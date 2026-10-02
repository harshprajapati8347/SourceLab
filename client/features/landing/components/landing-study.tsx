import {
  FileTextIcon,
  LayersIcon,
  MessageSquareIcon,
  WaypointsIcon,
} from "lucide-react";
import { LandingSectionHeader } from "./landing-section-header";

const STUDY_TOOLS = [
  {
    icon: MessageSquareIcon,
    title: "Cited chat",
    description:
      "Ask in the notebook and follow a citation back to the source.",
  },
  {
    icon: LayersIcon,
    title: "Flashcards and quizzes",
    description:
      "Practice from the sources, with an explanation on each quiz answer.",
  },
  {
    icon: WaypointsIcon,
    title: "Mind maps",
    description:
      "Expand a map of the material and ask about a selected node in chat.",
  },
  {
    icon: FileTextIcon,
    title: "Summaries and reports",
    description:
      "Get a summary, key takeaways, or a longer report from the same sources.",
  },
] as const;

export function LandingStudy() {
  return (
    <section
      id="study"
      className="relative z-10 scroll-mt-24 border-t border-border px-6 py-16 md:py-24"
    >
      <div className="mx-auto max-w-[1200px]">
        <LandingSectionHeader
          eyebrow="Study tools"
          title="Use the same sources to study"
          description="Generate a study aid from the notebook instead of rewriting the material yourself."
        />
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {STUDY_TOOLS.map((tool) => (
            <article
              key={tool.title}
              className="rounded-xl border border-border bg-card p-6 transition-colors hover:border-foreground/30"
            >
              <div className="mb-4 flex size-9 items-center justify-center rounded-lg border border-primary/25 bg-primary/10 text-primary">
                <tool.icon className="size-4" />
              </div>
              <h3 className="font-heading text-base font-semibold tracking-tight">
                {tool.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {tool.description}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
