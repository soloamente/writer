"use client";

import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { AutoFocusPlugin } from "@lexical/react/LexicalAutoFocusPlugin";
import { OnChangePlugin as LexicalOnChangePlugin } from "@lexical/react/LexicalOnChangePlugin";
import type { EditorState } from "lexical";
import {
  liveblocksConfig,
  LiveblocksPlugin,
  FloatingToolbar,
} from "@liveblocks/react-lexical";
import { Threads } from "@/app/editor/_components/threads";
import { api } from "@/trpc/react";
import { useMemo, useRef, useEffect } from "react";
import { toast } from "sonner";

export function Editor({
  documentId,
  initialContent,
  canWrite = true,
}: {
  documentId: string;
  initialContent: string | null;
  canWrite?: boolean;
}) {
  // Wrap your Lexical config with `liveblocksConfig`
  const initialConfig = liveblocksConfig({
    namespace: "Writer",
    // @ts-expect-error - liveblocksConfig wraps the config, editorState is valid but not in types
    editorState: initialContent ?? undefined,
    editable: canWrite, // Disable editing if read-only
    onError: (error: Error) => {
      console.error(error);
      throw error;
    },
  });

  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
  const updateMutation = api.document.updateContent.useMutation({
    onError: (error: unknown) => {
      const message =
        error && typeof error === "object" && "message" in error
          ? String(error.message)
          : "Failed to save document. Please try again.";
      toast.error(message, { id: `save-error-${documentId}` });
    },
    onSuccess: () => {
      // Show subtle success indication without being too intrusive
      toast.success("Saved", {
        id: `save-success-${documentId}`,
        duration: 1500,
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

  const handleChange = useMemo(
    () => (editorState: EditorState) => {
      // Don't save if user doesn't have write permission
      if (!canWrite) return;

      // Skip first change triggered by initial load
      if (skipFirst.current) {
        skipFirst.current = false;
        return;
      }

      // Skip if a save is in progress
      if (savingRef.current) return;

      const jsonStr = JSON.stringify(editorState.toJSON());
      if (jsonStr === lastSavedRef.current) return;

      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        savingRef.current = true;
        lastSavedRef.current = jsonStr;
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        updateMutation.mutate(
          { id: documentId, content: jsonStr },
          {
            onSettled: () => {
              savingRef.current = false;
            },
          },
        );
      }, 800);
    },
    [documentId, updateMutation, canWrite],
  );

  return (
    <LexicalComposer initialConfig={initialConfig}>
      <div className="editor">
        <RichTextPlugin
          contentEditable={
            <ContentEditable
              style={{
                cursor: canWrite ? "text" : "not-allowed",
                opacity: canWrite ? 1 : 0.7,
              }}
            />
          }
          placeholder={
            <div className="placeholder">
              {canWrite ? "Start typing here…" : "Read-only document"}
            </div>
          }
          ErrorBoundary={LexicalErrorBoundary}
        />
        <AutoFocusPlugin />
        <LexicalOnChangePlugin onChange={handleChange} />
        <LiveblocksPlugin>
          <Threads />
          <FloatingToolbar />
        </LiveblocksPlugin>
      </div>
    </LexicalComposer>
  );
}
