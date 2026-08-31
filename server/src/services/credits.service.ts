/**
 * Credit balance checks and atomic deductions.
 *
 * Call {@link checkAndDeductCredits} before any OpenAI-backed work. Concurrent
 * requests cannot drive the balance negative because the update is guarded in SQL.
 */

import {
  CREDIT_COSTS,
  INSUFFICIENT_CREDITS_MESSAGE,
} from "../config/plans.js";
import {
  decrementCreditsIfAvailable,
  findUserBillingById,
} from "../repositories/user.repository.js";
import { PaymentRequiredError } from "../types/app-error.js";

export { CREDIT_COSTS, INSUFFICIENT_CREDITS_MESSAGE };

/**
 * Throws if the user currently has fewer than `amount` credits.
 *
 * This is a preflight read for enqueueing work (e.g. source ingest). The
 * actual charge for sources happens atomically when processing succeeds.
 *
 * @param userId - Authenticated user's id
 * @param amount - Minimum credits required
 * @throws {PaymentRequiredError} When the balance is too low
 */
export async function assertMinimumCredits(userId: string, amount: number) {
  const user = await findUserBillingById(userId);
  const credits = user ? Number(user.credits) : 0;

  if (credits < amount) {
    throw new PaymentRequiredError(INSUFFICIENT_CREDITS_MESSAGE);
  }
}

/**
 * Atomically checks and deducts credits for a generation action.
 *
 * @param userId - Authenticated user's id
 * @param amount - Credits to deduct (e.g. 0.1 for chat, 1 for an artifact)
 * @throws {PaymentRequiredError} When the user has fewer than `amount` credits
 */
export async function checkAndDeductCredits(
  userId: string,
  amount: number,
): Promise<void> {
  const updated = await decrementCreditsIfAvailable(userId, amount);

  if (!updated) {
    throw new PaymentRequiredError(INSUFFICIENT_CREDITS_MESSAGE);
  }
}
