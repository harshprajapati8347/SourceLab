/**
 * Output guardrails for a drafted chat answer.
 *
 * Length and chain-of-thought checks run on the text that would be released.
 * A rejection replaces that text. The draft is not returned.
 */

import { guardrailsConfig } from "./config/guardrails.js";
import { OutputGuardService } from "./guardrails/output/OutputGuardService.js";
import type { ChatResponse } from "./core/models.js";
import { OutputGuardError } from "./shared/errors.js";

export const OUTPUT_CHECK_FAILED_MESSAGE =
  "I couldn't check this answer safely, so I didn't send it.";

export const OUTPUT_BLOCKED_MESSAGE =
  "This answer wasn't shown because it didn't pass a safety check.";

export type OutputGuardStep = {
  text: string;
  blocked: boolean;
  summary: string;
  lines: string[];
};

type OutputChecker = {
  validateAndSanitize(response: ChatResponse): Promise<ChatResponse>;
};

let outputGuards: OutputGuardService | null = null;

function getOutputGuards() {
  outputGuards ??= new OutputGuardService(guardrailsConfig);
  return outputGuards;
}

/**
 * Text written to the client after an output check.
 *
 * A failed check withholds the draft. A completed check returns its text,
 * which is a replacement when the guard blocked.
 *
 * @param step - Completed check, when one finished
 * @param failed - True when the check threw
 * @returns The reply that may be released
 */
export function textReleasedAfterOutputCheck(
  step: OutputGuardStep | undefined,
  failed: boolean,
) {
  if (failed || !step) {
    return OUTPUT_CHECK_FAILED_MESSAGE;
  }

  return step.text;
}

/**
 * Runs the local output guards on text that may be released.
 *
 * @param text - Answer after grounding and release transforms
 * @param service - Guard runner. Tests can pass a double.
 * @returns The same text, or a replacement when a guard rejects
 * @throws When a guard fails to execute
 */
export async function checkOutputGuards(
  text: string,
  service: OutputChecker = getOutputGuards(),
): Promise<OutputGuardStep> {
  try {
    const checked = await service.validateAndSanitize({
      message: { role: "assistant", content: text },
      sources: [],
    });

    return {
      text: checked.message.content,
      blocked: false,
      summary: "Allowed",
      lines: ["Length and chain-of-thought checks passed."],
    };
  } catch (error) {
    if (error instanceof OutputGuardError) {
      return {
        text: OUTPUT_BLOCKED_MESSAGE,
        blocked: true,
        summary: "Blocked",
        lines: [`Blocked by ${error.guardName}.`],
      };
    }

    throw error;
  }
}
