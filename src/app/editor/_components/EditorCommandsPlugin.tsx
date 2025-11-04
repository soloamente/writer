"use client";

/**
 * Plugin that handles custom editor commands
 * 
 * This plugin registers handlers for custom commands like:
 * - TOGGLE_EDIT_MODE_COMMAND: Toggle between read/write mode
 * - SAVE_DOCUMENT_COMMAND: Trigger manual save
 * - OPEN_COMMAND_PALETTE_COMMAND: Open command palette
 * - OPEN_DOCUMENT_ACTIONS_COMMAND: Open document actions palette
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
import { toggleEditMode, getEditorInstance } from "./editor";
import { useCommandPaletteState } from "@/hooks/use-keyboard-shortcuts";
import { openDocumentActionsPalette } from "./DocumentActionsCommandPalette";

interface EditorCommandsPluginProps {
  documentId: string;
  canWrite: boolean;
}

export function EditorCommandsPlugin({
  documentId,
  canWrite,
}: EditorCommandsPluginProps) {
  const [editor] = useLexicalComposerContext();
  const { setOpen: setCommandPaletteOpen } = useCommandPaletteState();

  useEffect(() => {
    // Register TOGGLE_EDIT_MODE_COMMAND handler
    const removeToggleEditMode = editor.registerCommand(
      TOGGLE_EDIT_MODE_COMMAND,
      (payload) => {
        // Only handle if this command is for this document
        if (payload.documentId !== documentId) {
          return false; // Don't stop propagation, let other handlers try
        }

        // Toggle edit mode using existing function
        const result = toggleEditMode(payload.documentId, payload.canWrite);
        
        // Return true to stop propagation if handled successfully
        return result !== null;
      },
      COMMAND_PRIORITY_EDITOR,
    );

    // Register SAVE_DOCUMENT_COMMAND handler
    // Note: Currently autosave handles saves automatically, but this allows manual triggering
    const removeSaveDocument = editor.registerCommand(
      SAVE_DOCUMENT_COMMAND,
      (payload) => {
        // Only handle if this command is for this document
        if (payload.documentId !== documentId) {
          return false;
        }

        // For now, just trigger a save by updating the editor state
        // The OnChangePlugin will detect the change and trigger autosave
        // In the future, we could add a manual save API endpoint
        editor.update(() => {
          // This will trigger onChange which will trigger autosave
        }, { tag: "manual-save" });

        return true; // Command handled
      },
      COMMAND_PRIORITY_EDITOR,
    );

    // Register OPEN_COMMAND_PALETTE_COMMAND handler
    const removeOpenCommandPalette = editor.registerCommand(
      OPEN_COMMAND_PALETTE_COMMAND,
      () => {
        setCommandPaletteOpen(true);
        return true; // Command handled
      },
      COMMAND_PRIORITY_EDITOR,
    );

    // Register OPEN_DOCUMENT_ACTIONS_COMMAND handler
    const removeOpenDocumentActions = editor.registerCommand(
      OPEN_DOCUMENT_ACTIONS_COMMAND,
      () => {
        openDocumentActionsPalette();
        return true; // Command handled
      },
      COMMAND_PRIORITY_EDITOR,
    );

    // Cleanup all command listeners
    return () => {
      removeToggleEditMode();
      removeSaveDocument();
      removeOpenCommandPalette();
      removeOpenDocumentActions();
    };
  }, [editor, documentId, canWrite, setCommandPaletteOpen]);

  return null;
}
