/**
 * Input guardrails for workspace chat.
 *
 * Checks the latest user message with the local PII guard before conversation
 * creation, credit deduction, retrieval, or the AI SDK stream. A rejection
 * becomes {@link InputBlockedError} so Express returns JSON instead of a stream.
 */

import { guardrailsConfig } from "./config/guardrails.js";
import { InputGuardService } from "./guardrails/input/InputGuardService.js";
import { InputGuardError } from "./shared/errors.js";
import { InputBlockedError } from "../types/app-error.js";

const PII_BLOCKED_MESSAGE =
  "Your message couldn't be processed because it contains personal or sensitive information. Please remove it and try again.";

let inputGuards: InputGuardService | null = null;

function getInputGuards() {
  inputGuards ??= new InputGuardService(guardrailsConfig);
  return inputGuards;
}

/**
 * Maps a local input rejection to a client-safe 400.
 *
 * The response includes the guard name and the original user message so the
 * composer can restore it. Detected values stay on the server.
 *
 * @param error - Rejection raised by {@link assertChatInputAllowed}
 * @param message - Exact user text that was checked
 * @returns Application error the global handler serializes as JSON
 */
export function toInputBlockedError(error: InputGuardError, message: string) {
  console.warn(`Input guardrail blocked request: ${error.guardName}`);
  return new InputBlockedError(PII_BLOCKED_MESSAGE, {
    code: "INPUT_BLOCKED",
    guardrail: error.guardName,
    message,
  });
}

export type ChatInputDecision = {
  /** Text sent to retrieval and the model. The stored user message stays original. */
  textForModel: string;
  /** Always false. Embedded-instruction rewriting is not part of this gate. */
  ignoredEmbeddedInstructions: false;
};

/**
 * Runs the local input guards on the latest user message.
 *
 * An allowed message is returned unchanged. A PII rejection stops the request
 * before RAG. A guard that fails to execute is rethrown so the request fails
 * closed.
 *
 * @param text - Latest user message text
 * @returns The text to retrieve and generate from
 * @throws {InputBlockedError} When a configured check blocks the text
 */
export async function assertChatInputAllowed(
  text: string,
): Promise<ChatInputDecision> {
  try {
    const result = await getInputGuards().validateAndSanitize({ query: text });
    return {
      textForModel: result.query,
      ignoredEmbeddedInstructions: false,
    };
  } catch (error) {
    if (error instanceof InputGuardError) {
      throw toInputBlockedError(error, text);
    }

    throw error;
  }
}
