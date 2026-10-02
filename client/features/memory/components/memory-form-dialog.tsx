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
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { getErrorMessage } from "@/shared/lib/api";
import type { UserMemory } from "../lib/types";

type MemoryFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  memory?: UserMemory | null;
  onSubmit: (values: { memory: string }) => Promise<void>;
  isPending?: boolean;
};

/** Mounted fresh each time the dialog opens, so the text starts from the memory being edited. */
function MemoryForm({
  memory,
  onSubmit,
  onOpenChange,
  isPending = false,
}: Omit<MemoryFormDialogProps, "open">) {
  const isEditing = Boolean(memory);
  const [value, setValue] = useState(memory?.memory ?? "");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const trimmedValue = value.trim();

    if (!trimmedValue) {
      setError("Write something for SourceLab to remember.");
      return;
    }

    try {
      await onSubmit({ memory: trimmedValue });
      onOpenChange(false);
    } catch (submitError) {
      setError(getErrorMessage(submitError, "Could not save this memory."));
    }
  }

  return (
    <form className="grid gap-5" onSubmit={(event) => void handleSubmit(event)}>
      <DialogHeader>
        <DialogTitle>{isEditing ? "Edit memory" : "Add a memory"}</DialogTitle>
        <DialogDescription>
          SourceLab brings a memory into a chat when it is relevant, in any
          notebook.
        </DialogDescription>
      </DialogHeader>

      <div className="grid gap-2">
        <Label htmlFor="memory-value">Memory</Label>
        <Textarea
          id="memory-value"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="I prefer short explanations with one worked example"
          rows={5}
          className="min-h-28"
          autoFocus
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
          {isEditing ? "Save changes" : "Add memory"}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function MemoryFormDialog({
  open,
  onOpenChange,
  memory,
  onSubmit,
  isPending,
}: MemoryFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <MemoryForm
          key={memory?.id ?? "new"}
          memory={memory}
          onSubmit={onSubmit}
          onOpenChange={onOpenChange}
          isPending={isPending}
        />
      </DialogContent>
    </Dialog>
  );
}
