/**
 * Billing reads and Stripe-webhook → Inngest credit lifecycle.
 *
 * Prisma writes for `User.credits` / `User.plan` run in the Inngest worker,
 * not inline in the webhook request.
 */

import type Stripe from "stripe";
import {
  getPublicPricingPlans,
  PLANS,
  type PublicPricingPlan,
} from "../config/plans.js";
import {
  enqueueBillingCreditApply,
  type BillingCreditAction,
} from "../lib/billing-events.js";
import { findActiveSubscriptionByReferenceId } from "../repositories/subscription.repository.js";
import {
  findUserBillingById,
  findUserByStripeCustomerId,
  setUserPlan,
  setUserPlanAndCredits,
} from "../repositories/user.repository.js";
import { NotFoundError } from "../types/app-error.js";

export type BillingSummary = {
  plan: "free" | "pro";
  credits: number;
  allowance: number;
  subscription: {
    status: string;
    plan: string;
    periodEnd: string | null;
    cancelAtPeriodEnd: boolean;
  } | null;
};

/**
 * Current plan, remaining credits, and Stripe subscription snapshot for a user.
 *
 * @param userId - Authenticated user's id
 * @returns Billing summary for settings / credits badge
 * @throws {NotFoundError} When the user row is missing
 */
export async function getBillingForUser(
  userId: string,
): Promise<BillingSummary> {
  const user = await findUserBillingById(userId);

  if (!user) {
    throw new NotFoundError("User not found");
  }

  const plan = user.plan === "pro" ? "pro" : "free";
  const subscription = await findActiveSubscriptionByReferenceId(userId);

  return {
    plan,
    credits: Number(user.credits),
    allowance: PLANS[plan].credits,
    subscription: subscription
      ? {
          status: subscription.status ?? "incomplete",
          plan: subscription.plan,
          periodEnd: subscription.periodEnd?.toISOString() ?? null,
          cancelAtPeriodEnd: Boolean(subscription.cancelAtPeriodEnd),
        }
      : null,
  };
}

/**
 * Display plans for the public pricing page (no Stripe price ids).
 */
export function listPublicPricingPlans(): PublicPricingPlan[] {
  return getPublicPricingPlans();
}

/**
 * Applies a credit/plan change. Invoked from the Inngest `billing/credits.apply` job.
 *
 * Activate and renew both overwrite credits to the Pro allowance (idempotent).
 * Downgrade only flips `plan` — leftover credits are kept.
 *
 * @param userId - User whose row to update
 * @param action - Lifecycle event from Stripe
 */
export async function applyCreditLifecycle(
  userId: string,
  action: BillingCreditAction,
) {
  if (action === "activate_pro" || action === "renew_pro") {
    await setUserPlanAndCredits(userId, "pro", PLANS.pro.credits);
    return;
  }

  await setUserPlan(userId, "free");
}

/**
 * Enqueues Pro activation after checkout completes.
 *
 * @param userId - Subscription reference id (user id)
 */
export async function queueProActivation(userId: string) {
  await enqueueBillingCreditApply({ userId, action: "activate_pro" });
}

/**
 * Enqueues a Free downgrade after the Stripe subscription has actually ended.
 *
 * @param userId - Subscription reference id (user id)
 */
export async function queueDowngradeToFree(userId: string) {
  await enqueueBillingCreditApply({ userId, action: "downgrade_free" });
}

/**
 * Handles `invoice.paid` for Pro period renewals (hard-reset credits).
 *
 * Ignores the first invoice (`subscription_create`) — activation is driven by
 * `onSubscriptionComplete`. Only `subscription_cycle` renews credits.
 *
 * @param event - Stripe webhook event from the Better Auth plugin
 */
export async function handleStripeInvoicePaid(event: Stripe.Event) {
  if (event.type !== "invoice.paid") {
    return;
  }

  const invoice = event.data.object;
  if (invoice.billing_reason !== "subscription_cycle") {
    return;
  }

  const customerId =
    typeof invoice.customer === "string"
      ? invoice.customer
      : invoice.customer &&
          typeof invoice.customer === "object" &&
          "id" in invoice.customer
        ? invoice.customer.id
        : null;

  if (!customerId) {
    return;
  }

  const user = await findUserByStripeCustomerId(customerId);
  if (!user) {
    return;
  }

  await enqueueBillingCreditApply({ userId: user.id, action: "renew_pro" });
}
