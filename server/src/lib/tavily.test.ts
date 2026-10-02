import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatTavilyResultsForPrompt,
  mergeWebSearchResults,
  type TavilySearchResponse,
} from "./tavily.js";

describe("web result markers", () => {
  it("appends new urls without renumbering earlier pages", () => {
    const first: TavilySearchResponse = {
      query: "a",
      results: [
        { title: "A", url: "https://a.example", content: "alpha" },
      ],
    };
    const second: TavilySearchResponse = {
      query: "b",
      results: [
        { title: "A", url: "https://a.example", content: "alpha" },
        { title: "B", url: "https://b.example", content: "beta" },
      ],
    };
    const merged = mergeWebSearchResults(first, second);
    const added = merged.results.slice(first.results.length);
    const formatted = formatTavilyResultsForPrompt(
      { ...merged, results: added },
      first.results.length,
    );

    assert.equal(merged.results[0]?.url, "https://a.example");
    assert.equal(merged.results[1]?.url, "https://b.example");
    assert.match(formatted, /\[W2\] B/);
    assert.doesNotMatch(formatted, /\[W1\]/);
  });
});
