"use client";

/**
 * Plugin that handles custom editor commands
 * 
 * This plugin registers handlers for custom commands like:
 * - TOGGLE_EDIT_MODE_COMMAND: Toggle between read/write mode
 * - SAVE_DOCUMENT_COMMAND: Trigger manual save
 * - OPEN_COMMAND_PALETTE_COMMAND: Open command palette
 * - OPEN_DOCUMENT_ACTIONS_COMMAND: Open document actions palette
 * 
 * @remarks
 * - Each command handler checks if the command is for this document (by documentId)
 * - Commands that don't match this document return false to allow other handlers
 * - Uses COMMAND_PRIORITY_EDITOR to ensure proper ordering
 * - All handlers properly clean up on unmount
 * 
 * @example
 * ```tsx
 * <LexicalComposer initialConfig={config}>
 *   <EditorCommandsPlugin documentId="doc-123" canWrite={true} />
 * </LexicalComposer>
 * ```
 * 
 * @see https://lexical.dev/docs/concepts/commands
 */

import { useEffect } from "react";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { COMMAND_PRIORITY_EDITOR } from "lexical";
import {
  TOGGLE_EDIT_MODE_COMMAND,
  SAVE_DOCUMENT_COMMAND,
  OPEN_COMMAND_PALETTE_COMMAND,
  OPEN_DOCUMENT_ACTIONS_COMMAND,
} from "@/lib/lexical/commands";
import { toggleEditMode } from "./editor";
import { useCommandPaletteState } from "@/hooks/use-keyboard-shortcuts";
import { openDocumentActionsPalette } from "./DocumentActionsCommandPalette";
import { dispatchSaveDocument } from "@/lib/lexical/command-helpers";

interface EditorCommandsPluginProps {
  /** The document ID this plugin is managing commands for */
  documentId: string;
  /** Whether the user has write permission for this document */
  canWrite: boolean;
}

export function EditorCommandsPlugin({
  documentId,
  canWrite: _canWrite,
}: EditorCommandsPluginProps) {
  const [editor] = useLexicalComposerContext();
  const { setOpen: setCommandPaletteOpen } = useCommandPaletteState();

  useEffect(() => {
    /**
     * Handle TOGGLE_EDIT_MODE_COMMAND
     * 
     * Toggles the editor between read and write mode.
     * Only handles commands for this document.
     */
    const removeToggleEditMode = editor.registerCommand(
      TOGGLE_EDIT_MODE_COMMAND,
      (payload) => {
        // Only handle if this command is for this document
        // Return false to let other handlers (for other documents) try
        if (payload.documentId !== documentId) {
          return false;
        }

        try {
          // Toggle edit mode using existing function
          const result = toggleEditMode(payload.documentId, payload.canWrite);
          
          // Return true to stop propagation if handled successfully
          // Return false if editor not found (let other handlers try)
          return result !== null;
        } catch (error) {
          // Log error but don't crash - return false to allow other handlers
          console.error("Error toggling edit mode:", error);
          return false;
        }
      },
      COMMAND_PRIORITY_EDITOR,
    );

    /**
     * Handle SAVE_DOCUMENT_COMMAND
     * 
     * Triggers a manual save by updating the editor state.
     * The OnChangePlugin will detect the change and trigger autosave.
     * 
     * @remarks
     * - Currently autosave handles saves automatically via OnChangePlugin
     * - This command allows manual triggering (e.g., Cmd+S)
     * - In the future, we could add a dedicated manual save API endpoint
     */
    const removeSaveDocument = editor.registerCommand(
      SAVE_DOCUMENT_COMMAND,
      (payload) => {
        // Only handle if this command is for this document
        if (payload.documentId !== documentId) {
          return false;
        }

        try {
          // Trigger a save by updating the editor state
          // The OnChangePlugin will detect the change and trigger autosave
          // Using a tag to identify this as a manual save (useful for debugging)
          editor.update(() => {
            // Empty update - just triggers onChange
            // The OnChangePlugin will serialize and save the state
          }, { tag: "manual-save" });

          return true; // Command handled
        } catch (error) {
          // Log error but don't crash
          console.error("Error triggering manual save:", error);
          return true; // Still return true to stop propagation
        }
      },
      COMMAND_PRIORITY_EDITOR,
    );

    /**
     * Handle OPEN_COMMAND_PALETTE_COMMAND
     * 
     * Opens the command palette (Cmd/Ctrl+K).
     * This is a global command that can be dispatched from any editor.
     */
    const removeOpenCommandPalette = editor.registerCommand(
      OPEN_COMMAND_PALETTE_COMMAND,
      () => {
        try {
          setCommandPaletteOpen(true);
          return true; // Command handled
        } catch (error) {
          console.error("Error opening command palette:", error);
          return true; // Still return true to stop propagation
        }
      },
      COMMAND_PRIORITY_EDITOR,
    );

    /**
     * Handle OPEN_DOCUMENT_ACTIONS_COMMAND
     * 
     * Opens the document actions palette (Cmd/Ctrl+B).
     * This is a global command typically used when viewing document list.
     */
    const removeOpenDocumentActions = editor.registerCommand(
      OPEN_DOCUMENT_ACTIONS_COMMAND,
      () => {
        try {
          openDocumentActionsPalette();
          return true; // Command handled
        } catch (error) {
          console.error("Error opening document actions palette:", error);
          return true; // Still return true to stop propagation
        }
      },
      COMMAND_PRIORITY_EDITOR,
    );

    // Cleanup: remove all command listeners when component unmounts
    return () => {
      removeToggleEditMode();
      removeSaveDocument();
      removeOpenCommandPalette();
      removeOpenDocumentActions();
    };
  }, [editor, documentId, setCommandPaletteOpen]);

  // Handle Cmd/Ctrl+S keyboard shortcut for manual save
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd+S (Mac) or Ctrl+S (Windows/Linux)
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        // Don't trigger if typing in an input/textarea
        const target = e.target as HTMLElement;
        const isInput =
          target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          (target.closest('[cmdk-input]') !== null);

        // Only handle if editor is focused and editable
        // Allow default browser save dialog in inputs
        if (isInput || !editor.isEditable()) {
          return;
        }

        // Check if editor content is focused
        const isEditorFocused = editor.getRootElement()?.contains(target) ?? false;
        if (!isEditorFocused) {
          return;
        }

        e.preventDefault();
        e.stopPropagation();

        // Dispatch save command
        dispatchSaveDocument(documentId);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [editor, documentId]);

  return null;
}
