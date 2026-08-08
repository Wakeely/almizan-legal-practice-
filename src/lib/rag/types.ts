// =============================================================================
// Al Mizan — RAG shared types
// -----------------------------------------------------------------------------
// All types that cross the lib boundary (retrieve → answer → API → UI) live
// here. Keeping them in one file makes the citation contract explicit.
// =============================================================================

/** Source type for a retrieved chunk. */
export type SourceType = "statute" | "document" | "transcript";

/** A single retrieved chunk with its similarity score and provenance. */
export interface RetrievedChunk {
  /** Chunk row id (DocumentChunk.id or LegalCorpus.id). */
  chunkId: string;
  type: SourceType;

  // --- statute fields (only set when type === "statute") ---
  lawName?: string;
  lawType?: string;
  articleNumber?: string;
  title?: string;
  year?: number;
  sourceUrl?: string;

  // --- document / transcript fields ---
  documentId?: string;
  documentName?: string;
  transcriptId?: string;
  pageNumber?: number;
  chunkIndex?: number;

  /** The chunk text shown to the model and (truncated) to the user. */
  content: string;

  /** Cosine similarity 0..1 from pgvector. Undefined in dev fallback. */
  similarity?: number;
}

/** A citation as returned in the API response. Stripped of internal fields. */
export interface Citation {
  type: SourceType;
  lawName?: string;
  lawType?: string;
  articleNumber?: string;
  title?: string;
  year?: number;
  sourceUrl?: string;
  documentId?: string;
  documentName?: string;
  transcriptId?: string;
  pageNumber?: number;
  chunkIndex?: number;
  excerpt: string;
  chunkId?: string;
  /** Model-assigned confidence 0..1 (heuristic; not a similarity score). */
  confidence?: number;
}

/** The canonical RAG answer shape. The API returns exactly this object. */
export interface RagAnswer {
  answer: string;
  sources: Citation[];
  /** True when at least one source was retrieved AND used in the answer. */
  grounded: boolean;
  /** True when retrieval returned nothing useful (model refused). */
  noSources: boolean;
  /** Number of matter chunks retrieved. */
  matterHits: number;
  /** Number of corpus articles retrieved. */
  corpusHits: number;
  disclaimer: string;
  /** Lang the answer was generated in. */
  lang: "ar" | "en";
  /** True when Gemini key was unset and a stub was returned. */
  _stub: boolean;
  /** True when vector search was unavailable (SQLite dev) and text fallback ran. */
  _textFallback: boolean;
}

/** Options for the answer pipeline. */
export interface AnswerOptions {
  matterId: string;
  question: string;
  organizationId: string;
  lang?: "ar" | "en";
  /** Include Jordanian corpus in retrieval. Default true. */
  includeCorpus?: boolean;
  /** Include matter chunks in retrieval. Default true. */
  includeMatter?: boolean;
  /** Top-k matter chunks to retrieve. Default 4. */
  matterTopK?: number;
  /** Top-k corpus articles to retrieve. Default 4. */
  corpusTopK?: number;
}

/** Ingest input — what ingest.ts expects from the caller. */
export interface IngestDocumentInput {
  organizationId: string;
  matterId: string;
  documentId: string;
  /** Raw text to chunk. Caller is responsible for extracting from file. */
  text: string;
  documentName?: string;
}

export interface IngestTranscriptInput {
  organizationId: string;
  matterId: string;
  transcriptId: string;
  /** Pages already split by the caller; ingest preserves page boundaries. */
  pages: Array<{
    pageNumber: number;
    speaker: string;
    text: string;
  }>;
}
