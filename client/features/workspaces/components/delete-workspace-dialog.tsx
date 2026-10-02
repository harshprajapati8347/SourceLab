"use client";

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
import { Spinner } from "@/components/ui/spinner";
import type { Workspace } from "../lib/types";

type DeleteWorkspaceDialogProps = {
  workspace: Workspace | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => Promise<void>;
  isPending?: boolean;
};

export function DeleteWorkspaceDialog({
  workspace,
  open,
  onOpenChange,
  onConfirm,
  isPending = false,
}: DeleteWorkspaceDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this notebook?</AlertDialogTitle>
          <AlertDialogDescription>
            <span className="font-medium text-foreground">
              {workspace?.title}
            </span>{" "}
            and everything in it will be deleted for good: its sources,
            conversations, and learning tools. This can&apos;t be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={isPending}
            onClick={(event) => {
              event.preventDefault();
              void onConfirm();
            }}
          >
            {isPending ? <Spinner /> : null}
            Delete notebook
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
