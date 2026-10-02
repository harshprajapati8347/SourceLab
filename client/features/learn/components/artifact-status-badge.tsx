import { AlertCircleIcon, CheckIcon, ClockIcon, Loader2Icon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ARTIFACT_STATUS_LABELS, ARTIFACT_TYPE_LABELS } from "../lib/constants";
import type { ArtifactStatus, ArtifactType } from "../lib/types";

type ArtifactStatusBadgeProps = {
  status: ArtifactStatus;
  className?: string;
};

export function ArtifactStatusBadge({
  status,
  className,
}: ArtifactStatusBadgeProps) {
  switch (status) {
    case "PENDING":
      return (
        <Badge variant="secondary" className={className}>
          <ClockIcon />
          {ARTIFACT_STATUS_LABELS.PENDING}
        </Badge>
      );
    case "PROCESSING":
      return (
        <Badge variant="outline" className={className}>
          <Loader2Icon className="animate-spin" />
          Generating
        </Badge>
      );
    case "READY":
      return (
        <Badge
          variant="outline"
          className={cn(
            "border-primary/30 bg-primary/10 text-primary-ink",
            className,
          )}
        >
          <CheckIcon />
          {ARTIFACT_STATUS_LABELS.READY}
        </Badge>
      );
    case "FAILED":
      return (
        <Badge variant="destructive" className={className}>
          <AlertCircleIcon />
          {ARTIFACT_STATUS_LABELS.FAILED}
        </Badge>
      );
  }
}

export function ArtifactTypeBadge({ type }: { type: ArtifactType }) {
  return <Badge variant="outline">{ARTIFACT_TYPE_LABELS[type]}</Badge>;
}
