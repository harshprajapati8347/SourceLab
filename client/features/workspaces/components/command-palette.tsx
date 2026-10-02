"use client";

import { useRouter } from "next/navigation";
import {
  BookOpenIcon,
  BrainIcon,
  CreditCardIcon,
  GraduationCapIcon,
  KeyboardIcon,
  LibraryIcon,
  MessageSquareIcon,
  MonitorIcon,
  MoonIcon,
  PlusIcon,
  SettingsIcon,
  SunIcon,
} from "lucide-react";
import { useTheme } from "next-themes";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { billingRoutes } from "@/features/billing/lib/routes";
import { learnRoutes } from "@/features/learn/lib/routes";
import { memoryRoutes } from "@/features/memory/lib/routes";
import { useSources } from "@/features/sources/hooks/use-sources";
import { sourceRoutes } from "@/features/sources/lib/routes";
import { SourceTypeIcon } from "@/features/sources/components/source-type-icon";
import { useUIStore } from "@/shared/stores/ui-store";
import { useWorkspaces } from "../hooks/use-workspaces";
import { workspaceRoutes } from "../lib/routes";

type CommandPaletteProps = {
  /** When set, sources and notebook sections are offered too. */
  workspaceId?: string;
};

export function CommandPalette({ workspaceId }: CommandPaletteProps) {
  const router = useRouter();
  const { setTheme } = useTheme();
  const open = useUIStore((state) => state.commandOpen);
  const setOpen = useUIStore((state) => state.setCommandOpen);
  const setCreateWorkspaceOpen = useUIStore(
    (state) => state.setCreateWorkspaceOpen,
  );
  const setAddSourceOpen = useUIStore((state) => state.setAddSourceOpen);
  const setShortcutsOpen = useUIStore((state) => state.setShortcutsOpen);

  const { data: workspaces } = useWorkspaces();
  const { data: sources } = useSources(workspaceId ?? "", {}, {
    enabled: Boolean(workspaceId),
  });

  function run(action: () => void) {
    setOpen(false);
    action();
  }

  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      title="Search"
      description="Find a notebook, a source, or an action."
    >
      <CommandInput placeholder="Search notebooks, sources, and actions" />
      <CommandList>
        <CommandEmpty>Nothing matches that search.</CommandEmpty>

        {workspaceId ? (
          <>
            <CommandGroup heading="This notebook">
              <CommandItem
                value="go chat"
                onSelect={() =>
                  run(() => router.push(workspaceRoutes.detail(workspaceId)))
                }
              >
                <MessageSquareIcon />
                Chat
              </CommandItem>
              <CommandItem
                value="go learn study tools"
                onSelect={() =>
                  run(() => router.push(learnRoutes.hub(workspaceId)))
                }
              >
                <GraduationCapIcon />
                Learn
              </CommandItem>
              <CommandItem
                value="go sources library"
                onSelect={() =>
                  run(() => router.push(sourceRoutes.list(workspaceId)))
                }
              >
                <LibraryIcon />
                Sources
              </CommandItem>
              <CommandItem
                value="go notebook settings"
                onSelect={() =>
                  run(() => router.push(workspaceRoutes.settings(workspaceId)))
                }
              >
                <SettingsIcon />
                Notebook settings
              </CommandItem>
              <CommandItem
                value="add source upload"
                onSelect={() => run(() => setAddSourceOpen(true))}
              >
                <PlusIcon />
                Add a source
              </CommandItem>
            </CommandGroup>

            {sources && sources.length > 0 ? (
              <CommandGroup heading="Sources">
                {sources.map((source) => (
                  <CommandItem
                    key={source.id}
                    value={`source ${source.title} ${source.id}`}
                    onSelect={() =>
                      run(() =>
                        router.push(sourceRoutes.detail(workspaceId, source.id)),
                      )
                    }
                  >
                    <SourceTypeIcon type={source.type} />
                    <span className="truncate">{source.title}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : null}
            <CommandSeparator />
          </>
        ) : null}

        <CommandGroup heading="Notebooks">
          <CommandItem
            value="new notebook create"
            onSelect={() =>
              run(() => {
                setCreateWorkspaceOpen(true);
                router.push(workspaceRoutes.list);
              })
            }
          >
            <PlusIcon />
            New notebook
          </CommandItem>
          {workspaces?.map((workspace) => (
            <CommandItem
              key={workspace.id}
              value={`notebook ${workspace.title} ${workspace.description ?? ""} ${workspace.id}`}
              onSelect={() =>
                run(() => router.push(workspaceRoutes.detail(workspace.id)))
              }
            >
              <BookOpenIcon />
              <span className="truncate">{workspace.title}</span>
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Account and preferences">
          <CommandItem
            value="billing credits plan"
            onSelect={() => run(() => router.push(billingRoutes.settings))}
          >
            <CreditCardIcon />
            Billing and credits
          </CommandItem>
          <CommandItem
            value="memory"
            onSelect={() => run(() => router.push(memoryRoutes.settings))}
          >
            <BrainIcon />
            Memory
          </CommandItem>
          <CommandItem
            value="keyboard shortcuts help"
            onSelect={() => run(() => setShortcutsOpen(true))}
          >
            <KeyboardIcon />
            Keyboard shortcuts
          </CommandItem>
          <CommandItem
            value="theme light"
            onSelect={() => run(() => setTheme("light"))}
          >
            <SunIcon />
            Light theme
          </CommandItem>
          <CommandItem
            value="theme dark"
            onSelect={() => run(() => setTheme("dark"))}
          >
            <MoonIcon />
            Dark theme
          </CommandItem>
          <CommandItem
            value="theme system"
            onSelect={() => run(() => setTheme("system"))}
          >
            <MonitorIcon />
            System theme
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
