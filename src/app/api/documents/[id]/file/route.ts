// =============================================================================
// GET /api/documents/[id]/file — download/view the actual file
// -----------------------------------------------------------------------------
// SECURITY:
// - Requires authentication (requireUser)
// - Verifies the document belongs to the user's org (orgWhere)
// - If the user is a Client Representative, only returns documents where
//   visibleToClient === true (server-side filter — never trusts the frontend)
// - Returns the file as a binary response with correct Content-Type
// =============================================================================

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser, orgWhere } from "@/lib/org";
import { retrieveFile } from "@/lib/file-storage";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const r = await requireUser();
  if (!r.ok) return r.response;
  const { id } = await params;

  // Fetch the document (org-scoped)
  const doc = await db.document.findFirst({
    where: { id, ...orgWhere(r.session) },
    select: {
      id: true,
      name: true,
      blobUrl: true,
      fileContent: true,
      fileMimeType: true,
      visibleToClient: true,
    },
  });

  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // SECURITY: If the user is a Client Representative, enforce visibleToClient
  // filter server-side — even if they somehow have the document ID, they
  // cannot download a file that isn't marked visibleToClient.
  if (r.session.role === "Client Representative" && !doc.visibleToClient) {
    return NextResponse.json({ error: "Forbidden — this document is not shared with clients" }, { status: 403 });
  }

  // Retrieve the file content
  try {
    const { buffer, mimeType } = await retrieveFile(doc.blobUrl, doc.fileContent, doc.fileMimeType);

    // Return as binary response with inline disposition (view in browser)
    // + Content-Disposition with filename for download
    const fileName = doc.name || "document";
    const encodedName = encodeURIComponent(fileName);

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": mimeType,
        "Content-Disposition": `inline; filename="${encodedName}"; filename*=UTF-8''${encodedName}`,
        "Content-Length": String(buffer.length),
        "Cache-Control": "private, no-cache, no-store, must-revalidate",
      },
    });
  } catch (err: any) {
    console.error("[file-download] Error retrieving file:", err?.message ?? err);
    return NextResponse.json(
      { error: "Failed to retrieve file. It may have been deleted from storage." },
      { status: 500 },
    );
  }
}
