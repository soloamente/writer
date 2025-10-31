"use client";

import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { LexicalCursorRenderer } from "./LexicalCursorRenderer";

/**
 * Lexical plugin that integrates the custom cursor system
 * Uses Lexical's selection API to position cursor relative to actual text
 */
export function CursorPlugin({ enabled = true }: { enabled?: boolean }) {
  const [editor] = useLexicalComposerContext();

  if (!enabled) {
    return null;
  }

  return <LexicalCursorRenderer />;
}

