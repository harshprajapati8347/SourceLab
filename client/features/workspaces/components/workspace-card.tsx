"use client";

import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { MoreHorizontalIcon, PencilIcon, Trash2Icon } from "lucide-react";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { workspaceRoutes } from "../lib/routes";
import type { Workspace } from "../lib/types";

type WorkspaceCardProps = {
    workspace: Workspace;
    onEdit: (workspace: Workspace) => void;
    onDelete: (workspace: Workspace) => void;
};

export function WorkspaceCard({
    workspace,
    onEdit,
    onDelete,
}: WorkspaceCardProps) {
    const href = workspaceRoutes.detail(workspace.id);

    return (
        <Card className="group/card relative transition-shadow hover:shadow-md">
            <Link
                href={href}
                className="absolute inset-0 z-0 rounded-[inherit] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                aria-label={`Open ${workspace.title}`}
            />

            <CardHeader className="relative">
                <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-3">
                        <span className="text-2xl leading-none">
                            {workspace.icon ?? "📚"}
                        </span>
                        <div className="min-w-0">
                            <CardTitle className="truncate group-hover/card:underline">
                                {workspace.title}
                            </CardTitle>
                            <CardDescription>
                                Updated{" "}
                                {formatDistanceToNow(
                                    new Date(workspace.updatedAt),
                                    { addSuffix: true },
                                )}
                            </CardDescription>
                        </div>
                    </div>

                    <div
                        className="relative z-10"
                        onClick={(event) => event.stopPropagation()}
                        onKeyDown={(event) => event.stopPropagation()}
                    >
                        <DropdownMenu>
                            <DropdownMenuTrigger
                                render={
                                    <Button
                                        variant="ghost"
                                        size="icon-sm"
                                        className="shrink-0"
                                    />
                                }
                            >
                                <MoreHorizontalIcon />
                                <span className="sr-only">Open menu</span>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                    onClick={() => onEdit(workspace)}
                                >
                                    <PencilIcon />
                                    Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                    variant="destructive"
                                    onClick={() => onDelete(workspace)}
                                >
                                    <Trash2Icon />
                                    Delete
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </div>
            </CardHeader>

            {workspace.description ? (
                <CardContent className="relative">
                    <p className="line-clamp-2 text-sm text-muted-foreground">
                        {workspace.description}
                    </p>
                </CardContent>
            ) : null}
        </Card>
    );
}
