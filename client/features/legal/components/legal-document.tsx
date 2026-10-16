import type { ReactNode } from "react";
import { PublicFooter } from "@/shared/components/public-footer";
import { PublicHeader } from "@/shared/components/public-header";

type LegalDocumentProps = {
  title: string;
  children: ReactNode;
};

export function LegalDocument({ title, children }: LegalDocumentProps) {
  return (
    <div className="flex min-h-svh flex-col bg-background">
      <PublicHeader />
      <article className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-10 px-4 py-14 md:px-8 md:py-20">
        <header className="space-y-4 border-b border-border pb-8">
          <h1 className="font-heading text-3xl font-bold tracking-tight">
            {title}
          </h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Last updated 15 October 2026. This page describes how SourceLab
            behaves today. It is not legal advice, and a lawyer has not reviewed
            it. Text in brackets is unpublished information.
          </p>
        </header>
        <div
          className={[
            "space-y-10 text-sm leading-relaxed text-foreground",
            // section headings
            "[&_section]:space-y-3",
            "[&_h2]:font-heading [&_h2]:text-base [&_h2]:font-semibold [&_h2]:tracking-tight [&_h2]:text-foreground",
            // lists
            "[&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pl-5 [&_ul]:text-muted-foreground",
            "[&_li]:leading-relaxed",
            // body paragraphs
            "[&_p]:text-muted-foreground",
            // inline links
            "[&_a]:text-foreground [&_a]:underline [&_a]:underline-offset-4 [&_a:hover]:text-primary-ink",
          ].join(" ")}
        >
          {children}
        </div>
      </article>
      <PublicFooter />
    </div>
  );
}
