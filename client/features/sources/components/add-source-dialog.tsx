"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import {
  useCreateSource,
  useImportWebsiteSource,
  useImportYoutubeSource,
  useUploadPdfSource,
} from "../hooks/use-sources";
import { sourceRoutes } from "../lib/routes";
import type { Source, SourceType } from "../lib/types";
import { SourceTypeIcon } from "./source-type-icon";

type AddSourceDialogProps = {
  workspaceId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const TABS: { value: string; label: string; type: SourceType }[] = [
  { value: "text", label: "Text", type: "TEXT" },
  { value: "markdown", label: "Markdown", type: "MARKDOWN" },
  { value: "pdf", label: "PDF", type: "PDF" },
  { value: "website", label: "Website", type: "WEBSITE" },
  { value: "youtube", label: "YouTube", type: "YOUTUBE" },
];

function errorText(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

/** Mounted fresh each time the dialog opens, so every field starts empty. */
function AddSourceForm({
  workspaceId,
  onDone,
}: {
  workspaceId: string;
  onDone: () => void;
}) {
  const router = useRouter();
  const createSource = useCreateSource(workspaceId);
  const uploadPdf = useUploadPdfSource(workspaceId);
  const importWebsite = useImportWebsiteSource(workspaceId);
  const importYoutube = useImportYoutubeSource(workspaceId);

  const [error, setError] = useState<string | null>(null);

  const [textTitle, setTextTitle] = useState("");
  const [textContent, setTextContent] = useState("");

  const [markdownTitle, setMarkdownTitle] = useState("");
  const [markdownContent, setMarkdownContent] = useState("");

  const [pdfTitle, setPdfTitle] = useState("");
  const [pdfFile, setPdfFile] = useState<File | null>(null);

  const [websiteUrl, setWebsiteUrl] = useState("");
  const [websiteTitle, setWebsiteTitle] = useState("");

  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [youtubeTitle, setYoutubeTitle] = useState("");

  const isPending =
    createSource.isPending ||
    uploadPdf.isPending ||
    importWebsite.isPending ||
    importYoutube.isPending;

  function handleSuccess(source: Source) {
    onDone();
    toast.add({
      title: `Added “${source.title}”`,
      description:
        "Indexing has started. Answers can use it once it finishes.",
      type: "success",
      actionProps: {
        children: "Open",
        onClick: () =>
          router.push(sourceRoutes.detail(workspaceId, source.id)),
      },
    });
  }

  async function run(
    action: () => Promise<Source>,
    fallbackMessage: string,
  ) {
    setError(null);
    try {
      handleSuccess(await action());
    } catch (submitError) {
      setError(errorText(submitError, fallbackMessage));
    }
  }

  function onSubmit(handler: () => void) {
    return (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      handler();
    };
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Add a source</DialogTitle>
        <DialogDescription>
          Answers in this notebook will cite what you add here.
        </DialogDescription>
      </DialogHeader>

      <Tabs defaultValue="text">
        <TabsList className="w-full overflow-x-auto">
          {TABS.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value}>
              <SourceTypeIcon type={tab.type} className="size-3.5" />
              <span className="max-sm:sr-only">{tab.label}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="text" className="pt-3">
          <form
            className="grid gap-4"
            onSubmit={onSubmit(
              () =>
                void run(
                  () =>
                    createSource.mutateAsync({
                      type: "TEXT",
                      title: textTitle,
                      content: textContent,
                    }),
                  "Could not add the text.",
                ),
            )}
          >
            <Field
              id="text-title"
              label="Title"
              value={textTitle}
              onChange={setTextTitle}
              placeholder="Meeting notes"
              disabled={isPending}
              required
            />
            <FieldTextarea
              id="text-content"
              label="Content"
              value={textContent}
              onChange={setTextContent}
              placeholder="Paste your text here"
              disabled={isPending}
              required
            />
            <DialogFooter>
              <SubmitButton pending={createSource.isPending}>
                Add text
              </SubmitButton>
            </DialogFooter>
          </form>
        </TabsContent>

        <TabsContent value="markdown" className="pt-3">
          <form
            className="grid gap-4"
            onSubmit={onSubmit(
              () =>
                void run(
                  () =>
                    createSource.mutateAsync({
                      type: "MARKDOWN",
                      title: markdownTitle,
                      content: markdownContent,
                    }),
                  "Could not add the Markdown.",
                ),
            )}
          >
            <Field
              id="markdown-title"
              label="Title"
              value={markdownTitle}
              onChange={setMarkdownTitle}
              placeholder="Research notes"
              disabled={isPending}
              required
            />
            <FieldTextarea
              id="markdown-content"
              label="Markdown"
              value={markdownContent}
              onChange={setMarkdownContent}
              placeholder={"# Heading\n\nWrite Markdown here"}
              disabled={isPending}
              rows={8}
              required
              mono
            />
            <DialogFooter>
              <SubmitButton pending={createSource.isPending}>
                Add Markdown
              </SubmitButton>
            </DialogFooter>
          </form>
        </TabsContent>

        <TabsContent value="pdf" className="pt-3">
          <form
            className="grid gap-4"
            onSubmit={onSubmit(() => {
              if (!pdfFile) {
                setError("Choose a PDF file to upload.");
                return;
              }
              void run(
                () =>
                  uploadPdf.mutateAsync({
                    file: pdfFile,
                    title: pdfTitle || undefined,
                  }),
                "Could not upload the PDF.",
              );
            })}
          >
            <Field
              id="pdf-title"
              label="Title (optional)"
              value={pdfTitle}
              onChange={setPdfTitle}
              placeholder="Research paper"
              disabled={isPending}
            />
            <div className="grid gap-2">
              <Label htmlFor="pdf-file">PDF file</Label>
              <Input
                id="pdf-file"
                type="file"
                accept="application/pdf"
                disabled={isPending}
                onChange={(event) =>
                  setPdfFile(event.target.files?.[0] ?? null)
                }
              />
              {pdfFile ? (
                <p className="text-xs text-muted-foreground">
                  Selected: {pdfFile.name}
                </p>
              ) : null}
            </div>
            <DialogFooter>
              <SubmitButton pending={uploadPdf.isPending}>
                Upload PDF
              </SubmitButton>
            </DialogFooter>
          </form>
        </TabsContent>

        <TabsContent value="website" className="pt-3">
          <form
            className="grid gap-4"
            onSubmit={onSubmit(
              () =>
                void run(
                  () =>
                    importWebsite.mutateAsync({
                      url: websiteUrl,
                      title: websiteTitle || undefined,
                    }),
                  "Could not import the page.",
                ),
            )}
          >
            <Field
              id="website-url"
              label="Page address"
              type="url"
              value={websiteUrl}
              onChange={setWebsiteUrl}
              placeholder="https://example.com/article"
              disabled={isPending}
              required
            />
            <Field
              id="website-title"
              label="Title (optional)"
              value={websiteTitle}
              onChange={setWebsiteTitle}
              placeholder="Article title"
              disabled={isPending}
            />
            <DialogFooter>
              <SubmitButton pending={importWebsite.isPending}>
                Import page
              </SubmitButton>
            </DialogFooter>
          </form>
        </TabsContent>

        <TabsContent value="youtube" className="pt-3">
          <form
            className="grid gap-4"
            onSubmit={onSubmit(
              () =>
                void run(
                  () =>
                    importYoutube.mutateAsync({
                      url: youtubeUrl,
                      title: youtubeTitle || undefined,
                    }),
                  "Could not import the transcript.",
                ),
            )}
          >
            <Field
              id="youtube-url"
              label="Video address"
              type="url"
              value={youtubeUrl}
              onChange={setYoutubeUrl}
              placeholder="https://www.youtube.com/watch?v=..."
              disabled={isPending}
              required
            />
            <Field
              id="youtube-title"
              label="Title (optional)"
              value={youtubeTitle}
              onChange={setYoutubeTitle}
              placeholder="Video title"
              disabled={isPending}
            />
            <DialogFooter>
              <SubmitButton pending={importYoutube.isPending}>
                Import transcript
              </SubmitButton>
            </DialogFooter>
          </form>
        </TabsContent>
      </Tabs>

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </>
  );
}

export function AddSourceDialog({
  workspaceId,
  open,
  onOpenChange,
}: AddSourceDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <AddSourceForm
          workspaceId={workspaceId}
          onDone={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  placeholder,
  disabled,
  required,
  type,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  type?: string;
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        required={required}
      />
    </div>
  );
}

function FieldTextarea({
  id,
  label,
  value,
  onChange,
  placeholder,
  disabled,
  required,
  rows = 6,
  mono = false,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  rows?: number;
  mono?: boolean;
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Textarea
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        required={required}
        rows={rows}
        className={cn("max-h-64 min-h-32", mono && "font-mono text-xs")}
      />
    </div>
  );
}

function SubmitButton({
  children,
  pending,
}: {
  children: React.ReactNode;
  pending: boolean;
}) {
  return (
    <Button type="submit" disabled={pending}>
      {pending ? <Spinner /> : null}
      {children}
    </Button>
  );
}
