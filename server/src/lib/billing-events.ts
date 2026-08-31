/**
 * Inngest event helpers for applying plan/credit changes from Stripe webhooks.
 */

import { inngest } from "../inngest/client.js";

export type BillingCreditAction =
  | "activate_pro"
  | "renew_pro"
  | "downgrade_free";

/**
 * Enqueues a credit lifecycle job. The webhook handler returns after this send;
 * Prisma writes happen in the Inngest worker.
 *
 * @param input - User to update and the lifecycle action
 */
export async function enqueueBillingCreditApply(input: {
  userId: string;
  action: BillingCreditAction;
}) {
  await inngest.send({
    name: "billing/credits.apply",
    data: input,
  });
}
