/**
 * Prisma queries for User billing fields (`credits`, `plan`, `stripeCustomerId`).
 */

import { Prisma } from "../generated/prisma/client.js";
import prisma from "../lib/db.js";

export const userBillingSelect = {
  id: true,
  email: true,
  credits: true,
  plan: true,
  stripeCustomerId: true,
} as const;

export type UserBillingRecord = Prisma.UserGetPayload<{
  select: typeof userBillingSelect;
}>;

function toCreditDecimal(amount: number) {
  return new Prisma.Decimal(amount.toFixed(1));
}

export function findUserBillingById(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: userBillingSelect,
  });
}

export function findUserByStripeCustomerId(stripeCustomerId: string) {
  return prisma.user.findFirst({
    where: { stripeCustomerId },
    select: userBillingSelect,
  });
}

/**
 * Atomically decrements credits when the balance is at least `amount`.
 *
 * @returns Whether a row was updated (false means insufficient credits)
 */
export async function decrementCreditsIfAvailable(
  userId: string,
  amount: number,
) {
  const cost = toCreditDecimal(amount);
  const result = await prisma.user.updateMany({
    where: {
      id: userId,
      credits: { gte: cost },
    },
    data: {
      credits: { decrement: cost },
    },
  });

  return result.count === 1;
}

export async function setUserPlanAndCredits(
  userId: string,
  plan: string,
  credits: number,
) {
  await prisma.user.update({
    where: { id: userId },
    data: {
      plan,
      credits: toCreditDecimal(credits),
    },
  });
}

export async function setUserPlan(userId: string, plan: string) {
  await prisma.user.update({
    where: { id: userId },
    data: { plan },
  });
}
