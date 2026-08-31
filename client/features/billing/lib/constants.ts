export const INSUFFICIENT_CREDITS_MESSAGE =
  "You're out of credits. Upgrade to Pro.";

/**
 * Formats a credit balance for display (one decimal when needed).
 */
export function formatCreditCount(credits: number) {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  }).format(credits);
}

/**
 * Formats a plan's monthly price in the plan currency (INR).
 */
export function formatPlanPrice(amount: number, currency: string) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}
