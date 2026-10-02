import { tavily } from "@tavily/core";

export type TavilySearchResult = {
  title: string;
  url: string;
  content: string;
  score?: number;
};

export type TavilySearchResponse = {
  query: string;
  answer?: string;
  results: TavilySearchResult[];
};

let client: ReturnType<typeof tavily> | null = null;

/**
 * Runs a web search query via Tavily for the chat `web_search` tool.
 *
 * @param query - Natural-language search query from the model
 * @returns Normalized search response with up to 5 results and optional answer summary
 * @throws When `TAVILY_API_KEY` is not configured
 *
 */
export async function searchWeb(query: string): Promise<TavilySearchResponse> {
  const apiKey = process.env.TAVILY_API_KEY?.trim();

  if (!apiKey) {
    throw new Error("TAVILY_API_KEY is not configured");
  }

  if (!client) {
    client = tavily({ apiKey });
  }

  const response = await client.search(query, {
    searchDepth: "basic",
    maxResults: 5,
    includeAnswer: true,
  });

  return {
    query,
    answer: typeof response.answer === "string" ? response.answer : undefined,
    results: (response.results ?? []).map((result) => ({
      title: result.title ?? result.url ?? "Untitled",
      url: result.url ?? "",
      content: result.content ?? "",
      score: result.score,
    })),
  };
}

/**
 * Combines web search responses, keeping the first result for each URL.
 *
 * @param existing - Results already retrieved for this turn, if any
 * @param next - A later search, such as a model tool call
 * @returns One response whose results are unique by URL
 */
export function mergeWebSearchResults(
  existing: TavilySearchResponse | null,
  next: TavilySearchResponse,
): TavilySearchResponse {
  if (!existing) {
    return next;
  }

  const seen = new Set(existing.results.map((result) => result.url));
  const results = [...existing.results];

  for (const result of next.results) {
    if (seen.has(result.url)) {
      continue;
    }

    seen.add(result.url);
    results.push(result);
  }

  return {
    query: existing.query,
    answer: existing.answer ?? next.answer,
    results,
  };
}

/**
 * Formats Tavily results into a prompt block for the chat model.
 *
 * `startIndex` continues numbering for pages already shown. A later search
 * passes the count of earlier results so the first new page is `[W3]` when
 * two pages were already labeled `[W1]` and `[W2]`.
 *
 * @param response - Normalized Tavily search response
 * @param startIndex - How many web results already occupy earlier marker numbers
 * @returns Multi-line string injected into the tool result or system prompt
 */
export function formatTavilyResultsForPrompt(
  response: TavilySearchResponse,
  startIndex = 0,
): string {
  if (response.results.length === 0) {
    return "No web results were found.";
  }

  const blocks = response.results.map(
    (result, index) =>
      `[W${startIndex + index + 1}] ${result.title} (${result.url})\n${result.content}`,
  );

  const parts = [
    startIndex > 0
      ? `Additional web pages. The next marker is [W${startIndex + 1}]. Do not reuse earlier numbers.`
      : "Web search results:",
  ];

  if (response.answer) {
    parts.push(`Summary: ${response.answer}`);
  }

  parts.push(blocks.join("\n\n"));

  return parts.join("\n\n");
}
