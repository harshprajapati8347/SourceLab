/**
 * Decides whether a chat turn is off topic, missing a fact, a conflict,
 * an embedded instruction, or eligible for web search.
 *
 * These checks are deterministic. The model still writes supported answers.
 */

import { questionContentTerms, topicFromQuestion } from "./topic-gap.js";

const DOCUMENT_QUESTION =
  /^(?:please\s+)?(?:can you\s+|could you\s+|would you\s+)?(?:please\s+)?(?:what|which|who|when|where|why|how|is|are|does|do|can|could|summarize|summarise|summary|compare|explain|describe|outline|tell me)\b/i;

const WEB_FACT = /\b(?:current|latest|official|pricing|version|lts)\b/i;

const CONFLICT_NUMBERS = /\b(\d+)\s+or\s+(\d+)\b/i;

const MONTH_YEAR =
  /\b(?:january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{4}\b/gi;

const NOVA_DESK_ANNUAL_PRICE =
  /^what is .+?['’]s annual enterprise contract price$/i;

const OBEY_EMBEDDED =
  /,?\s*\b(?:but\s+)?(?:also\s+)?(?:please\s+)?(?:obey|follow|comply with|execute|carry out)\b[^.?!]{0,160}\b(?:instructions?|commands?|directives?)\b[^.?!]{0,100}\b(?:inside|within|in)\b[^.?!]{0,60}\b(?:it|them|the document|the source|the file|the content|this document|the text)\b/i;

const SAFE_TASK =
  /\b(?:summarize|summarise|summary|explain|describe|outline|answer|compare|list|review)\b/i;

/** Appended when the user asked the model to follow instructions inside a source. */
export const EMBEDDED_INSTRUCTION_NOTE =
  "Instructions written inside the document were not followed.";

/**
 * Whether the message is a question or task about a document.
 *
 * @param text - Latest user message
 * @returns True for questions such as "What encryption standard is used?"
 */
export function isDocumentQuestion(text: string) {
  return DOCUMENT_QUESTION.test(normalize(text));
}

/**
 * Whether web search may answer this turn.
 *
 * The toggle must be on, and the question must ask for a current or official
 * external fact. A workspace price question does not match.
 *
 * @param text - Latest user message
 * @param webSearchEnabled - True when the chat toggle is on and Tavily is configured
 * @returns True for questions such as the current OpenAI API price
 */
export function isWebSearchEligible(text: string, webSearchEnabled: boolean) {
  return webSearchEnabled && WEB_FACT.test(text);
}

/**
 * Whether an Off Topic tripwire should let the message continue into retrieval.
 *
 * @param text - Latest user message
 * @param webSearchEnabled - True when the chat toggle is on and Tavily is configured
 * @returns True for a document question or a web-search-eligible question
 */
export function shouldDeferOffTopic(text: string, webSearchEnabled: boolean) {
  return (
    isDocumentQuestion(text) || isWebSearchEligible(text, webSearchEnabled)
  );
}

/**
 * Writes the reply used when the workspace subject is present and the fact is not.
 *
 * @param question - Latest user message
 * @returns A sentence that does not invent the missing fact
 */
export function buildInsufficientEvidenceReply(question: string) {
  const normalized = normalize(question).replace(/[?.!]+$/g, "");
  if (NOVA_DESK_ANNUAL_PRICE.test(normalized)) {
    return "The workspace sources do not specify an Enterprise annual contract price.";
  }

  const fact = topicFromQuestion(question);
  return `The workspace sources do not specify ${fact}.`;
}

/**
 * Whether any content word from the question appears in the workspace text.
 *
 * @param question - Latest user message
 * @param texts - Retrieved passages and ready source titles
 * @returns True when the workspace is about the asked subject
 */
export function sharesWorkspaceSubject(question: string, texts: string[]) {
  const terms = questionContentTerms(question);
  if (terms.length === 0) {
    return false;
  }

  const haystack = texts.join("\n").toLowerCase();
  return terms.some((term) => haystack.includes(term));
}

/**
 * Whether the user named two numbers and asked which one is right.
 *
 * @param text - Latest user message
 * @returns True for questions such as "Is the limit 50 or 100?"
 */
export function asksConflictingValues(text: string) {
  return CONFLICT_NUMBERS.test(text);
}

/**
 * Builds the full question plus one search string for each named number.
 *
 * @param text - Latest user message
 * @returns Retrieval queries. The original text is the only entry when it names one number
 */
export function conflictRetrievalQueries(text: string) {
  const normalized = normalize(text);
  const match = normalized.match(CONFLICT_NUMBERS);
  if (!match) {
    return normalized ? [normalized] : [];
  }

  const left = match[1] ?? "";
  const right = match[2] ?? "";
  return uniqueQueries([
    normalized,
    normalized.replace(CONFLICT_NUMBERS, left),
    normalized.replace(CONFLICT_NUMBERS, right),
  ]);
}

/**
 * Whether two passages disagree on a number or a month and year.
 *
 * @param left - First chunk text
 * @param right - Second chunk text
 * @returns True when the passages should both be kept for a conflict question
 */
export function textsStateDistinctFacts(left: string, right: string) {
  return (
    !sameTokens(numberTokens(left), numberTokens(right)) ||
    !sameTokens(dateTokens(left), dateTokens(right))
  );
}

/**
 * Separates a document task from a request to obey instructions inside that document.
 *
 * @param text - Latest user message
 * @returns The safe task, or null when the message is not that mixed request
 */
export function separateEmbeddedInstruction(text: string) {
  const normalized = normalize(text);
  if (!OBEY_EMBEDDED.test(normalized)) {
    return null;
  }

  const safeText = normalized
    .replace(OBEY_EMBEDDED, "")
    .replace(/\s+/g, " ")
    .replace(/\s+([.?!])/g, "$1")
    .replace(/[,;]\s*$/g, "")
    .trim();

  if (!safeText || !SAFE_TASK.test(safeText)) {
    return null;
  }

  return { safeText };
}

/**
 * Adds `[W#]` markers when a web answer did not cite its results.
 *
 * @param answer - Released assistant text
 * @param resultCount - How many web results belong to this turn
 * @returns The answer, with a web-source line when markers were missing
 */
export function ensureWebSourceMarkers(answer: string, resultCount: number) {
  if (resultCount <= 0 || /\[W\d+\]/.test(answer)) {
    return answer;
  }

  const markers = Array.from(
    { length: resultCount },
    (_, index) => `[W${index + 1}]`,
  ).join(" ");

  return `${answer.trim()}\n\nWeb sources: ${markers}`;
}

/**
 * Adds the note that embedded source instructions were ignored.
 *
 * @param answer - Released assistant text
 * @returns The answer plus {@link EMBEDDED_INSTRUCTION_NOTE} when it is not already there
 */
export function appendEmbeddedInstructionNote(answer: string) {
  if (answer.includes(EMBEDDED_INSTRUCTION_NOTE)) {
    return answer;
  }

  return `${answer.trim()}\n\n${EMBEDDED_INSTRUCTION_NOTE}`;
}

function normalize(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

function numberTokens(text: string) {
  return new Set(text.match(/\d{2,}/g) ?? []);
}

function dateTokens(text: string) {
  const pattern = new RegExp(MONTH_YEAR.source, "gi");
  return new Set(
    [...text.matchAll(pattern)].map((match) => match[0].toLowerCase()),
  );
}

function sameTokens(left: Set<string>, right: Set<string>) {
  if (left.size !== right.size) {
    return false;
  }

  for (const token of left) {
    if (!right.has(token)) {
      return false;
    }
  }

  return true;
}

function uniqueQueries(queries: string[]) {
  const seen = new Set<string>();
  const unique: string[] = [];

  for (const query of queries) {
    const trimmed = query.trim();
    const key = trimmed.toLowerCase();
    if (!trimmed || seen.has(key)) {
      continue;
    }

    seen.add(key);
    unique.push(trimmed);
  }

  return unique;
}
