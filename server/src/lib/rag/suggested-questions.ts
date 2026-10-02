/**
 * Follow-up questions grounded in the notebook, plus a short focus phrase
 * for a question the sources do not cover.
 */

import { openai } from "@ai-sdk/openai";
import { generateText, Output } from "ai";
import { z } from "zod";
import { RAG_INTELLIGENCE_MODEL } from "../ai-config.js";
import { logRagEvent } from "./rag-log.js";
import { normalizeFocus } from "./topic-gap.js";

export type NotebookPassage = {
  title: string;
  text: string;
};

const MAX_SUGGESTIONS = 3;
const MAX_QUESTION_LENGTH = 110;

const gapSchema = z.object({
  focus: z.string(),
  questions: z.array(z.string()),
});

const followUpSchema = z.object({
  questions: z.array(z.string()),
});

/**
 * Keeps at most three short, distinct questions.
 *
 * @param value - Model output or a stored JSON value
 * @param avoid - Questions that should not be suggested again, usually the one just asked
 * @returns Two or three questions when the model provided them, otherwise fewer
 */
export function normalizeSuggestedQuestions(value: unknown, avoid: string[] = []) {
  if (!Array.isArray(value)) {
    return [];
  }

  const blocked = new Set(
    avoid
      .map((item) => item.replace(/\s+/g, " ").trim().toLowerCase())
      .filter((item) => item.length > 0),
  );
  const seen = new Set<string>();
  const questions: string[] = [];

  for (const item of value) {
    if (typeof item !== "string") {
      continue;
    }

    let question = item.replace(/\s+/g, " ").trim().replace(/^["']|["']$/g, "");
    if (!question) {
      continue;
    }

    if (!question.endsWith("?")) {
      question = `${question.replace(/[.!]+$/g, "")}?`;
    }

    if (question.length > MAX_QUESTION_LENGTH) {
      continue;
    }

    const key = question.toLowerCase();
    if (blocked.has(key) || seen.has(key)) {
      continue;
    }

    seen.add(key);
    questions.push(question);

    if (questions.length === MAX_SUGGESTIONS) {
      break;
    }
  }

  return questions;
}

/**
 * Reads suggestions stored beside the pipeline steps.
 *
 * @param trace - Message `trace` JSON
 * @returns Up to three questions, or an empty list
 */
export function readStoredSuggestions(trace: unknown) {
  if (!trace || typeof trace !== "object" || !("suggestions" in trace)) {
    return [];
  }

  return normalizeSuggestedQuestions(
    (trace as { suggestions?: unknown }).suggestions,
  );
}

/**
 * Names what the notebook is about and suggests questions its passages can answer.
 *
 * @param input - Missing topic and notebook passages
 * @returns A focus phrase and up to three questions. Both are empty when the call fails
 */
export async function describeNotebookGap(input: {
  topic: string;
  passages: NotebookPassage[];
}) {
  if (input.passages.length === 0) {
    return { focus: null, questions: [] as string[] };
  }

  try {
    const result = await generateText({
      model: openai(RAG_INTELLIGENCE_MODEL),
      output: Output.object({ schema: gapSchema }),
      system: [
        "You describe a notebook and suggest questions its sources can answer.",
        "focus is a short noun phrase for what the passages are about. Do not write a full sentence and do not mention the missing topic.",
        "questions are 2 or 3 short questions a person could answer from these passages.",
        "Each question is under 90 characters.",
        "Do not ask about the missing topic.",
        "Do not repeat the same idea.",
        "Do not answer the questions.",
      ].join("\n"),
      prompt: [
        `Missing topic: ${input.topic}`,
        "",
        "Passages:",
        formatPassages(input.passages),
      ].join("\n"),
    });

    if (!result.output) {
      throw new Error("Notebook gap description returned no output");
    }

    return {
      focus: normalizeFocus(result.output.focus),
      questions: normalizeSuggestedQuestions(result.output.questions, [
        input.topic,
        `What is ${input.topic}?`,
      ]),
    };
  } catch {
    logRagEvent("suggestions", { gapFailed: true });
    return { focus: null, questions: [] as string[] };
  }
}

/**
 * Suggests the next questions for this chat.
 *
 * Questions stay inside the notebook when passages are available. A reply that
 * came from web research can be followed on that topic instead.
 *
 * @param input - The question, the reply just written, and the passages behind it
 * @returns Up to three short questions, or an empty list when nothing usable was returned
 */
export async function suggestFollowUpQuestions(input: {
  question: string;
  answer: string;
  passages: NotebookPassage[];
  preferNotebook?: boolean;
}) {
  if (!input.answer.trim() && input.passages.length === 0) {
    return [];
  }

  try {
    const result = await generateText({
      model: openai(RAG_INTELLIGENCE_MODEL),
      output: Output.object({ schema: followUpSchema }),
      system: [
        "You suggest the next questions in a notebook chat.",
        "Return 2 or 3 short questions.",
        "Each question is under 90 characters.",
        input.preferNotebook
          ? "Ask only about the passages. Do not ask about a topic the passages do not cover."
          : "Prefer questions the passages can answer. If the reply came from outside the notebook, follow that reply's topic.",
        "Do not repeat the question the user just asked.",
        "Do not answer the questions.",
      ].join("\n"),
      prompt: [
        `User question:\n${input.question}`,
        "",
        `Reply:\n${input.answer}`,
        "",
        input.passages.length > 0
          ? `Passages:\n${formatPassages(input.passages)}`
          : "No notebook passages were retrieved.",
      ].join("\n"),
    });

    if (!result.output) {
      throw new Error("Follow-up questions returned no output");
    }

    return normalizeSuggestedQuestions(result.output.questions, [
      input.question,
    ]);
  } catch {
    logRagEvent("suggestions", { followUpsFailed: true });
    return [];
  }
}

function formatPassages(passages: NotebookPassage[]) {
  return passages
    .slice(0, 6)
    .map((passage, index) => {
      const text = passage.text.replace(/\s+/g, " ").trim().slice(0, 700);
      return `[${index + 1}] ${passage.title}\n${text}`;
    })
    .join("\n\n");
}
