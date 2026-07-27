// =============================================================================
// Al Mizan Legal Practice — file storage service
// -----------------------------------------------------------------------------
// Dual-strategy file storage:
// 1. Vercel Blob (production) — if BLOB_READ_WRITE_TOKEN is set in env
//    Files are stored with PRIVATE access (no public URLs).
// 2. DB fallback (dev / no Blob token) — stores raw bytes in the Document
//    model's fileContent column
// =============================================================================

const BLOB_TOKEN = process.env.BLOB_READ_WRITE_TOKEN;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB hard limit

export interface StoredFile {
  blobUrl: string | null;
  fileContent: Buffer | null;
  fileMimeType: string;
  fileSize: number;
}

/**
 * Stores a file using the best available strategy.
 */
export async function storeFile(
  filename: string,
  fileBuffer: Buffer,
  mimeType: string,
): Promise<StoredFile> {
  if (fileBuffer.length > MAX_FILE_SIZE) {
    throw new Error(`File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024} MB.`);
  }

  if (BLOB_TOKEN) {
    try {
      const { put } = await import("@vercel/blob");
      const blob = await put(filename, fileBuffer, {
        access: "private",
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
      console.error("[file-storage] Vercel Blob upload failed, falling back to DB:", err?.message ?? err);
    }
  }

  return {
    blobUrl: null,
    fileContent: fileBuffer,
    fileMimeType: mimeType,
    fileSize: fileBuffer.length,
  };
}

/**
 * Retrieves file content for serving through our authenticated API.
 *
 * For private Vercel Blob files, we try multiple strategies:
 * 1. @vercel/blob's download() — handles auth internally
 * 2. Raw fetch with Authorization header
 * 3. If both fail, the file might have been stored in DB (fallback during upload)
 */
export async function retrieveFile(
  blobUrl: string | null,
  fileContent: Buffer | null,
  fileMimeType: string | null,
): Promise<{ buffer: Buffer; mimeType: string }> {
  // Strategy 1: Vercel Blob (private)
  if (blobUrl) {
    // Try 1: @vercel/blob download()
    try {
      const { download } = await import("@vercel/blob");
      const blob = await download(blobUrl);
      const arrayBuffer = await blob.arrayBuffer();
      return {
        buffer: Buffer.from(arrayBuffer),
        mimeType: fileMimeType ?? blob.type ?? "application/octet-stream",
      };
    } catch (err1: any) {
      console.error("[file-storage] download() failed:", err1?.message ?? err1);
    }

    // Try 2: Raw fetch with Authorization header
    try {
      const response = await fetch(blobUrl, {
        headers: {
          Authorization: `Bearer ${BLOB_TOKEN}`,
        },
      });
      if (response.ok) {
        const arrayBuffer = await response.arrayBuffer();
        return {
          buffer: Buffer.from(arrayBuffer),
          mimeType: fileMimeType ?? response.headers.get("content-type") ?? "application/octet-stream",
        };
      }
      console.error("[file-storage] raw fetch failed:", response.status, response.statusText);
    } catch (err2: any) {
      console.error("[file-storage] raw fetch error:", err2?.message ?? err2);
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
 * Deletes a file from storage.
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
}

export function isBlobConfigured(): boolean {
  return !!BLOB_TOKEN;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
