import { cn } from "@/lib/utils";

const MARKER =
  "mx-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-md border border-primary/30 bg-primary/15 px-1 align-middle font-mono text-[10px] font-semibold text-primary-ink";

/** A static example of a cited answer, shown on the landing and sign-in pages. Decorative. */
export function CitedAnswerPreview({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn("w-full max-w-md space-y-3 text-left", className)}
    >
      <div className="ml-auto w-fit max-w-[85%] rounded-2xl bg-secondary px-4 py-2.5 text-sm text-secondary-foreground">
        What does the methods section say about sample size?
      </div>
      <div className="rounded-xl border bg-card p-4 text-sm leading-relaxed">
        The trial enrolled 212 participants across three sites
        <span className={MARKER}>1</span>. The authors add that this was too
        small to detect effects under 5%<span className={MARKER}>2</span>.
        <div className="mt-4 flex flex-wrap gap-2 border-t pt-3 text-xs text-muted-foreground">
          <span className="rounded-lg border px-2.5 py-1">
            trial-protocol.pdf · p.4
          </span>
          <span className="rounded-lg border px-2.5 py-1">limitations.md</span>
        </div>
      </div>
    </div>
  );
}
