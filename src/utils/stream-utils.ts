import { progressFactory, type ProgressToken } from "../progress/index.js";

/** Default number of rows per streaming chunk */
export const STREAM_CHUNK_SIZE = 10;

/**
 * Stream query result rows to the client via MCP progress notifications.
 * Each chunk contains a JSON-serialized array of rows.
 *
 * @param progressToken The MCP progress token
 * @param rows The full array of query result rows
 * @param chunkSize Optional custom chunk size (defaults to STREAM_CHUNK_SIZE)
 * @returns Number of chunks emitted
 */
export function streamResultRows(
  progressToken: ProgressToken,
  rows: Record<string, unknown>[],
  chunkSize: number = STREAM_CHUNK_SIZE,
): number {
  if (rows.length === 0) {
    return 0;
  }

  const effectiveChunkSize = Math.max(1, chunkSize);
  const totalChunks = Math.ceil(rows.length / effectiveChunkSize);
  
  const reporter = progressFactory.create(progressToken);
  if (!reporter) return 0;

  for (let i = 0; i < totalChunks; i++) {
    const start = i * effectiveChunkSize;
    const end = Math.min(start + effectiveChunkSize, rows.length);
    const chunk = rows.slice(start, end);

    // Send the chunk as the progress message payload
    reporter.report(i + 1, totalChunks, JSON.stringify(chunk));
  }

  return totalChunks;
}
