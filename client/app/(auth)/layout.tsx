import Link from "next/link";
import { BrandMark } from "@/shared/components/brand-mark";
import { CitedAnswerPreview } from "@/shared/components/cited-answer-preview";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="grid min-h-svh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <aside className="dark relative hidden flex-col justify-between gap-10 overflow-hidden border-r bg-sidebar p-10 text-foreground lg:flex">
        <Link
          href="/"
          aria-label="SourceLab home"
          className="w-fit rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
        >
          <BrandMark />
        </Link>

        <div className="flex flex-1 items-center justify-center">
          <CitedAnswerPreview />
        </div>

        <p className="max-w-sm text-sm text-muted-foreground">
          Every answer points back to the passage it came from, so you can check
          it yourself.
        </p>
      </aside>

      <div className="flex flex-col items-center justify-center gap-8 bg-background p-6 md:p-10">
        <Link
          href="/"
          aria-label="SourceLab home"
          className="rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/40 lg:hidden"
        >
          <BrandMark />
        </Link>
        <div className="w-full max-w-sm">{children}</div>
      </div>
    </div>
  );
}
