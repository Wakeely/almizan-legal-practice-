// =============================================================================
// Al Mizan OCR Client — Public API
// =============================================================================

export { extractTextWithOCR, extractTextBatch, checkOCRHealth } from "./client";

export type {
  OCRRequest,
  OCRResponse,
  OCRHealthResponse,
  OCRBatchRequest,
  OCRBatchResponse,
  OCRBatchResult,
} from "./types";
