import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  acceptsWebResearch,
  buildUncoveredTopicReply,
  focusFromTitles,
  pendingWebResearchTopic,
  questionTermsMissing,
  sourcesMissTopic,
  topicFromQuestion,
} from "./topic-gap.js";

describe("uncovered topic replies", () => {
  it("names the missing topic, the notebook focus, and offers web research", () => {
    const reply = buildUncoveredTopicReply({
      topic: "Software Engineering",
      focus: "AI",
    });

    assert.equal(
      reply,
      "Your sources don't seem to cover Software Engineering. Your notebook currently focuses on AI. Would you like me to perform web research on Software Engineering?",
    );
    assert.equal(pendingWebResearchTopic(`assistant: ${reply}`), "Software Engineering");
  });

  it("asks for web research even when the toggle is off", () => {
    const reply = buildUncoveredTopicReply({
      topic: "Software Engineering",
      focus: "AI",
    });

    assert.match(reply, /Would you like me to perform web research on Software Engineering\?/);
    assert.equal(
      pendingWebResearchTopic(`assistant: ${reply}`),
      "Software Engineering",
    );
  });

  it("labels a definition question without the leading words", () => {
    assert.equal(
      topicFromQuestion("What is Software Engineering?"),
      "Software Engineering",
    );
    assert.equal(topicFromQuestion("How does a compiler work?"), "Compiler");
  });

  it("uses source titles when a model focus phrase is missing", () => {
    assert.equal(focusFromTitles(["AI", "AI"]), "AI");
    assert.equal(focusFromTitles(["AI", "Compilers"]), "AI and Compilers");
  });

  it("treats low coverage and missing topic words as a gap", () => {
    assert.equal(sourcesMissTopic(0.2), true);
    assert.equal(sourcesMissTopic(0.35), false);
    assert.equal(
      questionTermsMissing("What is Software Engineering?", [
        "Artificial intelligence studies learning systems.",
      ]),
      true,
    );
    assert.equal(
      questionTermsMissing("What is Software Engineering?", [
        "Software engineering is a discipline.",
      ]),
      false,
    );
    assert.equal(
      questionTermsMissing("What are the key ideas?", ["Reactive agents."]),
      false,
    );
  });

  it("accepts a short yes and ignores a new question", () => {
    assert.equal(acceptsWebResearch("Yes, please"), true);
    assert.equal(acceptsWebResearch("yes, search the web"), true);
    assert.equal(acceptsWebResearch("Yes, search the web?"), true);
    assert.equal(acceptsWebResearch("What is Software Engineering?"), false);
  });

  it("reads the offer only from the latest assistant turn", () => {
    const turns = [
      "assistant: Would you like me to perform web research on Pricing?",
      "user: yes",
      "assistant: The price is listed in the notebook.",
      "user: How do I upload a document securely to Amazon S3 using Node.js?",
    ].join("\n");

    assert.equal(pendingWebResearchTopic(turns), null);
  });
});
