// =============================================================================
// POST /api/ai/rag/ingest — manually re-ingest a document or transcript
// -----------------------------------------------------------------------------
// Body:
//   { type: "document", documentId: string }
//   { type: "transcript", transcriptId: string }
//   { type: "matter", matterId: string }   // re-ingest ALL matter files
//
// Use cases:
//   - Re-embed after fixing the embedding model / pgvector setup.
//   - Re-ingest a document whose text changed (rare — uploads create new rows).
//   - Bulk re-ingest a matter after a corpus update changes chunking strategy.
//
// Security: same as /api/ai/rag — requireUser + org scope + rate limit + audit.
// The entity must belong to the user's org before ingest runs.
// =============================================================================

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser, orgWhere, verifyMatterBelongsToOrg } from "@/lib/org";
import { aiRateLimit, getClientIp } from "@/lib/rate-limit";
import { audit } from "@/lib/audit";
import { z } from "zod";
import { parseBody } from "@/lib/validation/auth";
import {
  ingestDocument,
  ingestTranscript,
  extractTextFromFile,
  buildDocumentMetadataText,
} from "@/lib/rag/ingest";
import { retrieveFile } from "@/lib/file-storage";

const ingestSchema = z.object({
  type: z.enum(["document", "transcript", "matter"]),
  documentId: z.string().optional(),
  transcriptId: z.string().optional(),
  matterId: z.string().optional(),
}).refine(
  (d) => {
    if (d.type === "document") return !!d.documentId;
    if (d.type === "transcript") return !!d.transcriptId;
    if (d.type === "matter") return !!d.matterId;
    return false;
  },
  { message: "documentId / transcriptId / matterId required based on type" },
);

export async function POST(req: Request) {
  const r = await requireUser();
  if (r.ok === false) return r.response;

  const ip = getClientIp(req);
  const limit = await aiRateLimit(ip, r.session.organizationId);
  if (!limit.ok) {
    return NextResponse.json(
      { error: "AI rate limit exceeded. Please retry shortly." },
      { status: 429, headers: { "Retry-After": String(Math.ceil(limit.retryAfterMs / 1000)) } },
    );
  }

  const body = await req.json().catch((): null => null);
  const parsed = parseBody(ingestSchema, body);
  if (parsed.ok === false) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const data = parsed.data;

  // --- Document -----------------------------------------------------------
  if (data.type === "document") {
    const doc = await db.document.findFirst({
      where: { id: data.documentId!, ...orgWhere(r.session) },
      include: { matter: { select: { id: true } } },
    });
    if (!doc) return NextResponse.json({ error: "Document not found" }, { status: 404 });

    // Extract text from stored file (text/* only for now; PDF/DOCX is a TODO).
    let text = "";
    if (doc.fileContent || doc.blobUrl) {
      try {
        const file = await retrieveFile(doc.blobUrl, doc.fileContent, doc.fileMimeType);
          text = await extractTextFromFile(file.buffer, file.mimeType, doc.name);
      } catch (err: any) {
        console.warn("[rag/ingest] could not read file:", err?.message ?? err);
      }
    }
    // Fall back to metadata text if file parsing yielded nothing.
    if (!text.trim()) {
      const tags = doc.aiTags ? (() => { try { return JSON.parse(doc.aiTags) as string[]; } catch { return []; } })() : [];
      text = buildDocumentMetadataText({
        name: doc.name,
        category: doc.category,
        aiSummary: doc.aiSummary,
        aiTags: tags,
      });
    }

    const result = await ingestDocument({
      organizationId: r.session.organizationId,
      matterId: doc.matterId,
      documentId: doc.id,
      text,
      documentName: doc.name,
    });

    await audit({
      action: "ai.rag.ingest",
      entity: "document",
      entityId: doc.id,
      matterId: doc.matterId,
      details: {
        trigger: "manual",
        chunksCreated: result.chunksCreated,
        embeddingsWritten: result.embeddingsWritten,
        embeddingSkipped: result.embeddingSkipped,
      },
    }, req);

    return NextResponse.json({ ok: true, ...result });
  }

  // --- Transcript ---------------------------------------------------------
  if (data.type === "transcript") {
    const transcript = await db.depositionTranscript.findFirst({
      where: { id: data.transcriptId!, ...orgWhere(r.session) },
      include: { pages: { orderBy: { pageNumber: "asc" } } },
    });
    if (!transcript) return NextResponse.json({ error: "Transcript not found" }, { status: 404 });

    const result = await ingestTranscript({
      organizationId: r.session.organizationId,
      matterId: transcript.matterId,
      transcriptId: transcript.id,
      pages: transcript.pages.map((p) => ({
        pageNumber: p.pageNumber,
        speaker: p.speaker,
        text: p.text,
      })),
    });

    await audit({
      action: "ai.rag.ingest",
      entity: "depositionTranscript",
      entityId: transcript.id,
      matterId: transcript.matterId,
      details: {
        trigger: "manual",
        chunksCreated: result.chunksCreated,
        embeddingsWritten: result.embeddingsWritten,
        embeddingSkipped: result.embeddingSkipped,
      },
    }, req);

    return NextResponse.json({ ok: true, ...result });
  }

  // --- Matter (bulk) ------------------------------------------------------
  if (data.type === "matter") {
    const owns = await verifyMatterBelongsToOrg(data.matterId!, r.session);
    if (!owns) return NextResponse.json({ error: "Matter not found" }, { status: 404 });

    const [docs, transcripts] = await Promise.all([
      db.document.findMany({
        where: { matterId: data.matterId!, ...orgWhere(r.session) },
        include: { matter: { select: { id: true } } },
      }),
      db.depositionTranscript.findMany({
        where: { matterId: data.matterId!, ...orgWhere(r.session) },
        include: { pages: { orderBy: { pageNumber: "asc" } } },
      }),
    ]);

    let totalChunks = 0;
    let totalEmbeddings = 0;
    let embeddingSkipped = false;

    for (const doc of docs) {
      let text = "";
      if (doc.fileContent || doc.blobUrl) {
        try {
          const file = await retrieveFile(doc.blobUrl, doc.fileContent, doc.fileMimeType);
        text = await extractTextFromFile(file.buffer, file.mimeType, doc.name);
        } catch { /* ignore */ }
      }
      if (!text.trim()) {
        const tags = doc.aiTags ? (() => { try { return JSON.parse(doc.aiTags) as string[]; } catch { return []; } })() : [];
        text = buildDocumentMetadataText({
          name: doc.name,
          category: doc.category,
          aiSummary: doc.aiSummary,
          aiTags: tags,
        });
      }
      const result = await ingestDocument({
        organizationId: r.session.organizationId,
        matterId: doc.matterId,
        documentId: doc.id,
        text,
        documentName: doc.name,
      });
      totalChunks += result.chunksCreated;
      totalEmbeddings += result.embeddingsWritten;
      if (result.embeddingSkipped) embeddingSkipped = true;
    }

    for (const t of transcripts) {
      const result = await ingestTranscript({
        organizationId: r.session.organizationId,
        matterId: t.matterId,
        transcriptId: t.id,
        pages: t.pages.map((p) => ({
          pageNumber: p.pageNumber,
          speaker: p.speaker,
          text: p.text,
        })),
      });
      totalChunks += result.chunksCreated;
      totalEmbeddings += result.embeddingsWritten;
      if (result.embeddingSkipped) embeddingSkipped = true;
    }

    await audit({
      action: "ai.rag.ingest",
      entity: "matter",
      entityId: data.matterId!,
      matterId: data.matterId!,
      details: {
        trigger: "manual-bulk",
        documentsProcessed: docs.length,
        transcriptsProcessed: transcripts.length,
        chunksCreated: totalChunks,
        embeddingsWritten: totalEmbeddings,
        embeddingSkipped,
      },
    }, req);

    return NextResponse.json({
      ok: true,
      documentsProcessed: docs.length,
      transcriptsProcessed: transcripts.length,
      chunksCreated: totalChunks,
      embeddingsWritten: totalEmbeddings,
      embeddingSkipped,
    });
  }

  return NextResponse.json({ error: "Invalid type" }, { status: 400 });
}
