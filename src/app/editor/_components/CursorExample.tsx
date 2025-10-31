"use client";

import { useEffect, useRef, useState } from "react";
import { Cursor, Point } from "@/lib/writer";
import { CursorRenderer } from "./CursorRenderer";

/**
 * Example component showing how to use the custom cursor
 * This demonstrates cursor initialization, rendering, and keyboard controls
 */
export function CursorExample() {
  const editorRef = useRef<HTMLDivElement>(null);
  const [cursor, setCursor] = useState<Cursor | null>(null);

  // Initialize cursor on mount
  useEffect(() => {
    if (!editorRef.current) return;

    // Create initial cursor at position (0, 0)
    const initialCursor = new Cursor({ point: new Point(0, 0) });
    setCursor(initialCursor);

    // Set editor element reference
    const editor = editorRef.current;
    editor.setAttribute("writer-editor", "");

    // Handle keyboard events for cursor movement
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!initialCursor) return;

      const isShift = e.shiftKey;

      switch (e.key) {
        case "ArrowUp":
          e.preventDefault();
          initialCursor.moveUp(1, isShift);
          setCursor(new Cursor({ point: initialCursor.position })); // Trigger update
          break;
        case "ArrowDown":
          e.preventDefault();
          initialCursor.moveDown(1, isShift);
          setCursor(new Cursor({ point: initialCursor.position }));
          break;
        case "ArrowLeft":
          e.preventDefault();
          initialCursor.moveLeft(1, isShift);
          setCursor(new Cursor({ point: initialCursor.position }));
          break;
        case "ArrowRight":
          e.preventDefault();
          initialCursor.moveRight(1, isShift);
          setCursor(new Cursor({ point: initialCursor.position }));
          break;
        case "Home":
          e.preventDefault();
          initialCursor.moveToStartOfLine(isShift);
          setCursor(new Cursor({ point: initialCursor.position }));
          break;
        case "End":
          e.preventDefault();
          initialCursor.moveToEndOfLine(isShift);
          setCursor(new Cursor({ point: initialCursor.position }));
          break;
      }
    };

    editor.addEventListener("keydown", handleKeyDown);
    editor.setAttribute("tabIndex", "0");
    editor.focus();

    return () => {
      editor.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  return (
    <div className="relative w-full h-full">
      <div
        ref={editorRef}
        className="w-full h-full p-4 focus:outline-none"
        style={{
          minHeight: "400px",
          fontFamily: "var(--text-font-family)",
          fontSize: "var(--text-font-size)",
          lineHeight: "var(--text-line-height)",
          color: "var(--text-color)",
        }}
      >
        {/* Placeholder text */}
        <div className="opacity-50">
          <p>Use arrow keys to move the cursor</p>
          <p>Hold Shift to select text</p>
          <p>Cursor position: {cursor?.position.line}, {cursor?.position.column}</p>
        </div>

        {/* Render cursor */}
        {cursor && editorRef.current && (
          <CursorRenderer
            editorElement={editorRef.current}
            cursors={[cursor]}
            visible={true}
          />
        )}
      </div>
    </div>
  );
}

