// =============================================================================
// Al Mizan OCR Client Types
// =============================================================================

export interface OCRRequest {
  /** Raw file bytes */
  file: Uint8Array;
  /** Original filename (for format detection) */
  filename: string;
  /** MIME type of the file */
  mimeType: string;
  /** OCR engine to use: "auto", "paddle", or "unlimited" */
  engine?: "auto" | "paddle" | "unlimited";
  /** Document language: "ar" (Arabic), "en" (English), or "auto" */
  language?: "ar" | "en" | "auto";
}

export interface OCRResponse {
  /** Extracted text */
  text: string;
  /** Engine that was used for extraction */
  engineUsed: string;
  /** Number of pages processed */
  pagesProcessed: number;
  /** Detected language (if auto-detected) */
  languageDetected?: string;
}

export interface OCRHealthResponse {
  status: string;
  service: string;
  engines: string[];
}

export interface OCRBatchRequest {
  files: Array<{
    buffer: Uint8Array;
    filename: string;
    mimeType: string;
  }>;
  engine?: "auto" | "paddle" | "unlimited";
  language?: "ar" | "en" | "auto";
}

export interface OCRBatchResult {
  filename: string;
  text?: string;
  engineUsed?: string;
  pagesProcessed?: number;
  success: boolean;
  error?: string;
}

export interface OCRBatchResponse {
  results: OCRBatchResult[];
}
