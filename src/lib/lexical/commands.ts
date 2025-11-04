/**
 * Custom Lexical commands for the editor
 * 
 * This file defines custom commands that extend Lexical's built-in command system
 * for editor-specific functionality like toggling edit mode, saving documents, and
 * opening command palettes.
 */

import { createCommand, type LexicalCommand } from "lexical";

/**
 * Command to toggle editor between read/write mode
 * Payload: documentId and canWrite permission
 */
export const TOGGLE_EDIT_MODE_COMMAND: LexicalCommand<{
  documentId: string;
  canWrite: boolean;
}> = createCommand();

/**
 * Command to trigger manual save of document
 * Payload: documentId
 * Note: Currently autosave handles saves automatically, but this allows manual triggering
 */
export const SAVE_DOCUMENT_COMMAND: LexicalCommand<{
  documentId: string;
}> = createCommand();

/**
 * Command to open the command palette
 * Payload: void (no payload needed)
 */
export const OPEN_COMMAND_PALETTE_COMMAND: LexicalCommand<void> = createCommand();

/**
 * Command to open the document actions palette
 * Payload: void (no payload needed)
 */
export const OPEN_DOCUMENT_ACTIONS_COMMAND: LexicalCommand<void> = createCommand();

// Export command types for type safety
export type ToggleEditModePayload = {
  documentId: string;
  canWrite: boolean;
};

export type SaveDocumentPayload = {
  documentId: string;
};
