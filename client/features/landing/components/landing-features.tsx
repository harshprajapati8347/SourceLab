import { BookOpenIcon, BrainIcon, ListTreeIcon, QuoteIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { LandingSectionHeader } from "./landing-section-header";

const FEATURES = [
  {
    icon: BookOpenIcon,
    title: "Add the material",
    description:
      "PDFs, websites, YouTube transcripts, pasted text, and markdown go into one notebook. SourceLab extracts the text, splits it into passages, and indexes them.",
    wide: true,
  },
  {
    icon: QuoteIcon,
    title: "Answers you can check",
    description:
      "Each claim can open the passage it came from. On a PDF, the citation includes the page.",
    wide: false,
  },
  {
    icon: BrainIcon,
    title: "Memory across notebooks",
    description:
      "SourceLab can recall what you have already worked through when you ask again later.",
    wide: false,
  },
  {
    icon: ListTreeIcon,
    title: "See how an answer was found",
    description:
      "Open the steps above a reply: the search, the passages that came back, and whether the answer stayed on those sources.",
    wide: true,
  },
] as const;

export function LandingFeatures() {
  return (
    <section
      id="features"
      className="relative z-10 scroll-mt-24 border-t border-border px-6 py-16 md:py-24"
    >
      <div className="mx-auto max-w-[1200px]">
        <LandingSectionHeader
          eyebrow="Features"
          title="Built from the sources you add"
          description="A notebook holds your material. Chat and study tools stay tied to those sources."
        />
        <div className="grid gap-6 md:grid-cols-3">
          {FEATURES.map((feature) => (
            <article
              key={feature.title}
              className={cn(
                "flex flex-col items-start rounded-xl border border-border bg-card p-8 transition-colors hover:border-foreground/30",
                feature.wide && "md:col-span-2",
              )}
            >
              <div className="mb-6 flex size-10 items-center justify-center rounded-lg border border-border bg-secondary text-primary">
                <feature.icon className="size-5" />
              </div>
              <h3 className="font-heading text-xl font-semibold tracking-tight">
                {feature.title}
              </h3>
              <p className="mt-2 max-w-prose text-sm leading-relaxed text-muted-foreground">
                {feature.description}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
