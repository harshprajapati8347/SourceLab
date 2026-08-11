export function MarkdownPreview({ content }: { content: string }) {
  return (
    <div className="rounded-2xl border bg-muted/30 p-4">
      <pre className="whitespace-pre-wrap font-mono text-sm leading-relaxed text-foreground">
        {content}
      </pre>
    </div>
  );
}
