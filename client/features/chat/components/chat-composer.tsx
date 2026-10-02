"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUpIcon, GlobeIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

/** A message the server refused, put back in the box so the user can edit it. */
export type RestoredDraft = { id: number; text: string };

type ChatComposerProps = {
  onSubmit: (text: string) => void;
  disabled?: boolean;
  isStreaming?: boolean;
  webSearchEnabled?: boolean;
  onWebSearchChange?: (enabled: boolean) => void;
  restoredDraft?: RestoredDraft | null;
};

const MAX_HEIGHT_PX = 176;

export function ChatComposer({
  onSubmit,
  disabled = false,
  isStreaming = false,
  webSearchEnabled = false,
  onWebSearchChange,
  restoredDraft = null,
}: ChatComposerProps) {
  const [input, setInput] = useState("");
  const [appliedDraftId, setAppliedDraftId] = useState<number | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // A refused message comes back as a new draft; apply each one once.
  if (restoredDraft && restoredDraft.id !== appliedDraftId) {
    setAppliedDraftId(restoredDraft.id);
    setInput(restoredDraft.text);
  }

  // Grow with the text up to a cap, then scroll.
  useEffect(() => {
    const element = textareaRef.current;
    if (!element) {
      return;
    }

    element.style.height = "auto";
    element.style.height = `${Math.min(element.scrollHeight, MAX_HEIGHT_PX)}px`;
  }, [input]);

  const isBusy = disabled || isStreaming;
  const canSend = !isBusy && input.trim().length > 0;

  function submit() {
    const text = input.trim();
    if (!text || isBusy) {
      return;
    }

    onSubmit(text);
    setInput("");
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
      className="shrink-0 border-t bg-background/90 p-3 backdrop-blur-md sm:p-4"
    >
      <div className="mx-auto w-full max-w-3xl space-y-2">
        <div
          className={cn(
            "rounded-xl border bg-card transition-[border-color,box-shadow] duration-200 ease-house",
            "focus-within:border-primary focus-within:ring-1 focus-within:ring-primary",
            isBusy && "opacity-80",
          )}
        >
          <label htmlFor="chat-input" className="sr-only">
            Message
          </label>
          <textarea
            id="chat-input"
            ref={textareaRef}
            data-chat-input
            value={input}
            rows={1}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (
                event.key === "Enter" &&
                !event.shiftKey &&
                !event.nativeEvent.isComposing
              ) {
                event.preventDefault();
                submit();
              }
            }}
            placeholder="Ask a question about your sources"
            disabled={disabled}
            className="block max-h-44 min-h-11 w-full resize-none bg-transparent px-3.5 pt-3 pb-1 text-base outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed md:text-sm"
          />

          <div className="flex items-center justify-between gap-2 px-2 pb-2">
            {onWebSearchChange ? (
              <Button
                type="button"
                size="sm"
                variant={webSearchEnabled ? "secondary" : "ghost"}
                aria-pressed={webSearchEnabled}
                className={cn(
                  "rounded-full",
                  webSearchEnabled && "border-primary/40 text-primary-ink",
                )}
                onClick={() => onWebSearchChange(!webSearchEnabled)}
                disabled={isBusy}
              >
                <GlobeIcon />
                Web search{webSearchEnabled ? " on" : ""}
              </Button>
            ) : (
              <span />
            )}

            <Button
              type="submit"
              size="icon"
              disabled={!canSend}
              aria-label={isStreaming ? "Generating answer" : "Send message"}
              className="rounded-lg"
            >
              {isStreaming ? <Spinner /> : <ArrowUpIcon />}
            </Button>
          </div>
        </div>

        <p className="hidden items-center justify-between px-1 text-xs text-muted-foreground sm:flex">
          <span>Answers are grounded in your sources</span>
          <span className="flex items-center gap-1.5">
            <Kbd>Enter</Kbd> to send
            <Kbd>Shift</Kbd>
            <Kbd>Enter</Kbd> for a new line
          </span>
        </p>
      </div>
    </form>
  );
}
