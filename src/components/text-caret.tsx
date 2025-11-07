"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import {
  getCursorSettings,
  getBlinkAnimation,
  type CursorBlinkStyle,
} from "@/lib/cursor-settings";

/**
 * Custom text caret component that replaces the default browser caret
 * Shows a blue rectangle that matches the text height, similar to the cursor when hovering over text
 */
export function TextCaret() {
  const [caretPosition, setCaretPosition] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
    borderRadius: number;
  } | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [hasAppeared, setHasAppeared] = useState(false);
  const isInitialRender = useRef(true);
  const animationFrameRef = useRef<number | undefined>(undefined);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const typingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Load cursor settings
  const [cursorSettings, setCursorSettings] = useState(() =>
    getCursorSettings(),
  );

  // Listen for cursor settings changes
  useEffect(() => {
    const handleSettingsChange = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail) {
        setCursorSettings(customEvent.detail);
      }
    };

    window.addEventListener("cursor-settings-changed", handleSettingsChange);
    return () => {
      window.removeEventListener(
        "cursor-settings-changed",
        handleSettingsChange,
      );
    };
  }, []);

  useEffect(() => {
    const updateCaretPosition = () => {
      // Check if the focused element is a text input or contenteditable FIRST
      const activeElement = document.activeElement;
      const isHTMLInput =
        activeElement &&
        (activeElement.tagName === "INPUT" ||
          activeElement.tagName === "TEXTAREA");
      const isContentEditable =
        activeElement &&
        (activeElement.hasAttribute("contenteditable") ||
          activeElement.getAttribute("data-lexical-editor") !== null);
      const isTextInput = isHTMLInput || isContentEditable;

      console.log("[TextCaret] updateCaretPosition called:", {
        activeElement: activeElement?.tagName,
        hasContentEditable: activeElement?.hasAttribute("contenteditable"),
        hasDataLexicalEditor: activeElement?.getAttribute("data-lexical-editor"),
        contentEditableValue: activeElement?.getAttribute("contenteditable"),
        isHTMLInput,
        isContentEditable,
        isTextInput,
      });

      if (!isTextInput) {
        console.log("[TextCaret] Not a text input, hiding caret");
        setIsVisible(false);
        setCaretPosition(null);
        return;
      }

      // For HTML input/textarea, we handle them separately (they don't use window.getSelection())
      if (isHTMLInput) {
        // Continue with HTML input handling below
      } else {
        // For contenteditable elements, use window.getSelection()
        const selection = window.getSelection();

        console.log("[TextCaret] Checking selection:", {
          selection: selection ? {
            rangeCount: selection.rangeCount,
            collapsed: selection.rangeCount > 0 ? selection.getRangeAt(0).collapsed : null,
          } : null,
        });

        if (!selection || selection.rangeCount === 0) {
          console.log("[TextCaret] No selection found, hiding caret");
          setIsVisible(false);
          setCaretPosition(null);
          return;
        }

        const range = selection.getRangeAt(0);

        // Only show caret if it's collapsed (no selection, just a caret)
        if (!range.collapsed) {
          console.log("[TextCaret] Selection not collapsed, hiding caret");
          setIsVisible(false);
          setCaretPosition(null);
          return;
        }
      }

      try {
        // Get the computed style of the element
        let computedStyle = window.getComputedStyle(activeElement);
        let fontSize = parseFloat(computedStyle.fontSize);
        let lineHeight = parseFloat(computedStyle.lineHeight);

        // For contenteditable elements, try to get more accurate font size from the actual text node
        if (!isHTMLInput) {
          const selection = window.getSelection();
          if (selection && selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            const textNode = range.startContainer;
            if (
              textNode &&
              textNode.nodeType === Node.TEXT_NODE &&
              textNode.parentElement
            ) {
              const parentStyle = window.getComputedStyle(
                textNode.parentElement,
              );
              const parentFontSize = parseFloat(parentStyle.fontSize);
              if (parentFontSize > 0) {
                fontSize = parentFontSize;
                lineHeight =
                  parseFloat(parentStyle.lineHeight) || fontSize * 1.2;
              }
            } else if (textNode && textNode.nodeType === Node.ELEMENT_NODE) {
              const elementStyle = window.getComputedStyle(textNode as Element);
              const elementFontSize = parseFloat(elementStyle.fontSize);
              if (elementFontSize > 0) {
                fontSize = elementFontSize;
                lineHeight =
                  parseFloat(elementStyle.lineHeight) || fontSize * 1.2;
              }
            }
          }
        }

        // Calculate height based on line height or font size (keep original behavior)
        const height = lineHeight > 0 ? lineHeight : fontSize * 1.2;

        // Width should match the cursor caret - use a formula that grows slowly
        // Higher minimum for normal text, but doesn't grow too much for large text
        // Use a square root formula for more gradual growth, slightly reduced
        const width = Math.max(
          2.5,
          Math.min(5.5, 2 + Math.sqrt(fontSize) * 0.45),
        );

        // Border radius should be proportional to font size (like cursor with borderRadius: 5)
        // Use roughly 25% of font size, but keep it reasonable (between 1-5px)
        const borderRadius = Math.min(5, Math.max(1, fontSize * 0.25));

        let rect: DOMRect;

        if (isHTMLInput) {
          // For HTML input/textarea, we need to measure text position manually
          const input = activeElement as HTMLInputElement | HTMLTextAreaElement;

          // Ensure input has focus - if not, selectionStart might not be available
          if (document.activeElement !== input) {
            setIsVisible(false);
            setCaretPosition(null);
            return;
          }

          // Read input properties in one go to ensure consistency
          const inputRect = input.getBoundingClientRect();
          const inputValue = input.value ?? "";

          // Try to read selectionStart - it might be null if input doesn't support it
          // For some input types (like type="email"), selectionStart might not work as expected
          let selectionStart = input.selectionStart;

          // If selectionStart is null, try to get it from the selection API as fallback
          if (selectionStart === null || selectionStart === undefined) {
            // Fallback: assume cursor is at the end of the text
            selectionStart = inputValue.length;
          }

          // Ensure selectionStart is within valid range
          const validSelectionStart = Math.max(
            0,
            Math.min(selectionStart, inputValue.length),
          );
          const textBeforeCaret = inputValue.substring(0, validSelectionStart);

          // Debug logging
          if (process.env.NODE_ENV === "development") {
            console.log("TextCaret update:", {
              rawSelectionStart: input.selectionStart,
              selectionStart,
              inputValueLength: inputValue.length,
              validSelectionStart,
              textBeforeCaret,
              textBeforeCaretLength: textBeforeCaret.length,
              hasFocus: document.activeElement === input,
              inputType: input.type,
            });
          }

          // Create a temporary div that mimics the input for accurate measurement
          const tempDiv = document.createElement("div");
          tempDiv.style.position = "absolute";
          tempDiv.style.visibility = "hidden";
          tempDiv.style.whiteSpace = "nowrap"; // Inputs use nowrap, not pre
          tempDiv.style.pointerEvents = "none";
          tempDiv.style.fontSize = computedStyle.fontSize;
          tempDiv.style.fontFamily = computedStyle.fontFamily;
          tempDiv.style.fontWeight = computedStyle.fontWeight;
          tempDiv.style.fontStyle = computedStyle.fontStyle;
          tempDiv.style.letterSpacing = computedStyle.letterSpacing;
          tempDiv.style.textTransform = computedStyle.textTransform;
          tempDiv.style.fontVariant = computedStyle.fontVariant;
          tempDiv.style.textRendering = computedStyle.textRendering;
          tempDiv.style.lineHeight = computedStyle.lineHeight;
          tempDiv.style.wordSpacing = computedStyle.wordSpacing;
          tempDiv.style.direction = computedStyle.direction;
          tempDiv.style.unicodeBidi = computedStyle.unicodeBidi;
          tempDiv.style.overflow = "hidden";
          tempDiv.style.textOverflow = computedStyle.textOverflow;

          // Handle vendor-prefixed properties
          const webkitFontSmoothing = (computedStyle as any)
            .webkitFontSmoothing;
          const mozOsxFontSmoothing = (computedStyle as any)
            .mozOsxFontSmoothing;
          if (webkitFontSmoothing) {
            (tempDiv.style as any).webkitFontSmoothing = webkitFontSmoothing;
          }
          if (mozOsxFontSmoothing) {
            (tempDiv.style as any).mozOsxFontSmoothing = mozOsxFontSmoothing;
          }

          // Don't add padding/border to the temp div - we'll add it separately
          tempDiv.style.padding = "0";
          tempDiv.style.margin = "0";
          tempDiv.style.border = "0";
          tempDiv.style.top = "-9999px";
          tempDiv.style.left = "-9999px";
          tempDiv.style.width = "auto";
          tempDiv.style.height = "auto";

          // Set the text content up to the caret position
          tempDiv.textContent = textBeforeCaret || "\u200B"; // Zero-width space if empty

          // Append to body temporarily
          document.body.appendChild(tempDiv);

          // Force a reflow to ensure accurate measurement
          void tempDiv.offsetWidth;
          void tempDiv.offsetHeight;

          // Get the width of the text before the caret
          const textWidth = tempDiv.getBoundingClientRect().width;

          // Remove the temp div
          document.body.removeChild(tempDiv);

          // Calculate position
          const paddingLeft = parseFloat(computedStyle.paddingLeft) || 0;
          const borderLeft = parseFloat(computedStyle.borderLeftWidth) || 0;
          const paddingTop = parseFloat(computedStyle.paddingTop) || 0;
          const borderTop = parseFloat(computedStyle.borderTopWidth) || 0;

          // For textarea, we might need to account for line breaks
          if (activeElement.tagName === "TEXTAREA") {
            const textarea = activeElement as HTMLTextAreaElement;
            const lines = textBeforeCaret.split("\n");
            const currentLine = lines.length - 1;
            const lineText = lines[currentLine] || "";

            // Measure the current line width using the same method
            const tempDiv2 = document.createElement("div");
            tempDiv2.style.position = "absolute";
            tempDiv2.style.visibility = "hidden";
            tempDiv2.style.whiteSpace = "nowrap";
            tempDiv2.style.pointerEvents = "none";
            tempDiv2.style.fontSize = computedStyle.fontSize;
            tempDiv2.style.fontFamily = computedStyle.fontFamily;
            tempDiv2.style.fontWeight = computedStyle.fontWeight;
            tempDiv2.style.fontStyle = computedStyle.fontStyle;
            tempDiv2.style.letterSpacing = computedStyle.letterSpacing;
            tempDiv2.style.textTransform = computedStyle.textTransform;
            tempDiv2.style.padding = "0";
            tempDiv2.style.margin = "0";
            tempDiv2.style.border = "0";
            tempDiv2.style.top = "-9999px";
            tempDiv2.style.left = "-9999px";
            tempDiv2.textContent = lineText || "\u200B";
            document.body.appendChild(tempDiv2);
            void tempDiv2.offsetWidth;
            const lineWidth = tempDiv2.getBoundingClientRect().width;
            document.body.removeChild(tempDiv2);

            // Calculate Y position based on line number
            const lineHeightValue =
              parseFloat(computedStyle.lineHeight) || fontSize * 1.2;
            const scrollTop = textarea.scrollTop || 0;
            const scrollLeft = textarea.scrollLeft || 0;

            // Center vertically within the line
            const verticalOffset = (lineHeightValue - height) / 2;

            rect = {
              left:
                inputRect.left +
                paddingLeft +
                borderLeft +
                lineWidth -
                scrollLeft,
              top:
                inputRect.top +
                paddingTop +
                borderTop +
                currentLine * lineHeightValue +
                verticalOffset -
                scrollTop,
              width: 0,
              height: height,
            } as DOMRect;
          } else {
            // For regular input, it's a single line
            // Center vertically based on line height, not input height
            // This ensures the caret aligns with the text baseline
            const lineHeightValue =
              parseFloat(computedStyle.lineHeight) || fontSize * 1.2;
            const verticalOffset = (lineHeightValue - height) / 2;

            // Account for horizontal scroll in input
            const scrollLeft = input.scrollLeft || 0;

            rect = {
              left:
                inputRect.left +
                paddingLeft +
                borderLeft +
                textWidth -
                scrollLeft,
              top: inputRect.top + paddingTop + borderTop + verticalOffset,
              width: 0,
              height: height,
            } as DOMRect;
          }
        } else {
          // For contenteditable elements, use the standard method
          const selection = window.getSelection();
          if (selection && selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            rect = range.getBoundingClientRect();
          } else {
            setIsVisible(false);
            setCaretPosition(null);
            return;
          }
        }

        // If rect is empty or invalid (common on empty lines), use alternative method
        // Only for contenteditable elements (not HTML inputs)
        if (
          !isHTMLInput &&
          ((rect.width === 0 && rect.height === 0) ||
            (rect.left === 0 && rect.top === 0))
        ) {
          // Method 1: Try inserting a zero-width space to measure position
          try {
            const selection = window.getSelection();
            if (selection && selection.rangeCount > 0) {
              const range = selection.getRangeAt(0);
              const tempSpan = document.createElement("span");
              tempSpan.textContent = "\u200B"; // Zero-width space
              tempSpan.style.position = "absolute";
              tempSpan.style.visibility = "hidden";
              tempSpan.style.whiteSpace = "pre";
              tempSpan.style.pointerEvents = "none";

              // Clone the range and insert the temp span
              const clonedRange = range.cloneRange();
              clonedRange.insertNode(tempSpan);

              // Get the position of the temp span
              const tempRect = tempSpan.getBoundingClientRect();

              // Remove the temp span immediately
              tempSpan.remove();

              // Use the temp span's position if valid and not at origin
              if (
                (tempRect.width > 0 || tempRect.height > 0) &&
                !(tempRect.left === 0 && tempRect.top === 0)
              ) {
                rect = tempRect;
              } else {
                throw new Error("Temp span position invalid");
              }
            } else {
              throw new Error("No selection available");
            }
          } catch (e) {
            // Method 2: For Lexical editor, try to find the current paragraph/line element
            const selection = window.getSelection();
            let currentNode: Node | null = null;
            if (selection && selection.rangeCount > 0) {
              const range = selection.getRangeAt(0);
              currentNode = range.startContainer;
            }

            // Walk up the DOM tree to find a block element (p, div, etc.)
            while (currentNode && currentNode !== activeElement) {
              if (currentNode.nodeType === Node.ELEMENT_NODE) {
                const element = currentNode as Element;
                const elementRect = element.getBoundingClientRect();

                // If we found a visible element, use its position
                if (
                  elementRect.width > 0 &&
                  elementRect.height > 0 &&
                  !(elementRect.left === 0 && elementRect.top === 0)
                ) {
                  // Calculate position within the element
                  const paddingLeft =
                    parseFloat(computedStyle.paddingLeft) || 0;

                  // For empty lines, position at the start of the line
                  // Use the element's height or calculated height
                  const elementHeight =
                    elementRect.height > 0 ? elementRect.height : height;
                  rect = {
                    left: elementRect.left + paddingLeft,
                    top: elementRect.top,
                    width: 0,
                    height: elementHeight,
                  } as DOMRect;
                  break;
                }
              }
              currentNode = currentNode.parentNode;
            }

            // Method 3: Fallback to container-based estimation
            if (
              (rect.width === 0 && rect.height === 0) ||
              (rect.left === 0 && rect.top === 0)
            ) {
              const containerRect = activeElement.getBoundingClientRect();
              const paddingLeft = parseFloat(computedStyle.paddingLeft) || 0;
              const paddingTop = parseFloat(computedStyle.paddingTop) || 0;

              // Only use if container is visible and valid
              if (
                containerRect.width > 0 &&
                containerRect.height > 0 &&
                !(containerRect.left === 0 && containerRect.top === 0)
              ) {
                rect = {
                  left: containerRect.left + paddingLeft,
                  top: containerRect.top + paddingTop,
                  width: 0,
                  height: height,
                } as DOMRect;
              }
            }
          }
        }

        // Validate the position - don't show if it's at (0,0) or invalid
        if (
          rect.left === 0 &&
          rect.top === 0 &&
          rect.width === 0 &&
          rect.height === 0
        ) {
          setIsVisible(false);
          setCaretPosition(null);
          return;
        }

        // Additional validation: check if position is within viewport bounds
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        if (
          rect.left < 0 ||
          rect.top < 0 ||
          rect.left > viewportWidth ||
          rect.top > viewportHeight
        ) {
          // Position seems invalid, try alternative method
          const containerRect = activeElement.getBoundingClientRect();
          const paddingLeft = parseFloat(computedStyle.paddingLeft) || 0;
          const paddingTop = parseFloat(computedStyle.paddingTop) || 0;

          // Only use container-based estimation if container is visible
          if (containerRect.width > 0 && containerRect.height > 0) {
            setCaretPosition({
              x: containerRect.left + paddingLeft,
              y: containerRect.top + paddingTop,
              width: width,
              height: height,
              borderRadius: borderRadius,
            });
            setIsVisible(true);
          } else {
            setIsVisible(false);
            setCaretPosition(null);
          }
          return;
        }

        setCaretPosition({
          x: rect.left,
          y: rect.top,
          width: width,
          height: height,
          borderRadius: borderRadius,
        });
        setIsVisible(true);
        // Mark that we've had at least one position update
        // Delay marking initial render as complete to prevent animation when cursor is restored
        if (isInitialRender.current) {
          setTimeout(() => {
            isInitialRender.current = false;
            // Trigger fade-in animation after a brief delay
            setTimeout(() => {
              setHasAppeared(true);
            }, 50);
          }, 200);
        }
      } catch (error) {
        // If we can't get the position, hide the caret
        setIsVisible(false);
        setCaretPosition(null);
      }
    };

    const handleSelectionChange = () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      // Use single requestAnimationFrame for faster updates
      animationFrameRef.current = requestAnimationFrame(updateCaretPosition);
    };

    const handleInput = () => {
      // Mark that we're typing for faster transitions
      setIsTyping(true);

      // Clear existing timeout and interval
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      if (typingIntervalRef.current) {
        clearInterval(typingIntervalRef.current);
      }

      // Update immediately with a small delay to ensure DOM is updated
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          updateCaretPosition();
        });
      });

      // Start continuous polling during typing for rapid updates
      typingIntervalRef.current = setInterval(() => {
        updateCaretPosition();
      }, 8); // ~120fps polling during typing for smoother updates

      // Reset typing flag after a longer delay to catch rapid typing
      typingTimeoutRef.current = setTimeout(() => {
        setIsTyping(false);
        if (typingIntervalRef.current) {
          clearInterval(typingIntervalRef.current);
          typingIntervalRef.current = null;
        }
      }, 300);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      // For Enter/Shift+Enter, add a longer delay to allow DOM to update
      if (e.key === "Enter") {
        requestAnimationFrame(() => {
          requestAnimationFrame(updateCaretPosition);
        });
      } else if (
        e.key === "ArrowUp" ||
        e.key === "ArrowDown" ||
        e.key === "ArrowLeft" ||
        e.key === "ArrowRight" ||
        e.key === "Home" ||
        e.key === "End" ||
        e.key === "PageUp" ||
        e.key === "PageDown"
      ) {
        // For arrow keys and navigation keys, update after a delay to allow browser to move selection
        requestAnimationFrame(() => {
          requestAnimationFrame(updateCaretPosition);
        });
      } else if (
        e.key === "Backspace" ||
        e.key === "Delete" ||
        (e.key && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey)
      ) {
        // For typing/deleting, mark as typing and start continuous polling
        setIsTyping(true);
        if (typingTimeoutRef.current) {
          clearTimeout(typingTimeoutRef.current);
        }
        if (typingIntervalRef.current) {
          clearInterval(typingIntervalRef.current);
        }

        // Update immediately with a small delay to ensure DOM is updated
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            updateCaretPosition();
          });
        });

        // Start continuous polling during typing for rapid updates
        typingIntervalRef.current = setInterval(() => {
          updateCaretPosition();
        }, 8); // ~120fps polling during typing for smoother updates

        typingTimeoutRef.current = setTimeout(() => {
          setIsTyping(false);
          if (typingIntervalRef.current) {
            clearInterval(typingIntervalRef.current);
            typingIntervalRef.current = null;
          }
        }, 300);
      } else {
        handleSelectionChange();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      // Also update on keyup for arrow keys to ensure we catch the final position
      if (
        e.key === "ArrowUp" ||
        e.key === "ArrowDown" ||
        e.key === "ArrowLeft" ||
        e.key === "ArrowRight" ||
        e.key === "Home" ||
        e.key === "End" ||
        e.key === "PageUp" ||
        e.key === "PageDown"
      ) {
        requestAnimationFrame(() => {
          requestAnimationFrame(updateCaretPosition);
        });
      }
    };

    // Listen for selection changes
    document.addEventListener("selectionchange", handleSelectionChange);
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("keyup", handleKeyUp);
    document.addEventListener("click", handleSelectionChange);
    document.addEventListener("input", handleInput);

    // Also listen directly on input/textarea elements for immediate updates
    const handleDirectInput = (e: Event) => {
      const target = e.target as HTMLElement;
      if (
        target &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA") &&
        target === document.activeElement
      ) {
        const input = target as HTMLInputElement | HTMLTextAreaElement;
        // Use a small timeout to ensure selectionStart is updated by the browser
        // This is necessary because selectionStart might not be updated immediately during the input event
        setTimeout(() => {
          updateCaretPosition();
        }, 0);
      }
    };

    // Use capture phase to catch all input events
    document.addEventListener("input", handleDirectInput, true);

    // Initial update
    updateCaretPosition();

    // Update on focus/blur
    const handleFocus = () => {
      setTimeout(updateCaretPosition, 0);
    };
    const handleBlur = () => {
      setIsVisible(false);
      setCaretPosition(null);
    };

    document.addEventListener("focusin", handleFocus);
    document.addEventListener("focusout", handleBlur);

    // Handle scroll events for input/textarea elements
    const handleScroll = (e: Event) => {
      const target = e.target as HTMLElement;
      if (
        target &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA") &&
        target === document.activeElement
      ) {
        updateCaretPosition();
      }
    };

    document.addEventListener("scroll", handleScroll, true); // Use capture phase to catch all scroll events

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      if (typingIntervalRef.current) {
        clearInterval(typingIntervalRef.current);
      }
      document.removeEventListener("selectionchange", handleSelectionChange);
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("keyup", handleKeyUp);
      document.removeEventListener("click", handleSelectionChange);
      document.removeEventListener("input", handleInput);
      document.removeEventListener("input", handleDirectInput, true);
      document.removeEventListener("focusin", handleFocus);
      document.removeEventListener("focusout", handleBlur);
      document.removeEventListener("scroll", handleScroll, true);
    };
  }, []);

  // Don't render until we have a position to prevent animation from (0,0)
  if (!caretPosition || !isVisible) {
    return null;
  }

  const blinkConfig = getBlinkAnimation(
    cursorSettings.blinkStyle,
    cursorSettings.blinkDuration,
  );

  return (
    <motion.div
      initial={false} // Prevent animation from initial state
      style={{
        position: "fixed",
        left: 0,
        top: 0,
        width: caretPosition.width || 2,
        height: caretPosition.height,
        backgroundColor: "#0d63f8",
        borderRadius: caretPosition.borderRadius || 2, // Rounded corners proportional to font size
        pointerEvents: "none",
        zIndex: 9998,
        willChange: "transform",
      }}
      animate={{
        opacity: hasAppeared
          ? cursorSettings.blinkStyle === "solid"
            ? 1
            : blinkConfig.opacity
          : 0,
        x: caretPosition.x, // Use transform for smoother movement
        y: caretPosition.y,
      }}
      transition={{
        opacity: hasAppeared
          ? cursorSettings.blinkStyle === "solid"
            ? {}
            : {
                duration: cursorSettings.blinkDuration,
                repeat: Infinity,
                ease: blinkConfig.ease as [number, number, number, number],
                times: blinkConfig.times,
              }
          : {
              duration: 0.2, // Smooth fade-in when appearing
              ease: [0.25, 0.46, 0.45, 0.94], // ease-out-quad
            },
        x: {
          duration: isInitialRender.current ? 0 : isTyping ? 0.08 : 0.15, // No animation on initial render
          ease: [0.25, 0.46, 0.45, 0.94], // ease-out-quad
        },
        y: {
          duration: isInitialRender.current ? 0 : isTyping ? 0.08 : 0.15, // No animation on initial render
          ease: [0.25, 0.46, 0.45, 0.94], // ease-out-quad
        },
      }}
    />
  );
}
