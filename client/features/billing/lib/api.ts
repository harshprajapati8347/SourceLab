import { apiFetch } from "@/shared/lib/api";
import type { BillingSummary, PublicPricingPlan } from "./types";

export function getBillingMe() {
  return apiFetch<BillingSummary>("/api/billing/me");
}

export function listPricingPlans() {
  return apiFetch<PublicPricingPlan[]>("/api/billing/plans");
}
