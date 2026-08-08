// =============================================================================
// POST /api/client-portal/matters/[id]/documents/upload — client-side upload
// -----------------------------------------------------------------------------
// PRD v0.6 §4.2: a document upload path so the client can submit something
// the lawyer has requested (e.g. ID, evidence, a signed form), landing in
// that matter's documents, flagged so the lawyer can see it's client-submitted
// and not yet reviewed/marked visible.
//
// SECURITY (PRD §6):
// - verifyMatterBelongsToOrg + verifyMatterMatchesClientScope (the uploading
//   client must be invited to THIS specific matter, not just be in the right org).
// - uploadedBy is set to the client's name with a "(client)" suffix so the
//   lawyer can distinguish client-submitted docs from firm-uploaded ones.
// - visibleToClient starts FALSE — the lawyer reviews before it becomes visible
//   in the client portal (prevents the client from surfacing their own upload
//   to themselves accidentally, and gives the lawyer a review gate).
// - category is forced to "Client Submitted" so the lawyer can filter.
// =============================================================================

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser, verifyMatterBelongsToOrg, verifyMatterMatchesClientScope } from "@/lib/org";
import { storeFile, formatFileSize } from "@/lib/file-storage";
import { audit } from "@/lib/audit";
import { ensureFileColumns } from "@/lib/migrate-files";

const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/gif",
  "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
  "text/csv",
  "application/zip",
  "application/x-zip-compressed",
];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const r = await requireUser();
  if (r.ok === false) return r.response;
  const { id } = await params;

  // PRD v0.6 §6: client must be invited to THIS specific matter
  const owns = await verifyMatterBelongsToOrg(id, r.session);
  if (!owns) return NextResponse.json({ error: "Matter not found" }, { status: 404 });
  if (!verifyMatterMatchesClientScope(id, r.session)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Only Client Representatives can use this endpoint
  if (r.session.role !== "Client Representative") {
    return NextResponse.json(
      { error: "This endpoint is for client-submitted documents only. Firm users should use the main upload endpoint." },
      { status: 403 },
    );
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const name = (formData.get("name") as string | null)?.trim();

  if (!file) {
    return NextResponse.json({ error: "No file provided." }, { status: 400 });
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024} MB.` },
      { status: 413 },
    );
  }

  const mimeType = file.type || "application/octet-stream";
  if (file.type && !ALLOWED_MIME_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: `File type "${file.type}" is not allowed.` },
      { status: 415 },
    );
  }

  const arrayBuffer = await file.arrayBuffer();
  const fileBuffer = new Uint8Array(arrayBuffer);

  let stored;
  try {
    const fileName = name || file.name;
    stored = await storeFile(fileName, fileBuffer, mimeType);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }

  await ensureFileColumns();

  // Client-submitted docs: visibleToClient = false (lawyer reviews first),
  // category forced to "Client Submitted", uploadedBy tagged with "(client)".
  const doc = await db.document.create({
    data: {
      name: name || file.name,
      category: "Client Submitted",
      fileSize: formatFileSize(stored.fileSize),
      uploadedBy: `${r.session.name} (client)`,
      visibleToClient: false, // Lawyer must review + explicitly mark visible
      version: 1,
      matterId: id,
      organizationId: r.session.organizationId,
      blobUrl: stored.blobUrl,
      fileContent: stored.fileContent as Uint8Array<ArrayBuffer>,
      fileMimeType: stored.fileMimeType,
    },
  });

  await audit(
    {
      action: "client_portal.document_upload",
      entity: "document",
      entityId: doc.id,
      matterId: id,
      details: {
        name: doc.name,
        fileSize: doc.fileSize,
        mimeType,
        uploadedByClient: r.session.email,
      },
    },
    req,
  );

  return NextResponse.json(
    {
      ...doc,
      fileContent: undefined, // Never return raw bytes in JSON
    },
    { status: 201 },
  );
}
