"use client";

import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { AutoFocusPlugin } from "@lexical/react/LexicalAutoFocusPlugin";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { OnChangePlugin as LexicalOnChangePlugin } from "@lexical/react/LexicalOnChangePlugin";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import type { EditorState, LexicalEditor } from "lexical";
import {
  liveblocksConfig,
  LiveblocksPlugin,
  FloatingToolbar,
} from "@liveblocks/react-lexical";
import { Threads } from "@/app/editor/_components/threads";
import { editorTheme } from "@/app/editor/_components/editorTheme";
import { CursorPlugin } from "@/app/editor/_components/CursorPlugin";
import { TailwindExtension } from "@lexical/tailwind";
import { api } from "@/trpc/react";
import { useMemo, useRef, useEffect, useState } from "react";
import { toastManager } from "@/components/ui/toast";
// Import standard Lexical nodes required by RichTextPlugin
import { HeadingNode, QuoteNode } from "@lexical/rich-text";
import { ListNode, ListItemNode } from "@lexical/list";
import { LinkNode, AutoLinkNode } from "@lexical/link";
import { CodeNode, CodeHighlightNode } from "@lexical/code";
import { ParagraphNode } from "lexical";
import { EditorCommandsPlugin } from "./EditorCommandsPlugin";
import { KeyboardCommandsPlugin } from "./KeyboardCommandsPlugin";
import { FormattingCommandsPlugin } from "./FormattingCommandsPlugin";
import { CursorPositionPlugin } from "./CursorPositionPlugin";
import { CursorInspector } from "./CursorInspector";
import { CursorStyler } from "./CursorStyler";

// Plugin to track and manage editable state
function EditableStatePlugin({
  canWrite,
  onEditableChange,
}: {
  canWrite: boolean;
  onEditableChange?: (isEditable: boolean) => void;
}) {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    // Set initial editable state based on permissions
    if (editor.isEditable() !== canWrite) {
      editor.setEditable(canWrite);
      onEditableChange?.(canWrite);
    }

    // Register listener for editable state changes
    const removeEditableListener = editor.registerEditableListener(
      (editable) => {
        onEditableChange?.(editable);
      },
    );

    return () => {
      removeEditableListener();
    };
  }, [editor, canWrite, onEditableChange]);

  // Update editor editable state when canWrite changes
  useEffect(() => {
    // Only allow switching to edit mode if user has write permission
    // But allow switching to read mode even if user has write permission
    if (!canWrite && editor.isEditable()) {
      editor.setEditable(false);
    } else if (canWrite && !editor.isEditable()) {
      // Don't force edit mode if user manually switched to read mode
      // Only sync if there's a permission change
      // This preserves user's manual read mode preference
    }
  }, [editor, canWrite]);

  return null;
}

// Export editor instance and editable state via context/event
// This allows other components to toggle read/edit mode
const editorRefContext = new Map<string, LexicalEditor>();

// Function to get editor instance for a document
export function getEditorInstance(documentId: string): LexicalEditor | null {
  return editorRefContext.get(documentId) ?? null;
}

// Function to toggle edit mode (if user has permission)
export function toggleEditMode(
  documentId: string,
  canWrite: boolean,
): boolean | null {
  const editor = editorRefContext.get(documentId);
  if (!editor) return null;

  const currentEditable = editor.isEditable();

  // If trying to enable edit mode, check permissions
  if (!currentEditable && !canWrite) {
    return false; // Cannot enable edit mode without permission
  }

  // Toggle editable state
  const newEditable = !currentEditable;
  editor.setEditable(newEditable);
  return newEditable;
}

// Function to get current editable state
export function getEditMode(documentId: string): boolean | null {
  const editor = editorRefContext.get(documentId);
  return editor ? editor.isEditable() : null;
}

// Function to get the first available editor instance
// Useful for global commands that don't have a specific documentId
export function getFirstAvailableEditor(): LexicalEditor | null {
  // Return the first editor in the registry
  // In a multi-document app, this returns the most recently registered editor
  const editors = Array.from(editorRefContext.values());
  return editors.length > 0 ? editors[editors.length - 1] : null;
}

// Function to get all registered document IDs
export function getAllDocumentIds(): string[] {
  return Array.from(editorRefContext.keys());
}

// Check if there's a saved cursor position for a document
function hasSavedCursorPosition(documentId: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    const storageKey = `writer-cursor-position-${documentId}`;
    const stored = localStorage.getItem(storageKey);
    return stored !== null;
  } catch {
    return false;
  }
}

export function Editor({
  documentId,
  initialContent,
  canWrite = true,
}: {
  documentId: string;
  initialContent: string | null;
  canWrite?: boolean;
}) {
  const [isEditable, setIsEditable] = useState(canWrite);
  // Disable AutoFocusPlugin if we have a saved cursor position
  const [shouldAutoFocus, setShouldAutoFocus] = useState(
    () => !hasSavedCursorPosition(documentId),
  );

  // Wrap your Lexical config with `liveblocksConfig`
  const initialConfig = liveblocksConfig({
    namespace: "Writer",
    // @ts-expect-error - liveblocksConfig wraps the config, editorState is valid but not in types
    editorState: initialContent ?? undefined,
    editable: canWrite, // Initialize editable state based on permissions
    theme: editorTheme, // Apply custom theme configuration with heading sizes
    // Register standard Lexical nodes required by RichTextPlugin
    nodes: [
      HeadingNode,
      QuoteNode,
      ListNode,
      ListItemNode,
      LinkNode,
      AutoLinkNode,
      CodeNode,
      CodeHighlightNode,
      ParagraphNode,
    ],
    onError: (error: Error) => {
      console.error(error);
      throw error;
    },
  });

  const updateMutation = api.document.updateContent.useMutation({
    onError: (error: unknown) => {
      const message =
        error && typeof error === "object" && "message" in error
          ? String(error.message)
          : "Failed to save document. Please try again.";
      toastManager.add({
        title: message,
        type: "error",
      });
    },
    onSuccess: () => {
      // Show subtle success indication without being too intrusive
      toastManager.add({
        title: "Saved",
        type: "success",
        timeout: 1500,
      });
    },
  });

  const lastSavedRef = useRef<string | null>(null);
  const skipFirst = useRef(true);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savingRef = useRef(false);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  // Plugin to register editor instance globally
  function EditorRegistrationPlugin({ docId }: { docId: string }) {
    const [editor] = useLexicalComposerContext();

    useEffect(() => {
      // Register editor instance for this document
      editorRefContext.set(docId, editor);

      // Cleanup on unmount
      return () => {
        editorRefContext.delete(docId);
      };
    }, [editor, docId]);

    return null;
  }

  const handleChange = useMemo(
    () => (editorState: EditorState) => {
      // Don't save if user doesn't have write permission
      if (!canWrite) return;

      // Don't save if editor is in read-only mode
      const editor = editorRefContext.get(documentId);
      if (editor && !editor.isEditable()) return;

      // Skip first change triggered by initial load
      if (skipFirst.current) {
        skipFirst.current = false;
        return;
      }

      // Skip if a save is in progress
      if (savingRef.current) return;

      // Defer expensive JSON.stringify operation to avoid blocking typing
      // This ensures typing feels smooth and responsive
      if (debounceRef.current) clearTimeout(debounceRef.current);
      
      // Perform JSON.stringify in a deferred callback to avoid blocking the main thread
      // Using requestAnimationFrame ensures this runs after the current frame, keeping typing smooth
      const performSave = () => {
        const jsonStr = JSON.stringify(editorState.toJSON());
        if (jsonStr === lastSavedRef.current) return;

        savingRef.current = true;
        lastSavedRef.current = jsonStr;
        updateMutation.mutate(
          { id: documentId, content: jsonStr },
          {
            onSettled: () => {
              savingRef.current = false;
            },
          },
        );
      };

      // Use requestAnimationFrame to defer the save operation until after the current frame
      // This prevents blocking the main thread during typing, making the experience smoother
      requestAnimationFrame(() => {
        debounceRef.current = setTimeout(performSave, 800);
      });
    },
    [documentId, updateMutation, canWrite],
  );

  return (
    <LexicalComposer initialConfig={initialConfig}>
      <div className="editor relative">
        <EditorRegistrationPlugin docId={documentId} />
        <EditableStatePlugin
          canWrite={canWrite}
          onEditableChange={setIsEditable}
        />
        <KeyboardCommandsPlugin />
        <EditorCommandsPlugin
          documentId={documentId}
          canWrite={canWrite}
        />
        <FormattingCommandsPlugin />
        <RichTextPlugin
          contentEditable={
            <ContentEditable
              className="lexical-content-editable"
              style={{
                cursor: isEditable ? "text" : "not-allowed",
                opacity: isEditable ? 1 : 0.7,
              }}
            />
          }
          placeholder={(placeholderIsEditable) => (
            <div className="placeholder">
              {placeholderIsEditable ? "Start typing here…" : "Read-only mode"}
            </div>
          )}
          ErrorBoundary={LexicalErrorBoundary}
        />
        {shouldAutoFocus && <AutoFocusPlugin />}
        <HistoryPlugin />
        <CursorPositionPlugin
          documentId={documentId}
          onHasSavedPosition={(hasSaved) => setShouldAutoFocus(!hasSaved)}
        />
        <LexicalOnChangePlugin onChange={handleChange} />
        {/* Custom cursor disabled - using default caret */}
        {/* <CursorPlugin enabled={isEditable} /> */}
        {/* LiveblocksPlugin requires collaboration context from liveblocksConfig */}
        {/* The liveblocksConfig should set up CollaborationPlugin internally */}
        {/* Note: May have compatibility issues with Lexical 0.38.2 vs expected 0.24.0 */}
        <LiveblocksPlugin>
          <Threads />
          <FloatingToolbar />
        </LiveblocksPlugin>
        {/* Temporarily enable cursor inspector to identify Liveblocks cursor classes */}
        <CursorInspector />
        {/* Dynamic cursor styler that applies styles to any cursor elements */}
        <CursorStyler />
      </div>
    </LexicalComposer>
  );
}
