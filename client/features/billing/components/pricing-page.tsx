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
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { authClient } from "@/features/auth/lib/auth-client";
import { authRoutes } from "@/features/auth/lib/auth-routes";
import { useSession } from "@/features/auth/hooks/use-session";
import { BrandMark } from "@/shared/components/brand-mark";
import { getErrorMessage } from "@/shared/lib/api";
import { usePricingPlans } from "../hooks/use-billing";
import { formatPlanPrice } from "../lib/constants";
import { billingRoutes } from "../lib/routes";
import { cn } from "@/lib/utils";

type PricingPageProps = {
  embedded?: boolean;
};

export function PricingPage({ embedded = false }: PricingPageProps) {
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

  const Heading = embedded ? "h2" : "h1";

  const content = (
    <div
      id={embedded ? "pricing" : undefined}
      className={cn(
        "mx-auto flex w-full max-w-5xl flex-col gap-10 px-4 py-12 md:px-8 md:py-16",
        embedded && "scroll-mt-24",
      )}
    >
      <div className="space-y-3 text-center">
        <Heading className="font-heading text-3xl font-bold tracking-tight">
          Pricing
        </Heading>
        <p className="mx-auto max-w-xl text-sm text-muted-foreground">
          Start on Free with a one-time credit grant. Upgrade to Pro for a
          monthly credit reset. Both plans include the full product.
        </p>
      </div>

      {isLoading ? (
        <div className="grid gap-6 md:grid-cols-2">
          <Skeleton className="h-80 rounded-xl" />
          <Skeleton className="h-80 rounded-xl" />
        </div>
      ) : error ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyTitle>Could not load plans</EmptyTitle>
            <EmptyDescription>
              {getErrorMessage(error, "Try again in a moment.")}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {plans?.map((plan) => (
            <Card
              key={plan.key}
              className={cn(plan.featured && "border-primary")}
            >
              <CardHeader>
                <CardTitle className="font-heading">{plan.label}</CardTitle>
                <CardDescription>{plan.description}</CardDescription>
                <p className="pt-2 font-heading text-3xl font-bold tracking-tight">
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
                      <CheckIcon className="mt-0.5 size-4 shrink-0 text-primary-ink" />
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
        <p role="alert" className="text-center text-sm text-destructive">
          {actionError}
        </p>
      ) : null}

    </div>
  );

  if (embedded) {
    return content;
  }

  return (
    <div className="min-h-svh bg-background">
      <header className="border-b">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 md:px-8">
          <Link
            href={authRoutes.home}
            aria-label="SourceLab home"
            className="rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
          >
            <BrandMark />
          </Link>
          <Button
            nativeButton={false}
            variant="outline"
            size="sm"
            render={
              <Link
                href={session?.user ? authRoutes.dashboard : authRoutes.login}
              />
            }
          >
            {session?.user ? "Go to dashboard" : "Sign in"}
          </Button>
        </div>
      </header>
      {content}
    </div>
  );
}
