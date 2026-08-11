"use client";

import { useState } from "react";
import { LayoutGridIcon, ListIcon, PlusIcon, SearchIcon } from "lucide-react";
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
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { ApiError } from "@/shared/lib/api";
import { useDeleteSource, useSources } from "../hooks/use-sources";
import {
  SOURCE_STATUSES,
  SOURCE_TYPE_LABELS,
  SOURCE_TYPES,
} from "../lib/constants";
import type { Source, SourceFilters } from "../lib/types";
import { AddSourceDialog } from "./add-source-dialog";
import { SourceCard } from "./source-card";

type SourceLibraryProps = {
  workspaceId: string;
};

export function SourceLibrary({ workspaceId }: SourceLibraryProps) {
  const [view, setView] = useState<"grid" | "list">("grid");
  const [addOpen, setAddOpen] = useState(false);
  const [deletingSource, setDeletingSource] = useState<Source | null>(null);
  const [filters, setFilters] = useState<SourceFilters>({});

  const { data: sources, isLoading, error } = useSources(workspaceId, filters);
  const deleteSource = useDeleteSource(workspaceId);

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-heading text-xl font-semibold">Source library</h2>
          <p className="text-sm text-muted-foreground">
            All knowledge sources in this workspace.
          </p>
        </div>
        <Button onClick={() => setAddOpen(true)}>
          <PlusIcon />
          Add source
        </Button>
      </div>

      <div className="flex flex-col gap-4">
        <div className="relative max-w-md">
          <SearchIcon className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search sources..."
            value={filters.q ?? ""}
            onChange={(event) =>
              setFilters((current) => ({
                ...current,
                q: event.target.value,
              }))
            }
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <FilterChip
            label="All types"
            active={!filters.type}
            onClick={() =>
              setFilters((current) => ({
                ...current,
                type: undefined,
              }))
            }
          />
          {SOURCE_TYPES.map((type) => (
            <FilterChip
              key={type}
              label={SOURCE_TYPE_LABELS[type]}
              active={filters.type === type}
              onClick={() =>
                setFilters((current) => ({
                  ...current,
                  type: current.type === type ? undefined : type,
                }))
              }
            />
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <FilterChip
            label="All statuses"
            active={!filters.status}
            onClick={() =>
              setFilters((current) => ({
                ...current,
                status: undefined,
              }))
            }
          />
          {SOURCE_STATUSES.map((status) => (
            <FilterChip
              key={status}
              label={status.toLowerCase()}
              active={filters.status === status}
              onClick={() =>
                setFilters((current) => ({
                  ...current,
                  status: current.status === status ? undefined : status,
                }))
              }
            />
          ))}

          <div className="ml-auto flex items-center gap-1">
            <Button
              variant={view === "grid" ? "secondary" : "ghost"}
              size="icon-sm"
              onClick={() => setView("grid")}
            >
              <LayoutGridIcon />
            </Button>
            <Button
              variant={view === "list" ? "secondary" : "ghost"}
              size="icon-sm"
              onClick={() => setView("list")}
            >
              <ListIcon />
            </Button>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div
          className={cn(
            "grid gap-4",
            view === "grid" ? "sm:grid-cols-2 xl:grid-cols-3" : "",
          )}
        >
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton
              key={index}
              className={cn(
                "rounded-[24px]",
                view === "grid" ? "h-40" : "h-24",
              )}
            />
          ))}
        </div>
      ) : error ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyTitle>Could not load sources</EmptyTitle>
            <EmptyDescription>
              {error instanceof ApiError ? error.message : "Please try again."}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : sources && sources.length > 0 ? (
        <div
          className={cn(
            "grid gap-4",
            view === "grid" ? "sm:grid-cols-2 xl:grid-cols-3" : "grid-cols-1",
          )}
        >
          {sources.map((source) => (
            <SourceCard
              key={source.id}
              source={source}
              onDelete={setDeletingSource}
            />
          ))}
        </div>
      ) : (
        <Empty className="border">
          <EmptyHeader>
            <EmptyTitle>No sources found</EmptyTitle>
            <EmptyDescription>
              Add a source or adjust your search filters.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button onClick={() => setAddOpen(true)}>
              <PlusIcon />
              Add source
            </Button>
          </EmptyContent>
        </Empty>
      )}

      <AddSourceDialog
        workspaceId={workspaceId}
        open={addOpen}
        onOpenChange={setAddOpen}
      />

      <AlertDialog
        open={Boolean(deletingSource)}
        onOpenChange={(open) => {
          if (!open) {
            setDeletingSource(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete source?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete{" "}
              <span className="font-medium text-foreground">
                {deletingSource?.title}
              </span>
              .
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteSource.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={deleteSource.isPending}
              onClick={(event) => {
                event.preventDefault();
                if (!deletingSource) {
                  return;
                }
                void deleteSource
                  .mutateAsync(deletingSource.id)
                  .then(() => setDeletingSource(null));
              }}
            >
              {deleteSource.isPending ? <Spinner /> : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      size="sm"
      variant={active ? "secondary" : "outline"}
      className="rounded-full capitalize"
      onClick={onClick}
    >
      {label}
    </Button>
  );
}
