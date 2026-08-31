"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeftIcon, CreditCardIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { workspaceRoutes } from "@/features/workspaces/lib/routes";
import { ApiError } from "@/shared/lib/api";
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
  console.log("data", data);
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
    <div className="mx-auto flex min-h-svh w-full max-w-3xl flex-col gap-8 p-6 md:p-10">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-3">
          <Button
            nativeButton={false}
            variant="ghost"
            size="sm"
            className="-ml-2"
            render={<Link href={workspaceRoutes.list} />}
          >
            <ArrowLeftIcon />
            Dashboard
          </Button>
          <div className="flex items-center gap-2">
            <CreditCardIcon className="size-5" />
            <h1 className="font-heading text-2xl font-semibold">Billing</h1>
          </div>
          <p className="max-w-xl text-sm text-muted-foreground">
            Free includes a one-time credit grant. Pro resets credits each
            billing period. Unused Pro credits do not roll over.
          </p>
        </div>
      </div>

      {isLoading ? (
        <Skeleton className="h-48 rounded-3xl" />
      ) : error ? (
        <div className="rounded-2xl border border-dashed p-10 text-center">
          <p className="font-medium">Could not load billing</p>
          <p className="mt-2 text-sm text-muted-foreground">
            {error instanceof ApiError
              ? error.message
              : "Try again in a moment."}
          </p>
          <Button className="mt-4" onClick={() => void refetch()}>
            Retry
          </Button>
        </div>
      ) : data ? (
        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <CardTitle>Current plan</CardTitle>
                <Badge variant={isPro ? "default" : "secondary"}>
                  {isPro ? "Pro" : "Free"}
                </Badge>
              </div>
              <CardDescription>
                {formatCreditCount(data.credits)} credits remaining
                {isPro
                  ? ` of ${formatCreditCount(data.allowance)} this period`
                  : ` (Free grant is ${formatCreditCount(data.allowance)}, no refill)`}
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
                <p className="text-sm text-destructive">{actionError}</p>
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
                  View pricing
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
