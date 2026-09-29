import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatCitationCoverage,
  settleGrounding,
  UNSUPPORTED_SOURCES_MESSAGE,
} from "./answer-grounding.js";

const contactEvidence = new Map([
  [
    "1",
    "Customer record. Email ada@example.com. Phone +91 98765 43210. The city and company are not in this note.",
  ],
]);

describe("grounding", () => {
  it("removes a city or company the cited evidence does not contain", () => {
    const result = settleGrounding(
      "The email is ada@example.com [1]. The customer is in Pune [1]. The company is Initech [1].",
      [
        {
          span: "The email is ada@example.com [1].",
          citations: ["1"],
          supported: true,
        },
        {
          span: "The customer is in Pune [1].",
          citations: ["1"],
          supported: true,
        },
        {
          span: "The company is Initech [1].",
          citations: ["1"],
          supported: true,
        },
      ],
      contactEvidence,
    );

    assert.match(result.text, /ada@example.com/);
    assert.doesNotMatch(result.text, /Pune/);
    assert.doesNotMatch(result.text, /Initech/);
    assert.equal(result.verdict, "PARTIALLY_SUPPORTED");
    assert.equal(result.coverage.summary, "1 / 3 = 33.3%");
    assert.ok(
      result.citations.lines.some((line) =>
        line.startsWith("Removed (evidence does not support the claim)"),
      ),
    );
  });

  it("keeps an explicit statement that a detail is not in the sources", () => {
    const result = settleGrounding(
      "The email is ada@example.com [1]. City: Not mentioned. Company: Not mentioned.",
      [
        {
          span: "The email is ada@example.com [1].",
          citations: ["1"],
          supported: true,
        },
        {
          span: "City: Not mentioned.",
          citations: [],
          supported: false,
        },
        {
          span: "Company: Not mentioned.",
          citations: [],
          supported: false,
        },
      ],
      contactEvidence,
    );

    assert.match(result.text, /City: Not mentioned/);
    assert.match(result.text, /Company: Not mentioned/);
    assert.equal(result.coverage.summary, "1 / 1 = 100%");
    assert.ok(
      result.citations.lines.every((line) => !line.includes("Not mentioned")),
    );
  });

  it("withholds an answer whose factual claims are all unsupported", () => {
    const result = settleGrounding(
      "The customer is in Pune [1].",
      [
        {
          span: "The customer is in Pune [1].",
          citations: ["1"],
          supported: true,
        },
      ],
      contactEvidence,
    );

    assert.equal(result.text, UNSUPPORTED_SOURCES_MESSAGE);
    assert.equal(result.verdict, "UNSUPPORTED");
    assert.equal(result.coverage.summary, "0 / 1 = 0%");
  });
});

describe("citation coverage", () => {
  it("counts repeated wording of the same fact once", () => {
    const answer = [
      "Email is ada@example.com [1].",
      "Contact email: ada@example.com [1].",
      "Phone is +91 98765 43210 [1].",
      "The phone number is +91 98765 43210 [1].",
      "City: Not mentioned.",
      "Company: Not mentioned.",
    ].join(" ");
    const result = settleGrounding(
      answer,
      [
        {
          span: "Email is ada@example.com [1].",
          citations: ["1"],
          supported: true,
        },
        {
          span: "Contact email: ada@example.com [1].",
          citations: ["1"],
          supported: true,
        },
        {
          span: "Phone is +91 98765 43210 [1].",
          citations: ["1"],
          supported: true,
        },
        {
          span: "The phone number is +91 98765 43210 [1].",
          citations: ["1"],
          supported: true,
        },
        { span: "City: Not mentioned.", citations: [], supported: false },
        { span: "Company: Not mentioned.", citations: [], supported: false },
      ],
      contactEvidence,
    );

    assert.equal(result.coverage.summary, "2 / 2 = 100%");
    assert.equal(result.verdict, "SUPPORTED");
    assert.match(result.text, /Email is ada@example.com/);
    assert.match(result.text, /Phone is \+91 98765 43210/);
    assert.doesNotMatch(result.text, /Contact email/);
    assert.match(result.text, /Not mentioned/);
    assert.equal(result.citations.lines.length, 2);
    assert.equal(formatCitationCoverage(7, 8), "7 / 8 = 87.5%");
  });

  it("removes an uncited factual claim and keeps a cited one", () => {
    const result = settleGrounding(
      "The email is ada@example.com [1]. The customer was founded in 1999.",
      [
        {
          span: "The email is ada@example.com [1].",
          citations: ["1"],
          supported: true,
        },
        {
          span: "The customer was founded in 1999.",
          citations: [],
          supported: true,
        },
      ],
      contactEvidence,
    );

    assert.match(result.text, /ada@example.com/);
    assert.doesNotMatch(result.text, /1999/);
    assert.equal(result.coverage.summary, "1 / 2 = 50%");
    assert.ok(
      result.citations.lines.some((line) => line.includes("no citation")),
    );
  });
});
