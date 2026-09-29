/**
 * Output guardrails for a drafted chat answer.
 *
 * PII is masked in place. Moderation and secret-key checks replace the whole
 * answer when they trip. Detected values are not returned for logs or the UI.
 */

import { fileURLToPath } from "node:url";
import {
  instantiateGuardrails,
  loadPipelineBundles,
  type ConfiguredGuardrail,
  type GuardrailResult,
  type PipelineConfig,
} from "@openai/guardrails";
import OpenAI from "openai";

const configPath = fileURLToPath(
  new URL("../config/guardrails_config.json", import.meta.url),
);

export const OUTPUT_CHECK_FAILED_MESSAGE =
  "I couldn't check this answer safely, so I didn't send it.";

export const OUTPUT_POLICY_MESSAGE =
  "Moderation: This answer wasn't shown because it contains content that isn't allowed.";

export const OUTPUT_SECRET_MESSAGE =
  "This answer was withheld because it contained sensitive credentials.";

export type OutputGuardStep = {
  text: string;
  blocked: boolean;
  summary: string;
  lines: string[];
};

let pipelinePromise: Promise<PipelineConfig> | null = null;
let guardsPromise: Promise<ConfiguredGuardrail[]> | null = null;
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

async function loadOutputGuards() {
  if (!guardsPromise) {
    guardsPromise = loadPipeline()
      .then(async (pipeline) => {
        const bundle = pipeline.output;
        if (!bundle || bundle.guardrails.length === 0) {
          throw new Error("Output guardrails are not configured");
        }

        return instantiateGuardrails(bundle);
      })
      .catch((error: unknown) => {
        guardsPromise = null;
        throw error;
      });
  }

  return guardsPromise;
}

async function guardNamed(name: string) {
  const guards = await loadOutputGuards();
  const found = guards.find((guard) => guard.definition.name === name);
  if (!found) {
    throw new Error(`Output guardrail ${name} is not configured`);
  }

  return found;
}

function assertExecuted(result: GuardrailResult, name: string) {
  if (result.executionFailed) {
    throw new Error(`${name} failed`);
  }
}

function emptyStep(text: string): OutputGuardStep {
  return {
    text,
    blocked: false,
    summary: "No text to check",
    lines: ["No text to check."],
  };
}

/**
 * Masks configured PII in a reply or citation excerpt.
 *
 * Masking is applied from `checked_text` here. The guardrail package only
 * applies that replacement automatically in its pre-flight stage.
 *
 * @param text - Draft answer or excerpt
 * @returns Masked text and entity counts, without the detected values
 * @throws When the check fails to run or does not return masked text
 */
export async function maskOutputPii(text: string): Promise<OutputGuardStep> {
  if (!text.trim()) {
    return emptyStep(text);
  }

  const guard = await guardNamed("Contains PII");
  const result = await guard.run({}, text);
  assertExecuted(result, "Contains PII");

  if (result.tripwireTriggered) {
    throw new Error("Contains PII check failed");
  }

  const masked = result.info.checked_text;
  if (typeof masked !== "string") {
    throw new Error("Contains PII did not return masked text");
  }

  const lines = piiLines(result.info);
  const maskedCount = lines.filter((line) => line.startsWith("Masked ")).length;

  return {
    text: masked,
    blocked: false,
    summary:
      maskedCount > 0
        ? `Masked ${maskedCount} ${maskedCount === 1 ? "type" : "types"}`
        : "No sensitive details",
    lines,
  };
}

/**
 * Runs the output moderation categories on text that may be released.
 *
 * @param text - Answer after grounding
 * @returns The same text, or a replacement when moderation trips
 * @throws When the moderation check fails to run
 */
export async function checkOutputPolicy(text: string): Promise<OutputGuardStep> {
  if (!text.trim()) {
    return emptyStep(text);
  }

  const guard = await guardNamed("Moderation");
  const result = await guard.run(getGuardrailContext(), text);
  assertExecuted(result, "Moderation");

  if (!result.tripwireTriggered) {
    return {
      text,
      blocked: false,
      summary: "Allowed",
      lines: ["No disallowed content."],
    };
  }

  const categories = flaggedCategories(result.info);

  return {
    text: OUTPUT_POLICY_MESSAGE,
    blocked: true,
    summary: "Blocked",
    lines: [
      categories.length > 0
        ? `Flagged: ${categories.join(", ")}`
        : "Blocked by moderation.",
    ],
  };
}

/**
 * Blocks an answer that contains an API key or similar credential.
 *
 * @param text - Answer that may be released
 * @returns The same text, or a replacement when a credential is detected
 * @throws When the check fails to run
 */
export async function checkOutputSecrets(text: string): Promise<OutputGuardStep> {
  if (!text.trim()) {
    return emptyStep(text);
  }

  const guard = await guardNamed("Secret Keys");
  const result = await guard.run({}, text);
  assertExecuted(result, "Secret Keys");

  if (!result.tripwireTriggered) {
    return {
      text,
      blocked: false,
      summary: "None detected",
      lines: ["No credentials detected."],
    };
  }

  const count = secretCount(result.info);

  return {
    text: OUTPUT_SECRET_MESSAGE,
    blocked: true,
    summary: "Blocked",
    lines: [
      count > 1
        ? `Detected ${count} credentials.`
        : "Detected 1 credential.",
    ],
  };
}

/**
 * Checks whether claim text can be shown in the pipeline panel.
 *
 * A tripwire hides the quoted claims. It does not by itself replace an answer
 * that already passed the release checks.
 *
 * @param text - Claim spans joined together
 * @returns False when the spans include disallowed content or credentials
 */
export async function outputSpansAreDisclosable(text: string) {
  if (!text.trim()) {
    return true;
  }

  const policy = await checkOutputPolicy(text);
  if (policy.blocked) {
    return false;
  }

  const secrets = await checkOutputSecrets(text);
  return !secrets.blocked;
}

function piiLines(info: GuardrailResult["info"]) {
  const detected = info.detected_entities;
  if (!detected || typeof detected !== "object" || Array.isArray(detected)) {
    return ["No sensitive details detected."];
  }

  const lines: string[] = [];

  for (const [entity, values] of Object.entries(detected)) {
    if (!/^[A-Z0-9_]+$/.test(entity) || !Array.isArray(values)) {
      continue;
    }

    if (values.length > 0) {
      lines.push(`Masked ${values.length} ${entity}`);
    }
  }

  return lines.length > 0 ? lines : ["No sensitive details detected."];
}

function flaggedCategories(info: GuardrailResult["info"]) {
  const categories = info.flagged_categories;
  if (!Array.isArray(categories)) {
    return [];
  }

  return categories.filter((category): category is string => typeof category === "string");
}

function secretCount(info: GuardrailResult["info"]) {
  const secrets = info.detected_secrets;
  if (!Array.isArray(secrets) || secrets.length === 0) {
    return 1;
  }

  return secrets.length;
}
