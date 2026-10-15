import type { ChatCitation } from "./types";

/**
 * Whether a citation URL can be rendered as a link.
 *
 * Matches the server check: only http and https.
 *
 * @param url - Citation URL, when the record has one
 * @returns True when the URL is safe to put in an href
 */
export function isSafeHttpUrl(url: string | undefined): url is string {
  if (!url) {
    return false;
  }

  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export function getCitationByIndex(citations: ChatCitation[], index: number) {
  const workspace = citations.filter((citation) => citation.sourceType !== "WEB");
  return workspace[index - 1] ?? null;
}

export function getWebCitation(citations: ChatCitation[], index: number) {
  const web = citations.filter((citation) => citation.sourceType === "WEB");
  return web[index - 1] ?? null;
}

export function uniqueCitationsBySource(citations: ChatCitation[]) {
  return citations.filter((citation, index, array) => {
    const key = citation.sourceId ?? citation.url ?? citation.sourceTitle;
    return (
      array.findIndex(
        (item) => (item.sourceId ?? item.url ?? item.sourceTitle) === key,
      ) === index
    );
  });
}
