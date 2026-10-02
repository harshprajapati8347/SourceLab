/**
 * Detects a question the notebook does not answer, and the reply that offers a next step.
 */

import { RAG_TOPIC_COVERAGE_FLOOR } from "../ai-config.js";

const LEADING_QUESTION = [
  /^(?:please\s+)?(?:can you\s+|could you\s+|would you\s+)?(?:please\s+)?(?:explain|describe|define|summarize|outline|tell me about|talk about|give me an overview of)\s+/i,
  /^(?:what|who)\s+(?:is|are|was|were)\s+/i,
  /^(?:what|who)\s+(?:does|do)\s+/i,
  /^how\s+(?:does|do|is|are|can|could)\s+/i,
  /^why\s+(?:is|are|does|do)\s+/i,
  /^what\s+about\s+/i,
];

const TERM_STOPWORDS = new Set([
  "what",
  "when",
  "where",
  "which",
  "who",
  "whom",
  "whose",
  "why",
  "how",
  "does",
  "did",
  "are",
  "was",
  "were",
  "the",
  "and",
  "for",
  "with",
  "from",
  "that",
  "this",
  "your",
  "about",
  "into",
  "have",
  "has",
  "can",
  "could",
  "would",
  "should",
  "please",
  "explain",
  "describe",
  "define",
  "tell",
  "something",
  "there",
  "their",
  "them",
  "they",
  "you",
  "any",
  "some",
  "main",
  "key",
  "between",
  "difference",
  "compare",
  "versus",
  "overview",
  "summary",
  "summarize",
]);

const AFFIRMATIVE =
  /^(?:yes|yeah|yep|yup|sure|ok|okay|please|go ahead|do it|do that|sounds good)(?:[,!]?\s+(?:please|do it|go ahead|search(?: the web)?|do the research|research it))*[.!]?$/i;

const RESEARCH_OFFER =
  /Would you like me to perform web research on ([^?\n]+)\?/g;

/**
 * Coverage this low means the passages do not answer the question.
 *
 * @param coverage - Judged coverage from 0 to 1
 * @returns Whether the topic should be treated as missing from the sources
 */
export function sourcesMissTopic(coverage: number) {
  return coverage < RAG_TOPIC_COVERAGE_FLOOR;
}

/**
 * True when the question names at least two content words and none of them appear in the passages.
 *
 * A single word such as "ideas" is ignored so broad questions still use the coverage score.
 *
 * @param question - Latest user message
 * @param texts - Passage text already retrieved
 * @returns Whether the sources lexically miss the asked topic
 */
export function questionTermsMissing(question: string, texts: string[]) {
  const terms = question
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 3 && !TERM_STOPWORDS.has(word));

  if (terms.length < 2) {
    return false;
  }

  const haystack = texts.join("\n").toLowerCase();
  return terms.every((term) => !haystack.includes(term));
}

/**
 * Turns a user question into a short topic label.
 *
 * @param question - Latest user message
 * @returns A label such as "Software Engineering"
 */
export function topicFromQuestion(question: string) {
  const original = question.replace(/\s+/g, " ").trim().replace(/[?.!]+$/g, "");
  let topic = original;

  for (const pattern of LEADING_QUESTION) {
    if (pattern.test(topic)) {
      topic = topic.replace(pattern, "");
      break;
    }
  }

  topic = topic
    .replace(/^(?:a|an|the)\s+/i, "")
    .replace(/\s+work$/i, "")
    .trim();

  if (!topic) {
    topic = original;
  }

  return topic.charAt(0).toUpperCase() + topic.slice(1);
}

/**
 * Builds a short focus phrase from source titles when the model does not return one.
 *
 * @param titles - Ready source titles
 * @returns A phrase such as "AI", or null when there are no titles
 */
export function focusFromTitles(titles: string[]) {
  const unique: string[] = [];

  for (const title of titles) {
    const cleaned = title.replace(/\s+/g, " ").trim();
    if (!cleaned) {
      continue;
    }

    if (unique.some((item) => item.toLowerCase() === cleaned.toLowerCase())) {
      continue;
    }

    unique.push(cleaned);
  }

  if (unique.length === 0) {
    return null;
  }

  if (unique.length === 1) {
    return unique[0] ?? null;
  }

  if (unique.length === 2) {
    return `${unique[0]} and ${unique[1]}`;
  }

  return `${unique[0]}, ${unique[1]}, and ${unique[2]}`;
}

/**
 * Keeps a notebook-focus phrase short enough to sit in one reply.
 *
 * @param value - Model or title phrase
 * @returns A trimmed phrase, or null when it is empty
 */
export function normalizeFocus(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const focus = value.replace(/\s+/g, " ").trim().replace(/[.?!]+$/g, "");
  if (!focus) {
    return null;
  }

  if (focus.length <= 180) {
    return focus;
  }

  return `${focus.slice(0, 177).trim()}…`;
}

/**
 * Writes the reply used when the notebook does not cover the question.
 *
 * @param input - Topic label, notebook focus, and whether web search can run
 * @returns The user-facing gap reply
 */
export function buildUncoveredTopicReply(input: {
  topic: string;
  focus: string | null;
  webSearchEnabled: boolean;
}) {
  const topic = input.topic.trim() || "that topic";
  const focus = normalizeFocus(input.focus);
  const coverage = focus
    ? `Your sources don't seem to cover ${topic}. Your notebook currently focuses on ${focus}.`
    : `Your sources don't seem to cover ${topic}. This notebook doesn't have ready sources yet.`;
  const next = input.webSearchEnabled
    ? `Would you like me to perform web research on ${topic}?`
    : `Turn on Web search if you'd like me to research ${topic}.`;

  return `${coverage} ${next}`;
}

/**
 * Reads the topic from the latest web-research offer in the conversation.
 *
 * @param recentTurns - Role-labelled recent messages
 * @returns The offered topic, or null when no offer is present
 */
export function pendingWebResearchTopic(recentTurns: string) {
  const matches = [...recentTurns.matchAll(RESEARCH_OFFER)];
  const topic = matches.at(-1)?.[1]?.trim();
  return topic || null;
}

/**
 * Whether a short user reply accepts the web-research offer.
 *
 * @param text - Latest user message
 * @returns True for replies such as "yes" or "yes, search the web"
 */
export function acceptsWebResearch(text: string) {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized || normalized.length > 80) {
    return false;
  }

  return AFFIRMATIVE.test(normalized);
}
