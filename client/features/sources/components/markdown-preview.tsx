"use client";

import { StreamdownContent } from "@/shared/components/streamdown-content";

export function MarkdownPreview({ content }: { content: string }) {
  return (
    <div className="max-h-[70vh] overflow-auto rounded-xl border bg-card p-5">
      <StreamdownContent content={content} mode="static" />
    </div>
  );
}
