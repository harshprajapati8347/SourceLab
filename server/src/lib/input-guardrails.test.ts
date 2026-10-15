import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { InputBlockedError } from "../types/app-error.js";
import { assertChatInputAllowed } from "./input-guardrails.js";

describe("assertChatInputAllowed", () => {
  it("continues an ordinary question unchanged", async () => {
    const text = "What is RAG?";
    const decision = await assertChatInputAllowed(text);
    assert.equal(decision.textForModel, text);
    assert.equal(decision.ignoredEmbeddedInstructions, false);
  });

  it("blocks PII before the query can continue", async () => {
    const text = "My email is test@example.com";
    await assert.rejects(
      () => assertChatInputAllowed(text),
      (error: unknown) => {
        assert.ok(error instanceof InputBlockedError);
        assert.equal(error.statusCode, 400);
        assert.doesNotMatch(error.message, /test@example.com/);
        assert.deepEqual(error.details, {
          code: "INPUT_BLOCKED",
          guardrail: "PiiGuard",
          message: text,
        });
        return true;
      },
    );
  });
});
