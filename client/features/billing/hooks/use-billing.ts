"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getBillingMe, listPricingPlans } from "../lib/api";

export const billingKeys = {
  all: ["billing"] as const,
  me: () => ["billing", "me"] as const,
  plans: () => ["billing", "plans"] as const,
};

export function useBilling(enabled = true) {
  return useQuery({
    queryKey: billingKeys.me(),
    queryFn: getBillingMe,
    enabled,
    refetchInterval: 15_000,
  });
}

export function usePricingPlans() {
  return useQuery({
    queryKey: billingKeys.plans(),
    queryFn: listPricingPlans,
  });
}

/**
 * Invalidates cached billing/credits queries (after a paid action or 402).
 */
export function useInvalidateBilling() {
  const queryClient = useQueryClient();

  return () => queryClient.invalidateQueries({ queryKey: billingKeys.all });
}
