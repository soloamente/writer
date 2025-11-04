"use client";

/**
 * Plugin that handles standard Lexical keyboard commands
 * 
 * This plugin registers handlers for keyboard commands like:
 * - KEY_TAB_COMMAND: Handle tab indentation
 * - KEY_ENTER_COMMAND: Handle enter key behavior (if custom logic needed)
 * 
 * Note: RichTextPlugin already handles many keyboard commands internally.
 * This plugin only adds custom behavior beyond what RichTextPlugin provides.
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
    // Register KEY_TAB_COMMAND handler for indentation
    // This handles tab indentation: Shift+Tab outdents, Tab indents
    const removeTabCommand = editor.registerCommand(
      KEY_TAB_COMMAND,
      (event: KeyboardEvent | null) => {
        // Don't handle if editor is not editable
        if (!editor.isEditable()) {
          return false; // Let default behavior handle it
        }

        // Prevent default browser tab behavior
        if (event) {
          event.preventDefault();
        }

        // Dispatch indentation command based on shift key
        if (event?.shiftKey) {
          // Shift+Tab: outdent
          editor.dispatchCommand(OUTDENT_CONTENT_COMMAND, undefined);
        } else {
          // Tab: indent
          editor.dispatchCommand(INDENT_CONTENT_COMMAND, undefined);
        }

        return true; // Command handled, stop propagation
      },
      COMMAND_PRIORITY_EDITOR,
    );

    // Cleanup command listener
    return () => {
      removeTabCommand();
    };
  }, [editor]);

  return null;
}
