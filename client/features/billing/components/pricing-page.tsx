"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { authClient } from "@/features/auth/lib/auth-client";
import { authRoutes } from "@/features/auth/lib/auth-routes";
import { useSession } from "@/features/auth/hooks/use-session";
import { ApiError } from "@/shared/lib/api";
import { usePricingPlans } from "../hooks/use-billing";
import { formatPlanPrice } from "../lib/constants";
import { billingRoutes } from "../lib/routes";
import { cn } from "@/lib/utils";

export function PricingPage() {
  const { data: plans, isLoading, error } = usePricingPlans();
  const { data: session } = useSession();
  const [actionError, setActionError] = useState<string | null>(null);
  const [isUpgrading, setIsUpgrading] = useState(false);

  async function handleUpgrade() {
    setActionError(null);
    setIsUpgrading(true);

    const { error: upgradeError } = await authClient.subscription.upgrade({
      plan: "pro",
      successUrl: `${window.location.origin}${billingRoutes.settings}`,
      cancelUrl: `${window.location.origin}${billingRoutes.pricing}`,
    });

    if (upgradeError) {
      setActionError(
        upgradeError.message ?? "Could not start checkout. Try again.",
      );
      setIsUpgrading(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-svh w-full max-w-5xl flex-col gap-10 p-6 md:p-10">
      <div className="space-y-3 text-center">
        <h1 className="font-heading text-3xl font-semibold tracking-tight">
          Pricing
        </h1>
        <p className="mx-auto max-w-xl text-sm text-muted-foreground">
          Start on Free with a one-time credit grant. Upgrade to Pro for a
          monthly credit reset. Both plans include the full product.
        </p>
      </div>

      {isLoading ? (
        <div className="grid gap-6 md:grid-cols-2">
          <Skeleton className="h-80 rounded-3xl" />
          <Skeleton className="h-80 rounded-3xl" />
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-dashed p-10 text-center">
          <p className="font-medium">Could not load plans</p>
          <p className="mt-2 text-sm text-muted-foreground">
            {error instanceof ApiError ? error.message : "Try again later."}
          </p>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {plans?.map((plan) => (
            <Card
              key={plan.key}
              className={cn(
                "rounded-3xl",
                plan.featured && "border-primary shadow-sm",
              )}
            >
              <CardHeader>
                <CardTitle className="font-heading">{plan.label}</CardTitle>
                <CardDescription>{plan.description}</CardDescription>
                <p className="pt-2 font-heading text-3xl font-semibold">
                  {plan.price === 0
                    ? "Free"
                    : formatPlanPrice(plan.price, plan.currency)}
                  {plan.price > 0 ? (
                    <span className="text-base font-normal text-muted-foreground">
                      /month
                    </span>
                  ) : null}
                </p>
              </CardHeader>
              <CardContent className="grid gap-6">
                <ul className="grid gap-2 text-sm">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2">
                      <CheckIcon className="mt-0.5 size-4 shrink-0 text-primary" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                {plan.key === "free" ? (
                  <Button
                    nativeButton={false}
                    variant="outline"
                    render={
                      <Link
                        href={
                          session?.user ? authRoutes.dashboard : authRoutes.signup
                        }
                      />
                    }
                  >
                    {session?.user ? "Go to dashboard" : "Get started"}
                  </Button>
                ) : session?.user ? (
                  <Button
                    onClick={() => void handleUpgrade()}
                    disabled={isUpgrading}
                  >
                    {isUpgrading ? <Spinner /> : null}
                    Upgrade to Pro
                  </Button>
                ) : (
                  <Button
                    nativeButton={false}
                    render={
                      <Link
                        href={`${authRoutes.login}?callbackUrl=${billingRoutes.pricing}`}
                      />
                    }
                  >
                    Sign in to upgrade
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {actionError ? (
        <p className="text-center text-sm text-destructive">{actionError}</p>
      ) : null}

      <p className="text-center text-sm text-muted-foreground">
        <Link href={authRoutes.home} className="underline underline-offset-4">
          Back home
        </Link>
      </p>
    </div>
  );
}
