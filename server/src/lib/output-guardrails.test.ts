import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { guardrailsConfig } from "./config/guardrails.js";
import { OutputGuardService } from "./guardrails/output/OutputGuardService.js";
import {
  OUTPUT_BLOCKED_MESSAGE,
  OUTPUT_CHECK_FAILED_MESSAGE,
  checkOutputGuards,
  textReleasedAfterOutputCheck,
} from "./output-guardrails.js";

describe("checkOutputGuards", () => {
  it("returns an ordinary answer unchanged", async () => {
    const text = "This is a safe and valid response.";
    const result = await checkOutputGuards(text);
    assert.equal(result.blocked, false);
    assert.equal(result.text, text);
    assert.equal(textReleasedAfterOutputCheck(result, false), text);
  });

  it("replaces a chain-of-thought draft and omits that draft", async () => {
    const draft = "<thinking>the hidden draft stays on the server</thinking>";
    const result = await checkOutputGuards(draft);
    assert.equal(result.blocked, true);
    assert.equal(result.text, OUTPUT_BLOCKED_MESSAGE);
    assert.equal(result.summary, "Blocked");
    assert.match(result.lines.join(" "), /ChainOfThoughtGuard/);
    assert.doesNotMatch(result.text, /hidden draft/);
    assert.doesNotMatch(result.lines.join(" "), /hidden draft/);
    assert.equal(
      textReleasedAfterOutputCheck(result, false),
      OUTPUT_BLOCKED_MESSAGE,
    );
  });

  it("replaces an over-length draft and omits that draft", async () => {
    const draft = "x".repeat(12);
    const result = await checkOutputGuards(
      draft,
      new OutputGuardService({
        ...guardrailsConfig,
        OUTPUT_MAX_RESPONSE_LENGTH: 10,
      }),
    );
    assert.equal(result.blocked, true);
    assert.equal(result.text, OUTPUT_BLOCKED_MESSAGE);
    assert.match(result.lines.join(" "), /MaximumLengthGuard/);
    assert.doesNotMatch(result.text, /x{12}/);
  });

  it("withholds the draft when a guard fails to execute", async () => {
    const draft = "A normal answer that must not be released.";
    await assert.rejects(
      () =>
        checkOutputGuards(draft, {
          async validateAndSanitize() {
            throw new Error("detector failed");
          },
        }),
      /detector failed/,
    );
    const released = textReleasedAfterOutputCheck(undefined, true);
    assert.equal(released, OUTPUT_CHECK_FAILED_MESSAGE);
    assert.doesNotMatch(released, /normal answer/);
  });
});
