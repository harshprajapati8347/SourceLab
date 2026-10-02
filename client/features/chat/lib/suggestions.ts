/**
 * Reads the follow-up questions attached to one assistant reply.
 *
 * @param value - A streamed `data-suggestions` payload or a stored message field
 * @returns At most three non-empty questions
 */
export function parseSuggestions(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const questions: string[] = [];

  for (const item of value) {
    if (typeof item !== "string") {
      continue;
    }

    const question = item.replace(/\s+/g, " ").trim();
    if (!question || questions.includes(question)) {
      continue;
    }

    questions.push(question);
    if (questions.length === 3) {
      break;
    }
  }

  return questions;
}
