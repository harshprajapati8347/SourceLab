import {
  FileTextIcon,
  LayersIcon,
  ListChecksIcon,
  NetworkIcon,
  NotebookTextIcon,
  SparklesIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ArtifactType } from "../lib/types";

const ICONS = {
  SUMMARY: NotebookTextIcon,
  TAKEAWAYS: SparklesIcon,
  FLASHCARDS: LayersIcon,
  QUIZ: ListChecksIcon,
  MINDMAP: NetworkIcon,
  REPORT: FileTextIcon,
} as const;

type ArtifactTypeIconProps = {
  type: ArtifactType;
  className?: string;
};

export function ArtifactTypeIcon({ type, className }: ArtifactTypeIconProps) {
  const Icon = ICONS[type];
  return <Icon aria-hidden="true" className={cn("size-4 shrink-0", className)} />;
}
