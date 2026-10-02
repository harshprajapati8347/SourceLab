"use client";

import { ArrowUpRightIcon, PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BrandMark } from "@/shared/components/brand-mark";

const STARTER_PROMPTS = [
  "Summarize the main points across my sources",
  "What are the key terms and definitions?",
  "Where do my sources disagree?",
  "Write five study questions from this material",
] as const;

type ChatEmptyStateProps = {
  /** `undefined` while sources are loading. */
  hasSources: boolean | undefined;
  onPrompt: (text: string) => void;
  onAddSource: () => void;
  disabled?: boolean;
};

export function ChatEmptyState({
  hasSources,
  onPrompt,
  onAddSource,
  disabled = false,
}: ChatEmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-6 py-12 text-center sm:py-20">
      <BrandMark showWordmark={false} size="lg" />

      <div className="space-y-2">
        <h2 className="font-heading text-xl font-bold tracking-tight">
          Ask your sources
        </h2>
        <p className="mx-auto max-w-md text-sm text-muted-foreground">
          {hasSources === false
            ? "Add a PDF, a web page, a YouTube video, or some text. Answers will point back to the exact passage they came from."
            : "Every answer cites the passages it used. Hover a number to read the passage, or open the source."}
        </p>
      </div>

      {hasSources === false ? (
        <Button size="lg" onClick={onAddSource}>
          <PlusIcon />
          Add your first source
        </Button>
      ) : hasSources ? (
        <ul className="flex max-w-2xl flex-wrap justify-center gap-2">
          {STARTER_PROMPTS.map((prompt) => (
            <li key={prompt}>
              <button
                type="button"
                disabled={disabled}
                onClick={() => onPrompt(prompt)}
                className="group inline-flex items-center gap-1.5 rounded-full border bg-card px-3.5 py-2 text-left text-sm text-muted-foreground outline-none transition-[border-color,color,background-color] duration-200 ease-house hover:border-primary/40 hover:bg-primary/5 hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/40 disabled:pointer-events-none disabled:opacity-50"
              >
                {prompt}
                <ArrowUpRightIcon
                  aria-hidden="true"
                  className="size-3.5 shrink-0 opacity-50 transition-all duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:opacity-100"
                />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
