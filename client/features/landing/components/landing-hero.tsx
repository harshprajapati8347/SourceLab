import Link from "next/link";
import { Button } from "@/components/ui/button";
import { authRoutes } from "@/features/auth/lib/auth-routes";
import { CitedAnswerPreview } from "@/shared/components/cited-answer-preview";

export function LandingHero() {
  return (
    <section
      id="top"
      className="relative z-10 mx-auto max-w-[900px] px-6 pt-40 pb-24 text-center md:pt-48 md:pb-32"
    >
      <p className="mb-6 inline-flex items-center rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
        A notebook for your own sources
      </p>
      <h1 className="font-heading text-[clamp(2.5rem,6vw,4.5rem)] font-bold leading-[1.1] tracking-tight text-balance">
        A notebook that answers from your sources
      </h1>
      <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-muted-foreground md:text-lg">
        Add a PDF, website, YouTube transcript, or notes. Ask a question, then
        open the passage the answer came from, including the page on a PDF.
      </p>
      <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
        <Button
          nativeButton={false}
          size="lg"
          className="rounded-full px-6"
          render={<Link href={authRoutes.signup} />}
        >
          Create a notebook
        </Button>
        <Button
          nativeButton={false}
          variant="outline"
          size="lg"
          className="rounded-full px-6"
          render={<Link href={authRoutes.login} />}
        >
          Sign in
        </Button>
      </div>
      <CitedAnswerPreview className="mx-auto mt-16" />
    </section>
  );
}
