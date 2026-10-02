"use client";

import { ArrowUpRightIcon } from "lucide-react";

type SuggestedQuestionsProps = {
  questions: string[];
  disabled?: boolean;
  onSelect: (question: string) => void;
};

/**
 * Two or three short next questions under the latest assistant reply.
 * Choosing one sends it as the next message.
 */
export function SuggestedQuestions({
  questions,
  disabled = false,
  onSelect,
}: SuggestedQuestionsProps) {
  if (questions.length === 0) {
    return null;
  }

  return (
    <ul className="mt-1 grid w-full grid-cols-1 gap-2 sm:grid-cols-3">
      {questions.map((question) => (
        <li key={question} className="min-w-0">
          <button
            type="button"
            disabled={disabled}
            onClick={() => onSelect(question)}
            className="group flex h-full w-full flex-col items-start rounded-xl border bg-card p-3 text-left text-sm outline-none transition-[border-color,background-color] duration-200 ease-house hover:border-primary/40 hover:bg-primary/5 focus-visible:ring-3 focus-visible:ring-ring/40 disabled:pointer-events-none disabled:opacity-50"
          >
            <span>{question}</span>
            <ArrowUpRightIcon
              aria-hidden="true"
              className="mt-3 size-3.5 text-muted-foreground transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-primary-ink"
            />
          </button>
        </li>
      ))}
    </ul>
  );
}
