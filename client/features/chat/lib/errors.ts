/**
 * Raised when the server's input guardrails refuse a message. Carries the
 * original text so the composer can put it back for editing.
 */
export class InputBlockedError extends Error {
  readonly draft: string;

  constructor(message: string, draft: string) {
    super(message);
    this.name = "InputBlockedError";
    this.draft = draft;
  }
}
