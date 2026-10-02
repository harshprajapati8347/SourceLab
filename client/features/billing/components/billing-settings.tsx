"use client";

import { useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
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
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { authClient } from "@/features/auth/lib/auth-client";
import { AccountShell } from "@/features/workspaces/components/account-shell";
import { getErrorMessage } from "@/shared/lib/api";
import { useBilling } from "../hooks/use-billing";
import { formatCreditCount } from "../lib/constants";
import { billingRoutes } from "../lib/routes";

export function BillingSettings() {
  const { data, isLoading, error, refetch } = useBilling();
  const [actionError, setActionError] = useState<string | null>(null);
  const [isUpgrading, setIsUpgrading] = useState(false);
  const [isOpeningPortal, setIsOpeningPortal] = useState(false);

  const isPro = data?.plan === "pro";
  const hasStripeSubscription = Boolean(data?.subscription);

  async function handleUpgrade() {
    setActionError(null);
    setIsUpgrading(true);

    const { error: upgradeError } = await authClient.subscription.upgrade({
      plan: "pro",
      successUrl: `${window.location.origin}${billingRoutes.settings}`,
      cancelUrl: `${window.location.origin}${billingRoutes.settings}`,
    });

    if (upgradeError) {
      setActionError(
        upgradeError.message ?? "Could not start checkout. Try again.",
      );
      setIsUpgrading(false);
    }
  }

  async function handleManageBilling() {
    setActionError(null);
    setIsOpeningPortal(true);

    const { error: portalError } = await authClient.subscription.billingPortal({
      returnUrl: `${window.location.origin}${billingRoutes.settings}`,
    });

    if (portalError) {
      setActionError(
        portalError.message ?? "Could not open the billing portal.",
      );
      setIsOpeningPortal(false);
    }
  }

  return (
    <AccountShell
      title="Billing and credits"
      description="Free includes a one-time grant of credits. Pro refills them every billing period; unused Pro credits do not roll over."
    >
      {isLoading ? (
        <Skeleton
          className="h-48 rounded-xl"
          aria-busy="true"
          aria-label="Loading billing"
        />
      ) : error && !data ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyTitle>Could not load billing</EmptyTitle>
            <EmptyDescription>
              {getErrorMessage(error, "Check your connection and try again.")}
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button onClick={() => void refetch()}>Try again</Button>
          </EmptyContent>
        </Empty>
      ) : data ? (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <CardTitle>Current plan</CardTitle>
              <Badge variant={isPro ? "default" : "secondary"}>
                {isPro ? "Pro" : "Free"}
              </Badge>
            </div>
            <CardDescription>
              <span className="font-heading text-2xl font-bold text-foreground tabular-nums">
                {formatCreditCount(data.credits)}
              </span>{" "}
              credits left
              {isPro
                ? ` of ${formatCreditCount(data.allowance)} this period`
                : `. The Free grant is ${formatCreditCount(data.allowance)} credits and does not refill`}
              .
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            {data.subscription?.cancelAtPeriodEnd &&
            data.subscription.periodEnd ? (
              <p className="text-sm text-muted-foreground">
                Cancels on{" "}
                {new Date(data.subscription.periodEnd).toLocaleDateString()}.
                You keep Pro until then.
              </p>
            ) : null}

            {actionError ? (
              <p role="alert" className="text-sm text-destructive">
                {actionError}
              </p>
            ) : null}

            <div className="flex flex-wrap gap-2">
              {!isPro ? (
                <Button
                  onClick={() => void handleUpgrade()}
                  disabled={isUpgrading}
                >
                  {isUpgrading ? <Spinner /> : null}
                  Upgrade to Pro
                </Button>
              ) : null}
              {hasStripeSubscription ? (
                <Button
                  variant="outline"
                  onClick={() => void handleManageBilling()}
                  disabled={isOpeningPortal}
                >
                  {isOpeningPortal ? <Spinner /> : null}
                  Manage billing
                </Button>
              ) : null}
              <Button
                nativeButton={false}
                variant="ghost"
                render={<Link href={billingRoutes.pricing} />}
              >
                Compare plans
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </AccountShell>
  );
}
