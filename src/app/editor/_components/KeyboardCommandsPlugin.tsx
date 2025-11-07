"use client";

/**
 * Plugin that handles standard Lexical keyboard commands
 * 
 * This plugin registers handlers for keyboard commands like:
 * - KEY_TAB_COMMAND: Handle tab indentation (Tab/Shift+Tab)
 * 
 * @remarks
 * - RichTextPlugin already handles many keyboard commands internally (Enter, Arrow keys, etc.)
 * - This plugin only adds custom behavior beyond what RichTextPlugin provides
 * - Commands respect editor editable state - they don't fire in read-only mode
 * - Uses COMMAND_PRIORITY_EDITOR to ensure proper ordering with other handlers
 * 
 * @example
 * ```tsx
 * <LexicalComposer initialConfig={config}>
 *   <KeyboardCommandsPlugin />
 * </LexicalComposer>
 * ```
 * 
 * @see https://lexical.dev/docs/concepts/commands
 */

import { useEffect } from "react";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  KEY_TAB_COMMAND,
  COMMAND_PRIORITY_EDITOR,
  OUTDENT_CONTENT_COMMAND,
  INDENT_CONTENT_COMMAND,
} from "lexical";

interface KeyboardCommandsPluginProps {
  // Currently no props needed, but can be extended in the future
}

export function KeyboardCommandsPlugin(_props: KeyboardCommandsPluginProps) {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    /**
     * Handle TAB key for indentation
     * 
     * - Tab: Indent content (dispatches INDENT_CONTENT_COMMAND)
     * - Shift+Tab: Outdent content (dispatches OUTDENT_CONTENT_COMMAND)
     * - Only works when editor is editable
     * - Prevents default browser tab behavior
     */
    const removeTabCommand = editor.registerCommand(
      KEY_TAB_COMMAND,
      (event: KeyboardEvent | null) => {
        // Don't handle if editor is not editable
        // Return false to let other handlers (or default behavior) process it
        if (!editor.isEditable()) {
          return false;
        }

        // Prevent default browser tab behavior (focus navigation)
        if (event) {
          event.preventDefault();
        }

        // Dispatch indentation command based on shift key
        // These commands are handled by ListPlugin for list items
        // and by RichTextPlugin for other block-level indentation
        if (event?.shiftKey) {
          // Shift+Tab: outdent
          editor.dispatchCommand(OUTDENT_CONTENT_COMMAND, undefined);
        } else {
          // Tab: indent
          editor.dispatchCommand(INDENT_CONTENT_COMMAND, undefined);
        }

        // Return true to stop propagation - we've handled the command
        return true;
      },
      COMMAND_PRIORITY_EDITOR,
    );

    // Cleanup: remove command listener when component unmounts
    return () => {
      removeTabCommand();
    };
  }, [editor]);

  return null;
}
