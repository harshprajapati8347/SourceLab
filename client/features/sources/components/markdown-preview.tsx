"use client";

import { StreamdownContent } from "@/shared/components/streamdown-content";

export function MarkdownPreview({ content }: { content: string }) {
  return (
    <div className="max-h-[70vh] overflow-auto rounded-xl border bg-card p-5 [&_img]:h-auto [&_img]:max-w-full">
      <StreamdownContent content={content} mode="static" />
    </div>
  );
}
