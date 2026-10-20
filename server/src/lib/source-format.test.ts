/// <reference types="vitest/globals" />
import assert from "node:assert/strict";
import {
  normalizeExtractedContent,
  normalizePdfPages,
  prepareExtractedContent,
} from "./source-format.js";

const WORDS = /[\p{L}\p{N}]+/gu;

function words(text: string): string[] {
  return text.match(WORDS) ?? [];
}

describe("source formatting", () => {
  it("leaves pasted text and markdown unchanged", () => {
    const messy = "• Alpha • Beta\n\n#Title\n\n\npage 1";
    assert.equal(prepareExtractedContent("TEXT", { text: messy }).text, messy);
    assert.equal(
      prepareExtractedContent("MARKDOWN", { text: messy }).text,
      messy,
    );
  });

  it("splits inline bullets and repairs a skipped heading without new words", () => {
    const original =
      "#### Setup\nInstall the agent • Configure the key • Restart the worker";
    const text = normalizeExtractedContent(original, "WEBSITE");

    assert.match(text, /^# Setup/);
    assert.match(text, /^- Install the agent/m);
    assert.match(text, /^- Configure the key/m);
    assert.match(text, /^- Restart the worker/m);
    assert.deepEqual(words(text), words(original));
  });

  it("joins a hard-wrapped hyphenated PDF line and drops page chrome", () => {
    const pages = [
      "Acme Handbook\nThe boiling point of water is informa-\ntion that stays 100 C.\n1",
      "Acme Handbook\nA second fact is stored here for the index.\n2",
    ];
    const normalized = normalizePdfPages(pages);
    const prepared = prepareExtractedContent("PDF", {
      text: pages.join("\n\n"),
      pages,
    });

    assert.match(normalized[0] ?? "", /information/);
    assert.doesNotMatch(normalized[0] ?? "", /Acme Handbook/);
    assert.doesNotMatch(normalized[0] ?? "", /^1$/m);
    assert.match(prepared.text, /information/);
    assert.match(prepared.text, /100/);
    assert.equal(
      normalizeExtractedContent(prepared.text, "PDF"),
      prepared.text,
    );
  });

  it("repairs a pipe table, a tab table, and a numbered list missing spaces", () => {
    const text = normalizeExtractedContent(
      ["Name\tRole", "Ada\tResearch", "", "| A | B |", "| 1 | 2 |", "", "1.Alpha 2.Beta"].join(
        "\n",
      ),
      "PDF",
    );

    assert.match(text, /\| Name \| Role \|/);
    assert.match(text, /\| --- \| --- \|/);
    assert.match(text, /\| Ada \| Research \|/);
    assert.match(text, /\| A \| B \|/);
    assert.match(text, /^1\. Alpha/m);
    assert.match(text, /^2\. Beta/m);
    assert.ok(words(text).includes("Ada"));
    assert.ok(words(text).includes("100") === false);
  });

  it("keeps links, code, and image addresses while dropping image dimensions", () => {
    const original = [
      "See [the spec](https://example.com/spec) and `keep • this`.",
      "",
      "```",
      "• not a list",
      "#NotAHeading",
      "```",
      "",
      '![Diagram](https://cdn.example.com/a.png =2000x1000){width=2000}',
      '<img src="https://cdn.example.com/b.png" alt="Chart" width="1800" height="900">',
      '<img src="https://cdn.example.com/pixel.gif" alt="" width="1" height="1">',
    ].join("\n");
    const text = normalizeExtractedContent(original, "WEBSITE");

    assert.match(text, /\[the spec\]\(https:\/\/example\.com\/spec\)/);
    assert.match(text, /`keep • this`/);
    assert.match(text, /```\n• not a list\n#NotAHeading\n```/);
    assert.match(text, /!\[Diagram\]\(https:\/\/cdn\.example\.com\/a\.png\)/);
    assert.match(text, /!\[Chart\]\(https:\/\/cdn\.example\.com\/b\.png\)/);
    assert.doesNotMatch(text, /2000x1000|width=|pixel\.gif/);
    assert.ok(!words(text).some((word) => word.toLowerCase() === "summary"));
  });

  it("turns an HTML table and heading into markdown without adding cells", () => {
    const text = normalizeExtractedContent(
      '<h4>Limits</h4><table><tr><th>Plan</th><th>Credits</th></tr><tr><td>Free</td><td>10</td></tr></table><p>See <a href="https://example.com/pricing">pricing</a>.</p>',
      "WEBSITE",
    );

    assert.match(text, /^# Limits/m);
    assert.match(text, /\| Plan \| Credits \|/);
    assert.match(text, /\| Free \| 10 \|/);
    assert.match(text, /\[pricing\]\(https:\/\/example\.com\/pricing\)/);
    assert.deepEqual(words(text.replace(/\(https?:\/\/[^)]+\)/g, "")), [
      "Limits",
      "Plan",
      "Credits",
      "Free",
      "10",
      "See",
      "pricing",
    ]);
  });

  it("cleans a YouTube transcript without adding narration", () => {
    const spoken =
      "Welcome back. The cache expires after 90 days. The cache expires after 90 days. Keys rotate in place.";
    const text = normalizeExtractedContent(
      `${spoken} [Music] &amp; that&#39;s the rule.`,
      "YOUTUBE",
    );

    assert.doesNotMatch(text, /\[Music\]|&amp;|&#39;/);
    assert.match(text, /that's the rule/);
    assert.match(text, /&/);
    assert.equal(text.split("The cache expires after 90 days.").length - 1, 1);
    for (const word of ["Welcome", "cache", "90", "Keys", "rotate"]) {
      assert.ok(words(text).includes(word), word);
    }
    assert.equal(normalizeExtractedContent(text, "YOUTUBE"), text);
  });

  it("removes an unnecessary single bullet, empty bullets, and duplicate lines", () => {
    const text = normalizeExtractedContent(
      [
        "- This extracted paragraph is one long bullet that should read as a paragraph because the extractor prefixed every body block with a bullet even though it is not a list item at all and the sentence just keeps going.",
        "-",
        "* ",
        "##",
        "Skip to content",
        "Alpha",
        "Alpha",
      ].join("\n"),
      "PDF",
    );

    assert.doesNotMatch(text, /^[-*]\s/m);
    assert.match(text, /^This extracted paragraph/m);
    assert.doesNotMatch(text, /Skip to content/);
    assert.equal(text.split("Alpha").length - 1, 1);
  });

  it("keeps a real list and does not invent a heading or example", () => {
    const original = "- Keys rotate every 90 days.\n- Access is logged.";
    const text = normalizeExtractedContent(original, "PDF");
    assert.equal(text, original);
    assert.doesNotMatch(text, /for example|in summary|overview/i);
  });
});
