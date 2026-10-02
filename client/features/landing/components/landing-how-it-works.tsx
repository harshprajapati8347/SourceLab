import { LandingSectionHeader } from "./landing-section-header";

const STEPS = [
  {
    step: "Step 1",
    title: "Add sources",
    description:
      "You add files and links. SourceLab splits them into passages and prepares those passages for search.",
  },
  {
    step: "Step 2",
    title: "Index the notebook",
    description:
      "Each passage is embedded and stored in that notebook’s index, so a later question can find it.",
  },
  {
    step: "Step 3",
    title: "Answer with a citation",
    description:
      "The question retrieves the closest passages, checks the match, and the reply points back to them.",
  },
] as const;

export function LandingHowItWorks() {
  return (
    <section
      id="how"
      className="relative z-10 scroll-mt-24 border-t border-border px-6 py-16 md:py-24"
    >
      <div className="mx-auto max-w-[1200px]">
        <LandingSectionHeader
          eyebrow="How it works"
          title="Look up the notebook, then answer"
          description="SourceLab searches the notebook when you ask, instead of answering from general knowledge. Web results, if you turn them on, are marked separately from notebook citations."
        />
        <ol className="grid gap-6 md:grid-cols-3">
          {STEPS.map((step) => (
            <li
              key={step.step}
              className="rounded-xl border border-border bg-card p-8"
            >
              <p className="mb-4 text-xs font-semibold text-primary">
                {step.step}
              </p>
              <h3 className="font-heading text-lg font-semibold tracking-tight">
                {step.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {step.description}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
