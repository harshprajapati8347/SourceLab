export type RagTraceStep = {
  id: string;
  label: string;
  status: "active" | "done";
  summary: string;
  lines: string[];
};

export type RagTrace = {
  steps: RagTraceStep[];
};

/**
 * Reads a stored or streamed pipeline trace.
 *
 * @param value - JSON from a message `trace` column or a `data-rag` part
 * @returns The trace, or null when the value is not a trace
 */
export function parseRagTrace(value: unknown): RagTrace | null {
  if (!value || typeof value !== "object" || !("steps" in value)) {
    return null;
  }

  const steps = (value as { steps?: unknown }).steps;
  if (!Array.isArray(steps)) {
    return null;
  }

  const parsed: RagTraceStep[] = [];

  for (const step of steps) {
    if (!step || typeof step !== "object") {
      return null;
    }

    const record = step as Record<string, unknown>;
    if (
      typeof record.id !== "string" ||
      typeof record.label !== "string" ||
      typeof record.summary !== "string" ||
      (record.status !== "active" && record.status !== "done") ||
      !Array.isArray(record.lines) ||
      record.lines.some((line) => typeof line !== "string")
    ) {
      return null;
    }

    parsed.push({
      id: record.id,
      label: record.label,
      status: record.status,
      summary: record.summary,
      lines: record.lines,
    });
  }

  return { steps: parsed };
}
