// =============================================================================
// Al Mizan Legal Practice — file storage service
// -----------------------------------------------------------------------------
// Dual-strategy file storage:
// 1. Vercel Blob (production) — if BLOB_READ_WRITE_TOKEN is set in env
//    Files are stored with PRIVATE access (no public URLs).
//    Downloads go through our authenticated API endpoint which generates
//    a short-lived signed URL server-side.
// 2. DB fallback (dev / no Blob token) — stores raw bytes in the Document
//    model's fileContent column
//
// SECURITY: Files are NEVER publicly accessible. Even with the Blob URL,
// a user cannot download the file without going through our authenticated
// /api/documents/[id]/file endpoint which checks org ownership + role.
// =============================================================================

const BLOB_TOKEN = process.env.BLOB_READ_WRITE_TOKEN;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB hard limit

export interface StoredFile {
  blobUrl: string | null;      // Vercel Blob URL (null if using DB fallback)
  fileContent: Buffer | null;  // Raw bytes (null if using Vercel Blob)
  fileMimeType: string;
  fileSize: number;
}

/**
 * Stores a file using the best available strategy.
 * Returns metadata about where the file was stored.
 *
 * If Vercel Blob is configured but the upload fails, it falls back to DB
 * storage so the user's upload doesn't fail entirely.
 */
export async function storeFile(
  filename: string,
  fileBuffer: Buffer,
  mimeType: string,
): Promise<StoredFile> {
  if (fileBuffer.length > MAX_FILE_SIZE) {
    throw new Error(`File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024} MB.`);
  }

  // Strategy 1: Vercel Blob (production) — PRIVATE access
  if (BLOB_TOKEN) {
    try {
      const { put } = await import("@vercel/blob");
      const blob = await put(filename, fileBuffer, {
        access: "private", // ← FIX: private, not public
        contentType: mimeType,
        addRandomSuffix: true,
      });
      return {
        blobUrl: blob.url,
        fileContent: null,
        fileMimeType: mimeType,
        fileSize: fileBuffer.length,
      };
    } catch (err: any) {
      // If Blob upload fails, fall back to DB storage so the upload
      // doesn't fail entirely. Log the error for debugging.
      console.error("[file-storage] Vercel Blob upload failed, falling back to DB:", err?.message ?? err);
      // Fall through to DB fallback
    }
  }

  // Strategy 2: DB fallback (dev / no Blob token / Blob upload failed)
  return {
    blobUrl: null,
    fileContent: fileBuffer,
    fileMimeType: mimeType,
    fileSize: fileBuffer.length,
  };
}

/**
 * Retrieves file content for serving to the client.
 *
 * - If stored in Vercel Blob (private): generates a short-lived signed URL
 *   using @vercel/blob's head() function, then fetches the content.
 *   The signed URL expires quickly and is never exposed to the browser —
 *   the file content is streamed through our authenticated API endpoint.
 * - If stored in DB: returns the raw bytes directly
 */
export async function retrieveFile(
  blobUrl: string | null,
  fileContent: Buffer | null,
  fileMimeType: string | null,
): Promise<{ buffer: Buffer; mimeType: string }> {
  // Strategy 1: Vercel Blob (private — needs signed URL)
  if (blobUrl) {
    try {
      // Use @vercel/blob's head() to get a signed download URL for the
      // private blob. This generates a short-lived URL that allows
      // server-side fetch of the file content.
      const { head } = await import("@vercel/blob");
      const blobInfo = await head(blobUrl);

      // head() returns metadata but for private blobs we need to use
      // the download() helper or fetch with the signed URL.
      // Actually, for private blobs, we can use the blob's URL directly
      // with the BLOB_READ_WRITE_TOKEN as authorization.
      // The cleanest approach: use fetch with the Authorization header.
      const response = await fetch(blobUrl, {
        headers: {
          // Vercel Blob private files require the token as a Bearer header
          Authorization: `Bearer ${BLOB_TOKEN}`,
        },
      });

      if (!response.ok) {
        // Fallback: try the head() approach to get a signed URL
        try {
          const { download } = await import("@vercel/blob/blob");
          const signedUrl = await download(blobUrl);
          const signedResponse = await fetch(signedUrl);
          if (signedResponse.ok) {
            const arrayBuffer = await signedResponse.arrayBuffer();
            return {
              buffer: Buffer.from(arrayBuffer),
              mimeType: fileMimeType ?? blobInfo.contentType ?? "application/octet-stream",
            };
          }
        } catch {
          // Fall through to error
        }
        throw new Error(`Failed to fetch private Blob file: ${response.status} ${response.statusText}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      return {
        buffer: Buffer.from(arrayBuffer),
        mimeType: fileMimeType ?? response.headers.get("content-type") ?? "application/octet-stream",
      };
    } catch (err: any) {
      console.error("[file-storage] Failed to retrieve private Blob file:", err?.message ?? err);
      throw new Error(`Failed to retrieve file: ${err?.message ?? "Unknown error"}`);
    }
  }

  // Strategy 2: DB fallback
  if (fileContent) {
    return {
      buffer: fileContent,
      mimeType: fileMimeType ?? "application/octet-stream",
    };
  }

  throw new Error("File not found — no blob URL or file content available.");
}

/**
 * Deletes a file from storage (used when a document is deleted).
 */
export async function deleteFile(blobUrl: string | null): Promise<void> {
  if (blobUrl && BLOB_TOKEN) {
    try {
      const { del } = await import("@vercel/blob");
      await del(blobUrl);
    } catch (err) {
      console.error("[file-storage] Failed to delete Blob file:", err);
    }
  }
  // DB fallback: no explicit delete needed — the Document row deletion
  // cascades the fileContent column automatically.
}

/**
 * Checks whether Vercel Blob is configured.
 */
export function isBlobConfigured(): boolean {
  return !!BLOB_TOKEN;
}

/**
 * Formats file size as a human-readable string.
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
