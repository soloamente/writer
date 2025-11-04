/**
 * Helper functions for dispatching Lexical commands globally
 * 
 * These functions allow dispatching commands to editors even when
 * the editor instance is not directly available in the component tree.
 */

import {
  getEditorInstance,
  getFirstAvailableEditor,
} from "@/app/editor/_components/editor";
import {
  OPEN_COMMAND_PALETTE_COMMAND,
  OPEN_DOCUMENT_ACTIONS_COMMAND,
  TOGGLE_EDIT_MODE_COMMAND,
  SAVE_DOCUMENT_COMMAND,
} from "./commands";

/**
 * Dispatch OPEN_COMMAND_PALETTE_COMMAND to the specified editor
 * If no documentId is provided, tries to find the first available editor
 */
export function dispatchOpenCommandPalette(
  documentId?: string,
): boolean {
  if (documentId) {
    const editor = getEditorInstance(documentId);
    if (editor) {
      editor.dispatchCommand(OPEN_COMMAND_PALETTE_COMMAND, undefined);
      return true;
    }
  }

  // Try to find any available editor
  const editor = getFirstAvailableEditor();
  if (editor) {
    editor.dispatchCommand(OPEN_COMMAND_PALETTE_COMMAND, undefined);
    return true;
  }

  return false;
}

/**
 * Dispatch OPEN_DOCUMENT_ACTIONS_COMMAND to the specified editor
 */
export function dispatchOpenDocumentActions(
  documentId?: string,
): boolean {
  if (documentId) {
    const editor = getEditorInstance(documentId);
    if (editor) {
      editor.dispatchCommand(OPEN_DOCUMENT_ACTIONS_COMMAND, undefined);
      return true;
    }
  }

  const editor = getFirstAvailableEditor();
  if (editor) {
    editor.dispatchCommand(OPEN_DOCUMENT_ACTIONS_COMMAND, undefined);
    return true;
  }

  return false;
}

/**
 * Dispatch TOGGLE_EDIT_MODE_COMMAND to the specified editor
 */
export function dispatchToggleEditMode(
  documentId: string,
  canWrite: boolean,
): boolean {
  const editor = getEditorInstance(documentId);
  if (editor) {
    editor.dispatchCommand(TOGGLE_EDIT_MODE_COMMAND, {
      documentId,
      canWrite,
    });
    return true;
  }

  return false;
}

/**
 * Dispatch SAVE_DOCUMENT_COMMAND to the specified editor
 */
export function dispatchSaveDocument(documentId: string): boolean {
  const editor = getEditorInstance(documentId);
  if (editor) {
    editor.dispatchCommand(SAVE_DOCUMENT_COMMAND, { documentId });
    return true;
  }

  return false;
}

