/**
 * SourceLab plan allowances and credit prices.
 *
 * Credits are a mutable counter on `User` (not Stripe billing). Free never
 * refills. Pro hard-resets to `PLANS.pro.credits` on each paid cycle.
 *
 * Display amount is rupees (INR). Stripe charges the Price in
 * `STRIPE_PRO_PRICE_ID` — that id must be a `price_…` object, not `prod_…`.
 * Amount and currency on a Stripe Price are immutable; changing `PLANS.pro.price`
 * here does not change what Checkout charges.
 */

export const PLAN_CURRENCY = "INR" as const;

export const PLANS = {
  free: {
    label: "Free",
    credits: 10,
    price: 0,
  },
  pro: {
    label: "Pro",
    credits: 500,
    price: 499,
  },
} as const;

export type PlanKey = keyof typeof PLANS;

/**
 * Feature bullets shared by Free and Pro. The credit count is the only
 * difference between tiers — both include the full product.
 */
function planFeatureList(credits: number) {
  return [
    `${credits} credits`,
    "1 credit per source processed or learning tool",
    "0.1 credits per chat message",
    "Workspaces, sources, RAG chat, learning tools, and memory",
  ] as const;
}

/**
 * Credit cost per gated action. Chat is 0.1 (ten messages = 1 credit).
 * Artifact generation and a successfully processed source each cost 1.
 */
export const CREDIT_COSTS = {
  chatMessage: 0.1,
  artifactGeneration: 1,
  sourceProcessed: 1,
} as const;

export const MIN_CREDITS_TO_GENERATE = CREDIT_COSTS.chatMessage;

export const INSUFFICIENT_CREDITS_MESSAGE =
  "You're out of credits. Upgrade to Pro.";

export const PRICING_PLANS = [
  {
    key: "free",
    label: "Free",
    description:
      "Try SourceLab with a one-time credit grant. Credits never refill on Free.",
    price: PLANS.free.price,
    currency: PLAN_CURRENCY,
    featured: false,
    planId: null,
    active: true,
    features: planFeatureList(PLANS.free.credits),
  },
  {
    key: "pro",
    label: "Pro",
    description:
      "More room to chat, generate study tools, and index sources each month. Credits hard-reset on renewal.",
    price: PLANS.pro.price,
    currency: PLAN_CURRENCY,
    featured: true,
    planId: process.env.STRIPE_PRO_PRICE_ID ?? null,
    active: true,
    features: planFeatureList(PLANS.pro.credits),
  },
] as const;

export type PublicPricingPlan = {
  key: PlanKey;
  label: string;
  description: string;
  price: number;
  currency: typeof PLAN_CURRENCY;
  featured: boolean;
  active: boolean;
  features: readonly string[];
};

/**
 * Public pricing payload (no Stripe price ids).
 *
 * @returns Display fields for the pricing page
 */
export function getPublicPricingPlans(): PublicPricingPlan[] {
  return PRICING_PLANS.map((plan) => ({
    key: plan.key,
    label: plan.label,
    description: plan.description,
    price: plan.price,
    currency: plan.currency,
    featured: plan.featured,
    active: plan.active,
    features: plan.features,
  }));
}
