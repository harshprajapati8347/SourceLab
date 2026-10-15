/// <reference types="vitest/globals" />
import assert from "node:assert/strict";
import { guardrailsConfig } from "../../config/guardrails.js";
import { InputGuardError } from "../../shared/errors.js";
import { InputGuardService } from "./InputGuardService.js";

describe("InputGuardService", () => {
  it("returns an allowed query unchanged", async () => {
    const service = new InputGuardService(guardrailsConfig);
    const result = await service.validateAndSanitize({ query: "What is RAG?" });
    assert.equal(result.query, "What is RAG?");
  });

  it("rejects a query that contains PII", async () => {
    const service = new InputGuardService(guardrailsConfig);
    await assert.rejects(
      () =>
        service.validateAndSanitize({
          query: "My email is test@example.com",
        }),
      InputGuardError,
    );
  });

  it("skips PII when that guard is disabled", async () => {
    const service = new InputGuardService({
      ...guardrailsConfig,
      ENABLE_PII_GUARD: false,
    });
    const query = "My email is test@example.com";
    const result = await service.validateAndSanitize({ query });
    assert.equal(result.query, query);
  });
});
