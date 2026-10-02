/**
 * Step-by-step trace for one chat retrieval.
 *
 * Each update is printed to the server console and can be streamed to the client.
 * The text is intentional: rewritten queries, passages, and chunk labels are the
 * values needed to debug a turn.
 */

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
 * Whether the chat UI should receive the pipeline trace.
 *
 * Unset or any value other than `true` keeps the trace on the server only.
 */
export function isRagTraceEnabled() {
  return process.env.RAG_TRACE_ENABLED === "true";
}

/**
 * Collects pipeline steps, logs each one, and notifies a listener with a snapshot.
 *
 * @param onChange - Called with a copy of the trace after every step
 * @returns Helpers that record steps and read the current trace
 */
export function createRagTrace(onChange?: (trace: RagTrace) => void) {
  const steps: RagTraceStep[] = [];

  function snapshot(): RagTrace {
    return {
      steps: steps.map((step) => ({
        ...step,
        lines: [...step.lines],
      })),
    };
  }

  function step(next: RagTraceStep) {
    const index = steps.findIndex((item) => item.id === next.id);
    if (index === -1) {
      steps.push(next);
    } else {
      steps[index] = next;
    }

    logTraceStep(next);
    onChange?.(snapshot());
  }

  return { step, snapshot };
}

export type RagTraceRecorder = ReturnType<typeof createRagTrace>;

/**
 * Prints one pipeline step as readable console lines.
 *
 * @param step - Step that was just recorded
 */
export function logTraceStep(step: RagTraceStep) {
  const status = step.status === "active" ? "started" : step.summary;
  console.info(`[rag] ${step.label} → ${status}`);

  if (step.status === "done") {
    for (const line of step.lines) {
      console.info(`[rag]   ${line}`);
    }
  }
}
