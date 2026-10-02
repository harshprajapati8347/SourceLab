import { AlertCircleIcon, CheckIcon, ClockIcon, Loader2Icon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { SOURCE_STATUS_LABELS } from "../lib/constants";
import type { SourceStatus } from "../lib/types";

function SpinningLoader({ className }: { className?: string }) {
  return <Loader2Icon className={cn("animate-spin", className)} />;
}

const STATUS_STYLE: Record<
  SourceStatus,
  {
    variant: "secondary" | "outline" | "destructive";
    className?: string;
    icon: React.ComponentType<{ className?: string }>;
  }
> = {
  PENDING: { variant: "secondary", icon: ClockIcon },
  PROCESSING: {
    variant: "outline",
    icon: SpinningLoader,
  },
  READY: {
    variant: "outline",
    className: "border-primary/30 bg-primary/10 text-primary-ink",
    icon: CheckIcon,
  },
  FAILED: { variant: "destructive", icon: AlertCircleIcon },
};

type SourceStatusBadgeProps = {
  status: SourceStatus;
  className?: string;
};

export function SourceStatusBadge({
  status,
  className,
}: SourceStatusBadgeProps) {
  const { variant, className: statusClassName, icon: Icon } =
    STATUS_STYLE[status];

  return (
    <Badge variant={variant} className={cn(statusClassName, className)}>
      <Icon />
      {SOURCE_STATUS_LABELS[status]}
    </Badge>
  );
}
