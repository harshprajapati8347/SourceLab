import { cn } from "@/lib/utils";

type BrandMarkProps = {
  /** Show the "SourceLab" wordmark next to the mark. */
  showWordmark?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
};

const MARK_SIZES = {
  sm: "size-6 rounded-md",
  md: "size-7 rounded-lg",
  lg: "size-9 rounded-xl",
} as const;

const WORDMARK_SIZES = {
  sm: "text-sm",
  md: "text-[15px]",
  lg: "text-lg",
} as const;

/**
 * SourceLab mark: three lines of text with a filled dot at the end of the
 * middle one, which reads as a citation marker on a passage.
 */
export function BrandMark({
  showWordmark = true,
  size = "md",
  className,
}: BrandMarkProps) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <span
        className={cn(
          "flex shrink-0 items-center justify-center bg-primary text-primary-foreground",
          MARK_SIZES[size],
        )}
        aria-hidden={showWordmark ? true : undefined}
        role={showWordmark ? undefined : "img"}
        aria-label={showWordmark ? undefined : "SourceLab"}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          className="size-[62%]"
          aria-hidden="true"
        >
          <path
            d="M5 7h14M5 12h8M5 17h14"
            stroke="currentColor"
            strokeWidth="2.25"
            strokeLinecap="round"
          />
          <circle cx="18" cy="12" r="2.1" fill="currentColor" />
        </svg>
      </span>
      {showWordmark ? (
        <span
          className={cn(
            "font-heading font-bold tracking-tight",
            WORDMARK_SIZES[size],
          )}
        >
          SourceLab
        </span>
      ) : null}
    </span>
  );
}
