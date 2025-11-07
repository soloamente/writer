/**
 * Helper functions for dispatching Lexical commands globally
 * 
 * These functions allow dispatching commands to editors even when
 * the editor instance is not directly available in the component tree.
 * 
 * @remarks
 * - These helpers provide a convenient way to dispatch commands from anywhere
 * - They handle finding the appropriate editor instance
 * - They return boolean indicating success/failure
 * - Use these instead of directly accessing editor instances when possible
 * 
 * @example
 * ```ts
 * // Open command palette from a button click
 * const handleClick = () => {
 *   dispatchOpenCommandPalette();
 * };
 * 
 * // Save document from keyboard shortcut
 * const handleSave = (documentId: string) => {
 *   dispatchSaveDocument(documentId);
 * };
 * ```
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
  TOGGLE_FORMAT_COMMAND,
  INSERT_HEADING_COMMAND,
  INSERT_LINK_COMMAND,
  REMOVE_LINK_COMMAND,
  INSERT_QUOTE_COMMAND,
  INSERT_CODE_BLOCK_COMMAND,
  TOGGLE_BULLET_LIST_COMMAND,
  TOGGLE_NUMBERED_LIST_COMMAND,
  GO_TO_START_COMMAND,
  GO_TO_END_COMMAND,
  CLEAR_SELECTION_COMMAND,
  type ToggleFormatPayload,
  type InsertHeadingPayload,
  type InsertLinkPayload,
  type InsertCodeBlockPayload,
} from "./commands";

/**
 * Dispatch OPEN_COMMAND_PALETTE_COMMAND to the specified editor
 * 
 * Opens the command palette (Cmd/Ctrl+K).
 * If no documentId is provided, tries to find the first available editor.
 * 
 * @param documentId - Optional document ID. If not provided, uses first available editor
 * @returns `true` if command was dispatched successfully, `false` otherwise
 * 
 * @example
 * ```ts
 * // Open palette for specific document
 * dispatchOpenCommandPalette("doc-123");
 * 
 * // Open palette using any available editor
 * dispatchOpenCommandPalette();
 * ```
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
 * 
 * Opens the document actions palette (Cmd/Ctrl+B).
 * If no documentId is provided, tries to find the first available editor.
 * 
 * @param documentId - Optional document ID. If not provided, uses first available editor
 * @returns `true` if command was dispatched successfully, `false` otherwise
 * 
 * @example
 * ```ts
 * // Open actions for specific document
 * dispatchOpenDocumentActions("doc-123");
 * 
 * // Open actions using any available editor
 * dispatchOpenDocumentActions();
 * ```
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
 * 
 * Toggles the editor between read and write mode.
 * Requires a documentId since edit mode is document-specific.
 * 
 * @param documentId - The document ID to toggle edit mode for
 * @param canWrite - Whether the user has write permission
 * @returns `true` if command was dispatched successfully, `false` otherwise
 * 
 * @example
 * ```ts
 * // Toggle edit mode for a document
 * dispatchToggleEditMode("doc-123", true);
 * ```
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
 * 
 * Triggers a manual save of the document.
 * The OnChangePlugin will detect the change and trigger autosave.
 * 
 * @param documentId - The document ID to save
 * @returns `true` if command was dispatched successfully, `false` otherwise
 * 
 * @example
 * ```ts
 * // Save document from keyboard shortcut (Cmd+S)
 * const handleKeyDown = (e: KeyboardEvent) => {
 *   if ((e.metaKey || e.ctrlKey) && e.key === "s") {
 *     e.preventDefault();
 *     dispatchSaveDocument("doc-123");
 *   }
 * };
 * ```
 */
export function dispatchSaveDocument(documentId: string): boolean {
  const editor = getEditorInstance(documentId);
  if (editor) {
    editor.dispatchCommand(SAVE_DOCUMENT_COMMAND, { documentId });
    return true;
  }

  return false;
}

/**
 * Dispatch TOGGLE_FORMAT_COMMAND to toggle text formatting
 * 
 * @param documentId - The document ID
 * @param format - The format to toggle ("bold", "italic", "underline", "strikethrough", "code")
 * @returns `true` if command was dispatched successfully, `false` otherwise
 */
export function dispatchToggleFormat(
  documentId: string,
  format: ToggleFormatPayload,
): boolean {
  const editor = getEditorInstance(documentId);
  if (editor) {
    editor.dispatchCommand(TOGGLE_FORMAT_COMMAND, format);
    return true;
  }

  return false;
}

/**
 * Dispatch INSERT_HEADING_COMMAND to insert a heading
 * 
 * @param documentId - The document ID
 * @param level - Heading level (1-6)
 * @returns `true` if command was dispatched successfully, `false` otherwise
 */
export function dispatchInsertHeading(
  documentId: string,
  level: InsertHeadingPayload["level"],
): boolean {
  const editor = getEditorInstance(documentId);
  if (editor) {
    editor.dispatchCommand(INSERT_HEADING_COMMAND, { level });
    return true;
  }

  return false;
}

/**
 * Dispatch INSERT_LINK_COMMAND to insert or update a link
 * 
 * @param documentId - The document ID
 * @param url - The URL for the link
 * @param text - Optional text for the link (if no text is selected)
 * @returns `true` if command was dispatched successfully, `false` otherwise
 */
export function dispatchInsertLink(
  documentId: string,
  url: string,
  text?: string,
): boolean {
  const editor = getEditorInstance(documentId);
  if (editor) {
    editor.dispatchCommand(INSERT_LINK_COMMAND, { url, text });
    return true;
  }

  return false;
}

/**
 * Dispatch REMOVE_LINK_COMMAND to remove a link
 * 
 * @param documentId - The document ID
 * @returns `true` if command was dispatched successfully, `false` otherwise
 */
export function dispatchRemoveLink(documentId: string): boolean {
  const editor = getEditorInstance(documentId);
  if (editor) {
    editor.dispatchCommand(REMOVE_LINK_COMMAND, undefined);
    return true;
  }

  return false;
}

/**
 * Dispatch INSERT_QUOTE_COMMAND to insert a quote block
 * 
 * @param documentId - The document ID
 * @returns `true` if command was dispatched successfully, `false` otherwise
 */
export function dispatchInsertQuote(documentId: string): boolean {
  const editor = getEditorInstance(documentId);
  if (editor) {
    editor.dispatchCommand(INSERT_QUOTE_COMMAND, undefined);
    return true;
  }

  return false;
}

/**
 * Dispatch INSERT_CODE_BLOCK_COMMAND to insert a code block
 * 
 * @param documentId - The document ID
 * @param language - Optional programming language for syntax highlighting
 * @returns `true` if command was dispatched successfully, `false` otherwise
 */
export function dispatchInsertCodeBlock(
  documentId: string,
  language?: string,
): boolean {
  const editor = getEditorInstance(documentId);
  if (editor) {
    editor.dispatchCommand(INSERT_CODE_BLOCK_COMMAND, { language });
    return true;
  }

  return false;
}

/**
 * Dispatch TOGGLE_BULLET_LIST_COMMAND to toggle bullet list
 * 
 * @param documentId - The document ID
 * @returns `true` if command was dispatched successfully, `false` otherwise
 */
export function dispatchToggleBulletList(documentId: string): boolean {
  const editor = getEditorInstance(documentId);
  if (editor) {
    editor.dispatchCommand(TOGGLE_BULLET_LIST_COMMAND, undefined);
    return true;
  }

  return false;
}

/**
 * Dispatch TOGGLE_NUMBERED_LIST_COMMAND to toggle numbered list
 * 
 * @param documentId - The document ID
 * @returns `true` if command was dispatched successfully, `false` otherwise
 */
export function dispatchToggleNumberedList(documentId: string): boolean {
  const editor = getEditorInstance(documentId);
  if (editor) {
    editor.dispatchCommand(TOGGLE_NUMBERED_LIST_COMMAND, undefined);
    return true;
  }

  return false;
}

/**
 * Dispatch GO_TO_START_COMMAND to navigate to start of document
 * 
 * @param documentId - The document ID
 * @returns `true` if command was dispatched successfully, `false` otherwise
 */
export function dispatchGoToStart(documentId: string): boolean {
  const editor = getEditorInstance(documentId);
  if (editor) {
    editor.dispatchCommand(GO_TO_START_COMMAND, undefined);
    return true;
  }

  return false;
}

/**
 * Dispatch GO_TO_END_COMMAND to navigate to end of document
 * 
 * @param documentId - The document ID
 * @returns `true` if command was dispatched successfully, `false` otherwise
 */
export function dispatchGoToEnd(documentId: string): boolean {
  const editor = getEditorInstance(documentId);
  if (editor) {
    editor.dispatchCommand(GO_TO_END_COMMAND, undefined);
    return true;
  }

  return false;
}

/**
 * Dispatch CLEAR_SELECTION_COMMAND to clear selection
 * 
 * @param documentId - The document ID
 * @returns `true` if command was dispatched successfully, `false` otherwise
 */
export function dispatchClearSelection(documentId: string): boolean {
  const editor = getEditorInstance(documentId);
  if (editor) {
    editor.dispatchCommand(CLEAR_SELECTION_COMMAND, undefined);
    return true;
  }

  return false;
}

