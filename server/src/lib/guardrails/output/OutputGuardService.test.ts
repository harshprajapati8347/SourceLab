/// <reference types="vitest/globals" />
import assert from "node:assert/strict";
import { guardrailsConfig } from "../../config/guardrails.js";
import { OutputGuardError } from "../../shared/errors.js";
import { OutputGuardService } from "./OutputGuardService.js";

function response(content: string) {
  return {
    message: { role: "assistant", content },
    sources: [],
  };
}

describe("OutputGuardService", () => {
  const service = new OutputGuardService(guardrailsConfig);

  it("returns an allowed response unchanged", async () => {
    const content = "This is a safe and valid response.";
    const result = await service.validateAndSanitize(response(content));
    assert.equal(result.message.content, content);
  });

  it("rejects a response over the configured length", async () => {
    const limited = new OutputGuardService({
      ...guardrailsConfig,
      OUTPUT_MAX_RESPONSE_LENGTH: 10,
    });
    await assert.rejects(
      () => limited.validateAndSanitize(response("this is longer than ten")),
      (error: unknown) => {
        assert.ok(error instanceof OutputGuardError);
        assert.equal(error.guardName, "MaximumLengthGuard");
        return true;
      },
    );
  });

  it("rejects chain-of-thought leakage", async () => {
    await assert.rejects(
      () =>
        service.validateAndSanitize(
          response("Let's think step by step about the answer."),
        ),
      (error: unknown) => {
        assert.ok(error instanceof OutputGuardError);
        assert.equal(error.guardName, "ChainOfThoughtGuard");
        return true;
      },
    );
  });

  it("skips chain-of-thought when that guard is disabled", async () => {
    const open = new OutputGuardService({
      ...guardrailsConfig,
      ENABLE_CHAIN_OF_THOUGHT_GUARD: false,
    });
    const content = "Let's think step by step about the answer.";
    const result = await open.validateAndSanitize(response(content));
    assert.equal(result.message.content, content);
  });
});
