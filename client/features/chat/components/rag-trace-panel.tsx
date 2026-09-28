"use client";

import { ChevronDownIcon } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Spinner } from "@/components/ui/spinner";
import type { RagTrace } from "../lib/rag-trace";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

type RagTracePanelProps = {
  trace: RagTrace;
};

/**
 * Shows the retrieval steps for one assistant reply.
 *
 * Completed steps open to the values produced by that step.
 */
export function RagTracePanel({ trace }: RagTracePanelProps) {
  if (trace.steps.length === 0) {
    return null;
  }

  return (
    <div className="mb-2 w-full rounded-2xl px-3 py-2">
      <Accordion>
        <AccordionItem value="pipeline">
          <AccordionTrigger>Pipeline</AccordionTrigger>
          <AccordionContent>
            <ol className="mt-1">
              {trace.steps.map((step) => {
                const expandable = step.lines.length > 0;
                const row = (
                  <>
                    <StepMark status={step.status} />
                    <span className="min-w-0 flex-1">
                      <span className="text-sm">{step.label}</span>
                      <span className="text-sm text-muted-foreground">
                        {" "}
                        → {step.summary}
                      </span>
                    </span>
                    {expandable ? (
                      <ChevronDownIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                    ) : null}
                  </>
                );

                if (!expandable) {
                  return (
                    <li
                      key={step.id}
                      className="flex items-start gap-2 px-1 py-1"
                    >
                      {row}
                    </li>
                  );
                }

                return (
                  <li key={step.id}>
                    <Collapsible>
                      <CollapsibleTrigger className="flex w-full items-start gap-2 rounded-lg px-1 py-1 text-left hover:bg-muted/40">
                        {row}
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <pre className="max-h-48 overflow-y-auto px-7 pb-2 wrap-break-word whitespace-pre-wrap text-xs text-muted-foreground">
                          {step.lines.join("\n")}
                        </pre>
                      </CollapsibleContent>
                    </Collapsible>
                  </li>
                );
              })}
            </ol>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}

function StepMark({ status }: { status: "active" | "done" }) {
  if (status === "active") {
    return <Spinner className="mt-0.5 size-3.5 shrink-0" />;
  }

  return (
    <span
      className="mt-1 size-2.5 shrink-0 rounded-full bg-primary"
      aria-hidden
    />
  );
}
