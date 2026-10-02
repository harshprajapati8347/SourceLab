"use client";

import { useState } from "react";
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
import type { UserMemory } from "../lib/types";
import { MemoryFormDialog } from "./memory-form-dialog";

export function MemorySettings() {
  const {
    data: memories = [],
    isLoading,
    error,
    refetch,
  } = useMemories();
  const createMemory = useCreateMemory();
  const updateMemory = useUpdateMemory();
  const deleteMemory = useDeleteMemory();

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
      });
      toast.add({ title: "Memory updated", type: "success" });
      return;
    }

    await createMemory.mutateAsync(values);
    toast.add({ title: "Memory added", type: "success" });
  }

  async function confirmDelete() {
    if (!deletingMemory) {
      return;
    }

    try {
      await deleteMemory.mutateAsync(deletingMemory.id);
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
      title="Memory"
      description="Things SourceLab remembers about you across every notebook. It learns some from your chats, and you can add or remove any of them."
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
              Keep chatting and SourceLab will pick up your preferences, or add
              one yourself.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button onClick={openCreateDialog}>
              <PlusIcon />
              Add a memory
            </Button>
          </EmptyContent>
        </Empty>
      ) : (
        <ul className="space-y-3">
          {memories.map((memory) => (
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
      )}

      <MemoryFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        memory={editingMemory}
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
              SourceLab will stop using it in chats. If you mention it again, it
              may learn it again.
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
