import { BriefcaseIcon, FlaskConicalIcon, GraduationCapIcon } from "lucide-react";
import { LandingSectionHeader } from "./landing-section-header";

const USE_CASES = [
  {
    icon: GraduationCapIcon,
    title: "Students",
    description:
      "Keep a course packet, lecture notes, and videos in one notebook, then quiz yourself from them.",
  },
  {
    icon: FlaskConicalIcon,
    title: "Researchers",
    description:
      "Ask a set of papers a specific question and open the page instead of searching the PDF again.",
  },
  {
    icon: BriefcaseIcon,
    title: "Project work",
    description:
      "Drop in docs and videos for a project and check a claim against the source that said it.",
  },
] as const;

export function LandingUseCases() {
  return (
    <section
      id="who"
      className="relative z-10 scroll-mt-24 border-t border-border px-6 py-16 md:py-24"
    >
      <div className="mx-auto max-w-[1200px]">
        <LandingSectionHeader
          eyebrow="Who it’s for"
          title="For people working through a set of sources"
          description="Students, researchers, and anyone who would otherwise reread the same files."
        />
        <div className="grid gap-6 md:grid-cols-3">
          {USE_CASES.map((useCase) => (
            <article
              key={useCase.title}
              className="rounded-xl border border-border bg-card p-6 transition-colors hover:border-foreground/30"
            >
              <div className="mb-4 flex size-9 items-center justify-center rounded-lg border border-primary/25 bg-primary/10 text-primary">
                <useCase.icon className="size-4" />
              </div>
              <h3 className="font-heading text-base font-semibold tracking-tight">
                {useCase.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {useCase.description}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
