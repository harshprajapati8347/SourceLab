/**
 * Prisma queries for Better Auth Stripe `subscription` rows.
 */

import { Prisma } from "../generated/prisma/client.js";
import prisma from "../lib/db.js";

export const subscriptionSelect = {
  id: true,
  plan: true,
  referenceId: true,
  stripeCustomerId: true,
  stripeSubscriptionId: true,
  status: true,
  periodStart: true,
  periodEnd: true,
  cancelAtPeriodEnd: true,
  cancelAt: true,
  canceledAt: true,
  endedAt: true,
} as const;

export type SubscriptionRecord = Prisma.SubscriptionGetPayload<{
  select: typeof subscriptionSelect;
}>;

/**
 * Latest active or trialing subscription for a user (referenceId = user id).
 */
export function findActiveSubscriptionByReferenceId(referenceId: string) {
  return prisma.subscription.findFirst({
    where: {
      referenceId,
      status: { in: ["active", "trialing"] },
    },
    select: subscriptionSelect,
    orderBy: { periodEnd: "desc" },
  });
}
