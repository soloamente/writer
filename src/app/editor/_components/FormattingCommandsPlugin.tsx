"use client";

/**
 * Plugin that handles formatting, heading, link, block, and list commands
 * 
 * This plugin registers handlers for content formatting commands:
 * - TOGGLE_FORMAT_COMMAND: Bold, italic, underline, strikethrough, code
 * - INSERT_HEADING_COMMAND: Insert headings (H1-H6)
 * - INSERT_LINK_COMMAND / REMOVE_LINK_COMMAND: Link management
 * - INSERT_QUOTE_COMMAND: Insert quote blocks
 * - INSERT_CODE_BLOCK_COMMAND: Insert code blocks
 * - TOGGLE_BULLET_LIST_COMMAND / TOGGLE_NUMBERED_LIST_COMMAND: List toggles
 * - GO_TO_START_COMMAND / GO_TO_END_COMMAND: Navigation
 * - CLEAR_SELECTION_COMMAND: Clear selection
 * 
 * @remarks
 * - Commands respect editor editable state
 * - Uses Lexical's built-in formatting functions where available
 * - Properly handles selection and node manipulation
 * - Uses COMMAND_PRIORITY_EDITOR for consistent ordering
 * 
 * @example
 * ```tsx
 * <LexicalComposer initialConfig={config}>
 *   <FormattingCommandsPlugin />
 * </LexicalComposer>
 * ```
 * 
 * @see https://lexical.dev/docs/concepts/commands
 */

import { useEffect } from "react";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { COMMAND_PRIORITY_EDITOR } from "lexical";
import {
  $getSelection,
  $isRangeSelection,
  $isTextNode,
  FORMAT_TEXT_COMMAND,
  $getRoot,
  $createParagraphNode,
  $createTextNode,
  $createRangeSelection,
  $setSelection,
} from "lexical";
import {
  $createHeadingNode,
  $createQuoteNode,
  HeadingNode,
} from "@lexical/rich-text";
import {
  INSERT_UNORDERED_LIST_COMMAND,
  INSERT_ORDERED_LIST_COMMAND,
  REMOVE_LIST_COMMAND,
  $isListNode,
} from "@lexical/list";
import { $createLinkNode, $isLinkNode, LinkNode } from "@lexical/link";
import { $createCodeNode, CodeNode } from "@lexical/code";
import {
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
} from "@/lib/lexical/commands";
import { $setBlocksType } from "@lexical/selection";

interface FormattingCommandsPluginProps {
  // Currently no props needed
}

export function FormattingCommandsPlugin(_props: FormattingCommandsPluginProps) {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    /**
     * Handle TOGGLE_FORMAT_COMMAND
     * Toggles text formatting (bold, italic, underline, strikethrough, code)
     */
    const removeToggleFormat = editor.registerCommand(
      TOGGLE_FORMAT_COMMAND,
      (format) => {
        if (!editor.isEditable()) {
          return false;
        }

        try {
          // Map our format types to Lexical's FORMAT_TEXT_COMMAND values
          const formatMap: Record<
            typeof format,
            typeof format | "underline" | "strikethrough"
          > = {
            bold: "bold",
            italic: "italic",
            underline: "underline",
            strikethrough: "strikethrough",
            code: "code",
          };

          const lexicalFormat = formatMap[format];
          if (lexicalFormat) {
            editor.dispatchCommand(FORMAT_TEXT_COMMAND, lexicalFormat);
            return true;
          }

          return false;
        } catch (error) {
          console.error(`Error toggling format ${format}:`, error);
          return false;
        }
      },
      COMMAND_PRIORITY_EDITOR,
    );

    /**
     * Handle INSERT_HEADING_COMMAND
     * Inserts or converts current block to a heading
     */
    const removeInsertHeading = editor.registerCommand(
      INSERT_HEADING_COMMAND,
      (payload) => {
        if (!editor.isEditable()) {
          return false;
        }

        try {
          editor.update(() => {
            const selection = $getSelection();
            if (!$isRangeSelection(selection)) {
              return;
            }

            const { level } = payload;
            const headingNode = $createHeadingNode(`h${level}`);
            $setBlocksType(selection, () => headingNode);
          });

          return true;
        } catch (error) {
          console.error(`Error inserting heading H${payload.level}:`, error);
          return false;
        }
      },
      COMMAND_PRIORITY_EDITOR,
    );

    /**
     * Handle INSERT_LINK_COMMAND
     * Inserts or updates a link
     */
    const removeInsertLink = editor.registerCommand(
      INSERT_LINK_COMMAND,
      (payload) => {
        if (!editor.isEditable()) {
          return false;
        }

        try {
          editor.update(() => {
            const selection = $getSelection();
            if (!$isRangeSelection(selection)) {
              return;
            }

            const { url, text } = payload;

            // If text is provided and no selection, insert text as link
            if (text && selection.isCollapsed()) {
              const linkNode = $createLinkNode(url);
              const textNode = $createTextNode(text);
              linkNode.append(textNode);
              selection.insertNodes([linkNode]);
              textNode.select();
              return;
            }

            // If text is selected, wrap it in a link
            if (!selection.isCollapsed()) {
              const nodes = selection.getNodes();

              // Check if selection is already a link
              const firstNode = nodes[0];
              if ($isLinkNode(firstNode)) {
                // Update existing link
                firstNode.setURL(url);
                return;
              }

              // Get selected text
              const selectedText = selection.getTextContent();
              
              // Create link node with selected text
              const linkNode = $createLinkNode(url);
              if (selectedText) {
                const textNode = $createTextNode(selectedText);
                linkNode.append(textNode);
              }
              
              // Replace selection with link
              selection.insertNodes([linkNode]);
              // Select the text node inside the link
              const firstChild = linkNode.getFirstChild();
              if (firstChild && $isTextNode(firstChild)) {
                const newSelection = $createRangeSelection();
                const textLength = firstChild.getTextContentSize();
                newSelection.anchor.set(firstChild.getKey(), textLength, "text");
                newSelection.focus.set(firstChild.getKey(), textLength, "text");
                $setSelection(newSelection);
              }
            }
          });

          return true;
        } catch (error) {
          console.error("Error inserting link:", error);
          return false;
        }
      },
      COMMAND_PRIORITY_EDITOR,
    );

    /**
     * Handle REMOVE_LINK_COMMAND
     * Removes link from current selection
     */
    const removeRemoveLink = editor.registerCommand(
      REMOVE_LINK_COMMAND,
      () => {
        if (!editor.isEditable()) {
          return false;
        }

        try {
          editor.update(() => {
            const selection = $getSelection();
            if (!$isRangeSelection(selection)) {
              return;
            }

            const nodes = selection.getNodes();
            nodes.forEach((node) => {
              if ($isLinkNode(node)) {
                const parent = node.getParent();
                if (parent) {
                  const children = node.getChildren();
                  // Insert children after the link node (in reverse order to maintain correct order)
                  // then remove the link node
                  for (let i = children.length - 1; i >= 0; i--) {
                    node.insertAfter(children[i]);
                  }
                  node.remove();
                }
              }
            });
          });

          return true;
        } catch (error) {
          console.error("Error removing link:", error);
          return false;
        }
      },
      COMMAND_PRIORITY_EDITOR,
    );

    /**
     * Handle INSERT_QUOTE_COMMAND
     * Inserts or converts current block to a quote
     */
    const removeInsertQuote = editor.registerCommand(
      INSERT_QUOTE_COMMAND,
      () => {
        if (!editor.isEditable()) {
          return false;
        }

        try {
          editor.update(() => {
            const selection = $getSelection();
            if (!$isRangeSelection(selection)) {
              return;
            }

            const quoteNode = $createQuoteNode();
            $setBlocksType(selection, () => quoteNode);
          });

          return true;
        } catch (error) {
          console.error("Error inserting quote:", error);
          return false;
        }
      },
      COMMAND_PRIORITY_EDITOR,
    );

    /**
     * Handle INSERT_CODE_BLOCK_COMMAND
     * Inserts a code block
     */
    const removeInsertCodeBlock = editor.registerCommand(
      INSERT_CODE_BLOCK_COMMAND,
      (payload) => {
        if (!editor.isEditable()) {
          return false;
        }

        try {
          editor.update(() => {
            const selection = $getSelection();
            if (!$isRangeSelection(selection)) {
              return;
            }

            const { language } = payload;
            const codeNode = $createCodeNode(language);
            $setBlocksType(selection, () => codeNode);
          });

          return true;
        } catch (error) {
          console.error("Error inserting code block:", error);
          return false;
        }
      },
      COMMAND_PRIORITY_EDITOR,
    );

    /**
     * Handle TOGGLE_BULLET_LIST_COMMAND
     * Toggles unordered list on/off
     */
    const removeToggleBulletList = editor.registerCommand(
      TOGGLE_BULLET_LIST_COMMAND,
      () => {
        if (!editor.isEditable()) {
          return false;
        }

        try {
          editor.update(() => {
            const selection = $getSelection();
            if (!$isRangeSelection(selection)) {
              return;
            }

            // Check if selection is in a list
            const nodes = selection.getNodes();
            const isInList = nodes.some((node) => {
              const parent = node.getParent();
              return parent && $isListNode(parent);
            });

            if (isInList) {
              editor.dispatchCommand(REMOVE_LIST_COMMAND, undefined);
            } else {
              editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined);
            }
          });

          return true;
        } catch (error) {
          console.error("Error toggling bullet list:", error);
          return false;
        }
      },
      COMMAND_PRIORITY_EDITOR,
    );

    /**
     * Handle TOGGLE_NUMBERED_LIST_COMMAND
     * Toggles ordered list on/off
     */
    const removeToggleNumberedList = editor.registerCommand(
      TOGGLE_NUMBERED_LIST_COMMAND,
      () => {
        if (!editor.isEditable()) {
          return false;
        }

        try {
          editor.update(() => {
            const selection = $getSelection();
            if (!$isRangeSelection(selection)) {
              return;
            }

            // Check if selection is in a list
            const nodes = selection.getNodes();
            const isInList = nodes.some((node) => {
              const parent = node.getParent();
              return parent && $isListNode(parent);
            });

            if (isInList) {
              editor.dispatchCommand(REMOVE_LIST_COMMAND, undefined);
            } else {
              editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined);
            }
          });

          return true;
        } catch (error) {
          console.error("Error toggling numbered list:", error);
          return false;
        }
      },
      COMMAND_PRIORITY_EDITOR,
    );

    /**
     * Handle GO_TO_START_COMMAND
     * Moves cursor to start of document
     */
    const removeGoToStart = editor.registerCommand(
      GO_TO_START_COMMAND,
      () => {
        if (!editor.isEditable()) {
          return false;
        }

        try {
          editor.update(() => {
            const root = $getRoot();
            const firstChild = root.getFirstChild();
            if (firstChild) {
              firstChild.selectStart();
            } else {
              // If document is empty, create a paragraph and select it
              const paragraph = $createParagraphNode();
              root.append(paragraph);
              paragraph.selectStart();
            }
          });

          return true;
        } catch (error) {
          console.error("Error navigating to start:", error);
          return false;
        }
      },
      COMMAND_PRIORITY_EDITOR,
    );

    /**
     * Handle GO_TO_END_COMMAND
     * Moves cursor to end of document
     */
    const removeGoToEnd = editor.registerCommand(
      GO_TO_END_COMMAND,
      () => {
        if (!editor.isEditable()) {
          return false;
        }

        try {
          editor.update(() => {
            const root = $getRoot();
            const lastChild = root.getLastChild();
            if (lastChild) {
              lastChild.selectEnd();
            } else {
              // If document is empty, create a paragraph and select it
              const paragraph = $createParagraphNode();
              root.append(paragraph);
              paragraph.selectStart();
            }
          });

          return true;
        } catch (error) {
          console.error("Error navigating to end:", error);
          return false;
        }
      },
      COMMAND_PRIORITY_EDITOR,
    );

    /**
     * Handle CLEAR_SELECTION_COMMAND
     * Clears current selection
     */
    const removeClearSelection = editor.registerCommand(
      CLEAR_SELECTION_COMMAND,
      () => {
        try {
          editor.update(() => {
            const selection = $getSelection();
            if ($isRangeSelection(selection)) {
              selection.collapse();
            }
          });

          return true;
        } catch (error) {
          console.error("Error clearing selection:", error);
          return false;
        }
      },
      COMMAND_PRIORITY_EDITOR,
    );

    // Cleanup: remove all command listeners when component unmounts
    return () => {
      removeToggleFormat();
      removeInsertHeading();
      removeInsertLink();
      removeRemoveLink();
      removeInsertQuote();
      removeInsertCodeBlock();
      removeToggleBulletList();
      removeToggleNumberedList();
      removeGoToStart();
      removeGoToEnd();
      removeClearSelection();
    };
  }, [editor]);

  return null;
}

