"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useBilling } from "../hooks/use-billing";
import { formatCreditCount } from "../lib/constants";
import { billingRoutes } from "../lib/routes";

type CreditsBadgeProps = {
  className?: string;
};

export function CreditsBadge({ className }: CreditsBadgeProps) {
  const { data, isLoading } = useBilling();

  if (isLoading) {
    return <Skeleton className="h-8 w-28 rounded-full" />;
  }

  if (!data) {
    return null;
  }

  return (
    <Button
      nativeButton={false}
      variant="outline"
      size="sm"
      className={cn("rounded-full", className)}
      render={<Link href={billingRoutes.settings} />}
    >
      {formatCreditCount(data.credits)} credits
    </Button>
  );
}
