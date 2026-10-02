import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  normalizeSuggestedQuestions,
  readStoredSuggestions,
} from "./suggested-questions.js";

describe("suggested questions", () => {
  it("keeps at most three short questions and drops the one just asked", () => {
    const questions = normalizeSuggestedQuestions(
      [
        "How do Reactive AI and Limited Memory AI differ?",
        "What is Software Engineering?",
        "how do reactive ai and limited memory ai differ",
        "What are some real-world examples of Limited Memory AI?",
        "Can you explain Theory of Mind AI?",
        "This question is far too long to show as a short follow-up chip under a chat reply and should be dropped?",
      ],
      ["What is Software Engineering?"],
    );

    assert.deepEqual(questions, [
      "How do Reactive AI and Limited Memory AI differ?",
      "What are some real-world examples of Limited Memory AI?",
      "Can you explain Theory of Mind AI?",
    ]);
  });

  it("reads questions stored on a message trace", () => {
    assert.deepEqual(
      readStoredSuggestions({
        steps: [],
        suggestions: ["What is a reactive agent?"],
      }),
      ["What is a reactive agent?"],
    );
    assert.deepEqual(readStoredSuggestions(null), []);
  });
});
