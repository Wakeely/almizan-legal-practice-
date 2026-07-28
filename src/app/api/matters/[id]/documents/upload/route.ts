// =============================================================================
// POST /api/matters/[id]/documents/upload — real file upload
// -----------------------------------------------------------------------------
// Accepts multipart/form-data with:
//   - file: the uploaded file (Blob)
//   - name: document display name (optional — defaults to filename)
//   - category: document category (optional — defaults to "General")
//   - visibleToClient: "true" or "false" (optional — defaults to false)
//
// Stores the file using Vercel Blob (if configured) or DB fallback.
// Saves metadata in the Document table with organizationId scoping.
// =============================================================================

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser, verifyMatterBelongsToOrg } from "@/lib/org";
import { storeFile, formatFileSize } from "@/lib/file-storage";
import { audit } from "@/lib/audit";
import { getFullUserProfile } from "@/lib/session";
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
  if (!r.ok) return r.response;
  const { id } = await params;

  // Verify the matter belongs to the user's org
  const owns = await verifyMatterBelongsToOrg(id, r.session);
  if (!owns) return NextResponse.json({ error: "Matter not found" }, { status: 404 });

  // Parse multipart form data
  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const name = (formData.get("name") as string | null)?.trim();
  const category = (formData.get("category") as string | null)?.trim() || "General";
  const visibleToClient = formData.get("visibleToClient") === "true";

  if (!file) {
    return NextResponse.json({ error: "No file provided. Use 'file' field in multipart form data." }, { status: 400 });
  }

  // Validate file size
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024} MB.` },
      { status: 413 },
    );
  }

  // Validate MIME type (if the browser provides one)
  const mimeType = file.type || "application/octet-stream";
  if (file.type && !ALLOWED_MIME_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: `File type "${file.type}" is not allowed. Allowed: PDF, images, Office docs, text, ZIP.` },
      { status: 415 },
    );
  }

  // Read file into buffer
  const arrayBuffer = await file.arrayBuffer();
  const fileBuffer = Buffer.from(arrayBuffer);

  // Store the file (Vercel Blob or DB fallback)
  let stored;
  try {
    const fileName = name || file.name;
    stored = await storeFile(fileName, fileBuffer, mimeType);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }

  // Get the user's name for uploadedBy
  const userProfile = await getFullUserProfile();
  const uploadedBy = userProfile?.name ?? r.session.name ?? "Unknown";

  // Ensure the Document table has the file storage columns
  await ensureFileColumns();

  // Save document metadata + file content in DB
  const doc = await db.document.create({
    data: {
      name: name || file.name,
      category,
      fileSize: formatFileSize(stored.fileSize),
      uploadedBy,
      visibleToClient,
      version: 1,
      matterId: id,
      organizationId: r.session.organizationId,
      blobUrl: stored.blobUrl,
      fileContent: stored.fileContent,
      fileMimeType: stored.fileMimeType,
    },
  });

  await audit({
    action: "document.upload",
    entity: "document",
    entityId: doc.id,
    matterId: id,
    details: { name: doc.name, fileSize: doc.fileSize, mimeType, visibleToClient, storage: stored.blobUrl ? "blob" : "db" },
  }, req);

  return NextResponse.json({
    ...doc,
    aiTags: [],
    fileContent: undefined, // Don't return the raw bytes in the JSON response
  }, { status: 201 });
}
