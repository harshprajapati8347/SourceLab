/**
 * Output guardrails for a drafted chat answer.
 *
 * PII is masked in place. A real credential is redacted in place. Moderation
 * replaces the whole answer when it trips. Detected values are not returned
 * for logs or the UI.
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

  const checked = result.info.checked_text;
  if (typeof checked !== "string") {
    throw new Error("Contains PII did not return masked text");
  }

  // The package phone pattern is 3-3-4. Indian mobiles such as
  // "+91 98765 43210" are masked here and reported as PHONE_NUMBER.
  const supplemental = maskSupplementalPhones(checked);
  const lines = withPhoneCount(piiLines(result.info), supplemental.count);
  const maskedCount = lines.filter((line) => line.startsWith("Masked ")).length;
  const masked = supplemental.text;

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
 * Redacts an API key or similar credential and keeps the rest of the answer.
 *
 * Hyphenated words with no digits, such as `key-points`, and ordinary URLs
 * are ignored. Phone numbers are PII, not credentials. A phone that the PII
 * step masks leaves this step clear. Detected values are not included in the
 * trace lines.
 *
 * @param text - Answer that may be released
 * @returns The same text, or that text with each real credential replaced by `<SECRET>`
 * @throws When the check fails to run
 */
export async function checkOutputSecrets(text: string): Promise<OutputGuardStep> {
  if (!text.trim()) {
    return emptyStep(text);
  }

  const guard = await guardNamed("Secret Keys");
  const result = await guard.run({}, text);
  assertExecuted(result, "Secret Keys");

  const secrets = secretValues(result.info).filter(
    (token) => !isIgnorableSecret(token),
  );

  if (!result.tripwireTriggered || secrets.length === 0) {
    return {
      text,
      blocked: false,
      summary: "None detected",
      lines: ["No credentials detected."],
    };
  }

  const summary =
    secrets.length === 1
      ? "Masked 1 credential"
      : `Masked ${secrets.length} credentials`;

  return {
    text: redactSecrets(text, secrets),
    blocked: false,
    summary,
    lines: [`${summary}.`],
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
  return secrets.text === text;
}

const SECRET_KEY_MARKERS = [
  "sk-",
  "sk_",
  "pk_",
  "pk-",
  "ghp_",
  "AKIA",
  "xox",
  "hf_",
  "SG.",
];

/**
 * Drops tokens the secret check flags that are ordinary words or links.
 *
 * A URL that itself contains a key marker is still treated as a credential.
 */
function isIgnorableSecret(token: string) {
  if (/^[A-Za-z]+(?:-[A-Za-z]+)+$/.test(token)) {
    return true;
  }

  if (/^https?:\/\//i.test(token)) {
    return !SECRET_KEY_MARKERS.some((marker) => token.includes(marker));
  }

  return false;
}

function redactSecrets(text: string, secrets: string[]) {
  const ordered = [...secrets].sort((left, right) => right.length - left.length);
  let next = text;

  for (const secret of ordered) {
    next = next.split(secret).join("<SECRET>");
  }

  return next;
}

function secretValues(info: GuardrailResult["info"]) {
  const secrets = info.detected_secrets;
  if (!Array.isArray(secrets)) {
    return [];
  }

  return secrets.filter(
    (value): value is string => typeof value === "string" && value.length > 0,
  );
}

const SUPPLEMENTAL_PHONE_PATTERNS = [
  /\+\s*91(?:[\s.-]*\d){10}\b/g,
  /\b0[6-9]\d{4}[\s.-]?\d{5}\b/g,
  /\b[6-9]\d{4}[\s.-]\d{5}\b/g,
];

/**
 * Masks phone numbers the guardrail package's 3-3-4 pattern does not match.
 *
 * `+91` forms are replaced before the 5-5 grouping so the country code is
 * included in the same placeholder.
 *
 * @param text - Text already passed through the package PII check
 * @returns Masked text and how many extra phone numbers were found
 */
export function maskSupplementalPhones(text: string) {
  let count = 0;
  let next = text;

  for (const pattern of SUPPLEMENTAL_PHONE_PATTERNS) {
    next = next.replace(pattern, () => {
      count += 1;
      return "<PHONE_NUMBER>";
    });
  }

  return { text: next, count };
}

function withPhoneCount(lines: string[], count: number) {
  if (count === 0) {
    return lines;
  }

  const cleaned = lines.filter(
    (line) => line !== "No sensitive details detected.",
  );
  const index = cleaned.findIndex((line) =>
    /^Masked \d+ PHONE_NUMBER$/.test(line),
  );

  if (index === -1) {
    cleaned.push(`Masked ${count} PHONE_NUMBER`);
    return cleaned;
  }

  const current = Number(cleaned[index]?.match(/\d+/)?.[0] ?? 0);
  cleaned[index] = `Masked ${current + count} PHONE_NUMBER`;
  return cleaned;
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
