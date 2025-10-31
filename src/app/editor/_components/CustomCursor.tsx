"use client";

import { useEffect, useRef, useState } from "react";
import { Cursor, Point, elements, editor as editorState, settings } from "@/lib/writer";
import { pointToXY } from "@/lib/writer/utils";

interface CustomCursorProps {
  /**
   * Whether the cursor is visible
   */
  visible?: boolean;
  /**
   * Initial cursor position
   */
  initialPosition?: Point;
  /**
   * Callback when cursor position changes
   */
  onPositionChange?: (position: Point) => void;
}

/**
 * CustomCursor component renders and manages a custom text cursor
 * This component initializes the cursor system and renders the cursor element
 */
export function CustomCursor({
  visible = true,
  initialPosition = new Point(0, 0),
  onPositionChange,
}: CustomCursorProps) {
  const cursorRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const cursorInstanceRef = useRef<Cursor | null>(null);
  const [position, setPosition] = useState<{ x: number; y: number }>(
    pointToXY(initialPosition),
  );

  // Initialize cursor and editor elements
  useEffect(() => {
    if (!editorRef.current || !cursorRef.current) return;

    // Set up editor element references
    elements.editor = editorRef.current;
    elements.lines = editorRef.current.querySelector<HTMLElement>(
      "[writer-lines]",
    );
    elements.decorations = editorRef.current.querySelector<HTMLElement>(
      "[writer-decorations]",
    );

    // Create hidden textarea for selection calculations
    if (!elements.textarea) {
      const textarea = document.createElement("textarea");
      textarea.setAttribute("writer-textarea", "");
      textarea.style.position = "absolute";
      textarea.style.opacity = "0";
      textarea.style.pointerEvents = "none";
      document.body.appendChild(textarea);
      elements.textarea = textarea;
    }

    // Create initial cursor instance
    if (!cursorInstanceRef.current) {
      const cursor = new Cursor({ point: initialPosition });
      editorState.cursors = [cursor];
      cursorInstanceRef.current = cursor;

      // Update position
      const xy = pointToXY(cursor.position);
      setPosition(xy);

      // Set up position tracking
      const updateCursorPosition = () => {
        if (cursorInstanceRef.current) {
          const xy = pointToXY(cursorInstanceRef.current.position);
          setPosition(xy);
          onPositionChange?.(cursorInstanceRef.current.position);
        }
      };

      // Store update function for later use
      (cursor as any).__updatePosition = updateCursorPosition;
    }

    return () => {
      // Cleanup
      if (elements.textarea && elements.textarea.parentNode) {
        elements.textarea.parentNode.removeChild(elements.textarea);
      }
    };
  }, [initialPosition, onPositionChange]);

  // Update cursor position when it changes
  useEffect(() => {
    if (!cursorInstanceRef.current) return;

    const cursor = cursorInstanceRef.current;
    const xy = pointToXY(cursor.position);
    setPosition(xy);

    // Update cursor element transform
    if (cursorRef.current) {
      cursorRef.current.style.transform = `translate(${xy.x}px, ${xy.y}px)`;
    }
  }, [position]);

  return (
    <div ref={editorRef} writer-editor="">
      <div writer-wrapper="">
        <div writer-lines="" />
        <div writer-decorations="" />
      </div>
      {visible && (
        <div
          ref={cursorRef}
          writer-cursor=""
          style={{
            transform: `translate(${position.x}px, ${position.y}px)`,
          }}
        />
      )}
    </div>
  );
}

/**
 * Hook to use the custom cursor
 * Returns cursor instance and helper functions
 */
export function useCustomCursor(initialPosition?: Point) {
  const [cursor, setCursor] = useState<Cursor | null>(null);
  const [position, setPosition] = useState<Point>(
    initialPosition ?? new Point(0, 0),
  );

  useEffect(() => {
    const cursorInstance = new Cursor({ point: initialPosition });
    editorState.cursors = [cursorInstance];
    setCursor(cursorInstance);

    return () => {
      // Cleanup
      const index = editorState.cursors.indexOf(cursorInstance);
      if (index > -1) {
        editorState.cursors.splice(index, 1);
      }
    };
  }, [initialPosition]);

  // Update position when cursor moves
  useEffect(() => {
    if (!cursor) return;
    setPosition(cursor.position);
  }, [cursor?.position.line, cursor?.position.column, cursor]);

  return {
    cursor,
    position,
    moveTo: (line: number, column: number, select?: boolean) => {
      cursor?.moveTo(line, column, select);
      if (cursor) setPosition(cursor.position);
    },
    moveUp: (lines?: number, select?: boolean) => {
      cursor?.moveUp(lines, select);
      if (cursor) setPosition(cursor.position);
    },
    moveDown: (lines?: number, select?: boolean) => {
      cursor?.moveDown(lines, select);
      if (cursor) setPosition(cursor.position);
    },
    moveLeft: (cols?: number, select?: boolean) => {
      cursor?.moveLeft(cols, select);
      if (cursor) setPosition(cursor.position);
    },
    moveRight: (cols?: number, select?: boolean) => {
      cursor?.moveRight(cols, select);
      if (cursor) setPosition(cursor.position);
    },
  };
}

