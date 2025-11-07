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
      // Check both e.key (case-insensitive) and e.code for reliability
      const isCmdK = (e.metaKey || e.ctrlKey) && 
                     (e.key === "k" || e.key === "K" || e.code === "KeyK");
      
      if (isCmdK) {
        // Don't trigger if typing in an actual input/textarea (not contentEditable editor)
        // We specifically check for INPUT/TEXTAREA tags and cmdk-input, but NOT contentEditable
        // because the editor itself is contentEditable and we want Cmd+K to work there
        const target = e.target as HTMLElement;
        const isInput =
          target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          (target.closest('[cmdk-input]') !== null);

        if (isInput) {
          return; // Allow default behavior in actual form inputs
        }

        // Prevent Chrome's default Cmd+K behavior (address bar search)
        // Do this immediately to ensure we catch it before Chrome
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        
        // Try to dispatch Lexical command first (if editor is available)
        // Fall back to direct state manipulation for global access
        const commandDispatched = dispatchOpenCommandPalette();
        if (!commandDispatched) {
          // No editor available, toggle command palette directly
          state.open = !state.open;
        }
        // Note: If command was dispatched, EditorCommandsPlugin will handle state update
        return;
      }
      // Escape to close - but only if we're on the main page (not in a nested page)
      // Since we're in capture phase, we need to check for nested pages ourselves
      // The CommandPalette component handles Escape for nested pages (goes back)
      if (e.key === "Escape" && state.open) {
        // Check if we're inside the command palette dialog
        const target = e.target as HTMLElement;
        const commandPalette = document.querySelector('[data-testid="command-palette"]');
        
        if (commandPalette && commandPalette.contains(target)) {
          // Check if we're in a nested page by looking for page-specific content
          // These are definitive indicators that we're in a nested page
          const hasNestedPageContent = 
            // Theme page - has theme selection items
            commandPalette.querySelector('[value="theme.dark"]') !== null ||
            commandPalette.querySelector('[value="theme.light"]') !== null ||
            // Account page - has sidebar items or detail view
            (commandPalette.querySelector('[value="account.logout"]') !== null ||
             commandPalette.querySelector('[value="account.info"]') !== null ||
             commandPalette.querySelector('[data-account-sidebar-item]') !== null) ||
            // Settings page - has sidebar items
            (commandPalette.querySelector('[value="settings.cursor.style"]') !== null ||
             commandPalette.querySelector('[value="settings.cursor.duration"]') !== null ||
             commandPalette.querySelector('[data-settings-sidebar-item]') !== null) ||
            // Members page - has invite user button
            commandPalette.querySelector('[value="invite.user"]') !== null ||
            // Open document page - has document items with data-value attribute
            (commandPalette.querySelectorAll('[cmdk-item][data-value]').length > 0) ||
            // Title or create document pages - have focused input fields (not the search input)
            (target.tagName === "INPUT" && 
             target.closest('[data-testid="command-palette"]') !== null &&
             target.getAttribute('placeholder') !== "Type a command or search...");
          
          if (hasNestedPageContent) {
            // We're in a nested page - let CommandPalette handle it (it will navigate back)
            // Don't prevent default or stop propagation, let it bubble to CommandPalette's handler
            return;
          }
        }
        
        // We're on the main page or event is not from command palette - close it
        e.preventDefault();
        e.stopPropagation();
        state.open = false;
      }
    };

    // Attach listeners to both document and window in capture phase
    // This ensures we catch the event as early as possible before Chrome's handlers
    // Some browsers handle shortcuts at different levels, so we cover both
    document.addEventListener("keydown", handleKeyDown, true);
    window.addEventListener("keydown", handleKeyDown, true);
    
    return () => {
      document.removeEventListener("keydown", handleKeyDown, true);
      window.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [state]);

  return {
    open: state.open,
    setOpen: (open: boolean) => {
      state.open = open;
    },
  };
}

