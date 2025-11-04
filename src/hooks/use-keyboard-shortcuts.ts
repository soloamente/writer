"use client";

import { useEffect } from "react";
import { createStore } from "@/lib/store";
import {
  dispatchOpenCommandPalette,
  dispatchOpenDocumentActions,
} from "@/lib/lexical/command-helpers";

// Store for keyboard shortcuts dialog state
// Using the React Hook Getter pattern to reduce re-renders
const useKeyboardShortcutsStore = createStore({
  open: false,
});

/**
 * Hook to access keyboard shortcuts dialog state
 * Only re-renders when the `open` property is accessed and changed
 * 
 * @example
 * ```tsx
 * function Component() {
 *   const shortcuts = useKeyboardShortcutsState()
 *   // Only re-renders when shortcuts.open changes
 *   return <Dialog open={shortcuts.open} onOpenChange={(open) => shortcuts.open = open} />
 * }
 * ```
 */
export function useKeyboardShortcutsState() {
  const state = useKeyboardShortcutsStore();
  return {
    open: state.open,
    setOpen: (open: boolean) => {
      state.open = open;
    },
  };
}

/**
 * Set keyboard shortcuts dialog open state from outside React
 * Useful for triggering from event handlers or other imperative code
 */
export function setKeyboardShortcutsOpen(open: boolean) {
  // Use the store's setState method directly (doesn't require React hook)
  useKeyboardShortcutsStore.setState("open", open);
}

// Store for command palette state
const useCommandPaletteStore = createStore({
  open: false,
});

/**
 * Hook to access command palette state
 * Handles keyboard shortcuts (Cmd/Ctrl+K) and Escape key
 * Only re-renders when the `open` property is accessed and changed
 * 
 * @example
 * ```tsx
 * function Component() {
 *   const palette = useCommandPaletteState()
 *   // Only re-renders when palette.open changes
 *   return <CommandPalette open={palette.open} onOpenChange={(open) => palette.open = open} />
 * }
 * ```
 */
export function useCommandPaletteState() {
  const state = useCommandPaletteStore();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd+K (Mac) or Ctrl+K (Windows/Linux)
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        // Don't trigger if typing in an input/textarea
        const target = e.target as HTMLElement;
        const isInput =
          target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          (target.closest('[cmdk-input]') !== null) ||
          target.isContentEditable;

        if (isInput) {
          return; // Allow default behavior in inputs
        }

        e.preventDefault();
        e.stopPropagation();
        
        // Try to dispatch Lexical command first (if editor is available)
        // Fall back to direct state manipulation for global access
        const commandDispatched = dispatchOpenCommandPalette();
        if (!commandDispatched) {
          // No editor available, toggle command palette directly
          state.open = !state.open;
        }
        // Note: If command was dispatched, EditorCommandsPlugin will handle state update
      }
      // Escape to close
      if (e.key === "Escape" && state.open) {
        state.open = false;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [state]);

  return {
    open: state.open,
    setOpen: (open: boolean) => {
      state.open = open;
    },
  };
}

