"use client";

import { useState, useEffect } from "react";

// State for command palette
export function useCommandPaletteState() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd+K (Mac) or Ctrl+K (Windows/Linux)
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
      // Escape to close
      if (e.key === "Escape" && open) {
        setOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  return [open, setOpen] as const;
}

// State for keyboard shortcuts dialog
let keyboardShortcutsOpenState = false;
const keyboardShortcutsListeners = new Set<(open: boolean) => void>();

export function useKeyboardShortcutsState() {
  const [open, setOpenState] = useState(keyboardShortcutsOpenState);

  useEffect(() => {
    const listener = (newOpen: boolean) => {
      setOpenState(newOpen);
    };
    keyboardShortcutsListeners.add(listener);
    return () => {
      keyboardShortcutsListeners.delete(listener);
    };
  }, []);

  const setOpen = (newOpen: boolean) => {
    keyboardShortcutsOpenState = newOpen;
    keyboardShortcutsListeners.forEach((listener) => listener(newOpen));
  };

  return [open, setOpen] as const;
}

export function setKeyboardShortcutsOpen(open: boolean) {
  keyboardShortcutsOpenState = open;
  keyboardShortcutsListeners.forEach((listener) => listener(open));
}

