// =============================================================================
// Al Mizan Legal Practice — file storage service
// -----------------------------------------------------------------------------
// SIMPLIFIED: Always store files in the DB (fileContent column).
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
  fileContent: Uint8Array<ArrayBuffer> | null;
  fileMimeType: string;
  fileSize: number;
}

export async function storeFile(
  filename: string,
  fileBuffer: Uint8Array<ArrayBuffer>,
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

export async function retrieveFile(
  blobUrl: string | null,
  fileContent: Uint8Array<ArrayBuffer> | null,
  fileMimeType: string | null,
): Promise<{ buffer: Uint8Array<ArrayBuffer>; mimeType: string }> {
  if (fileContent) {
    return {
      buffer: fileContent,
      mimeType: fileMimeType ?? "application/octet-stream",
    };
  }

  if (blobUrl) {
    const BLOB_TOKEN = process.env.BLOB_READ_WRITE_TOKEN;
    if (BLOB_TOKEN) {
      try {
        const { download } = await import("@vercel/blob");
        const blob = await download(blobUrl);
        const arrayBuffer = await blob.arrayBuffer();
        return {
          buffer: new Uint8Array(arrayBuffer),
          mimeType: fileMimeType ?? blob.type ?? "application/octet-stream",
        };
      } catch (err1: any) {
        console.error("[file-storage] Blob download() failed:", err1?.message ?? err1);
      }

      try {
        const response = await fetch(blobUrl, {
          headers: { Authorization: `Bearer ${BLOB_TOKEN}` },
        });
        if (response.ok) {
          const arrayBuffer = await response.arrayBuffer();
          return {
            buffer: new Uint8Array(arrayBuffer),
            mimeType: fileMimeType ?? response.headers.get("content-type") ?? "application/octet-stream",
          };
        }
      } catch (err2: any) {
        console.error("[file-storage] Blob raw fetch failed:", err2?.message ?? err2);
      }
    }
  }

  throw new Error("File content not found in database.");
}

export async function deleteFile(blobUrl: string | null): Promise<void> {
}

export function isBlobConfigured(): boolean {
  return !!process.env.BLOB_READ_WRITE_TOKEN;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
