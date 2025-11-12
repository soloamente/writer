"use client";

import { useEffect } from "react";

/**
 * Temporary component to inspect Liveblocks cursor DOM structure
 * This helps us identify the correct CSS selectors to style cursors
 */
export function CursorInspector() {
  useEffect(() => {
    const inspectCursors = () => {
      // Find all elements that might be Liveblocks cursors
      const editor = document.querySelector("[data-lexical-editor]");
      if (!editor) return;

      // Look for elements with pointer-events: none (typical for cursors)
      const allElements = editor.querySelectorAll("*");
      const potentialCursors: Array<{
        element: Element;
        classes: string;
        styles: string;
        attributes: string;
      }> = [];

      allElements.forEach((el) => {
        const computed = window.getComputedStyle(el);
        if (
          computed.pointerEvents === "none" &&
          (computed.position === "absolute" || computed.position === "fixed")
        ) {
          potentialCursors.push({
            element: el,
            classes: el.className.toString(),
            styles: el.getAttribute("style") || "",
            attributes: Array.from(el.attributes)
              .map((attr) => `${attr.name}="${attr.value}"`)
              .join(" "),
          });
        }
      });

      if (potentialCursors.length > 0) {
        console.log("🔍 Found potential Liveblocks cursor elements:", potentialCursors);
        potentialCursors.forEach((cursor, i) => {
          console.log(`Cursor ${i + 1}:`, {
            tag: cursor.element.tagName,
            classes: cursor.classes,
            styles: cursor.styles,
            attributes: cursor.attributes,
            element: cursor.element,
          });
        });
      } else {
        console.log("⚠️ No cursor elements found. Make sure another user is editing.");
      }
    };

    // Inspect immediately and then periodically
    inspectCursors();
    const interval = setInterval(inspectCursors, 2000);

    return () => clearInterval(interval);
  }, []);

  return null;
}




