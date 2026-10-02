"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";
import {
  CHAT_MODEL_LABELS,
  CHAT_MODELS,
  type ChatModelId,
} from "@/features/chat/stores/chat-preferences";
import { PageHeader } from "@/shared/components/page-header";
import { getErrorMessage } from "@/shared/lib/api";
import {
  useDeleteWorkspace,
  useUpdateWorkspace,
} from "../hooks/use-workspaces";
import type { Workspace } from "../lib/types";
import { workspaceRoutes } from "../lib/routes";
import { DeleteWorkspaceDialog } from "./delete-workspace-dialog";

type WorkspaceSettingsFormProps = {
  workspace: Workspace;
};

function resolveModel(model: string): ChatModelId {
  return CHAT_MODELS.includes(model as ChatModelId)
    ? (model as ChatModelId)
    : "gpt-4o-mini";
}

export function WorkspaceSettingsForm({
  workspace,
}: WorkspaceSettingsFormProps) {
  const router = useRouter();
  const updateWorkspace = useUpdateWorkspace(workspace.id);
  const deleteWorkspace = useDeleteWorkspace();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [title, setTitle] = useState(workspace.title);
  const [description, setDescription] = useState(workspace.description ?? "");
  const [icon, setIcon] = useState(workspace.icon ?? "");
  const [defaultModel, setDefaultModel] = useState<ChatModelId>(
    resolveModel(workspace.defaultModel),
  );
  const [error, setError] = useState<string | null>(null);

  const isDirty =
    title.trim() !== workspace.title ||
    description.trim() !== (workspace.description ?? "") ||
    icon.trim() !== (workspace.icon ?? "") ||
    defaultModel !== resolveModel(workspace.defaultModel);

  async function handleSave(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError("Give the notebook a title.");
      return;
    }

    try {
      await updateWorkspace.mutateAsync({
        title: title.trim(),
        description: description.trim() || undefined,
        icon: icon.trim() || undefined,
        defaultModel,
      });
      toast.add({ title: "Settings saved", type: "success" });
      router.refresh();
    } catch (saveError) {
      setError(getErrorMessage(saveError, "Could not save your changes."));
    }
  }

  async function handleDelete() {
    try {
      await deleteWorkspace.mutateAsync(workspace.id);
      toast.add({ title: "Notebook deleted", type: "success" });
      router.push(workspaceRoutes.list);
    } catch (deleteError) {
      setDeleteOpen(false);
      toast.add({
        title: "Could not delete the notebook",
        description: getErrorMessage(deleteError, "Try again in a moment."),
        type: "error",
      });
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 p-4 md:p-8">
      <PageHeader
        title="Notebook settings"
        description="Name, describe, and set the defaults for this notebook."
      />

      <form onSubmit={(event) => void handleSave(event)} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="title">Title</Label>
          <Input
            id="title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={120}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={3}
            maxLength={500}
            className="min-h-20"
          />
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="icon">Icon</Label>
            <Input
              id="icon"
              value={icon}
              onChange={(event) => setIcon(event.target.value)}
              placeholder="📚"
              maxLength={8}
            />
            <p className="text-xs text-muted-foreground">
              Paste any emoji.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="defaultModel">Default chat model</Label>
            <Select
              value={defaultModel}
              items={CHAT_MODELS.map((model) => ({
                value: model,
                label: CHAT_MODEL_LABELS[model],
              }))}
              onValueChange={(value) => setDefaultModel(value as ChatModelId)}
            >
              <SelectTrigger id="defaultModel" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CHAT_MODELS.map((model) => (
                  <SelectItem key={model} value={model}>
                    {CHAT_MODEL_LABELS[model]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              You can still switch models from the chat header.
            </p>
          </div>
        </div>

        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}

        <Button
          type="submit"
          disabled={updateWorkspace.isPending || !isDirty}
        >
          {updateWorkspace.isPending ? <Spinner /> : null}
          Save changes
        </Button>
      </form>

      <section
        aria-labelledby="danger-zone"
        className="rounded-xl border border-destructive/30 bg-destructive/5 p-5"
      >
        <h2
          id="danger-zone"
          className="font-heading text-sm font-semibold text-destructive"
        >
          Delete this notebook
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          This removes its sources, conversations, and study tools for good.
        </p>
        <Button
          type="button"
          variant="destructive"
          className="mt-4"
          onClick={() => setDeleteOpen(true)}
        >
          Delete notebook
        </Button>
      </section>

      <DeleteWorkspaceDialog
        workspace={workspace}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onConfirm={handleDelete}
        isPending={deleteWorkspace.isPending}
      />
    </div>
  );
}
