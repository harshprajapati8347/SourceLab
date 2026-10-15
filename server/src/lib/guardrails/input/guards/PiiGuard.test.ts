import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { GuardDecision } from "../../../core/models.js";
import { PiiGuard, type DetectedItem } from "./PiiGuard.js";

describe("PiiGuard", () => {
  const guard = new PiiGuard();

  async function rejected(query: string, expectedType: string, expectedValue?: string) {
    const result = await guard.evaluate({ query });
    assert.equal(result.decision, GuardDecision.REJECT);
    assert.ok(result.details?.pii);
    const pii = result.details.pii as DetectedItem[];
    assert.ok(pii.length > 0);
    const item = pii.find((entry) => entry.type === expectedType);
    assert.ok(item);
    if (expectedValue) {
      assert.equal(item.value, expectedValue);
    }
  }

  it("allows normal text", async () => {
    const result = await guard.evaluate({ query: "What is your name?" });
    assert.equal(result.decision, GuardDecision.ALLOW);
  });

  it("rejects email addresses", async () => {
    await rejected("My email is test@example.com", "Email", "test@example.com");
    await rejected(
      "Contact test.user+123@gmail.com",
      "Email",
      "test.user+123@gmail.com",
    );
  });

  it("rejects phone numbers", async () => {
    await rejected("Call me at +91 9876543210", "Phone");
    await rejected("Call me at +1 555-123-4567", "Phone");
  });

  it("rejects a Luhn-valid credit card", async () => {
    await rejected(
      "Card: 4242 4242 4242 4242",
      "Credit Card",
      "4242 4242 4242 4242",
    );
  });

  it("allows a credit card that fails Luhn", async () => {
    const result = await guard.evaluate({ query: "Card: 4242 4242 4242 4243" });
    assert.equal(result.decision, GuardDecision.ALLOW);
  });

  it("rejects IPv4 and IPv6 addresses", async () => {
    await rejected("Connect to 192.168.1.1", "IPv4", "192.168.1.1");
    await rejected(
      "IP: 2001:0db8:85a3:0000:0000:8a2e:0370:7334",
      "IPv6",
    );
  });

  it("rejects UUIDs, JWTs, API keys, and private keys", async () => {
    await rejected("ID: 123e4567-e89b-12d3-a456-426614174000", "UUID");
    await rejected(
      "Token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c",
      "JWT",
    );
    await rejected(
      "Key: sk-123456789012345678901234567890123456789012345678",
      "API Key",
    );
    await rejected(
      "Key: ghp_123456789012345678901234567890123456",
      "API Key",
    );
    const key =
      "-----BEGIN RSA PRIVATE KEY-----\nMIIEpAIBAAKCAQEA\n-----END RSA PRIVATE KEY-----";
    await rejected(`Here is my key: ${key}`, "Private Key", key);
  });

  it("rejects Indian PAN, Aadhaar, GSTIN, and IFSC values", async () => {
    await rejected("PAN is ABCDE1234F", "PAN", "ABCDE1234F");
    await rejected("Aadhaar is 1234 5678 9010", "Aadhaar", "1234 5678 9010");
    await rejected("GSTIN: 22AAAAA0000A1Z5", "GSTIN", "22AAAAA0000A1Z5");
    await rejected("IFSC: SBIN0001234", "IFSC", "SBIN0001234");
  });

  it("reports every detected item and its indexes", async () => {
    const query = "Email is test@test.com and PAN is ABCDE1234F";
    const result = await guard.evaluate({ query });
    assert.equal(result.decision, GuardDecision.REJECT);
    const pii = result.details?.pii as DetectedItem[];
    assert.equal(pii.length, 2);
    assert.ok(pii.some((item) => item.type === "Email"));
    assert.ok(pii.some((item) => item.type === "PAN"));

    const indexed = await guard.evaluate({ query: "Here: ABCDE1234F." });
    const found = indexed.details?.pii as DetectedItem[];
    assert.equal(found[0]?.startIndex, 6);
    assert.equal(found[0]?.endIndex, 16);
    assert.equal("Here: ABCDE1234F.".slice(6, 16), "ABCDE1234F");
  });
});
