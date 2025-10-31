"use client";

import { useEffect, useRef } from "react";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $getRoot, $createRangeSelection, $setSelection, $getSelection } from "lexical";

/**
 * LexicalCursorRenderer component renders custom cursor using Lexical's selection API
 * This positions the cursor relative to the actual text content in the editor
 */
export function LexicalCursorRenderer() {
  const [editor] = useLexicalComposerContext();
  const cursorElementRef = useRef<HTMLDivElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const hasInitializedCursorRef = useRef(false);

  useEffect(() => {
    if (!editor) return;

    // Create cursor element
    const cursorElement = document.createElement("div");
    cursorElement.setAttribute("writer-cursor", "");
    cursorElement.style.cssText = `
      position: fixed;
      pointer-events: none;
      z-index: 9999;
      width: var(--cursor-width, 4px);
      height: var(--text-line-height, 28px);
      background: var(--cursor-color, #838383);
      border-radius: var(--cursor-radius, 2px);
      transition: transform 80ms ease, height 80ms ease;
      opacity: 1;
      will-change: transform;
    `;
    document.body.appendChild(cursorElement);
    cursorElementRef.current = cursorElement;
    
    // Track previous position for smooth transitions
    let previousLeft = 0;
    let previousTop = 0;
    
    // Track if Enter was just pressed to add extra delay for DOM update
    let justPressedEnter = false;
    
    // Track if we were recently on a non-start line to detect cursor jumping back
    let wasOnNonStartLine = false;
    
    // Track if we're currently using Lexical position (to persist it)
    let isUsingLexicalPosition = false;
    let lastLexicalPosition: { left: number; top: number; height: number } | null = null;
    let lastParagraphKey: string | null = null;
    
    // Listen for Enter key to add delay for new line
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        justPressedEnter = true;
        // Keep the flag longer to prevent cursor jumping back to start
        // Clear the flag after DOM has fully updated and user starts typing
        setTimeout(() => {
          justPressedEnter = false;
        }, 500);
      }
    };
    
    const rootElementForKeys = editor.getRootElement();
    rootElementForKeys?.addEventListener('keydown', handleKeyDown, true);

    // Function to update cursor position using native Selection API
    const updateCursorPosition = () => {
      if (!cursorElement) return;

      try {
        // Get the root element (content editable)
        const rootElement = editor.getRootElement();
        if (!rootElement) {
          cursorElement.style.display = "none";
          return;
        }

        const rootRect = rootElement.getBoundingClientRect();
        const computedStyle = window.getComputedStyle(rootElement);
        const paddingTop = parseFloat(computedStyle.paddingTop) || 0;
        const paddingLeft = parseFloat(computedStyle.paddingLeft) || 0;

        // Use native Selection API for real-time cursor tracking when typing
        const selection = window.getSelection();
        
        // Try to get cursor position from selection
        if (selection && selection.rangeCount > 0 && selection.isCollapsed) {
          const range = selection.getRangeAt(0);
          
          // Check if the selection is actually in our root element
          const isInRoot = rootElement.contains(range.commonAncestorContainer);
          
          if (isInRoot) {
            const rect = range.getBoundingClientRect();
            
            // For collapsed selections, width and height can be 0, which is fine
            // We just need valid coordinates that are within the root element
            const hasValidCoordinates = 
              rect.left !== undefined && 
              rect.top !== undefined &&
              !isNaN(rect.left) &&
              !isNaN(rect.top);
            
            // Check if coordinates are within the root element bounds
            // Also reject coordinates at (0,0) unless root is actually at (0,0)
            // This handles the case when editor is empty and selection returns invalid position
            const isWithinRootBounds = 
              rect.left >= rootRect.left && 
              rect.left <= rootRect.right &&
              rect.top >= rootRect.top &&
              rect.top <= rootRect.bottom;
            
            // Reject (0,0) positions unless root is actually at (0,0)
            // Also reject positions at padding edge for collapsed selections at start of empty lines
            const isAtPaddingEdge = Math.abs(rect.left - (rootRect.left + paddingLeft)) < 5 && rect.width === 0;
            
            // Check if position is suspicious - at the start of content editable
            // This might indicate the cursor jumped to wrong position after Enter
            // Check horizontal position (more reliable indicator than vertical)
            const isAtStartHorizontal = Math.abs(rect.left - (rootRect.left + paddingLeft)) < 5;
            const isAtStartVertical = Math.abs(rect.top - (rootRect.top + paddingTop)) < 10;
            const isAtStart = isAtStartHorizontal && isAtStartVertical;
            
            // Calculate line height first
            const lineHeight = parseFloat(computedStyle.lineHeight) || 28;
            
            // Check if cursor is on the same line as before (for deletion detection)
            // If cursor is at horizontal start but on same line vertically, it's just empty text, not a jump
            // Check if we're close to previousTop OR if DOM is incorrectly reporting first line when we were on a different line
            const wasOnDifferentLine = previousTop > 0 && (previousTop - (rootRect.top + paddingTop)) > lineHeight * 0.5;
            const isDOMAtFirstLine = Math.abs(rect.top - (rootRect.top + paddingTop)) < 10;
            const isCloseToPreviousTop = previousTop > 0 && Math.abs(rect.top - previousTop) < lineHeight * 0.5;
            // If DOM says first line but we were clearly on a different line, trust previousTop
            // Also check if horizontal position jumped to start when we were on a different line
            const isDOMAtStartHorizontally = Math.abs(rect.left - (rootRect.left + paddingLeft)) < 5;
            const wasNotAtStartHorizontally = previousLeft > 0 && Math.abs(previousLeft - (rootRect.left + paddingLeft)) > 10;
            // More aggressive: if DOM says first line AND start horizontally, but we were on different line, it's definitely deletion
            const isOnSameLineAsBefore = isCloseToPreviousTop || 
                                         (wasOnDifferentLine && isDOMAtFirstLine && isDOMAtStartHorizontally) ||
                                         (wasOnDifferentLine && isDOMAtFirstLine && isAtStartHorizontal && wasNotAtStartHorizontally);
            
            // VERY EARLY CHECK: Use Lexical position immediately when deleting text on a line
            // This ensures we get the correct paragraph position before any other logic interferes
            // PRIORITY CHECK 1: If previousTop was on a different line and DOM reports first line, ALWAYS use Lexical
            // This catches the case when you delete all text on a new line - stay on that line
            const previousTopIsDifferent = previousTop > 0 && Math.abs(previousTop - (rootRect.top + paddingTop)) > 5;
            // isDOMAtFirstLine is already defined above, reuse it
            
            // If we were on a different line but DOM says first line, use Lexical immediately
            // This is the most critical check - catch deletion cases before anything else
            if (previousTopIsDifferent && isDOMAtFirstLine && hasValidCoordinates && isWithinRootBounds) {
              // ALWAYS get Lexical position when DOM incorrectly reports first line
              // Lexical knows which paragraph we're actually in
              let lexicalDeletionPosition: { left: number; top: number; height: number } | null = null;
              
              try {
                editor.getEditorState().read(() => {
                  const lexicalSelection = $getSelection();
                  if (lexicalSelection && lexicalSelection.anchor) {
                    const root = $getRoot();
                    const children = root.getChildren();
                    
                    // Find current paragraph - try multiple methods
                    let targetParagraphKey: string | null = null;
                    const anchorKey = lexicalSelection.anchor.key;
                    
                    try {
                      // Method 1: Walk up from anchor node to find paragraph
                      const anchorNode = lexicalSelection.anchor.getNode();
                      if (anchorNode) {
                        let current: any = anchorNode;
                        while (current) {
                          const type = current.getType?.();
                          if (type === 'paragraph') {
                            targetParagraphKey = current.getKey();
                            break;
                          }
                          current = current.getParent?.();
                        }
                      }
                    } catch (e) {
                      // Continue
                    }
                    
                    // Method 2: Check if anchor key matches a paragraph directly
                    if (!targetParagraphKey) {
                      for (let i = 0; i < children.length; i++) {
                        const child = children[i];
                        if (child.getKey() === anchorKey) {
                          targetParagraphKey = child.getKey();
                          break;
                        }
                      }
                    }
                    
                    // Method 3: Search through all paragraphs for text nodes containing the anchor
                    if (!targetParagraphKey) {
                      for (let i = 0; i < children.length; i++) {
                        const child = children[i];
                        const searchForTextNode = (node: any): boolean => {
                          if (node.getKey() === anchorKey) return true;
                          const type = node.getType?.();
                          if (type === 'text' && node.getKey() === anchorKey) return true;
                          const nodeChildren = node.getChildren ? node.getChildren() : [];
                          return nodeChildren.some(searchForTextNode);
                        };
                        
                        if (searchForTextNode(child)) {
                          targetParagraphKey = child.getKey();
                          break;
                        }
                      }
                    }
                    
                    // Method 4: Use the last paragraph (most likely where you were typing)
                    // This is important - when you delete all text on a new line, you're likely in the last paragraph
                    if (!targetParagraphKey && children.length > 0) {
                      targetParagraphKey = children[children.length - 1].getKey();
                    }
                    
                    if (targetParagraphKey) {
                      const paragraphDOM = editor.getElementByKey(targetParagraphKey);
                      if (paragraphDOM) {
                        const blockRect = paragraphDOM.getBoundingClientRect();
                        const blockStyle = window.getComputedStyle(paragraphDOM);
                        const blockPaddingLeft = parseFloat(blockStyle.paddingLeft) || 0;
                        const blockMarginLeft = parseFloat(blockStyle.marginLeft) || 0;
                        const blockTextIndent = parseFloat(blockStyle.textIndent) || 0;
                        const blockPaddingTop = parseFloat(blockStyle.paddingTop) || 0;
                        const paragraphLineHeight = parseFloat(blockStyle.lineHeight) || parseFloat(computedStyle.lineHeight) || 28;
                        
                        lexicalDeletionPosition = {
                          left: blockRect.left + blockPaddingLeft + blockMarginLeft + blockTextIndent,
                          top: blockRect.top + blockPaddingTop,
                          height: paragraphLineHeight
                        };
                      }
                    }
                  }
                });
              } catch (e) {
                // Fall through
              }
              
              // ALWAYS use Lexical position if available - it knows the correct paragraph
              if (lexicalDeletionPosition) {
                cursorElement.style.transform = `translate(${lexicalDeletionPosition.left}px, ${lexicalDeletionPosition.top}px)`;
                cursorElement.style.height = `${lexicalDeletionPosition.height}px`;
                cursorElement.style.display = "block";
                
                previousLeft = lexicalDeletionPosition.left;
                previousTop = lexicalDeletionPosition.top;
                wasOnNonStartLine = true;
                isUsingLexicalPosition = false;
                lastLexicalPosition = null;
                lastParagraphKey = null;
                return;
              }
              
              // If Lexical didn't work, use previousTop to maintain position
              // This ensures cursor stays on the correct line when deleting all text
              if (previousTop > 0) {
                const targetLeft = previousLeft > 0 ? previousLeft : (rootRect.left + paddingLeft);
                const targetTop = previousTop;
                const targetHeight = rect.height || lineHeight;
                
                cursorElement.style.transform = `translate(${targetLeft}px, ${targetTop}px)`;
                cursorElement.style.height = `${targetHeight}px`;
                cursorElement.style.display = "block";
                
                previousLeft = targetLeft;
                previousTop = targetTop;
                wasOnNonStartLine = true;
                isUsingLexicalPosition = false;
                lastLexicalPosition = null;
                lastParagraphKey = null;
                return;
              }
            }
            
            // PRIORITY CHECK 2: If we're at padding edge (empty line after deleting all text), ALWAYS use Lexical
            // This is the most critical case - when you delete all text on a line, stay on that line (like Enter behavior)
            if (isAtPaddingEdge && hasValidCoordinates && isWithinRootBounds) {
              // When at padding edge (empty line), ALWAYS get Lexical position for current paragraph
              // This ensures cursor stays on the correct line when deleting all text, just like Enter
              let lexicalDeletionPosition: { left: number; top: number; height: number } | null = null;
              
              try {
                editor.getEditorState().read(() => {
                  const lexicalSelection = $getSelection();
                  if (lexicalSelection && lexicalSelection.anchor) {
                    const root = $getRoot();
                    const children = root.getChildren();
                    
                    // Find current paragraph - try multiple methods
                    let targetParagraphKey: string | null = null;
                    const anchorKey = lexicalSelection.anchor.key;
                    
                    try {
                      // Method 1: Walk up from anchor node to find paragraph
                      const anchorNode = lexicalSelection.anchor.getNode();
                      if (anchorNode) {
                        let current: any = anchorNode;
                        while (current) {
                          const type = current.getType?.();
                          if (type === 'paragraph') {
                            targetParagraphKey = current.getKey();
                            break;
                          }
                          current = current.getParent?.();
                        }
                      }
                    } catch (e) {
                      // Continue
                    }
                    
                    // Method 2: Check if anchor key matches a paragraph directly
                    if (!targetParagraphKey) {
                      for (let i = 0; i < children.length; i++) {
                        const child = children[i];
                        if (child.getKey() === anchorKey) {
                          targetParagraphKey = child.getKey();
                          break;
                        }
                      }
                    }
                    
                    // Method 3: Search through all paragraphs for text nodes containing the anchor
                    if (!targetParagraphKey) {
                      for (let i = 0; i < children.length; i++) {
                        const child = children[i];
                        const searchForTextNode = (node: any): boolean => {
                          if (node.getKey() === anchorKey) return true;
                          const type = node.getType?.();
                          if (type === 'text' && node.getKey() === anchorKey) return true;
                          const nodeChildren = node.getChildren ? node.getChildren() : [];
                          return nodeChildren.some(searchForTextNode);
                        };
                        
                        if (searchForTextNode(child)) {
                          targetParagraphKey = child.getKey();
                          break;
                        }
                      }
                    }
                    
                    // Method 4: Last resort - use the last paragraph
                    if (!targetParagraphKey && children.length > 0) {
                      targetParagraphKey = children[children.length - 1].getKey();
                    }
                    
                    if (targetParagraphKey) {
                      const paragraphDOM = editor.getElementByKey(targetParagraphKey);
                      if (paragraphDOM) {
                        const blockRect = paragraphDOM.getBoundingClientRect();
                        const blockStyle = window.getComputedStyle(paragraphDOM);
                        const blockPaddingLeft = parseFloat(blockStyle.paddingLeft) || 0;
                        const blockMarginLeft = parseFloat(blockStyle.marginLeft) || 0;
                        const blockTextIndent = parseFloat(blockStyle.textIndent) || 0;
                        const blockPaddingTop = parseFloat(blockStyle.paddingTop) || 0;
                        const paragraphLineHeight = parseFloat(blockStyle.lineHeight) || parseFloat(computedStyle.lineHeight) || 28;
                        
                        lexicalDeletionPosition = {
                          left: blockRect.left + blockPaddingLeft + blockMarginLeft + blockTextIndent,
                          top: blockRect.top + blockPaddingTop,
                          height: paragraphLineHeight
                        };
                      }
                    }
                  }
                });
              } catch (e) {
                // Fall through
              }
              
              // ALWAYS use Lexical position if available when at padding edge
              // This ensures cursor stays on correct line when deleting all text
              if (lexicalDeletionPosition) {
                cursorElement.style.transform = `translate(${lexicalDeletionPosition.left}px, ${lexicalDeletionPosition.top}px)`;
                cursorElement.style.height = `${lexicalDeletionPosition.height}px`;
                cursorElement.style.display = "block";
                
                previousLeft = lexicalDeletionPosition.left;
                previousTop = lexicalDeletionPosition.top;
                wasOnNonStartLine = true;
                isUsingLexicalPosition = false;
                lastLexicalPosition = null;
                lastParagraphKey = null;
                return;
              }
              
              // Fall back to previousTop if Lexical didn't work
              if (previousTop > 0) {
                const targetLeft = previousLeft > 0 ? previousLeft : (rootRect.left + paddingLeft);
                const targetTop = previousTop;
                const targetHeight = rect.height || lineHeight;
                
                cursorElement.style.transform = `translate(${targetLeft}px, ${targetTop}px)`;
                cursorElement.style.height = `${targetHeight}px`;
                cursorElement.style.display = "block";
                
                previousLeft = targetLeft;
                previousTop = targetTop;
                wasOnNonStartLine = true;
                isUsingLexicalPosition = false;
                lastLexicalPosition = null;
                lastParagraphKey = null;
                return;
              }
            }
            
            // SECOND CHECK: If we're at horizontal start (deleting text) and were on a different line
            // SIMPLE RULE: If we're at horizontal start OR padding edge (deleting text) AND previousTop was on a different line,
            // ALWAYS use Lexical or previousTop to maintain position on the correct line
            const previousTopIsDifferent = previousTop > 0 && Math.abs(previousTop - (rootRect.top + paddingTop)) > 5;
            const isAtHorizontalStart = Math.abs(rect.left - (rootRect.left + paddingLeft)) < 5;
            
            // Check if we're deleting text (horizontal start OR padding edge) and were on a different line
            // This should catch ALL cases when deleting all text on a line but staying on that line
            // isAtPaddingEdge catches empty lines, isAtHorizontalStart catches lines with text being deleted
            const isDeletingText = (isAtHorizontalStart || isAtPaddingEdge);
            
            if (isDeletingText && previousTopIsDifferent && hasValidCoordinates && isWithinRootBounds) {
              // Try to get Lexical position for current paragraph immediately
              let lexicalDeletionPosition: { left: number; top: number; height: number } | null = null;
              
              try {
                editor.getEditorState().read(() => {
                  const lexicalSelection = $getSelection();
                  if (lexicalSelection && lexicalSelection.anchor) {
                    const root = $getRoot();
                    const children = root.getChildren();
                    
                    // Find current paragraph - try multiple methods
                    let targetParagraphKey: string | null = null;
                    const anchorKey = lexicalSelection.anchor.key;
                    
                    try {
                      // Method 1: Walk up from anchor node to find paragraph
                      const anchorNode = lexicalSelection.anchor.getNode();
                      if (anchorNode) {
                        let current: any = anchorNode;
                        while (current) {
                          const type = current.getType?.();
                          if (type === 'paragraph') {
                            targetParagraphKey = current.getKey();
                            break;
                          }
                          current = current.getParent?.();
                        }
                      }
                    } catch (e) {
                      // Continue
                    }
                    
                    // Method 2: Check if anchor key matches a paragraph directly
                    if (!targetParagraphKey) {
                      for (let i = 0; i < children.length; i++) {
                        const child = children[i];
                        if (child.getKey() === anchorKey) {
                          targetParagraphKey = child.getKey();
                          break;
                        }
                      }
                    }
                    
                    // Method 3: Search through all paragraphs for text nodes containing the anchor
                    if (!targetParagraphKey) {
                      for (let i = 0; i < children.length; i++) {
                        const child = children[i];
                        const searchForTextNode = (node: any): boolean => {
                          if (node.getKey() === anchorKey) return true;
                          const type = node.getType?.();
                          if (type === 'text' && node.getKey() === anchorKey) return true;
                          const nodeChildren = node.getChildren ? node.getChildren() : [];
                          return nodeChildren.some(searchForTextNode);
                        };
                        
                        if (searchForTextNode(child)) {
                          targetParagraphKey = child.getKey();
                          break;
                        }
                      }
                    }
                    
                    // Method 4: Last resort - use the last paragraph
                    if (!targetParagraphKey && children.length > 0) {
                      targetParagraphKey = children[children.length - 1].getKey();
                    }
                    
                    if (targetParagraphKey) {
                      const paragraphDOM = editor.getElementByKey(targetParagraphKey);
                      if (paragraphDOM) {
                        const blockRect = paragraphDOM.getBoundingClientRect();
                        const blockStyle = window.getComputedStyle(paragraphDOM);
                        const blockPaddingLeft = parseFloat(blockStyle.paddingLeft) || 0;
                        const blockMarginLeft = parseFloat(blockStyle.marginLeft) || 0;
                        const blockTextIndent = parseFloat(blockStyle.textIndent) || 0;
                        const blockPaddingTop = parseFloat(blockStyle.paddingTop) || 0;
                        const paragraphLineHeight = parseFloat(blockStyle.lineHeight) || parseFloat(computedStyle.lineHeight) || 28;
                        
                        lexicalDeletionPosition = {
                          left: blockRect.left + blockPaddingLeft + blockMarginLeft + blockTextIndent,
                          top: blockRect.top + blockPaddingTop,
                          height: paragraphLineHeight
                        };
                      }
                    }
                  }
                });
              } catch (e) {
                // Fall through
              }
              
              // If we got a Lexical position, use it immediately (trust Lexical over DOM when DOM is wrong)
              // Lexical knows which paragraph the cursor is actually in, even if DOM reports wrong position
              if (lexicalDeletionPosition) {
                // ALWAYS use Lexical position if we have it - it's the source of truth
                // This ensures cursor stays on the correct line when deleting all text on that line
                cursorElement.style.transform = `translate(${lexicalDeletionPosition.left}px, ${lexicalDeletionPosition.top}px)`;
                cursorElement.style.height = `${lexicalDeletionPosition.height}px`;
                cursorElement.style.display = "block";
                
                previousLeft = lexicalDeletionPosition.left;
                previousTop = lexicalDeletionPosition.top;
                wasOnNonStartLine = true;
                isUsingLexicalPosition = false;
                lastLexicalPosition = null;
                lastParagraphKey = null;
                return;
              }
              
              // Fall back to previous position if Lexical didn't work
              // Use previousTop to stay on correct line when deleting all text on that line
              if (previousTop > 0) {
                const targetLeft = previousLeft > 0 ? previousLeft : (rootRect.left + paddingLeft);
                const targetTop = previousTop; // Always use previousTop to maintain vertical position
                const targetHeight = rect.height || lineHeight;
                
                cursorElement.style.transform = `translate(${targetLeft}px, ${targetTop}px)`;
                cursorElement.style.height = `${targetHeight}px`;
                cursorElement.style.display = "block";
                
                // Update previousTop to maintain position (don't let it drift)
                previousLeft = targetLeft;
                previousTop = targetTop;
                wasOnNonStartLine = true;
                isUsingLexicalPosition = false;
                lastLexicalPosition = null;
                lastParagraphKey = null;
                return;
              }
            }
            
            // Check if cursor jumped back to start when we were on a different line
            // This happens after Enter when DOM selection updates incorrectly
            // But NOT if we're on the same line (which means we just deleted text on that line)
            const jumpedBackToStart = isAtStartHorizontal && wasOnNonStartLine && !isOnSameLineAsBefore &&
                                     Math.abs(previousTop - (rootRect.top + paddingTop)) > lineHeight * 0.5;
            
            // FIRST: Check if we're deleting on the same line - if so, use DOM position immediately
            // This must happen BEFORE Lexical position logic to prioritize DOM when deleting
            // This ensures the cursor follows text as it's deleted, not jumping to line start
            if (isOnSameLineAsBefore && hasValidCoordinates && isWithinRootBounds) {
              // Check if DOM is incorrectly reporting first line when we were on a different line
              const isDOMAtFirstLine = Math.abs(rect.top - (rootRect.top + paddingTop)) < 10;
              const wasOnDifferentLine = previousTop > 0 && (previousTop - (rootRect.top + paddingTop)) > lineHeight * 0.5;
              const isDOMAtStartHorizontally = Math.abs(rect.left - (rootRect.left + paddingLeft)) < 5;
              
              // If DOM incorrectly reports first line (both vertical and horizontal), use Lexical or previous position
              // This prevents cursor from jumping to first line when deleting on other lines
              if (isDOMAtFirstLine && wasOnDifferentLine && isDOMAtStartHorizontally) {
                // DOM is completely wrong - try to get Lexical position for the current paragraph
                let useLexicalForDeletion = false;
                let lexicalDeletionPosition: { left: number; top: number; height: number } | null = null;
                
                try {
                  editor.getEditorState().read(() => {
                    const lexicalSelection = $getSelection();
                    if (lexicalSelection && lexicalSelection.anchor) {
                      const root = $getRoot();
                      const children = root.getChildren();
                      
                      // Find current paragraph
                      let targetParagraphKey: string | null = null;
                      try {
                        const anchorNode = lexicalSelection.anchor.getNode();
                        if (anchorNode) {
                          let current: any = anchorNode;
                          while (current) {
                            const type = current.getType?.();
                            if (type === 'paragraph') {
                              targetParagraphKey = current.getKey();
                              break;
                            }
                            current = current.getParent?.();
                          }
                        }
                      } catch (e) {
                        // Continue
                      }
                      
                      if (targetParagraphKey) {
                        const paragraphDOM = editor.getElementByKey(targetParagraphKey);
                        if (paragraphDOM) {
                          const blockRect = paragraphDOM.getBoundingClientRect();
                          const blockStyle = window.getComputedStyle(paragraphDOM);
                          const blockPaddingLeft = parseFloat(blockStyle.paddingLeft) || 0;
                          const blockMarginLeft = parseFloat(blockStyle.marginLeft) || 0;
                          const blockTextIndent = parseFloat(blockStyle.textIndent) || 0;
                          const blockPaddingTop = parseFloat(blockStyle.paddingTop) || 0;
                          const paragraphLineHeight = parseFloat(blockStyle.lineHeight) || parseFloat(computedStyle.lineHeight) || 28;
                          
                          lexicalDeletionPosition = {
                            left: blockRect.left + blockPaddingLeft + blockMarginLeft + blockTextIndent,
                            top: blockRect.top + blockPaddingTop,
                            height: paragraphLineHeight
                          };
                          
                          // Always use Lexical if we found a paragraph - it knows the correct position
                          useLexicalForDeletion = true;
                        }
                      }
                    }
                  });
                } catch (e) {
                  // Fall through to previous position
                }
                
                if (useLexicalForDeletion && lexicalDeletionPosition) {
                  // Use Lexical position for deletion - it knows the correct paragraph
                  // This ensures cursor stays on the correct line when deleting all text on that line
                  const targetLeft = lexicalDeletionPosition.left;
                  const targetTop = lexicalDeletionPosition.top;
                  const targetHeight = lexicalDeletionPosition.height;
                  
                  cursorElement.style.transform = `translate(${targetLeft}px, ${targetTop}px)`;
                  cursorElement.style.height = `${targetHeight}px`;
                  cursorElement.style.display = "block";
                  
                  previousLeft = targetLeft;
                  previousTop = targetTop;
                  wasOnNonStartLine = true;
                  isUsingLexicalPosition = false;
                  lastLexicalPosition = null;
                  lastParagraphKey = null;
                  return;
                } else {
                  // Fall back to previous position - maintain vertical position to stay on same line
                  const targetLeft = previousLeft > 0 ? previousLeft : (rootRect.left + paddingLeft);
                  const targetTop = previousTop;
                  const targetHeight = rect.height || lineHeight;
                  
                  cursorElement.style.transform = `translate(${targetLeft}px, ${targetTop}px)`;
                  cursorElement.style.height = `${targetHeight}px`;
                  cursorElement.style.display = "block";
                  
                  // Don't update previousLeft/previousTop - maintain correct position
                  wasOnNonStartLine = true;
                  isUsingLexicalPosition = false;
                  lastLexicalPosition = null;
                  lastParagraphKey = null;
                  return;
                }
              }
              
              // Otherwise, use DOM position to follow text as it's deleted (real-time tracking)
              // BUT: If we're at horizontal start (deleting text) and were on a different line,
              // ALWAYS use previousTop for vertical position to stay on the correct line
              const targetLeft = rect.left; // Always use DOM for horizontal to follow text
              
              // If deleting all text on a line (horizontal start) and were on different line, use previousTop
              // This ensures cursor stays on the same line when deleting all text, like Enter behavior
              const shouldUsePreviousTop = isDOMAtStartHorizontally && previousTopIsDifferent && 
                                          !isCloseToPreviousTop;
              
              const targetTop = shouldUsePreviousTop ? previousTop : 
                               ((isDOMAtFirstLine && wasOnDifferentLine) ? previousTop : rect.top);
              const targetHeight = rect.height || lineHeight;
              
              cursorElement.style.transform = `translate(${targetLeft}px, ${targetTop}px)`;
              cursorElement.style.height = `${targetHeight}px`;
              cursorElement.style.display = "block";
              
              previousLeft = targetLeft;
              previousTop = targetTop;
              wasOnNonStartLine = true;
              isUsingLexicalPosition = false; // Switch to DOM for deletion tracking
              lastLexicalPosition = null;
              lastParagraphKey = null;
              return;
            }
            
            // ALWAYS get Lexical position when DOM is at start (horizontally) or padding edge
            // OR if we're already using Lexical position (persist it)
            // BUT NOT if we're on the same line as before (just deleted text on that line)
            // This ensures we can detect when DOM is wrong and Lexical is correct
            const shouldCompareWithLexical = (isAtPaddingEdge || justPressedEnter || (isAtStartHorizontal && !isOnSameLineAsBefore) || jumpedBackToStart || (isUsingLexicalPosition && !isOnSameLineAsBefore));
            
            let lexicalPosition: { left: number; top: number; height: number } | null = null;
            let currentParagraphKey: string | null = null;
            if (shouldCompareWithLexical) {
              try {
                editor.getEditorState().read(() => {
                  const lexicalSelection = $getSelection();
                  if (lexicalSelection && lexicalSelection.anchor) {
                    const root = $getRoot();
                    const children = root.getChildren();
                    
                    let targetParagraphKey: string | null = null;
                    
                    try {
                      const anchorNode = lexicalSelection.anchor.getNode();
                      if (anchorNode) {
                        let current: any = anchorNode;
                        while (current) {
                          const type = current.getType?.();
                          if (type === 'paragraph') {
                            targetParagraphKey = current.getKey();
                            break;
                          }
                          current = current.getParent?.();
                        }
                      }
                    } catch (e) {
                      // Continue
                    }
                    
                    if (!targetParagraphKey) {
                      const anchorKey = lexicalSelection.anchor.key;
                      for (let i = 0; i < children.length; i++) {
                        const child = children[i];
                        if (child.getKey() === anchorKey) {
                          targetParagraphKey = child.getKey();
                          break;
                        }
                      }
                    }
                    
                    if (!targetParagraphKey && children.length > 0) {
                      targetParagraphKey = children[children.length - 1].getKey();
                    }
                    
                    // Store the current paragraph key for tracking changes
                    currentParagraphKey = targetParagraphKey;
                    
                    if (targetParagraphKey) {
                      const paragraphDOM = editor.getElementByKey(targetParagraphKey);
                      if (paragraphDOM) {
                        const blockRect = paragraphDOM.getBoundingClientRect();
                        const blockStyle = window.getComputedStyle(paragraphDOM);
                        const blockPaddingLeft = parseFloat(blockStyle.paddingLeft) || 0;
                        const blockMarginLeft = parseFloat(blockStyle.marginLeft) || 0;
                        const blockTextIndent = parseFloat(blockStyle.textIndent) || 0;
                        const blockPaddingTop = parseFloat(blockStyle.paddingTop) || 0;
                        const lineHeight = parseFloat(blockStyle.lineHeight) || parseFloat(computedStyle.lineHeight) || 28;
                        
                        lexicalPosition = {
                          left: blockRect.left + blockPaddingLeft + blockMarginLeft + blockTextIndent,
                          top: blockRect.top + blockPaddingTop,
                          height: lineHeight
                        };
                      }
                    }
                  }
                });
              } catch (e) {
                // Continue
              }
            }
            
            // Smart decision: compare DOM and Lexical positions
            // If Enter was just pressed and DOM position is at start but Lexical is on a different line, use Lexical
            // Otherwise, prefer DOM for real-time tracking
            const isValidPosition = 
              hasValidCoordinates && 
              isWithinRootBounds &&
              (rect.left !== 0 || rect.top !== 0 || 
               (rootRect.left === 0 && rootRect.top === 0)) &&
              !isAtPaddingEdge;
            
            // Smart decision logic:
            // 1. If DOM is at start but Lexical is on different line → always use Lexical (DOM is wrong)
            // 2. If Enter was just pressed → prefer Lexical
            // 3. If DOM position is valid and not suspicious → use DOM (for real-time typing)
            // 4. Otherwise → use Lexical if available
            
            if (lexicalPosition && shouldCompareWithLexical) {
              // We have Lexical position - check if DOM is suspicious
              const verticalDiff = Math.abs(rect.top - lexicalPosition.top);
              const isDifferentLine = verticalDiff > parseFloat(computedStyle.lineHeight) * 0.5;
              const lexicalIsNotAtStart = Math.abs(lexicalPosition.left - (rootRect.left + paddingLeft)) > 5;
              
              // If DOM is at start horizontally but Lexical is NOT at start, ALWAYS use Lexical
              // This prevents cursor from jumping back to start after Enter
              // This is the key fix - if DOM says start but Lexical says elsewhere, trust Lexical
              if (isAtStartHorizontal && lexicalIsNotAtStart) {
                cursorElement.style.transform = `translate(${lexicalPosition.left}px, ${lexicalPosition.top}px)`;
                cursorElement.style.height = `${lexicalPosition.height}px`;
                cursorElement.style.display = "block";
                
                previousLeft = lexicalPosition.left;
                previousTop = lexicalPosition.top;
                wasOnNonStartLine = true;
                isUsingLexicalPosition = true; // Persist Lexical usage
                lastLexicalPosition = lexicalPosition;
                lastParagraphKey = currentParagraphKey;
                return;
              }
              
              // If DOM is at start and Lexical is on different line, ALWAYS use Lexical
              if (isAtStart && isDifferentLine) {
                cursorElement.style.transform = `translate(${lexicalPosition.left}px, ${lexicalPosition.top}px)`;
                cursorElement.style.height = `${lexicalPosition.height}px`;
                cursorElement.style.display = "block";
                
                previousLeft = lexicalPosition.left;
                previousTop = lexicalPosition.top;
                wasOnNonStartLine = true;
                isUsingLexicalPosition = true;
                lastLexicalPosition = lexicalPosition;
                lastParagraphKey = currentParagraphKey;
                return;
              }
              
              // If Enter was just pressed or jumped back, prefer Lexical
              if (justPressedEnter || jumpedBackToStart || isAtPaddingEdge) {
                cursorElement.style.transform = `translate(${lexicalPosition.left}px, ${lexicalPosition.top}px)`;
                cursorElement.style.height = `${lexicalPosition.height}px`;
                cursorElement.style.display = "block";
                
                previousLeft = lexicalPosition.left;
                previousTop = lexicalPosition.top;
                wasOnNonStartLine = true;
                isUsingLexicalPosition = true;
                lastLexicalPosition = lexicalPosition;
                lastParagraphKey = currentParagraphKey;
                return;
              }
              
              // If we're already using Lexical position, check if we should update it
              if (isUsingLexicalPosition && lastLexicalPosition) {
                // Check if paragraph changed (indicates deletion/movement to different line)
                const paragraphChanged = currentParagraphKey && lastParagraphKey && currentParagraphKey !== lastParagraphKey;
                
                const domLexicalDiff = Math.abs(rect.top - lastLexicalPosition.top);
                
                // Update Lexical position if paragraph changed or position changed significantly
                const lexicalVerticalDiff = Math.abs(lexicalPosition.top - lastLexicalPosition.top);
                if (paragraphChanged || lexicalVerticalDiff > parseFloat(computedStyle.lineHeight) * 0.3) {
                  // Lexical position changed significantly - user deleted/moved, update position
                  isUsingLexicalPosition = true;
                  lastLexicalPosition = lexicalPosition;
                  lastParagraphKey = currentParagraphKey;
                  cursorElement.style.transform = `translate(${lexicalPosition.left}px, ${lexicalPosition.top}px)`;
                  cursorElement.style.height = `${lexicalPosition.height}px`;
                  cursorElement.style.display = "block";
                  
                  previousLeft = lexicalPosition.left;
                  previousTop = lexicalPosition.top;
                  wasOnNonStartLine = !isAtStartHorizontal;
                  return;
                }
                
                // If DOM position is valid and not at start, and significantly different from old Lexical
                // This happens when user deletes and cursor moves to previous line
                // Also check if DOM is moving upward (deletion case)
                const domMovedUp = rect.top < lastLexicalPosition.top - parseFloat(computedStyle.lineHeight) * 0.3;
                if (isValidPosition && !isAtStartHorizontal && 
                    (domLexicalDiff > parseFloat(computedStyle.lineHeight) * 0.3 || domMovedUp)) {
                  // DOM moved significantly - user probably deleted text, switch to DOM
                  isUsingLexicalPosition = false;
                  lastLexicalPosition = null;
                  lastParagraphKey = null;
                  const targetLeft = rect.left;
                  const targetTop = rect.top;
                  const targetHeight = rect.height || parseFloat(computedStyle.lineHeight) || 28;
                  
                  cursorElement.style.transform = `translate(${targetLeft}px, ${targetTop}px)`;
                  cursorElement.style.height = `${targetHeight}px`;
                  cursorElement.style.display = "block";
                  
                  previousLeft = targetLeft;
                  previousTop = targetTop;
                  wasOnNonStartLine = true;
                  return;
                }
                
                // If DOM position is close to Lexical and valid, switch to DOM for real-time tracking
                if (domLexicalDiff < parseFloat(computedStyle.lineHeight) * 0.3 && isValidPosition && !isAtStartHorizontal) {
                  // DOM position is close to Lexical - user probably typed, switch to DOM
                  isUsingLexicalPosition = false;
                  lastLexicalPosition = null;
                  lastParagraphKey = null;
                } else if (isAtStartHorizontal && !isOnSameLineAsBefore) {
                  // DOM says start and we're NOT on the same line - keep using Lexical (likely jumped)
                  cursorElement.style.transform = `translate(${lastLexicalPosition.left}px, ${lastLexicalPosition.top}px)`;
                  cursorElement.style.height = `${lastLexicalPosition.height}px`;
                  cursorElement.style.display = "block";
                  return;
                } else if (isAtStartHorizontal && isOnSameLineAsBefore) {
                  // DOM says start but we're on the same line - deleted text on that line, switch to DOM
                  isUsingLexicalPosition = false;
                  lastLexicalPosition = null;
                  lastParagraphKey = null;
                  // Fall through to use DOM position below
                }
              }
            }
            
            // FINAL CHECK: If we're at horizontal start (deleting text) and were on a different line,
            // ALWAYS use previousTop to maintain position on the correct line
            // This is a final fallback before using DOM position to ensure cursor stays on same line
            if (isAtStartHorizontal && previousTopIsDifferent && !isCloseToPreviousTop && previousTop > 0) {
              // We're deleting text on a line - use previousTop to stay on that line (like Enter behavior)
              const targetLeft = previousLeft > 0 ? previousLeft : (rootRect.left + paddingLeft);
              const targetTop = previousTop;
              const targetHeight = rect.height || lineHeight;
              
              cursorElement.style.transform = `translate(${targetLeft}px, ${targetTop}px)`;
              cursorElement.style.height = `${targetHeight}px`;
              cursorElement.style.display = "block";
              
              // Update previousTop to maintain position (prevent drift)
              previousLeft = targetLeft;
              previousTop = targetTop;
              wasOnNonStartLine = true;
              isUsingLexicalPosition = false;
              lastLexicalPosition = null;
              lastParagraphKey = null;
              return;
            }
            
            // Use DOM position for normal typing (real-time tracking)
            // Only if not at start horizontally AND not currently using Lexical
            if (isValidPosition && !isAtStartHorizontal && !isUsingLexicalPosition) {
              const targetLeft = rect.left;
              const targetTop = rect.top;
              const targetHeight = rect.height || parseFloat(computedStyle.lineHeight) || 28;
              
              cursorElement.style.transform = `translate(${targetLeft}px, ${targetTop}px)`;
              cursorElement.style.height = `${targetHeight}px`;
              cursorElement.style.display = "block";
              
              previousLeft = targetLeft;
              previousTop = targetTop;
              wasOnNonStartLine = true; // Track that we're not at start
              isUsingLexicalPosition = false; // Clear Lexical usage when using DOM
              lastLexicalPosition = null;
              lastParagraphKey = null;
              return;
            }
            
            // If we're using Lexical and it's still available, keep using it
            if (isUsingLexicalPosition && lastLexicalPosition) {
              cursorElement.style.transform = `translate(${lastLexicalPosition.left}px, ${lastLexicalPosition.top}px)`;
              cursorElement.style.height = `${lastLexicalPosition.height}px`;
            cursorElement.style.display = "block";
            return;
            }
            
            // Fallback: if we have Lexical position but DOM is invalid, use Lexical
            if (lexicalPosition && shouldCompareWithLexical) {
              cursorElement.style.transform = `translate(${lexicalPosition.left}px, ${lexicalPosition.top}px)`;
              cursorElement.style.height = `${lexicalPosition.height}px`;
              cursorElement.style.display = "block";
              
              previousLeft = lexicalPosition.left;
              previousTop = lexicalPosition.top;
              wasOnNonStartLine = true;
              isUsingLexicalPosition = true;
              lastLexicalPosition = lexicalPosition;
              lastParagraphKey = currentParagraphKey;
              return;
            }
            
            // If Enter was just pressed but we don't have Lexical position yet, use DOM with fallback
            // This ensures cursor is always visible after Enter, even if Lexical calculation fails
            if (justPressedEnter && !lexicalPosition) {
              // Try to use DOM position if valid, otherwise calculate a fallback based on previous position
              if (isValidPosition) {
                const targetLeft = rect.left;
                const targetTop = rect.top;
                const targetHeight = rect.height || parseFloat(computedStyle.lineHeight) || 28;
                
                cursorElement.style.transform = `translate(${targetLeft}px, ${targetTop}px)`;
                cursorElement.style.height = `${targetHeight}px`;
                cursorElement.style.display = "block";
                
                previousLeft = targetLeft;
                previousTop = targetTop;
                wasOnNonStartLine = true;
                return;
              } else if (previousTop > 0 && previousLeft > 0) {
                // Calculate position on next line based on previous position
                const lineHeight = parseFloat(computedStyle.lineHeight) || 28;
                const estimatedTop = previousTop + lineHeight;
                
                cursorElement.style.transform = `translate(${previousLeft}px, ${estimatedTop}px)`;
                cursorElement.style.height = `${lineHeight}px`;
                cursorElement.style.display = "block";
                
                previousLeft = previousLeft;
                previousTop = estimatedTop;
                wasOnNonStartLine = true;
                return;
              }
            }
            
            // Last resort fallback to Lexical when DOM fails
            if (isAtPaddingEdge || justPressedEnter) {
              // When at padding edge (empty line) or just pressed Enter, 
              // use Lexical's selection API to find the correct paragraph
              try {
                editor.getEditorState().read(() => {
                  const lexicalSelection = $getSelection();
                  if (lexicalSelection && lexicalSelection.anchor) {
                    const root = $getRoot();
                    const children = root.getChildren();
                    
                    // Find which paragraph contains the selection
                    let targetParagraphKey: string | null = null;
                    
                    try {
                      // First, try to get the node from anchor and walk up to find paragraph
                      const anchorNode = lexicalSelection.anchor.getNode();
                      if (anchorNode) {
                        let current: any = anchorNode;
                        // Walk up the tree to find paragraph parent
                        while (current) {
                          const type = current.getType?.();
                          if (type === 'paragraph') {
                            targetParagraphKey = current.getKey();
                            break;
                          }
                          current = current.getParent?.();
                        }
                      }
                    } catch (e) {
                      // Continue with fallback methods
                    }
                    
                    // If not found by walking up, check if anchor key matches a paragraph directly
                    if (!targetParagraphKey) {
                      const anchorKey = lexicalSelection.anchor.key;
                      for (let i = 0; i < children.length; i++) {
                        const child = children[i];
                        if (child.getKey() === anchorKey) {
                          targetParagraphKey = child.getKey();
                          break;
                        }
                      }
                    }
                    
                    // If still not found, search through all paragraphs for text nodes containing the anchor
                    if (!targetParagraphKey) {
                      const anchorKey = lexicalSelection.anchor.key;
                      for (let i = 0; i < children.length; i++) {
                        const child = children[i];
                        
                        // Recursively search for text nodes
                        const searchForTextNode = (node: any): boolean => {
                          if (node.getKey() === anchorKey) return true;
                          const type = node.getType?.();
                          if (type === 'text' && node.getKey() === anchorKey) return true;
                          const nodeChildren = node.getChildren ? node.getChildren() : [];
                          return nodeChildren.some(searchForTextNode);
                        };
                        
                        if (searchForTextNode(child)) {
                          targetParagraphKey = child.getKey();
                          break;
                        }
                      }
                    }
                    
                    // Last resort: use the last paragraph (most likely where cursor is after Enter)
                    if (!targetParagraphKey && children.length > 0) {
                      targetParagraphKey = children[children.length - 1].getKey();
                    }
                    
                    // Get the DOM element for the target paragraph
                    if (targetParagraphKey) {
                      const paragraphDOM = editor.getElementByKey(targetParagraphKey);
                      
                      if (paragraphDOM) {
                        const blockRect = paragraphDOM.getBoundingClientRect();
                        const blockStyle = window.getComputedStyle(paragraphDOM);
                        
                        // Calculate position based on paragraph element
                        const blockPaddingLeft = parseFloat(blockStyle.paddingLeft) || 0;
                        const blockMarginLeft = parseFloat(blockStyle.marginLeft) || 0;
                        const blockTextIndent = parseFloat(blockStyle.textIndent) || 0;
                        const blockPaddingTop = parseFloat(blockStyle.paddingTop) || 0;
                        const lineHeight = parseFloat(blockStyle.lineHeight) || parseFloat(computedStyle.lineHeight) || 28;
                        
                        const targetLeft = blockRect.left + blockPaddingLeft + blockMarginLeft + blockTextIndent;
                        const targetTop = blockRect.top + blockPaddingTop;
                        
                        // Use transform for smooth positioning
                        cursorElement.style.transform = `translate(${targetLeft}px, ${targetTop}px)`;
                        cursorElement.style.height = `${lineHeight}px`;
                        cursorElement.style.display = "block";
                        
                        previousLeft = targetLeft;
                        previousTop = targetTop;
                        return;
                      }
                    }
                  }
                });
              } catch (e) {
                // Fall through to default positioning
              }
              
              // If Enter was pressed but Lexical calculation failed, use fallback position
              // This ensures cursor is ALWAYS visible after Enter
              if (justPressedEnter && previousTop > 0 && previousLeft > 0) {
                const lineHeight = parseFloat(computedStyle.lineHeight) || 28;
                const estimatedTop = previousTop + lineHeight;
                
                cursorElement.style.transform = `translate(${previousLeft}px, ${estimatedTop}px)`;
                cursorElement.style.height = `${lineHeight}px`;
                cursorElement.style.display = "block";
                
                previousLeft = previousLeft;
                previousTop = estimatedTop;
                wasOnNonStartLine = true;
                return;
              }
            }
          }
        }
        
        // If no valid selection, position cursor at the start of content editable
        // This handles the empty editor case
        const targetLeft = rootRect.left + paddingLeft;
        const targetTop = rootRect.top + paddingTop;
        const targetHeight = parseFloat(computedStyle.lineHeight) || 28;
        
        cursorElement.style.transform = `translate(${targetLeft}px, ${targetTop}px)`;
        cursorElement.style.height = `${targetHeight}px`;
        cursorElement.style.display = "block";
        
        previousLeft = targetLeft;
        previousTop = targetTop;
      } catch (error) {
        // If anything fails, hide the cursor
        cursorElement.style.display = "none";
      }
    };

    // Update cursor position on Lexical updates
    const removeUpdateListener = editor.registerUpdateListener(() => {
      // Use requestAnimationFrame to update after DOM changes
      // If Enter was just pressed, add extra delay to ensure DOM is fully updated
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      
      // Longer delay after Enter to allow new paragraph DOM to be created
      const delay = justPressedEnter ? 150 : 0;
      
      animationFrameRef.current = requestAnimationFrame(() => {
        setTimeout(() => {
        updateCursorPosition();
        }, delay);
      });
    });

    // Also listen to native selection changes for real-time updates
    const handleSelectionChange = () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      animationFrameRef.current = requestAnimationFrame(() => {
        updateCursorPosition();
      });
    };

    document.addEventListener("selectionchange", handleSelectionChange);

    // Initial update
    updateCursorPosition();

    // Also update on scroll
    const handleScroll = () => {
      updateCursorPosition();
    };
    const rootElement = editor.getRootElement();
    rootElement?.addEventListener("scroll", handleScroll, true);

    // Update periodically to catch any missed updates
    const interval = setInterval(updateCursorPosition, 100);

    // Move cursor to end of document on initial load if content exists
    if (!hasInitializedCursorRef.current) {
      // Use setTimeout to ensure editor is fully mounted and updateCursorPosition is defined
      setTimeout(() => {
        editor.update(() => {
          const root = $getRoot();
          const children = root.getChildren();
          
          if (children.length === 0) {
            // Empty editor, don't move cursor
            hasInitializedCursorRef.current = true;
            return;
          }
          
          // Find the last node with content
          let lastNode = children[children.length - 1];
          
          // If last node is empty (like a trailing paragraph), try previous nodes
          while (lastNode && lastNode.getTextContent().trim().length === 0 && children.length > 1) {
            const index = children.indexOf(lastNode);
            if (index > 0) {
              lastNode = children[index - 1];
            } else {
              break;
            }
          }
          
          // Move selection to end of last node with content
          if (lastNode) {
            try {
              lastNode.selectEnd();
              hasInitializedCursorRef.current = true;
            } catch (error) {
              // Fallback: select at the end of root using selection API
              const selection = $createRangeSelection();
              selection.anchor.set(root.getKey(), root.getChildrenSize(), 'element');
              selection.focus.set(root.getKey(), root.getChildrenSize(), 'element');
              $setSelection(selection);
              hasInitializedCursorRef.current = true;
            }
          }
        });
        
        // Force cursor position update after selection is set
        setTimeout(() => {
          updateCursorPosition();
        }, 50);
      }, 200);
    }

    return () => {
      removeUpdateListener();
      document.removeEventListener("selectionchange", handleSelectionChange);
      rootElement?.removeEventListener("scroll", handleScroll, true);
      rootElementForKeys?.removeEventListener('keydown', handleKeyDown, true);
      clearInterval(interval);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (cursorElement.parentNode) {
        cursorElement.parentNode.removeChild(cursorElement);
      }
    };
  }, [editor]);

  return null;
}

