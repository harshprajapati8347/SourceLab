/**
 * Citation records shared by the chat stream and the saved assistant message.
 *
 * Workspace markers use `[1]`. Web markers use `[W1]` and follow the usable
 * web-result order. A web marker stays only when that page supports the sentence.
 */

import { citedTextSupports } from "./answer-grounding.js";
import {
  isSafeHttpUrl,
  keepUsableWebResults,
  type TavilySearchResponse,
} from "../tavily.js";

export type SavedCitation = {
  sourceId?: string;
  sourceTitle: string;
  sourceType: string;
  chunkId?: string;
  chunkIndex?: number;
  page?: number;
  excerpt: string;
  score?: number;
  url?: string;
  cited?: boolean;
};

/**
 * Drops sentences that use web results without a `[W#]` marker.
 *
 * Absence statements and the research offer stay. Called only when this turn
 * actually retrieved web pages.
 *
 * @param answer - Draft after unsupported markers were removed
 * @returns Sentences that cite a web page, plus non-factual asides that name no claim
 */
export function retainCitedWebSentences(answer: string) {
  const parts = answer.split(/(?<=[.!?])\s+/);
  const kept = parts.filter((sentence) => {
    const trimmed = sentence.trim();
    if (!trimmed) {
      return false;
    }

    if (/\[W\d+\]/.test(trimmed)) {
      return true;
    }

    return /(?:would you like me to perform web research|not in the sources|do not specify|couldn't find web results|couldn't complete web research)/i.test(
      trimmed,
    );
  });

  return kept.join(" ").trim();
}

/**
 * Removes web markers whose page does not support that sentence.
 *
 * Markers are not added for pages that merely appeared in the result list.
 * A sentence whose web markers are all removed is dropped.
 *
 * @param answer - Released assistant text
 * @param results - Web results in `[W#]` order
 * @returns The answer with only supported web markers left
 */
export function pruneUnsupportedWebMarkers(
  answer: string,
  results: TavilySearchResponse["results"],
) {
  const usable = keepUsableWebResults(results);
  const parts = answer.split(/(?<=[.!?])\s+/);
  const kept: string[] = [];

  for (const sentence of parts) {
    const markers = [...sentence.matchAll(/\[W(\d+)\]/g)];
    if (markers.length === 0) {
      if (sentence.trim()) {
        kept.push(sentence.trim());
      }
      continue;
    }

    let next = sentence;
    let supported = 0;

    for (const match of markers) {
      const marker = match[0];
      const index = Number(match[1]) - 1;
      const result = usable[index];
      const supportedByPage =
        result != null &&
        isSafeHttpUrl(result.url) &&
        citedTextSupports(sentence, result.content);

      if (!supportedByPage) {
        next = next.replace(marker, "");
        continue;
      }

      supported += 1;
    }

    next = next.replace(/\s{2,}/g, " ").trim();
    if (supported > 0 && next) {
      kept.push(next);
    }
  }

  return kept.join(" ").trim();
}

/**
 * Keeps retrieved citations in prompt order and marks the ones still in the answer.
 *
 * Workspace markers use `[1]`. Web markers use `[W1]` and follow the usable
 * web result order. Pages without an http(s) URL are omitted.
 *
 * @param input - Chunk citations, web results, and the text that will be saved
 * @returns Citations in the order inline markers expect
 */
export function assembleCitations(input: {
  chunks: SavedCitation[];
  webResults: TavilySearchResponse | null;
  answer: string;
}): SavedCitation[] {
  const markers = new Set(
    [...input.answer.matchAll(/\[(W?\d+)\]/g)]
      .map((match) => match[1])
      .filter((marker): marker is string => typeof marker === "string"),
  );
  const webResults = keepUsableWebResults(input.webResults?.results ?? []);

  const chunks = input.chunks.map((citation, index) => ({
    ...citation,
    cited: markers.has(String(index + 1)),
  }));
  const web = webResults.map((result, index) => ({
    sourceType: "WEB",
    sourceTitle: result.title,
    url: result.url,
    excerpt: result.content,
    cited: markers.has(`W${index + 1}`),
  }));

  return [...chunks, ...web];
}
