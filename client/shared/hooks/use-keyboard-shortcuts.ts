"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";

export type ShortcutHandlers = {
  onCommand?: () => void;
  onShortcuts?: () => void;
  onFocusChat?: () => void;
  onAddSource?: () => void;
  onToggleSources?: () => void;
};

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return (
    target.isContentEditable ||
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.tagName === "SELECT"
  );
}

/**
 * Registers the app-wide shortcuts once. Handlers can change on every render;
 * the listener always calls the latest ones.
 */
export function useKeyboardShortcuts(handlers: ShortcutHandlers) {
  const handlersRef = useRef(handlers);

  useEffect(() => {
    handlersRef.current = handlers;
  });

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const current = handlersRef.current;
      const mod = event.metaKey || event.ctrlKey;
      const key = event.key.toLowerCase();

      if (mod && key === "k" && current.onCommand) {
        event.preventDefault();
        current.onCommand();
        return;
      }

      if (mod && key === "/" && current.onFocusChat) {
        event.preventDefault();
        current.onFocusChat();
        return;
      }

      if (mod && key === "u" && current.onAddSource) {
        event.preventDefault();
        current.onAddSource();
        return;
      }

      if (mod && key === "." && current.onToggleSources) {
        event.preventDefault();
        current.onToggleSources();
        return;
      }

      if (
        event.key === "?" &&
        !mod &&
        !isTypingTarget(event.target) &&
        current.onShortcuts
      ) {
        event.preventDefault();
        current.onShortcuts();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}

function subscribeNever() {
  return () => {};
}

/** "⌘" on Apple platforms, "Ctrl" elsewhere. Renders "Ctrl" on the server to avoid a hydration mismatch. */
export function useModKeyLabel() {
  return useSyncExternalStore(
    subscribeNever,
    () => (/Mac|iPhone|iPad/i.test(navigator.platform) ? "⌘" : "Ctrl"),
    () => "Ctrl",
  );
}
