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
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { getErrorMessage } from "@/shared/lib/api";
import {
  ARTIFACT_TYPE_DESCRIPTIONS,
  ARTIFACT_TYPE_LABELS,
  ARTIFACT_TYPES,
} from "../lib/constants";
import { useCreateArtifact } from "../hooks/use-artifacts";
import type { ArtifactType } from "../lib/types";
import { ArtifactTypeIcon } from "./artifact-type-icon";

type GenerateArtifactDialogProps = {
  workspaceId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/** Mounted fresh each time the dialog opens, so the form starts clean. */
function GenerateArtifactForm({
  workspaceId,
  onOpenChange,
}: Omit<GenerateArtifactDialogProps, "open">) {
  const [type, setType] = useState<ArtifactType>("SUMMARY");
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const createArtifact = useCreateArtifact(workspaceId);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    try {
      await createArtifact.mutateAsync({
        type,
        title: title.trim() || undefined,
      });

      toast.add({
        title: `Generating your ${ARTIFACT_TYPE_LABELS[type].toLowerCase()}`,
        description: "It appears in the list when it is ready.",
        type: "success",
      });
      onOpenChange(false);
    } catch (submitError) {
      setError(getErrorMessage(submitError, "Could not start generating."));
    }
  }

  return (
    <form className="grid gap-5" onSubmit={(event) => void handleSubmit(event)}>
      <DialogHeader>
        <DialogTitle>Generate a study tool</DialogTitle>
        <DialogDescription>
          Built from every ready source in this notebook. It runs in the
          background, so you can keep working.
        </DialogDescription>
      </DialogHeader>

      <div className="grid gap-2">
        <span id="artifact-type-label" className="text-sm font-medium">
          Format
        </span>
        <div
          role="radiogroup"
          aria-labelledby="artifact-type-label"
          className="grid gap-2 sm:grid-cols-2"
        >
          {ARTIFACT_TYPES.map((artifactType) => {
            const selected = type === artifactType;
            return (
              <button
                key={artifactType}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setType(artifactType)}
                className={cn(
                  "flex items-start gap-3 rounded-xl border p-3 text-left outline-none transition-colors duration-200 focus-visible:ring-3 focus-visible:ring-ring/40",
                  selected
                    ? "border-primary bg-primary/10"
                    : "hover:border-primary/40 hover:bg-muted/50",
                )}
              >
                <ArtifactTypeIcon
                  type={artifactType}
                  className={cn(
                    "mt-0.5",
                    selected ? "text-primary-ink" : "text-muted-foreground",
                  )}
                />
                <span>
                  <span className="block text-sm font-medium">
                    {ARTIFACT_TYPE_LABELS[artifactType]}
                  </span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {ARTIFACT_TYPE_DESCRIPTIONS[artifactType]}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="artifact-title">Title (optional)</Label>
        <Input
          id="artifact-title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Chapter 3 review"
          maxLength={120}
        />
      </div>

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <DialogFooter className="sm:items-center">
        <p className="text-xs text-muted-foreground sm:mr-auto">
          Uses 1 credit
        </p>
        <Button
          type="button"
          variant="outline"
          onClick={() => onOpenChange(false)}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={createArtifact.isPending}>
          {createArtifact.isPending ? <Spinner /> : null}
          Generate
        </Button>
      </DialogFooter>
    </form>
  );
}

export function GenerateArtifactDialog({
  workspaceId,
  open,
  onOpenChange,
}: GenerateArtifactDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <GenerateArtifactForm
          workspaceId={workspaceId}
          onOpenChange={onOpenChange}
        />
      </DialogContent>
    </Dialog>
  );
}
