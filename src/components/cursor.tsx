"use client";

import { Cursor as MotionCursor } from "motion-plus/react";
import { useEffect, useState } from "react";

// Debug: Check if component is being imported correctly
console.log("CustomCursor component loaded, MotionCursor:", MotionCursor);

/**
 * Custom cursor component using Motion+ Cursor
 * Replaces the default browser cursor with a custom animated cursor
 *
 * Features:
 * - Automatically adapts to text, links, and buttons
 * - Supports magnetic snapping to interactive elements
 * - Respects reduced motion preferences
 * - Customizable via variants and CSS
 */
export function CustomCursor() {
  const [isMounted, setIsMounted] = useState(false);
  const [shouldReduceMotion, setShouldReduceMotion] = useState(false);

  // Only render on client side to avoid hydration issues
  useEffect(() => {
    setIsMounted(true);

    // Check for reduced motion preference
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setShouldReduceMotion(mediaQuery.matches);

    // Listen for changes to reduced motion preference
    const handleChange = (e: MediaQueryListEvent) => {
      setShouldReduceMotion(e.matches);
    };

    // Modern browsers
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener("change", handleChange);
    }
    // Fallback for older browsers
    else if (mediaQuery.addListener) {
      mediaQuery.addListener(handleChange);
    }

    return () => {
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener("change", handleChange);
      } else if (mediaQuery.removeListener) {
        mediaQuery.removeListener(handleChange);
      }
    };
  }, []);

  // Don't render if user prefers reduced motion or not mounted
  if (shouldReduceMotion || !isMounted) {
    return null;
  }

  return (
    <MotionCursor
      style={{
        backgroundColor: "#0d63f8",
        borderRadius: 20,
      }}
      variants={{
        // Default state - blue filled cursor
        default: {
          backgroundColor: "#0d63f8",
          borderRadius: 20,
        },
        // Text/caret state - blue filled (for text selection)
        // Motion+ Cursor automatically detects text and applies this variant
        text: {
          backgroundColor: "#0d63f8",
          borderRadius: 2, // Smaller, more text-cursor-like
        },
        // Pointer/clickable state - transparent with blue border
        pointer: {
          backgroundColor: "rgba(13, 99, 248, 0)",
          borderColor: "#0d63f8",
          borderWidth: 2,
          borderRadius: 20,
        },
        // Pressed state - smaller scale
        pressed: {
          scale: 0.8,
        },
        // Magnetic state - semi-transparent blue
        magnetic: {
          backgroundColor: "rgba(13, 99, 248, 0.3)",
        },
      }}
      magnetic
    />
  );
}
