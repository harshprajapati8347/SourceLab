/**
 * Transactional email via Resend (verification and password reset).
 *
 * When `RESEND_API_KEY` or `RESEND_FROM_EMAIL` is missing, the message is
 * written to the server log so local development can still copy the link.
 */

import { Resend } from "resend";

type SendAuthEmailInput = {
  to: string;
  subject: string;
  text: string;
};

let resendClient: Resend | null | undefined;

function getResendClient() {
  if (resendClient !== undefined) {
    return resendClient;
  }

  const apiKey = process.env.RESEND_API_KEY?.trim();
  resendClient = apiKey ? new Resend(apiKey) : null;
  return resendClient;
}

/**
 * Sends a plain-text auth email, or logs the contents when Resend is not configured.
 *
 * @param input - Recipient, subject, and body (includes the Better Auth action URL)
 */
export async function sendAuthEmail(input: SendAuthEmailInput) {
  const from = process.env.RESEND_FROM_EMAIL?.trim();
  const resend = getResendClient();

  if (!resend || !from) {
    console.warn(
      `[email] Resend is not configured. ${input.subject} → ${input.to}\n${input.text}`,
    );
    return;
  }

  const { error } = await resend.emails.send({
    from,
    to: input.to,
    subject: input.subject,
    text: input.text,
  });

  if (error) {
    throw new Error(error.message);
  }
}
