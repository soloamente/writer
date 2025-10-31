"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Cursor, Point, editor as editorState } from "@/lib/writer";
import { CursorRenderer } from "./CursorRenderer";

interface CursorIntegrationProps {
  /**
   * Whether the cursor is enabled
   */
  enabled?: boolean;
  /**
   * Container element ref (optional, will find automatically if not provided)
   */
  containerRef?: React.RefObject<HTMLElement>;
}

/**
 * CursorIntegration component integrates the custom cursor system
 * This component can be added to any editor to enable custom cursor rendering
 */
export function CursorIntegration({
  enabled = true,
  containerRef,
}: CursorIntegrationProps) {
  const internalRef = useRef<HTMLDivElement>(null);
  const [mainCursor, setMainCursor] = useState<Cursor | null>(null);
  const editorRef = useRef<HTMLElement | null>(null);

  // Find or create editor container
  useEffect(() => {
    if (!enabled) return;

    const container =
      containerRef?.current ?? internalRef.current?.parentElement ?? null;

    if (!container) return;

    // Find or create editor element
    let editor = container.querySelector<HTMLElement>("[writer-editor]");
    if (!editor) {
      // Use the container itself if it has the attribute or create a wrapper
      if (container.hasAttribute("writer-editor")) {
        editor = container;
      } else {
        editor = container;
        editor.setAttribute("writer-editor", "");
      }
    }
    editorRef.current = editor;

    // Initialize main cursor if not exists
    if (editorState.cursors.length === 0) {
      const cursor = new Cursor({ point: new Point(0, 0) });
      editorState.cursors.push(cursor);
      setMainCursor(cursor);
    } else {
      setMainCursor(editorState.cursors[0] ?? null);
    }
  }, [enabled, containerRef]);

  // Handle keyboard events for cursor movement
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!enabled || !mainCursor) return;

      const isShift = e.shiftKey;
      let shouldPreventDefault = false;

      switch (e.key) {
        case "ArrowUp":
          mainCursor.moveUp(1, isShift);
          shouldPreventDefault = true;
          break;
        case "ArrowDown":
          mainCursor.moveDown(1, isShift);
          shouldPreventDefault = true;
          break;
        case "ArrowLeft":
          mainCursor.moveLeft(1, isShift);
          shouldPreventDefault = true;
          break;
        case "ArrowRight":
          mainCursor.moveRight(1, isShift);
          shouldPreventDefault = true;
          break;
        case "Home":
          mainCursor.moveToStartOfLine(isShift);
          shouldPreventDefault = true;
          break;
        case "End":
          mainCursor.moveToEndOfLine(isShift);
          shouldPreventDefault = true;
          break;
        case "PageUp":
          mainCursor.moveUp(10, isShift);
          shouldPreventDefault = true;
          break;
        case "PageDown":
          mainCursor.moveDown(10, isShift);
          shouldPreventDefault = true;
          break;
      }

      if (shouldPreventDefault) {
        e.preventDefault();
        setMainCursor(new Cursor({ point: mainCursor.position })); // Trigger re-render
      }
    },
    [enabled, mainCursor],
  );

  // Attach keyboard listener
  useEffect(() => {
    if (!enabled || !editorRef.current) return;

    const editor = editorRef.current;
    editor.addEventListener("keydown", handleKeyDown);

    // Make sure editor is focusable
    if (!editor.hasAttribute("tabIndex")) {
      editor.setAttribute("tabIndex", "0");
    }

    return () => {
      editor.removeEventListener("keydown", handleKeyDown);
    };
  }, [enabled, handleKeyDown]);

  if (!enabled || !editorRef.current) {
    return <div ref={internalRef} />;
  }

  return (
    <>
      {mainCursor && (
        <CursorRenderer
          editorElement={editorRef.current}
          cursors={[mainCursor]}
          visible={enabled}
        />
      )}
    </>
  );
}

/**
 * Simple hook to get the main cursor
 */
export function useMainCursor() {
  const [cursor, setCursor] = useState<Cursor | null>(
    editorState.cursors[0] ?? null,
  );

  useEffect(() => {
    if (editorState.cursors.length > 0) {
      setCursor(editorState.cursors[0] ?? null);
    }
  }, []);

  return cursor;
}

