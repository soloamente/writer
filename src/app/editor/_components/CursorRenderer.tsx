"use client";

import { useEffect, useRef, useState } from "react";
import {
  Cursor,
  Point,
  elements,
  editor as editorState,
} from "@/lib/writer";
import { pointToXY } from "@/lib/writer/utils";

interface CursorRendererProps {
  /**
   * The editor container element (where cursor should be rendered relative to)
   */
  editorElement: HTMLElement | null;
  /**
   * Current cursor instances to render
   */
  cursors: Cursor[];
  /**
   * Whether cursors are visible
   */
  visible?: boolean;
}

/**
 * CursorRenderer component renders custom cursor elements
 * This component manages the DOM elements for cursors and updates their positions
 */
export function CursorRenderer({
  editorElement,
  cursors,
  visible = true,
}: CursorRendererProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const cursorElementsRef = useRef<Map<string, HTMLDivElement>>(new Map());

  // Initialize editor elements
  useEffect(() => {
    if (!editorElement) return;

    // Set editor reference
    elements.editor = editorElement;

    // Find or create wrapper
    let wrapper = editorElement.querySelector<HTMLDivElement>(
      "[writer-wrapper]",
    );
    if (!wrapper) {
      wrapper = document.createElement("div");
      wrapper.setAttribute("writer-wrapper", "");
      // Ensure wrapper has proper positioning
      wrapper.style.position = "relative";
      wrapper.style.width = "100%";
      wrapper.style.height = "100%";
      editorElement.appendChild(wrapper);
    }
    wrapperRef.current = wrapper;

    // Find or create lines container
    let lines = wrapper.querySelector<HTMLDivElement>("[writer-lines]");
    if (!lines) {
      lines = document.createElement("div");
      lines.setAttribute("writer-lines", "");
      wrapper.appendChild(lines);
    }
    elements.lines = lines;

    // Find or create decorations container
    let decorations = wrapper.querySelector<HTMLDivElement>(
      "[writer-decorations]",
    );
    if (!decorations) {
      decorations = document.createElement("div");
      decorations.setAttribute("writer-decorations", "");
      wrapper.appendChild(decorations);
    }
    elements.decorations = decorations;

    // Create hidden textarea if it doesn't exist
    if (!elements.textarea) {
      const textarea = document.createElement("textarea");
      textarea.setAttribute("writer-textarea", "");
      textarea.style.cssText = `
        position: absolute;
        opacity: 0;
        pointer-events: none;
        height: ${28}px;
        top: 0;
        left: 0;
      `;
      document.body.appendChild(textarea);
      elements.textarea = textarea;
    }
  }, [editorElement]);

  // Update cursor elements
  useEffect(() => {
    if (!wrapperRef.current || !visible) return;

    const wrapper = wrapperRef.current;
    const cursorElements = cursorElementsRef.current;

    // Remove cursors that no longer exist
    const currentIds = new Set(cursors.map((c) => c.id));
    for (const [id, element] of cursorElements.entries()) {
      if (!currentIds.has(id)) {
        element.remove();
        cursorElements.delete(id);
      }
    }

    // Create or update cursor elements
    cursors.forEach((cursor) => {
      let cursorElement = cursorElements.get(cursor.id);

      if (!cursorElement) {
        // Create new cursor element
        cursorElement = document.createElement("div");
        cursorElement.setAttribute("writer-cursor", "");
        // Ensure cursor element is positioned absolutely
        cursorElement.style.position = "absolute";
        cursorElement.style.zIndex = "9999";
        cursorElement.style.top = "0";
        cursorElement.style.left = "0";
        // Make cursor visible for debugging
        console.log("Creating cursor element:", cursor.id);
        wrapper.appendChild(cursorElement);
        cursorElements.set(cursor.id, cursorElement);
      }

      // Update cursor position
      const { x, y } = pointToXY(cursor.position);
      cursorElement.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      cursorElement.style.left = `${x}px`;
      cursorElement.style.top = `${y}px`;
      
      // Log for debugging
      if (cursors.length === 1 && cursor === cursors[0]) {
        console.log("Cursor position:", { x, y, line: cursor.position.line, column: cursor.position.column });
      }
    });

    return () => {
      // Cleanup on unmount
      for (const element of cursorElements.values()) {
        element.remove();
      }
      cursorElements.clear();
    };
  }, [cursors, visible]);

  return null;
}

/**
 * Hook to manage and render cursors
 */
export function useCursorRenderer(editorElement: HTMLElement | null) {
  const [cursors, setCursors] = useState<Cursor[]>([]);

  // Sync with editor state
  useEffect(() => {
    const updateCursors = () => {
      setCursors([...editorState.cursors]);
    };

    // Initial update
    updateCursors();

    // Set up interval to check for cursor changes
    // TODO: Use a more efficient state management system
    const interval = setInterval(updateCursors, 16); // ~60fps

    return () => clearInterval(interval);
  }, []);

  return {
    cursors,
    addCursor: (point?: Point) => {
      const cursor = new Cursor({ point });
      editorState.cursors.push(cursor);
      setCursors([...editorState.cursors]);
      return cursor;
    },
    removeCursor: (cursorId: string) => {
      const index = editorState.cursors.findIndex((c) => c.id === cursorId);
      if (index > -1) {
        editorState.cursors.splice(index, 1);
        setCursors([...editorState.cursors]);
      }
    },
  };
}

