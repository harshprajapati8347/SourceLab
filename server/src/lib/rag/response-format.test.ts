/// <reference types="vitest/globals" />
import assert from "node:assert/strict";
import {
  repairResponseFormatting,
  RESPONSE_FORMAT_FALLBACK,
} from "./response-format.js";

describe("response formatting", () => {
  it("leaves a consistent reply unchanged", () => {
    const answer = [
      "AES-256 protects data at rest [1].",
      "",
      "- Keys rotate every 90 days [1].",
      "- Access is logged [2].",
    ].join("\n");

    const result = repairResponseFormatting(answer);
    assert.equal(result.fallback, false);
    assert.equal(result.repaired, false);
    assert.equal(result.text, answer);
  });

  it("removes empty bullets and empty headings, and spaces the rest", () => {
    const result = repairResponseFormatting(
      [
        "## Encryption",
        "AES-256 protects data at rest [1].",
        "-",
        "* ",
        "1.",
        "##",
        "## Unused",
        "",
        "## Kept",
        "- Keys rotate every 90 days [1].",
        "",
        "- Keys rotate every 90 days [1].",
        "**Rotation**",
      ].join("\n"),
    );

    assert.equal(result.fallback, false);
    assert.match(result.text, /^## Encryption\n\nAES-256/);
    assert.doesNotMatch(result.text, /## Unused/);
    assert.match(result.text, /## Kept/);
    assert.match(result.text, /\[1\]/);
    assert.equal(result.text.match(/Keys rotate every 90 days/g)?.length, 1);
    assert.doesNotMatch(result.text, /^\s*(?:[-*+]|\d+[.)])\s*$/m);
  });

  it("closes a dangling fence and an unclosed bold marker without changing the claim", () => {
    const result = repairResponseFormatting(
      "The limit is **100 users [1].\n```\nconst limit = 100;",
    );

    assert.equal(result.fallback, false);
    assert.match(result.text, /\*\*100 users \[1\]\.\*\*/);
    assert.match(result.text, /```\nconst limit = 100;\n```/);
    assert.doesNotMatch(result.text, /200 users/);
  });

  it("returns the fallback when cleanup would drop a citation", () => {
    const result = repairResponseFormatting("## Only stated here [1]\n\n## Next\n\nNo marker remains.");

    assert.equal(result.fallback, true);
    assert.equal(result.text, RESPONSE_FORMAT_FALLBACK);
    assert.doesNotMatch(result.text, /\[1\]/);
  });

  it("returns the fallback when nothing readable remains", () => {
    const result = repairResponseFormatting("- \n*\n**\n##\n");

    assert.equal(result.fallback, true);
    assert.equal(result.text, RESPONSE_FORMAT_FALLBACK);
  });
});
