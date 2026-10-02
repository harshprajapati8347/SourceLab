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
    <div className="mb-1 w-full">
      <Accordion className="bg-muted/30">
        <AccordionItem value="pipeline">
          <AccordionTrigger className="items-center p-3 text-xs hover:no-underline">
            <span>
              How this answer was found
              <span className="ml-2 font-normal text-muted-foreground">
                {trace.steps.length} steps
              </span>
            </span>
          </AccordionTrigger>
          <AccordionContent className="pb-3">
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
                      <CollapsibleTrigger className="flex w-full items-start gap-2 rounded-lg px-1 py-1 text-left outline-none transition-colors duration-200 hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-ring/40">
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
