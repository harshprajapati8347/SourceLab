export type PlanKey = "free" | "pro";

export type BillingSubscription = {
  status: string;
  plan: string;
  periodEnd: string | null;
  cancelAtPeriodEnd: boolean;
};

export type BillingSummary = {
  plan: PlanKey;
  credits: number;
  allowance: number;
  subscription: BillingSubscription | null;
};

export type PublicPricingPlan = {
  key: PlanKey;
  label: string;
  description: string;
  price: number;
  currency: string;
  featured: boolean;
  active: boolean;
  features: string[];
};
