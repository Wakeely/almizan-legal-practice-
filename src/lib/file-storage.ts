// =============================================================================
// Al Mizan Legal Practice — file storage service
// -----------------------------------------------------------------------------
// SIMPLIFIED: Always store files in the DB (fileContent column).
//
// This is the most reliable approach for the current stage — no external
// dependencies, no Blob token issues, no private/public access confusion.
// Files are stored as raw bytes in Postgres and served through the
// authenticated API endpoint.
//
// When the org grows to thousands of large files, this can be migrated to
// Vercel Blob by:
// 1. Adding BLOB_READ_WRITE_TOKEN to env
// 2. Changing storeFile to use Vercel Blob
// 3. Migrating existing files from DB to Blob
// =============================================================================

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB hard limit

export interface StoredFile {
  blobUrl: string | null;
  fileContent: Buffer | null;
  fileMimeType: string;
  fileSize: number;
}

/**
 * Stores a file — always in DB for reliability.
 * The file bytes go into the Document.fileContent column.
 */
export async function storeFile(
  filename: string,
  fileBuffer: Buffer,
  mimeType: string,
): Promise<StoredFile> {
  if (fileBuffer.length > MAX_FILE_SIZE) {
    throw new Error(`File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024} MB.`);
  }

  return {
    blobUrl: null,
    fileContent: fileBuffer,
    fileMimeType: mimeType,
    fileSize: fileBuffer.length,
  };
}

/**
 * Retrieves file content from the DB.
 */
export async function retrieveFile(
  blobUrl: string | null,
  fileContent: Buffer | null,
  fileMimeType: string | null,
): Promise<{ buffer: Buffer; mimeType: string }> {
  if (fileContent) {
    return {
      buffer: fileContent,
      mimeType: fileMimeType ?? "application/octet-stream",
    };
  }

  // If fileContent is null but blobUrl exists, try Vercel Blob as fallback
  // (for files that were uploaded when Blob was still being used)
  if (blobUrl) {
    const BLOB_TOKEN = process.env.BLOB_READ_WRITE_TOKEN;
    if (BLOB_TOKEN) {
      // Try @vercel/blob download()
      try {
        const { download } = await import("@vercel/blob");
        const blob = await download(blobUrl);
        const arrayBuffer = await blob.arrayBuffer();
        return {
          buffer: Buffer.from(arrayBuffer),
          mimeType: fileMimeType ?? blob.type ?? "application/octet-stream",
        };
      } catch (err1: any) {
        console.error("[file-storage] Blob download() failed:", err1?.message ?? err1);
      }

      // Try raw fetch with auth header
      try {
        const response = await fetch(blobUrl, {
          headers: { Authorization: `Bearer ${BLOB_TOKEN}` },
        });
        if (response.ok) {
          const arrayBuffer = await response.arrayBuffer();
          return {
            buffer: Buffer.from(arrayBuffer),
            mimeType: fileMimeType ?? response.headers.get("content-type") ?? "application/octet-stream",
          };
        }
      } catch (err2: any) {
        console.error("[file-storage] Blob raw fetch failed:", err2?.message ?? err2);
      }
    }
  }

  throw new Error("File content not found in database. The file may have been uploaded before the file storage columns were added.");
}

/**
 * Deletes a file from storage.
 */
export async function deleteFile(blobUrl: string | null): Promise<void> {
  // DB fallback: no explicit delete needed — the Document row deletion
  // cascades the fileContent column automatically.
  // Vercel Blob files (legacy) are cleaned up separately if needed.
}

export function isBlobConfigured(): boolean {
  return !!process.env.BLOB_READ_WRITE_TOKEN;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
