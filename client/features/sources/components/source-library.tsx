"use client";

import { useMemo, useState } from "react";
import {
  CheckSquareIcon,
  LayoutGridIcon,
  ListIcon,
  PlusIcon,
  RefreshCwIcon,
  SearchIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react";
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/shared/components/page-header";
import { getErrorMessage } from "@/shared/lib/api";
import { useUIStore } from "@/shared/stores/ui-store";
import {
  useBulkDeleteSources,
  useDeleteSource,
  useReprocessSources,
  useSources,
} from "../hooks/use-sources";
import {
  SOURCE_STATUS_LABELS,
  SOURCE_STATUSES,
  SOURCE_TYPE_LABELS,
  SOURCE_TYPES,
} from "../lib/constants";
import type {
  Source,
  SourceFilters,
  SourceStatus,
  SourceType,
} from "../lib/types";
import { SourceCard } from "./source-card";

type SourceLibraryProps = {
  workspaceId: string;
};

export function SourceLibrary({ workspaceId }: SourceLibraryProps) {
  const [view, setView] = useState<"grid" | "list">("grid");
  const [deletingSource, setDeletingSource] = useState<Source | null>(null);
  const [filters, setFilters] = useState<SourceFilters>({});
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectionMode, setSelectionMode] = useState(false);
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);

  const setAddSourceOpen = useUIStore((state) => state.setAddSourceOpen);

  const { data: sources, isLoading, error } = useSources(workspaceId, filters);
  const deleteSource = useDeleteSource(workspaceId);
  const bulkDelete = useBulkDeleteSources(workspaceId);
  const reprocess = useReprocessSources(workspaceId);

  const failedCount =
    sources?.filter((source) => source.status === "FAILED").length ?? 0;

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.q?.trim()) count += 1;
    if (filters.type) count += 1;
    if (filters.status) count += 1;
    return count;
  }, [filters]);

  const hasActiveFilters = activeFilterCount > 0;

  function exitSelectionMode() {
    setSelectionMode(false);
    setSelectedIds([]);
  }

  return (
    <div className="mx-auto flex w-full min-w-0 max-w-6xl flex-1 flex-col gap-6 p-4 md:p-8">
      <PageHeader
        title="Sources"
        description={
          sources
            ? `${sources.length} ${sources.length === 1 ? "source" : "sources"}${hasActiveFilters ? " match your filters" : " in this notebook"}`
            : "Everything this notebook can cite"
        }
        actions={
          <Button onClick={() => setAddSourceOpen(true)}>
            <PlusIcon />
            Add source
          </Button>
        }
      />

      <div className="space-y-3">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
          <div className="relative min-w-0 flex-1">
            <SearchIcon
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              type="search"
              className="h-9 rounded-full pl-9"
              placeholder="Search sources"
              aria-label="Search sources"
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
            <Select
              value={filters.type ?? "all"}
              items={[
                { value: "all", label: "All types" },
                ...SOURCE_TYPES.map((type) => ({
                  value: type,
                  label: SOURCE_TYPE_LABELS[type],
                })),
              ]}
              onValueChange={(value) =>
                setFilters((current) => ({
                  ...current,
                  type: value === "all" ? undefined : (value as SourceType),
                }))
              }
            >
              <SelectTrigger
                aria-label="Filter by type"
                className="h-9 w-[8.5rem] rounded-full"
              >
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                {SOURCE_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {SOURCE_TYPE_LABELS[type]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={filters.status ?? "all"}
              items={[
                { value: "all", label: "All statuses" },
                ...SOURCE_STATUSES.map((status) => ({
                  value: status,
                  label: SOURCE_STATUS_LABELS[status],
                })),
              ]}
              onValueChange={(value) =>
                setFilters((current) => ({
                  ...current,
                  status: value === "all" ? undefined : (value as SourceStatus),
                }))
              }
            >
              <SelectTrigger
                aria-label="Filter by status"
                className="h-9 w-[8.5rem] rounded-full"
              >
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {SOURCE_STATUSES.map((status) => (
                  <SelectItem key={status} value={status}>
                    {SOURCE_STATUS_LABELS[status]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div
              role="group"
              aria-label="Layout"
              className="flex items-center rounded-full border p-0.5"
            >
              <Button
                variant={view === "grid" ? "secondary" : "ghost"}
                size="icon-sm"
                className="rounded-full"
                aria-pressed={view === "grid"}
                onClick={() => setView("grid")}
              >
                <LayoutGridIcon />
                <span className="sr-only">Grid view</span>
              </Button>
              <Button
                variant={view === "list" ? "secondary" : "ghost"}
                size="icon-sm"
                className="rounded-full"
                aria-pressed={view === "list"}
                onClick={() => setView("list")}
              >
                <ListIcon />
                <span className="sr-only">List view</span>
              </Button>
            </div>

            <Button
              variant={selectionMode ? "secondary" : "outline"}
              size="sm"
              className="h-9 rounded-full"
              aria-pressed={selectionMode}
              onClick={() =>
                selectionMode ? exitSelectionMode() : setSelectionMode(true)
              }
            >
              <CheckSquareIcon />
              Select
            </Button>

            {failedCount > 0 ? (
              <Button
                variant="outline"
                size="sm"
                className="h-9 rounded-full"
                disabled={reprocess.isPending}
                onClick={() => reprocess.mutate(undefined)}
              >
                {reprocess.isPending ? <Spinner /> : <RefreshCwIcon />}
                Retry {failedCount} failed
              </Button>
            ) : null}
          </div>
        </div>

        {hasActiveFilters ? (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">
              {activeFilterCount}{" "}
              {activeFilterCount === 1 ? "filter" : "filters"} applied
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-muted-foreground"
              onClick={() => setFilters({})}
            >
              <XIcon />
              Clear
            </Button>
          </div>
        ) : null}

        {selectionMode ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-muted/40 px-4 py-2.5">
            <p className="text-sm text-muted-foreground" aria-live="polite">
              {selectedIds.length > 0
                ? `${selectedIds.length} selected`
                : "Choose the sources to delete"}
            </p>
            <div className="flex items-center gap-2">
              {sources && sources.length > 0 ? (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    setSelectedIds(
                      selectedIds.length === sources.length
                        ? []
                        : sources.map((source) => source.id),
                    )
                  }
                >
                  {selectedIds.length === sources.length
                    ? "Clear selection"
                    : "Select all"}
                </Button>
              ) : null}
              <Button
                size="sm"
                variant="destructive"
                disabled={selectedIds.length === 0 || bulkDelete.isPending}
                onClick={() => setConfirmBulkDelete(true)}
              >
                <Trash2Icon />
                Delete
              </Button>
              <Button size="sm" variant="outline" onClick={exitSelectionMode}>
                Done
              </Button>
            </div>
          </div>
        ) : null}
      </div>

      {isLoading ? (
        <div
          aria-busy="true"
          aria-label="Loading sources"
          className={cn(
            "grid min-w-0 grid-cols-1 gap-4",
            view === "grid" && "sm:grid-cols-2 xl:grid-cols-3",
          )}
        >
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton
              key={index}
              className={cn("rounded-xl", view === "grid" ? "h-40" : "h-20")}
            />
          ))}
        </div>
      ) : error && !sources ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyTitle>Could not load sources</EmptyTitle>
            <EmptyDescription>
              {getErrorMessage(error, "Check your connection and try again.")}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : sources && sources.length > 0 ? (
        <ul
          className={cn(
            "grid min-w-0 grid-cols-1 gap-3",
            view === "grid" && "sm:grid-cols-2 xl:grid-cols-3",
          )}
        >
          {sources.map((source) => (
            <li key={source.id} className="flex w-full min-w-0 items-start gap-3">
              {selectionMode ? (
                <Checkbox
                  className="mt-5"
                  aria-label={`Select ${source.title}`}
                  checked={selectedIds.includes(source.id)}
                  onCheckedChange={(checked) =>
                    setSelectedIds((current) =>
                      checked
                        ? [...current, source.id]
                        : current.filter((id) => id !== source.id),
                    )
                  }
                />
              ) : null}
              <SourceCard
                source={source}
                layout={view}
                className="min-w-0 flex-1 self-stretch"
                onDelete={setDeletingSource}
                onReprocess={
                  source.status === "FAILED"
                    ? (target) => reprocess.mutate([target.id])
                    : undefined
                }
              />
            </li>
          ))}
        </ul>
      ) : (
        <Empty className="border border-dashed py-16">
          <EmptyHeader>
            <EmptyTitle>
              {hasActiveFilters ? "No source matches" : "No sources yet"}
            </EmptyTitle>
            <EmptyDescription>
              {hasActiveFilters
                ? "Try a different search, or clear the filters."
                : "Add a PDF, a web page, a YouTube video, or some text. Chat and study tools will use it."}
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent className="flex flex-wrap justify-center gap-2">
            {hasActiveFilters ? (
              <Button variant="outline" onClick={() => setFilters({})}>
                Clear filters
              </Button>
            ) : (
              <Button onClick={() => setAddSourceOpen(true)}>
                <PlusIcon />
                Add a source
              </Button>
            )}
          </EmptyContent>
        </Empty>
      )}

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
            <AlertDialogTitle>Delete this source?</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="font-medium text-foreground">
                {deletingSource?.title}
              </span>{" "}
              will be removed from this notebook, and answers will stop citing
              it. This can&apos;t be undone.
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
                deleteSource.mutate(deletingSource.id, {
                  onSuccess: () => setDeletingSource(null),
                });
              }}
            >
              {deleteSource.isPending ? <Spinner /> : null}
              Delete source
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmBulkDelete} onOpenChange={setConfirmBulkDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {selectedIds.length}{" "}
              {selectedIds.length === 1 ? "source" : "sources"}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              They will be removed from this notebook, and answers will stop
              citing them. This can&apos;t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkDelete.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={bulkDelete.isPending}
              onClick={(event) => {
                event.preventDefault();
                bulkDelete.mutate(selectedIds, {
                  onSuccess: () => {
                    setConfirmBulkDelete(false);
                    exitSelectionMode();
                  },
                });
              }}
            >
              {bulkDelete.isPending ? <Spinner /> : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
