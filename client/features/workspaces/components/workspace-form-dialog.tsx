"use client";

import { useState } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { Workspace } from "../lib/types";

const ICON_OPTIONS = ["📚", "📖", "📝", "🎓", "💡", "🔬", "🧠", "✨"];

type WorkspaceFormValues = {
  title: string;
  description?: string;
  icon?: string;
};

type WorkspaceFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspace?: Workspace | null;
  onSubmit: (values: WorkspaceFormValues) => Promise<void>;
  isPending?: boolean;
};

type WorkspaceFormProps = Pick<
  WorkspaceFormDialogProps,
  "workspace" | "onSubmit" | "isPending" | "onOpenChange"
>;

/** Mounted fresh each time the dialog opens, so its fields start from the notebook being edited. */
function WorkspaceForm({
  workspace,
  onSubmit,
  isPending = false,
  onOpenChange,
}: WorkspaceFormProps) {
  const isEditing = Boolean(workspace);
  const [title, setTitle] = useState(workspace?.title ?? "");
  const [description, setDescription] = useState(workspace?.description ?? "");
  const [icon, setIcon] = useState(workspace?.icon ?? ICON_OPTIONS[0]);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const trimmedTitle = title.trim();

    if (!trimmedTitle) {
      setError("Give the notebook a title.");
      return;
    }

    try {
      await onSubmit({
        title: trimmedTitle,
        description: description.trim() || undefined,
        icon,
      });
      onOpenChange(false);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Something went wrong. Try again.",
      );
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>
          {isEditing ? "Edit notebook" : "New notebook"}
        </DialogTitle>
        <DialogDescription>
          {isEditing
            ? "Change the name, description, or icon."
            : "A notebook holds the sources you want to ask questions about."}
        </DialogDescription>
      </DialogHeader>

      <form className="grid gap-4" onSubmit={(e) => void handleSubmit(e)}>
        <div className="grid gap-2">
          <span id="workspace-icon-label" className="text-sm font-medium">
            Icon
          </span>
          <div
            role="radiogroup"
            aria-labelledby="workspace-icon-label"
            className="flex flex-wrap gap-2"
          >
            {ICON_OPTIONS.map((option) => (
              <button
                key={option}
                type="button"
                role="radio"
                aria-checked={icon === option}
                onClick={() => setIcon(option)}
                className={cn(
                  "flex size-10 items-center justify-center rounded-lg border text-lg outline-none transition-colors duration-200 focus-visible:ring-3 focus-visible:ring-ring/40",
                  icon === option
                    ? "border-primary bg-primary/10"
                    : "hover:bg-muted",
                )}
              >
                <span aria-hidden="true">{option}</span>
                <span className="sr-only">Icon {option}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="workspace-title">Title</Label>
          <Input
            id="workspace-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Thesis research"
            maxLength={120}
            disabled={isPending}
            autoFocus
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="workspace-description">Description</Label>
          <Textarea
            id="workspace-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="What are you studying or working on?"
            maxLength={500}
            rows={3}
            disabled={isPending}
          />
        </div>

        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isPending}>
            {isPending ? <Spinner /> : null}
            {isEditing ? "Save changes" : "Create notebook"}
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}

export function WorkspaceFormDialog({
  open,
  onOpenChange,
  workspace,
  onSubmit,
  isPending,
}: WorkspaceFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <WorkspaceForm
          key={workspace?.id ?? "new"}
          workspace={workspace}
          onSubmit={onSubmit}
          isPending={isPending}
          onOpenChange={onOpenChange}
        />
      </DialogContent>
    </Dialog>
  );
}
