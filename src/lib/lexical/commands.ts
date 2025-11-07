/**
 * Custom Lexical commands for the editor
 * 
 * This file defines custom commands that extend Lexical's built-in command system
 * for editor-specific functionality like toggling edit mode, saving documents, and
 * opening command palettes.
 * 
 * @see https://lexical.dev/docs/concepts/commands
 * 
 * Commands follow Lexical's command pattern:
 * 1. Create command with `createCommand<T>()` where T is the payload type
 * 2. Register handlers with `editor.registerCommand(command, handler, priority)`
 * 3. Dispatch commands with `editor.dispatchCommand(command, payload)`
 * 
 * Command handlers return `true` to stop propagation, `false` to allow other handlers.
 */

import { createCommand, type LexicalCommand } from "lexical";

/**
 * Command to toggle editor between read/write mode
 * 
 * @example
 * ```ts
 * editor.dispatchCommand(TOGGLE_EDIT_MODE_COMMAND, {
 *   documentId: "doc-123",
 *   canWrite: true
 * });
 * ```
 * 
 * @remarks
 * - Only works if user has write permission (canWrite: true)
 * - Command handlers should check documentId to ensure they handle the correct document
 * - Returns boolean indicating success, or null if editor not found
 */
export const TOGGLE_EDIT_MODE_COMMAND: LexicalCommand<{
  documentId: string;
  canWrite: boolean;
}> = createCommand();

/**
 * Command to trigger manual save of document
 * 
 * @example
 * ```ts
 * editor.dispatchCommand(SAVE_DOCUMENT_COMMAND, {
 *   documentId: "doc-123"
 * });
 * ```
 * 
 * @remarks
 * - Currently autosave handles saves automatically via OnChangePlugin
 * - This command allows manual triggering (e.g., Cmd+S)
 * - The handler triggers an editor update which will be detected by OnChangePlugin
 */
export const SAVE_DOCUMENT_COMMAND: LexicalCommand<{
  documentId: string;
}> = createCommand();

/**
 * Command to open the command palette (Cmd/Ctrl+K)
 * 
 * @example
 * ```ts
 * editor.dispatchCommand(OPEN_COMMAND_PALETTE_COMMAND, undefined);
 * ```
 * 
 * @remarks
 * - No payload needed - command is global
 * - Can be dispatched from any editor instance
 * - Handler should open the command palette UI
 */
export const OPEN_COMMAND_PALETTE_COMMAND: LexicalCommand<void> = createCommand();

/**
 * Command to open the document actions palette (Cmd/Ctrl+B)
 * 
 * @example
 * ```ts
 * editor.dispatchCommand(OPEN_DOCUMENT_ACTIONS_COMMAND, undefined);
 * ```
 * 
 * @remarks
 * - No payload needed - command is global
 * - Typically used when viewing document list in command palette
 * - Handler should open the document actions popover
 */
export const OPEN_DOCUMENT_ACTIONS_COMMAND: LexicalCommand<void> = createCommand();

/**
 * Command to insert a heading
 * 
 * @example
 * ```ts
 * editor.dispatchCommand(INSERT_HEADING_COMMAND, { level: 1 });
 * ```
 * 
 * @remarks
 * - Level must be between 1-6
 * - Replaces current block with heading if selection is in a paragraph
 */
export const INSERT_HEADING_COMMAND: LexicalCommand<{
  level: 1 | 2 | 3 | 4 | 5 | 6;
}> = createCommand();

/**
 * Command to toggle text formatting
 * 
 * @example
 * ```ts
 * editor.dispatchCommand(TOGGLE_FORMAT_COMMAND, "bold");
 * ```
 * 
 * @remarks
 * - Format types: "bold", "italic", "underline", "strikethrough", "code"
 * - Toggles the format on the current selection
 */
export const TOGGLE_FORMAT_COMMAND: LexicalCommand<
  "bold" | "italic" | "underline" | "strikethrough" | "code"
> = createCommand();

/**
 * Command to insert or update a link
 * 
 * @example
 * ```ts
 * editor.dispatchCommand(INSERT_LINK_COMMAND, { url: "https://example.com", text: "Example" });
 * ```
 * 
 * @remarks
 * - If text is selected, wraps it in a link
 * - If no text selected, inserts link with provided text
 * - If link already exists, updates it
 */
export const INSERT_LINK_COMMAND: LexicalCommand<{
  url: string;
  text?: string;
}> = createCommand();

/**
 * Command to remove a link
 * 
 * @example
 * ```ts
 * editor.dispatchCommand(REMOVE_LINK_COMMAND, undefined);
 * ```
 * 
 * @remarks
 * - Removes link from current selection
 * - Preserves the link text
 */
export const REMOVE_LINK_COMMAND: LexicalCommand<void> = createCommand();

/**
 * Command to insert a quote block
 * 
 * @example
 * ```ts
 * editor.dispatchCommand(INSERT_QUOTE_COMMAND, undefined);
 * ```
 * 
 * @remarks
 * - Converts current block to a quote
 * - Or inserts a new quote block
 */
export const INSERT_QUOTE_COMMAND: LexicalCommand<void> = createCommand();

/**
 * Command to insert a code block
 * 
 * @example
 * ```ts
 * editor.dispatchCommand(INSERT_CODE_BLOCK_COMMAND, { language: "javascript" });
 * ```
 * 
 * @remarks
 * - Inserts a code block with optional language
 * - Converts selected text to code block if text is selected
 */
export const INSERT_CODE_BLOCK_COMMAND: LexicalCommand<{
  language?: string;
}> = createCommand();

/**
 * Command to toggle bullet list
 * 
 * @example
 * ```ts
 * editor.dispatchCommand(TOGGLE_BULLET_LIST_COMMAND, undefined);
 * ```
 * 
 * @remarks
 * - Toggles unordered list on/off for selected blocks
 * - Converts paragraphs to list items or vice versa
 */
export const TOGGLE_BULLET_LIST_COMMAND: LexicalCommand<void> = createCommand();

/**
 * Command to toggle numbered list
 * 
 * @example
 * ```ts
 * editor.dispatchCommand(TOGGLE_NUMBERED_LIST_COMMAND, undefined);
 * ```
 * 
 * @remarks
 * - Toggles ordered list on/off for selected blocks
 * - Converts paragraphs to list items or vice versa
 */
export const TOGGLE_NUMBERED_LIST_COMMAND: LexicalCommand<void> = createCommand();

/**
 * Command to navigate to start of document
 * 
 * @example
 * ```ts
 * editor.dispatchCommand(GO_TO_START_COMMAND, undefined);
 * ```
 * 
 * @remarks
 * - Moves cursor to the beginning of the document
 * - Collapses selection to a single point
 */
export const GO_TO_START_COMMAND: LexicalCommand<void> = createCommand();

/**
 * Command to navigate to end of document
 * 
 * @example
 * ```ts
 * editor.dispatchCommand(GO_TO_END_COMMAND, undefined);
 * ```
 * 
 * @remarks
 * - Moves cursor to the end of the document
 * - Collapses selection to a single point
 */
export const GO_TO_END_COMMAND: LexicalCommand<void> = createCommand();

/**
 * Command to clear selection
 * 
 * @example
 * ```ts
 * editor.dispatchCommand(CLEAR_SELECTION_COMMAND, undefined);
 * ```
 * 
 * @remarks
 * - Clears current selection
 * - Moves cursor to end of selection
 */
export const CLEAR_SELECTION_COMMAND: LexicalCommand<void> = createCommand();

// Export command types for type safety
export type ToggleEditModePayload = {
  documentId: string;
  canWrite: boolean;
};

export type SaveDocumentPayload = {
  documentId: string;
};

export type InsertHeadingPayload = {
  level: 1 | 2 | 3 | 4 | 5 | 6;
};

export type ToggleFormatPayload =
  | "bold"
  | "italic"
  | "underline"
  | "strikethrough"
  | "code";

export type InsertLinkPayload = {
  url: string;
  text?: string;
};

export type InsertCodeBlockPayload = {
  language?: string;
};
