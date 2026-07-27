// =============================================================================
// Al Mizan Legal Practice — file storage service
// -----------------------------------------------------------------------------
// Dual-strategy file storage:
// 1. Vercel Blob (production) — if BLOB_READ_WRITE_TOKEN is set in env
// 2. DB fallback (dev / no Blob token) — stores raw bytes in the Document
//    model's fileContent column
//
// The caller doesn't need to know which strategy is active — this module
// abstracts the choice and returns a consistent result.
//
// IMPORTANT: The @vercel/blob import is lazy (dynamic import inside the
// function) so the module doesn't crash on startup if the package isn't
// available or the token isn't set.
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

  // Strategy 1: Vercel Blob (production)
  if (BLOB_TOKEN) {
    try {
      // Lazy import so the module doesn't crash if @vercel/blob isn't installed
      const { put } = await import("@vercel/blob");
      const blob = await put(filename, fileBuffer, {
        access: "public",
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
 * - If stored in Vercel Blob: fetches from the Blob URL
 * - If stored in DB: returns the raw bytes directly
 */
export async function retrieveFile(
  blobUrl: string | null,
  fileContent: Buffer | null,
  fileMimeType: string | null,
): Promise<{ buffer: Buffer; mimeType: string }> {
  // Strategy 1: Vercel Blob
  if (blobUrl) {
    const response = await fetch(blobUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch file from Blob: ${response.status}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    return {
      buffer: Buffer.from(arrayBuffer),
      mimeType: fileMimeType ?? "application/octet-stream",
    };
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
