/**
 * Decides when this chat turn may call Tavily, and what to say when it may not.
 *
 * Callers still choose the search path. This module is the check that runs
 * immediately before the provider, and the replies used when evidence is missing.
 */

import {
  keepUsableWebResults,
  searchWeb,
  type TavilySearchResponse,
} from "../tavily.js";
import { RAG_SUPPORTING_TERM_RATIO } from "../ai-config.js";
import {
  supportingTermRatio,
  buildUncoveredTopicReply,
  pendingWebResearchTopic,
  acceptsWebResearch,
  repeatsOfferedTopic,
} from "./topic-gap.js";

/** Thrown when a search is attempted without consent for this request. */
export class WebSearchNotAuthorizedError extends Error {
  constructor() {
    super("Web search is not authorized for this request");
    this.name = "WebSearchNotAuthorizedError";
  }
}

export type RetrievalDisposition = "answer" | "missing-fact" | "ask-web";

/**
 * Calls Tavily only when this request is allowed to search.
 *
 * @param input - Consent flag, query, and an optional search function for tests
 * @returns The provider response
 * @throws {WebSearchNotAuthorizedError} When `allowed` is false, before `search` runs
 */
export async function searchWebIfAllowed(input: {
  allowed: boolean;
  query: string;
  search?: (query: string) => Promise<TavilySearchResponse>;
}) {
  if (!input.allowed) {
    throw new WebSearchNotAuthorizedError();
  }

  const search = input.search ?? searchWeb;
  return search(input.query);
}

/**
 * Topic to research when the user just accepted the latest offer.
 *
 * A short yes authorizes that topic even if the toggle is off. Sending the
 * same topic again authorizes it only when the toggle is on. An older offer
 * does not apply once a later assistant turn has no offer.
 *
 * @param input - Latest user text, recent turns, and the toggle for this request
 * @returns The topic to search, or null when this request has no fresh consent
 */
export function acceptedResearchTopic(input: {
  userText: string;
  recentTurns: string;
  webSearchEnabled: boolean;
}) {
  const offered = pendingWebResearchTopic(input.recentTurns);
  if (!offered) {
    return null;
  }

  if (acceptsWebResearch(input.userText)) {
    return offered;
  }

  if (input.webSearchEnabled && repeatsOfferedTopic(input.userText, offered)) {
    return offered;
  }

  return null;
}

/**
 * Whether workspace passages are enough to answer, or the user should be asked first.
 *
 * A conversational turn is always answered. An overview with passages is answered.
 * Passages that contain at least half of the question terms are enough to answer. Coverage and
 * similarity scores are not consulted. A shared subject that still lacks those
 * terms stays on the insufficient-evidence reply. Anything else asks for web
 * research and does not search.
 *
 * @param input - Query class, question, passage text, and subject overlap
 * @returns The retrieval outcome for this turn
 */
export function retrievalDisposition(input: {
  queryClass: string;
  question: string;
  chunkTexts: string[];
  sharesSubject: boolean;
}): RetrievalDisposition {
  if (input.queryClass === "conversational") {
    return "answer";
  }

  if (input.queryClass === "summarization" && input.chunkTexts.length > 0) {
    return "answer";
  }

  if (
    input.chunkTexts.length > 0 &&
    supportingTermRatio(input.question, input.chunkTexts) >=
      RAG_SUPPORTING_TERM_RATIO
  ) {
    return "answer";
  }

  if (input.sharesSubject) {
    return "missing-fact";
  }

  return "ask-web";
}

/**
 * Whether this turn should ask before any web search.
 *
 * The decision uses the retrieval outcome only. A sentence in the draft that
 * mentions a missing detail does not start or suppress the offer.
 *
 * @param input - Sufficiency, query shape, and whether this turn already searched
 * @returns True when the reply should end with the research question
 */
export function shouldOfferWebResearch(input: {
  evidenceSufficient: boolean;
  conversational: boolean;
  researchTopic: string | null;
}) {
  return (
    !input.evidenceSufficient &&
    !input.conversational &&
    !input.researchTopic
  );
}

/**
 * Maps a finished or failed search into either web results or a direct reply.
 *
 * Invalid URLs are removed. An empty list and a thrown provider call both
 * become a reply with no citations.
 *
 * @param input - Topic, raw results, and whether the provider call failed
 * @returns A direct reply, or usable results for the answer prompt
 */
export function settleWebSearch(input: {
  topic: string;
  results: TavilySearchResponse | null;
  failed: boolean;
}) {
  if (input.failed || !input.results) {
    return {
      directReply: webSearchFailedReply(input.topic),
      webResults: null,
    };
  }

  const results = keepUsableWebResults(input.results.results);
  if (results.length === 0) {
    return {
      directReply: `I couldn't find web results on ${input.topic}. Try again in a moment.`,
      webResults: null,
    };
  }

  return {
    directReply: null,
    webResults: { ...input.results, results },
  };
}

/**
 * Reply used when an authorized search does not return usable pages.
 *
 * @param topic - Topic that was searched
 * @returns The user-facing failure sentence
 */
export function webSearchFailedReply(topic: string) {
  return `I couldn't complete web research on ${topic}. Try again in a moment.`;
}

/**
 * Replaces an ungrounded factual draft when this request was not allowed to search.
 *
 * A turn whose passages already answer the question stays, including a draft
 * that mentions a missing detail. Conversational replies stay. A how-to with
 * no supporting passage becomes the research offer when search was not allowed,
 * or the search-failure reply when search was allowed but nothing was cited.
 *
 * @param input - Draft, consent, and whether any workspace passage was available
 * @returns The text to release
 */
export function replaceUnauthorizedAnswer(input: {
  answer: string;
  searchAllowed: boolean;
  chunkCount: number;
  withheld: boolean;
  conversational: boolean;
  evidenceSufficient?: boolean;
  topic: string;
  focus: string | null;
}) {
  if (input.conversational || input.evidenceSufficient) {
    return input.answer;
  }

  if (!input.answer.trim()) {
    return input.searchAllowed
      ? webSearchFailedReply(input.topic)
      : buildUncoveredTopicReply({ topic: input.topic, focus: input.focus });
  }

  if (isStableReply(input.answer)) {
    return input.answer;
  }

  if (input.searchAllowed) {
    if (input.chunkCount > 0 || /\[W\d+\]/.test(input.answer)) {
      return input.answer;
    }

    return webSearchFailedReply(input.topic);
  }

  if (input.chunkCount > 0 && !input.withheld) {
    return input.answer;
  }

  return buildUncoveredTopicReply({
    topic: input.topic,
    focus: input.focus,
  });
}

function isStableReply(answer: string) {
  return (
    /would you like me to perform web research/i.test(answer) ||
    /do not specify/i.test(answer) ||
    /couldn't find web results/i.test(answer) ||
    /couldn't complete web research/i.test(answer)
  );
}
