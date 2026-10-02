"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { useModKeyLabel } from "@/shared/hooks/use-keyboard-shortcuts";
import { useUIStore } from "@/shared/stores/ui-store";

type ShortcutRow = { label: string; keys: string[] };

export function ShortcutsDialog() {
  const open = useUIStore((state) => state.shortcutsOpen);
  const setOpen = useUIStore((state) => state.setShortcutsOpen);
  const mod = useModKeyLabel();

  const groups: { title: string; rows: ShortcutRow[] }[] = [
    {
      title: "Anywhere",
      rows: [
        { label: "Search notebooks and sources", keys: [mod, "K"] },
        { label: "Toggle the sidebar", keys: [mod, "B"] },
        { label: "Show this list", keys: ["?"] },
      ],
    },
    {
      title: "Inside a notebook",
      rows: [
        { label: "Focus the chat box", keys: [mod, "/"] },
        { label: "Add a source", keys: [mod, "U"] },
        { label: "Show or hide the sources panel", keys: [mod, "."] },
        { label: "Send a message", keys: ["Enter"] },
        { label: "New line in a message", keys: ["Shift", "Enter"] },
      ],
    },
  ];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
          <DialogDescription>
            Move around without leaving the keyboard.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-5">
          {groups.map((group) => (
            <section key={group.title} aria-label={group.title}>
              <h3 className="mb-2 text-xs font-semibold text-muted-foreground">
                {group.title}
              </h3>
              <ul className="divide-y rounded-lg border">
                {group.rows.map((row) => (
                  <li
                    key={row.label}
                    className="flex items-center justify-between gap-4 px-3 py-2 text-sm"
                  >
                    <span>{row.label}</span>
                    <KbdGroup>
                      {row.keys.map((key) => (
                        <Kbd key={key}>{key}</Kbd>
                      ))}
                    </KbdGroup>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
