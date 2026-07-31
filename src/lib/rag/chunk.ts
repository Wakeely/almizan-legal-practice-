// =============================================================================
// Al Mizan — text chunking for RAG ingest
// -----------------------------------------------------------------------------
// Goals:
//   - Produce chunks of roughly 500-800 tokens (we approximate tokens as
//     ~4 chars, which is accurate enough for English/Arabic legal text).
//   - Overlap each chunk by ~15% so retrieval can match a phrase that straddles
//     a boundary.
//   - Preserve page boundaries for transcripts — a chunk never spans two pages
//     because page numbers are first-class citations.
//   - Keep chunk metadata minimal (chunkIndex, pageNumber) so the citation
//     builder can construct "Document X, chunk N" / "Transcript, page P".
// =============================================================================

const TARGET_CHARS = 2000; // ~500 tokens at ~4 chars/token
const OVERLAP_CHARS = 300; // ~75 token overlap
const MIN_CHUNK_CHARS = 120; // don't emit tiny tail chunks — fold into previous

export interface ChunkSpec {
  content: string;
  chunkIndex: number;
  pageNumber?: number;
  tokenEstimate?: number;
}

/**
 * Split a long string into overlapping chunks. Page-agnostic — used for
 * document text where we don't have explicit page breaks.
 *
 * The algorithm is a simple sliding window with sentence-boundary preference:
 * we try to break at the last sentence-end punctuation before TARGET_CHARS,
 * falling back to a hard break if no sentence end is found.
 */
export function chunkText(rawText: string): ChunkSpec[] {
  const text = rawText.replace(/\r\n/g, "\n").trim();
  if (!text) return [];

  const chunks: ChunkSpec[] = [];
  let pos = 0;
  let chunkIndex = 0;

  while (pos < text.length) {
    let end = Math.min(pos + TARGET_CHARS, text.length);

    // Prefer to break at the last sentence boundary within the window.
    if (end < text.length) {
      const window = text.slice(pos, end);
      // Arabic + English sentence ends: . ! ? ؛ ؟
      const lastSentenceEnd = Math.max(
        window.lastIndexOf(". "),
        window.lastIndexOf("! "),
        window.lastIndexOf("? "),
        window.lastIndexOf("؟ "),
        window.lastIndexOf("؛ "),
        window.lastIndexOf("\n\n"),
      );
      if (lastSentenceEnd > TARGET_CHARS * 0.5) {
        end = pos + lastSentenceEnd + 1;
      }
    }

    const content = text.slice(pos, end).trim();
    if (content) {
      chunks.push({
        content,
        chunkIndex,
        tokenEstimate: Math.ceil(content.length / 4),
      });
      chunkIndex++;
    }

    if (end >= text.length) break;
    // Step back by OVERLAP_CHARS so the next chunk overlaps the previous one.
    pos = Math.max(pos + 1, end - OVERLAP_CHARS);

    // If the tail is shorter than MIN_CHUNK_CHARS, fold it into the last chunk.
    if (text.length - pos < MIN_CHUNK_CHARS && chunks.length > 0) {
      const tail = text.slice(pos).trim();
      if (tail) {
        chunks[chunks.length - 1].content += "\n" + tail;
        chunks[chunks.length - 1].tokenEstimate =
          Math.ceil(chunks[chunks.length - 1].content.length / 4);
      }
      break;
    }
  }

  return chunks;
}

/**
 * Split transcript pages into chunks. Each chunk belongs to exactly one page
 * (we never merge across pages — page number is a primary citation). If a
 * single page's text exceeds TARGET_CHARS, it is split into multiple chunks
 * that all carry the same pageNumber.
 *
 * Speaker is prepended to each chunk so the model sees who said what.
 */
export function chunkTranscriptPages(
  pages: Array<{ pageNumber: number; speaker: string; text: string }>,
): ChunkSpec[] {
  const chunks: ChunkSpec[] = [];
  let chunkIndex = 0;

  for (const page of pages) {
    const pageText = `${page.speaker}: ${page.text}`.trim();
    if (!pageText) continue;

    if (pageText.length <= TARGET_CHARS) {
      chunks.push({
        content: pageText,
        chunkIndex,
        pageNumber: page.pageNumber,
        tokenEstimate: Math.ceil(pageText.length / 4),
      });
      chunkIndex++;
      continue;
    }

    // Page is too long — split it with overlap, preserving pageNumber.
    const pageChunks = chunkText(pageText);
    for (const pc of pageChunks) {
      chunks.push({
        ...pc,
        chunkIndex,
        pageNumber: page.pageNumber,
      });
      chunkIndex++;
    }
  }

  return chunks;
}
