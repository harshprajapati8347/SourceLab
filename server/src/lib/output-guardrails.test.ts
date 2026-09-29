import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { checkOutputSecrets, maskOutputPii } from "./output-guardrails.js";

describe("output PII", () => {
  it("masks an email address", async () => {
    const result = await maskOutputPii("Email ada@example.com for details.");

    assert.match(result.text, /<EMAIL_ADDRESS>/);
    assert.doesNotMatch(result.text, /ada@example.com/);
    assert.ok(
      result.lines.some((line) => line.includes("EMAIL_ADDRESS")),
      result.lines.join(" | "),
    );
  });

  it("masks an Indian phone number", async () => {
    const result = await maskOutputPii("Call +91 98765 43210 tomorrow.");

    assert.match(result.text, /<PHONE_NUMBER>/);
    assert.doesNotMatch(result.text, /98765/);
    assert.ok(
      result.lines.some((line) => line.includes("PHONE_NUMBER")),
      result.lines.join(" | "),
    );
    assert.match(result.summary, /Masked 1 type/);
  });

  it("masks an email and an Indian phone as two PII types", async () => {
    const result = await maskOutputPii(
      "Email ada@example.com or call +91 98765 43210.",
    );

    assert.match(result.text, /<EMAIL_ADDRESS>/);
    assert.match(result.text, /<PHONE_NUMBER>/);
    assert.doesNotMatch(result.text, /ada@example.com/);
    assert.doesNotMatch(result.text, /98765/);
    assert.match(result.summary, /Masked 2 types/);
  });

  it("leaves a person's name in place", async () => {
    const result = await maskOutputPii("Ada Lovelace wrote the notes.");

    assert.match(result.text, /Ada Lovelace/);
    assert.equal(result.summary, "No sensitive details");
  });
});

describe("PII and sensitive data", () => {
  it("masks a phone as PII and does not treat that phone as a credential", async () => {
    const original = "Email ada@example.com and call +91 98765 43210.";
    const pii = await maskOutputPii(original);
    const secrets = await checkOutputSecrets(original);
    const released = secrets.blocked ? secrets.text : pii.text;

    assert.equal(secrets.blocked, false);
    assert.equal(secrets.summary, "None detected");
    assert.match(pii.summary, /Masked 2 types/);
    assert.doesNotMatch(released, /98765/);
    assert.doesNotMatch(released, /ada@example.com/);
    assert.doesNotMatch(secrets.lines.join(" "), /98765/);
  });

  it("still blocks an API key as sensitive data", async () => {
    const result = await checkOutputSecrets(
      "Use sk-proj-abcdefghijklmnopqrstuvwxyz1234567890 now.",
    );

    assert.equal(result.blocked, true);
    assert.match(result.text, /sensitive credentials/);
    assert.doesNotMatch(result.lines.join(" "), /sk-proj/);
  });
});
