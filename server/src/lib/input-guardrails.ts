/**
 * Input guardrails for workspace chat.
 *
 * Checks the latest user message with the local input guards before
 * conversation creation, credit deduction, retrieval, or the AI SDK stream.
 * A rejection becomes {@link InputBlockedError} so Express returns JSON
 * instead of a stream.
 */

import { guardrailsConfig } from "./config/guardrails.js";
import { InputGuardService } from "./guardrails/input/InputGuardService.js";
import { InputGuardError } from "./shared/errors.js";
import { InputBlockedError } from "../types/app-error.js";

const PII_BLOCKED_MESSAGE =
  "Your message couldn't be processed because it contains personal or sensitive information. Please remove it and try again.";

const INPUT_BLOCKED_MESSAGES: Record<string, string> = {
  PiiGuard: PII_BLOCKED_MESSAGE,
  EmptyQueryGuard:
    "Your message couldn't be processed because it was empty. Please enter a question and try again.",
  MaxLengthGuard:
    "Your message couldn't be processed because it is too long. Please shorten it and try again.",
  PromptInjectionGuard:
    "Your message couldn't be processed because it tried to override the assistant's instructions. Please rephrase it and try again.",
  JailbreakGuard:
    "Your message couldn't be processed because it tried to bypass safety checks. Please rephrase it and try again.",
  SqlInjectionGuard:
    "Your message couldn't be processed because it looks like a database attack. Please rephrase it and try again.",
  XssGuard:
    "Your message couldn't be processed because it contains unsafe markup. Please remove it and try again.",
  PathTraversalGuard:
    "Your message couldn't be processed because it looks like a file-path attack. Please rephrase it and try again.",
  UrlGuard:
    "Your message couldn't be processed because external links are not allowed. Please remove the link and try again.",
  SpamGuard:
    "Your message couldn't be processed because it looks like spam. Please revise it and try again.",
};

const GENERIC_INPUT_BLOCKED_MESSAGE =
  "Your message couldn't be processed because it didn't pass a safety check. Please revise it and try again.";

let inputGuards: InputGuardService | null = null;

function getInputGuards() {
  inputGuards ??= new InputGuardService(guardrailsConfig);
  return inputGuards;
}

/**
 * Maps a local input rejection to a client-safe 400.
 *
 * The response includes the guard name and the original user message so the
 * composer can restore it. Detected values and the matched text stay on the
 * server.
 *
 * @param error - Rejection raised by {@link assertChatInputAllowed}
 * @param message - Exact user text that was checked
 * @returns Application error the global handler serializes as JSON
 */
export function toInputBlockedError(error: InputGuardError, message: string) {
  console.warn(`Input guardrail blocked request: ${error.guardName}`);
  return new InputBlockedError(
    INPUT_BLOCKED_MESSAGES[error.guardName] ?? GENERIC_INPUT_BLOCKED_MESSAGE,
    {
      code: "INPUT_BLOCKED",
      guardrail: error.guardName,
      message,
    },
  );
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
 * An allowed message is returned after any sanitizing guard (Unicode
 * normalization, control characters). A rejection stops the request before
 * RAG. A guard that fails to execute is rethrown so the request fails closed.
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
