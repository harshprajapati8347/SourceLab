/**
 * Input guardrails for workspace chat.
 *
 * Checks the latest user message before conversation creation, credit
 * deduction, retrieval, or the AI SDK stream. A tripwire becomes
 * {@link GuardrailTripwireTriggered}; the chat service maps that to
 * {@link InputBlockedError} so Express returns JSON instead of a stream.
 */

import { fileURLToPath } from "node:url";
import {
  GuardrailTripwireTriggered,
  loadPipelineBundles,
  runGuardrails,
  type GuardrailBundle,
  type PipelineConfig,
} from "@openai/guardrails";
import OpenAI from "openai";
import { InputBlockedError } from "../types/app-error.js";

const configPath = fileURLToPath(
  new URL("../config/guardrails_config.json", import.meta.url),
);

const INPUT_BLOCKED_MESSAGES: Record<string, string> = {
  Moderation:
    "Moderation: Your message couldn't be processed because it contains content that isn't allowed. Please revise your message and try again.",

  Jailbreak:
    "Jailbreak: Your message couldn't be processed because it contains instructions that attempt to bypass SourceLab's safety rules. Please rephrase your request and try again.",

  "Off Topic Prompts":
    "Off Topic: Your message couldn't be processed because it's outside this workspace's scope. Please ask about your workspace sources, research, or learning.",

  "Contains PII":
    "Contains PII: Your message couldn't be processed because it contains sensitive personal information, such as financial or government ID details. Please remove this information and try again.",
};

let pipelinePromise: Promise<PipelineConfig> | null = null;
let guardrailLlm: OpenAI | null = null;

function loadPipeline(): Promise<PipelineConfig> {
  pipelinePromise ??= loadPipelineBundles(configPath).catch(
    (error: unknown) => {
      pipelinePromise = null;
      throw error;
    },
  );
  return pipelinePromise;
}

function getGuardrailContext() {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  // `@openai/guardrails` depends on its own `openai` copy, so this client is
  // passed as the `guardrailLlm` context without annotating that package's type.
  guardrailLlm ??= new OpenAI({ apiKey });
  return { guardrailLlm };
}

function guardrailNameFromTripwire(error: GuardrailTripwireTriggered) {
  const name = error.guardrailResult.info.guardrail_name;
  return typeof name === "string" && name.trim() ? name : "Unknown";
}

/**
 * Maps a guardrail tripwire to a client-safe 400.
 *
 * The response includes the guardrail name and the original user message so
 * the composer can restore it. Detected spans and confidence scores stay
 * on the server.
 *
 * @param error - Tripwire raised by {@link assertChatInputAllowed}
 * @param message - Exact user text that was checked
 * @returns Application error the global handler serializes as JSON
 */
export function toInputBlockedError(
  error: GuardrailTripwireTriggered,
  message: string,
) {
  const guardrail = guardrailNameFromTripwire(error);
  console.warn(`Input guardrail blocked request: ${guardrail}`);
  return new InputBlockedError(
    INPUT_BLOCKED_MESSAGES[guardrail] ?? "I can't help with that request.",
    { code: "INPUT_BLOCKED", guardrail, message },
  );
}

/**
 * Runs pre-flight checks, then input checks, on the latest user message.
 *
 * Pre-flight covers moderation and credential PII. Input covers jailbreak
 * and off-topic classification. The first tripwire stops the request.
 * A guardrail that fails to execute is rethrown so the request fails closed.
 *
 * @param text - Latest user message text
 * @throws {GuardrailTripwireTriggered} When a configured check blocks the text
 */
export async function assertChatInputAllowed(text: string): Promise<void> {
  const pipeline = await loadPipeline();
  const context = getGuardrailContext();
  const stages = [pipeline.pre_flight, pipeline.input].filter(
    (stage): stage is GuardrailBundle => !!stage && stage.guardrails.length > 0,
  );

  for (const stage of stages) {
    const results = await runGuardrails(text, stage, context, true);
    const triggered = results.find((result) => result.tripwireTriggered);
    if (triggered) {
      throw new GuardrailTripwireTriggered(triggered);
    }
  }
}
