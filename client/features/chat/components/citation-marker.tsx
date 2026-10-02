"use client";

import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import type { ChatCitation } from "../lib/types";
import { CitationPreview } from "./citation-preview";

type CitationMarkerProps = {
  index: number;
  citation: ChatCitation;
  workspaceId: string;
  prefix?: string;
};

export function CitationMarker({
  index,
  citation,
  workspaceId,
  prefix,
}: CitationMarkerProps) {
  const label = prefix ? `${prefix}${index}` : String(index);

  return (
    <HoverCard>
      <HoverCardTrigger
        delay={120}
        closeDelay={80}
        render={
          <button
            type="button"
            className="mx-0.5 inline-flex h-5 min-w-5 -translate-y-px items-center justify-center rounded-md border border-primary/30 bg-primary/15 px-1 align-middle font-mono text-[10px] font-semibold text-primary-ink transition-colors duration-200 hover:bg-primary/30 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
            aria-label={`Source ${label}: ${citation.sourceTitle}`}
          >
            {label}
          </button>
        }
      />
      <HoverCardContent side="top" align="start" className="w-80">
        <CitationPreview
          citation={citation}
          workspaceId={workspaceId}
          markerIndex={index}
        />
      </HoverCardContent>
    </HoverCard>
  );
}
