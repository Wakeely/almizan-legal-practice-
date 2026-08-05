// =============================================================================
// Al Mizan OCR Client
// =============================================================================
// Calls the Python OCR service (PaddleOCR-VL) for document text extraction.
// The OCR service runs as a mini-service alongside the Next.js app.
// =============================================================================

import type {
  OCRRequest,
  OCRResponse,
  OCRHealthResponse,
  OCRBatchRequest,
  OCRBatchResponse,
} from "./types";

/**
 * OCR service URL. Defaults to localhost:8080 (the mini-service port).
 * Can be overridden via OCR_SERVICE_URL environment variable.
 */
const OCR_SERVICE_URL = process.env.OCR_SERVICE_URL || "http://localhost:8080";

/**
 * Timeout for OCR requests (in milliseconds).
 * PaddleOCR can be slow on large documents, so we use a generous timeout.
 */
const OCR_TIMEOUT_MS = 120_000; // 2 minutes

/**
 * Extract text from a document using the OCR service.
 *
 * @example
 * ```ts
 * const result = await extractTextWithOCR({
 *   file: Buffer.from(fileBytes),
 *   filename: "contract.pdf",
 *   mimeType: "application/pdf",
 *   language: "ar",
 * });
 * console.log(result.text); // Extracted Arabic text
 * ```
 */
export async function extractTextWithOCR(
  request: OCRRequest,
): Promise<OCRResponse> {
  const formData = new FormData();
  formData.append(
    "file",
    new Blob([request.file], { type: request.mimeType }),
    request.filename,
  );
  formData.append("engine", request.engine || "auto");
  formData.append("language", request.language || "ar");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), OCR_TIMEOUT_MS);

  try {
    const response = await fetch(`${OCR_SERVICE_URL}/ocr`, {
      method: "POST",
      body: formData,
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");
      throw new Error(
        `OCR service returned ${response.status}: ${errorText}`,
      );
    }

    return await response.json();
  } catch (err: any) {
    if (err.name === "AbortError") {
      throw new Error(
        `OCR request timed out after ${OCR_TIMEOUT_MS / 1000}s. The document may be too large.`,
      );
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Extract text from multiple documents in a single request.
 */
export async function extractTextBatch(
  request: OCRBatchRequest,
): Promise<OCRBatchResponse> {
  const formData = new FormData();

  for (const file of request.files) {
    formData.append(
      "files",
      new Blob([file.buffer], { type: file.mimeType }),
      file.filename,
    );
  }
  formData.append("engine", request.engine || "auto");
  formData.append("language", request.language || "ar");

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    OCR_TIMEOUT_MS * request.files.length,
  );

  try {
    const response = await fetch(`${OCR_SERVICE_URL}/ocr/batch`, {
      method: "POST",
      body: formData,
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");
      throw new Error(
        `OCR batch request returned ${response.status}: ${errorText}`,
      );
    }

    return await response.json();
  } catch (err: any) {
    if (err.name === "AbortError") {
      throw new Error(`OCR batch request timed out.`);
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Check if the OCR service is healthy and reachable.
 */
export async function checkOCRHealth(): Promise<OCRHealthResponse | null> {
  try {
    const response = await fetch(`${OCR_SERVICE_URL}/health`, {
      signal: AbortSignal.timeout(5000), // 5s timeout for health check
    });

    if (!response.ok) {
      return null;
    }

    return await response.json();
  } catch {
    return null;
  }
}
