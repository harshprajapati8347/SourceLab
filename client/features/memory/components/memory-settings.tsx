"use client";

import { useState } from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "@/components/ui/toast";
import { AccountShell } from "@/features/workspaces/components/account-shell";
import { getErrorMessage } from "@/shared/lib/api";
import {
  useCreateMemory,
  useDeleteMemory,
  useMemories,
  useUpdateMemory,
} from "../hooks/use-memories";
import { memoryRoutes } from "../lib/routes";
import type { UserMemory } from "../lib/types";
import { MemoryFormDialog } from "./memory-form-dialog";

type MemorySettingsProps = {
  sourceFilter?: "manual" | "learned" | null;
  workspaceId?: string | null;
};

export function MemorySettings({
  sourceFilter = null,
  workspaceId = null,
}: MemorySettingsProps) {
  const {
    data: memories = [],
    isLoading,
    error,
    refetch,
  } = useMemories(workspaceId);
  const createMemory = useCreateMemory();
  const updateMemory = useUpdateMemory();
  const deleteMemory = useDeleteMemory();
  const notebookMemory = Boolean(workspaceId);
  const allMemoriesHref = memoryRoutes.href({ workspaceId });

  const visibleMemories = sourceFilter
    ? memories.filter((memory) => memory.source === sourceFilter)
    : memories;

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingMemory, setEditingMemory] = useState<UserMemory | null>(null);
  const [deletingMemory, setDeletingMemory] = useState<UserMemory | null>(null);

  function openCreateDialog() {
    setEditingMemory(null);
    setDialogOpen(true);
  }

  function openEditDialog(memory: UserMemory) {
    setEditingMemory(memory);
    setDialogOpen(true);
  }

  async function handleSubmit(values: { memory: string }) {
    if (editingMemory) {
      await updateMemory.mutateAsync({
        memoryId: editingMemory.id,
        input: values,
        workspaceId,
      });
      toast.add({ title: "Memory updated", type: "success" });
      return;
    }

    await createMemory.mutateAsync(
      workspaceId ? { ...values, workspaceId } : values,
    );
    toast.add({ title: "Memory added", type: "success" });
  }

  async function confirmDelete() {
    if (!deletingMemory) {
      return;
    }

    try {
      await deleteMemory.mutateAsync({
        memoryId: deletingMemory.id,
        workspaceId,
      });
      toast.add({ title: "Memory deleted", type: "success" });
      setDeletingMemory(null);
    } catch (deleteError) {
      toast.add({
        title: "Could not delete this memory",
        description: getErrorMessage(deleteError, "Try again in a moment."),
        type: "error",
      });
    }
  }

  return (
    <AccountShell
      title={notebookMemory ? "Notebook memory" : "Memory"}
      description={
        notebookMemory
          ? "Things SourceLab remembers about this notebook. They stay here, and chats in this notebook can recall them."
          : "Things SourceLab remembers about you in every notebook. Add the facts you want available everywhere."
      }
      actions={
        <Button onClick={openCreateDialog}>
          <PlusIcon />
          Add memory
        </Button>
      }
    >
      {isLoading ? (
        <div className="space-y-3" aria-busy="true" aria-label="Loading memories">
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
        </div>
      ) : error && memories.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyTitle>Could not load your memories</EmptyTitle>
            <EmptyDescription>
              {getErrorMessage(error, "Check your connection and try again.")}
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button onClick={() => void refetch()}>Try again</Button>
          </EmptyContent>
        </Empty>
      ) : memories.length === 0 ? (
        <Empty className="border border-dashed py-14">
          <EmptyHeader>
            <EmptyTitle>No memories yet</EmptyTitle>
            <EmptyDescription>
              {notebookMemory
                ? "Keep chatting in this notebook and SourceLab will pick up what matters here, or add a memory yourself."
                : "Add something you want SourceLab to remember in every notebook."}
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button onClick={openCreateDialog}>
              <PlusIcon />
              Add a memory
            </Button>
          </EmptyContent>
        </Empty>
      ) : visibleMemories.length === 0 ? (
        <Empty className="border border-dashed py-14">
          <EmptyHeader>
            <EmptyTitle>
              {sourceFilter === "manual"
                ? "No memories you added"
                : "No learned memories"}
            </EmptyTitle>
            <EmptyDescription>
              {sourceFilter === "manual"
                ? notebookMemory
                  ? "You have not written a memory for this notebook yet. Chat memories are still saved."
                  : "You have not written a memory yet."
                : notebookMemory
                  ? "SourceLab has not learned a memory from your chats yet."
                  : "Memories learned from a chat stay with that notebook."}
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button
              nativeButton={false}
              variant="outline"
              render={<Link href={allMemoriesHref} />}
            >
              Show all memories
            </Button>
          </EmptyContent>
        </Empty>
      ) : (
        <div className="space-y-3">
          {sourceFilter ? (
            <p className="text-sm text-muted-foreground">
              {sourceFilter === "manual"
                ? "Showing memories you added."
                : "Showing memories learned from chats."}{" "}
              <Link
                href={allMemoriesHref}
                className="font-medium text-foreground underline underline-offset-4 outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
              >
                Show all
              </Link>
            </p>
          ) : null}
          <ul className="space-y-3">
            {visibleMemories.map((memory) => (
              <li
                key={memory.id}
                className="rounded-xl border bg-card p-4 transition-colors duration-200 hover:border-primary/30"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="secondary">
                        {memory.source === "manual" ? "Added by you" : "Learned"}
                      </Badge>
                      {memory.categories?.map((category) => (
                        <Badge key={category} variant="outline">
                          {category}
                        </Badge>
                      ))}
                    </div>
                    <p className="text-sm leading-relaxed">{memory.memory}</p>
                    <p className="text-xs text-muted-foreground">
                      Updated{" "}
                      {formatDistanceToNow(new Date(memory.updatedAt), {
                        addSuffix: true,
                      })}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Edit memory"
                      onClick={() => openEditDialog(memory)}
                    >
                      <PencilIcon />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Delete memory"
                      onClick={() => setDeletingMemory(memory)}
                    >
                      <Trash2Icon />
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <MemoryFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        memory={editingMemory}
        description={
          notebookMemory
            ? "SourceLab brings this into a chat when it is relevant, in this notebook only."
            : "SourceLab brings this into a chat when it is relevant, in any notebook."
        }
        onSubmit={handleSubmit}
        isPending={createMemory.isPending || updateMemory.isPending}
      />

      <AlertDialog
        open={Boolean(deletingMemory)}
        onOpenChange={(open) => {
          if (!open) {
            setDeletingMemory(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this memory?</AlertDialogTitle>
            <AlertDialogDescription>
              {notebookMemory
                ? "SourceLab will stop using it in this notebook. If you mention it again, it may learn it again."
                : "SourceLab will stop using it across your notebooks."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMemory.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={deleteMemory.isPending}
              onClick={(event) => {
                event.preventDefault();
                void confirmDelete();
              }}
            >
              {deleteMemory.isPending ? <Spinner /> : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AccountShell>
  );
}
