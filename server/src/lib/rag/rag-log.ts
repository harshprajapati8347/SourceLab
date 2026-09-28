/**
 * Extra structured logs for retrieval failures.
 *
 * The readable step log, including rewritten queries and passages, is printed
 * from `rag-trace.ts`.
 */

/**
 * Writes one JSON log line for a RAG failure or fallback.
 *
 * @param event - Stage name such as "classification" or "quality"
 * @param fields - Flags for the failure. Omit raw passage text here
 */
export function logRagEvent(event: string, fields: Record<string, unknown>) {
  console.info(`[rag] ${event} → ${JSON.stringify(fields)}`);
}
