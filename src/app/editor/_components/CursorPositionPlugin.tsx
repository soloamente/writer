"use client";

import { useEffect, useRef } from "react";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  $getSelection,
  $isRangeSelection,
  $setSelection,
  $createRangeSelection,
  $getRoot,
  $getNodeByKey,
  COMMAND_PRIORITY_LOW,
} from "lexical";
import { SELECTION_CHANGE_COMMAND } from "lexical";

const STORAGE_KEY_PREFIX = "writer-cursor-position-";

/**
 * Get the storage key for a document's cursor position
 */
function getStorageKey(documentId: string): string {
  return `${STORAGE_KEY_PREFIX}${documentId}`;
}

/**
 * Get text offset from root for a given selection
 * Traverses all text nodes to calculate the absolute character offset
 */
function getTextOffset(selection: ReturnType<typeof $getSelection>): number | null {
  if (!$isRangeSelection(selection)) {
    return null;
  }

  const root = $getRoot();
  const focus = selection.focus;
  const targetKey = focus.key;
  
  // Traverse all nodes and calculate offset
  let offset = 0;
  let found = false;
  
  function traverseNode(node: any): void {
    if (found) return;
    
    const nodeKey = node.getKey();
    const nodeType = node.getType();
    
    // If this is a text node
    if (nodeType === "text") {
      if (nodeKey === targetKey) {
        // Found the target node, add the offset within it
        offset += focus.offset;
        found = true;
        return;
      } else {
        // Add the full length of this text node
        const textSize = node.getTextContentSize?.() ?? 0;
        offset += textSize;
      }
    } else {
      // For non-text nodes, check if they have children
      if (typeof node.getChildren === "function") {
        const children = node.getChildren();
        for (const child of children) {
          traverseNode(child);
          if (found) return;
        }
        
        // Add newline after block nodes (except the last one)
        if (nodeType !== "root" && children.length > 0) {
          offset += 1; // Newline character
        }
      } else {
        // Node doesn't have children, try to get text content size if available
        const textSize = node.getTextContentSize?.() ?? 0;
        offset += textSize;
      }
    }
  }
  
  traverseNode(root);
  return found ? offset : null;
}

/**
 * Set selection to a text offset position
 * Traverses text nodes to find the correct position
 */
function setSelectionToOffset(offset: number): boolean {
  const root = $getRoot();
  let currentOffset = 0;
  let targetNode: any = null;
  let targetOffset = 0;
  
  function traverseNode(node: any): boolean {
    const nodeType = node.getType();
    
    // If this is a text node
    if (nodeType === "text") {
      const nodeLength = node.getTextContentSize?.() ?? 0;
      
      if (currentOffset + nodeLength >= offset) {
        // Found the node containing the offset
        targetNode = node;
        targetOffset = offset - currentOffset;
        return true;
      } else {
        // Add the full length of this text node
        currentOffset += nodeLength;
        return false;
      }
    } else {
      // For non-text nodes, check if they have children
      if (typeof node.getChildren === "function") {
        const children = node.getChildren();
        for (let i = 0; i < children.length; i++) {
          const child = children[i];
          if (traverseNode(child)) {
            return true;
          }
          // Add newline after block nodes (except the last one)
          if (i < children.length - 1 && child.getType() !== "text") {
            currentOffset += 1; // Newline character
          }
        }
        return false;
      } else {
        // Node doesn't have children, try to get text content size if available
        const nodeLength = node.getTextContentSize?.() ?? 0;
        if (currentOffset + nodeLength >= offset) {
          // This node contains the offset, but it's not a text node
          // Try to select at the end of this node
          if (typeof node.selectEnd === "function") {
            targetNode = node;
            targetOffset = nodeLength;
            return true;
          }
        } else {
          currentOffset += nodeLength;
        }
        return false;
      }
    }
  }
  
  if (traverseNode(root) && targetNode) {
    try {
      const nodeType = targetNode.getType();
      const nodeKey = targetNode.getKey();
      
      // If it's a text node, set selection normally
      if (nodeType === "text") {
        const selection = $createRangeSelection();
        const nodeLength = targetNode.getTextContentSize?.() ?? 0;
        const clampedOffset = Math.min(Math.max(0, targetOffset), nodeLength);
        
        selection.anchor.set(nodeKey, clampedOffset, "text");
        selection.focus.set(nodeKey, clampedOffset, "text");
        $setSelection(selection);
        return true;
      } else {
        // For non-text nodes, try to select at the end
        if (typeof targetNode.selectEnd === "function") {
          targetNode.selectEnd();
          return true;
        }
        // Fallback: try to get first text node child
        if (typeof targetNode.getChildren === "function") {
          const children = targetNode.getChildren();
          if (children.length > 0) {
            const firstChild = children[0];
            if (firstChild.getType() === "text") {
              const selection = $createRangeSelection();
              selection.anchor.set(firstChild.getKey(), 0, "text");
              selection.focus.set(firstChild.getKey(), 0, "text");
              $setSelection(selection);
              return true;
            }
          }
        }
      }
    } catch (error) {
      // Fallback: select end of the last node
      try {
        if (typeof root.getChildren === "function") {
          const children = root.getChildren();
          if (children.length > 0) {
            const lastChild = children[children.length - 1];
            if (lastChild && typeof lastChild.selectEnd === "function") {
              lastChild.selectEnd();
              return true;
            }
          }
        }
      } catch {
        // Ignore errors
      }
    }
  } else {
    // Offset is beyond the document, select end
    try {
      if (typeof root.getChildren === "function") {
        const children = root.getChildren();
        if (children.length > 0) {
          const lastChild = children[children.length - 1];
          if (lastChild && typeof lastChild.selectEnd === "function") {
            lastChild.selectEnd();
            return true;
          }
        }
      }
    } catch {
      // Ignore errors
    }
  }
  
  return false;
}

/**
 * Sync Lexical selection to DOM selection
 * This ensures TextCaret component can detect the selection
 */
function syncSelectionToDOM(editor: any): boolean {
  try {
    const rootElement = editor.getRootElement();
    if (!rootElement) {
      return false;
    }

    const contentEditable = rootElement.querySelector(
      '[contenteditable="true"]',
    ) as HTMLElement;
    
    if (!contentEditable) {
      return false;
    }

    let domNode: Node | null = null;
    let domOffset = 0;

    editor.getEditorState().read(() => {
      const lexicalSelection = $getSelection();
      if (!$isRangeSelection(lexicalSelection)) {
        return;
      }

      const anchor = lexicalSelection.anchor;
      const anchorNode = $getNodeByKey(anchor.key);
      
      if (!anchorNode) {
        return;
      }

      const nodeType = anchorNode.getType();
      
      if (nodeType === "text") {
        // For text nodes, find the corresponding DOM text node
        // We'll traverse the DOM and match by text content and position
        const root = $getRoot();
        const children = root.getChildren();
        
        // Find which paragraph contains this text node
        let targetParagraph: any = null;
        let textOffsetInParagraph = 0;
        
        for (const child of children) {
          const childAny = child as any;
          if (typeof childAny.getChildren === "function") {
            const paragraphChildren = childAny.getChildren();
            let foundInParagraph = false;
            
            for (const paraChild of paragraphChildren) {
              if (paraChild.getKey() === anchor.key) {
                targetParagraph = child;
                textOffsetInParagraph = anchor.offset;
                foundInParagraph = true;
                break;
              } else if (paraChild.getType() === "text") {
                textOffsetInParagraph += paraChild.getTextContentSize?.() ?? 0;
              }
            }
            
            if (foundInParagraph) break;
          }
        }
        
        // Now find the DOM paragraph element
        if (targetParagraph) {
          const paragraphKey = targetParagraph.getKey();
          const paragraphElements = contentEditable.querySelectorAll("p");
          
          // Try to find paragraph by index (approximate)
          const paragraphIndex = children.indexOf(targetParagraph);
          if (paragraphIndex >= 0 && paragraphIndex < paragraphElements.length) {
            const domParagraph = paragraphElements[paragraphIndex];
            
            if (domParagraph) {
              // Find the text node within this paragraph
              const walker = document.createTreeWalker(
                domParagraph,
                NodeFilter.SHOW_TEXT,
              );
              
              let currentOffset = 0;
              while (walker.nextNode()) {
                const textNode = walker.currentNode;
                const textLength = textNode.textContent?.length ?? 0;
                
                if (textOffsetInParagraph >= currentOffset && textOffsetInParagraph <= currentOffset + textLength) {
                  domNode = textNode;
                  domOffset = textOffsetInParagraph - currentOffset;
                  break;
                }
                
                currentOffset += textLength;
              }
            }
          }
        }
      }
    });

    // If we found a DOM node, set the selection
    if (domNode && domNode.textContent !== null) {
      const domSelection = window.getSelection();
      if (domSelection) {
        const range = document.createRange();
        const textLength = domNode.textContent.length;
        const offset = Math.min(Math.max(0, domOffset), textLength);
        
        range.setStart(domNode, offset);
        range.setEnd(domNode, offset);
        range.collapse(true);
        
        domSelection.removeAllRanges();
        domSelection.addRange(range);
        return true;
      }
    }
    
    return false;
  } catch (error) {
    // Ignore errors - DOM sync is best effort
    console.warn("Failed to sync selection to DOM:", error);
    return false;
  }
}

/**
 * Serialize selection position to a storable format
 * Uses text offset instead of node keys for reliability
 */
function serializeSelection(selection: ReturnType<typeof $getSelection>): number | null {
  if (!$isRangeSelection(selection)) {
    return null;
  }

  return getTextOffset(selection);
}

/**
 * Save cursor position to localStorage
 */
function saveCursorPosition(documentId: string, offset: number): void {
  try {
    const storageKey = getStorageKey(documentId);
    localStorage.setItem(storageKey, JSON.stringify(offset));
  } catch (error) {
    // Ignore localStorage errors (e.g., quota exceeded, private browsing)
    console.warn("Failed to save cursor position:", error);
  }
}

/**
 * Load cursor position from localStorage
 */
function loadCursorPosition(documentId: string): number | null {
  try {
    const storageKey = getStorageKey(documentId);
    const stored = localStorage.getItem(storageKey);
    if (!stored) {
      return null;
    }
    const offset = JSON.parse(stored);
    return typeof offset === "number" ? offset : null;
  } catch (error) {
    // Ignore localStorage errors
    console.warn("Failed to load cursor position:", error);
    return null;
  }
}

/**
 * CursorPositionPlugin tracks and restores cursor position
 * Saves cursor position to localStorage when selection changes
 * Restores cursor position when document loads
 */
export function CursorPositionPlugin({
  documentId,
  onHasSavedPosition,
}: {
  documentId: string;
  onHasSavedPosition?: (hasSaved: boolean) => void;
}) {
  const [editor] = useLexicalComposerContext();
  const hasRestoredRef = useRef(false);
  const isRestoringRef = useRef(false);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryCountRef = useRef(0);

  // Restore cursor position on initial load
  useEffect(() => {
    console.log("[CursorPositionPlugin] useEffect called, documentId:", documentId, "hasRestored:", hasRestoredRef.current);
    
    // Don't check hasRestoredRef here - let the restoration run and mark it complete at the end
    // This prevents React Strict Mode from skipping the restoration

    // Wait for editor to be ready and content to be loaded
    const restorePosition = () => {
      console.log("[CursorPositionPlugin] restorePosition called");
      
      if (hasRestoredRef.current) {
        console.log("[CursorPositionPlugin] Already restored, skipping");
        return;
      }
      
      if (isRestoringRef.current) {
        console.log("[CursorPositionPlugin] Already restoring, skipping");
        return;
      }

      const savedOffset = loadCursorPosition(documentId);
      console.log("[CursorPositionPlugin] Loaded cursor position:", savedOffset);
      
      if (savedOffset === null) {
        console.log("[CursorPositionPlugin] No saved position found");
        onHasSavedPosition?.(false);
        hasRestoredRef.current = true;
        return;
      }

      // Notify parent that we have a saved position
      onHasSavedPosition?.(true);

      // Check if document has content before restoring
      // We need to wait for content to be loaded, so retry if it appears empty
      let hasContent = false;
      let maxOffset = 0;
      editor.getEditorState().read(() => {
        const root = $getRoot();
        const textContent = root.getTextContent();
        hasContent = textContent.trim().length > 0;
        maxOffset = textContent.length;
      });

      console.log("[CursorPositionPlugin] Content check:", { hasContent, maxOffset });

      if (!hasContent) {
        // Content might not be loaded yet, retry after a delay
        // But limit retries to prevent infinite loops
        if (retryCountRef.current < 5) {
          retryCountRef.current++;
          console.log(`[CursorPositionPlugin] Document appears empty, retrying in 500ms... (attempt ${retryCountRef.current}/5)`);
          setTimeout(() => {
            restorePosition();
          }, 500);
        } else {
          console.warn("[CursorPositionPlugin] Document still appears empty after 5 retries, giving up");
          hasRestoredRef.current = true;
        }
        return;
      }

      // Reset retry count on success
      retryCountRef.current = 0;

      isRestoringRef.current = true;

      // Focus the editor IMMEDIATELY to prevent TextCaret from checking before focus
      // This is critical - TextCaret checks on mount, so we need to focus before that
      const rootElement = editor.getRootElement();
      if (rootElement) {
        const contentEditable = rootElement.querySelector(
          '[contenteditable="true"]',
        ) as HTMLElement;
        
        if (contentEditable) {
          console.log("[CursorPositionPlugin] Focusing editor immediately");
          contentEditable.focus();
        }
      }

      // Try to find contentEditable using polling with requestAnimationFrame
      // This is more reliable than waiting for update listener which might not fire
      const tryFindAndRestore = (attempt = 0) => {
        const rootElement = editor.getRootElement();
        if (!rootElement) {
          if (attempt < 20) {
            requestAnimationFrame(() => tryFindAndRestore(attempt + 1));
          } else {
            console.warn("[CursorPositionPlugin] No root element found after 20 attempts");
            isRestoringRef.current = false;
            hasRestoredRef.current = true;
          }
          return;
        }

        // The rootElement IS the contentEditable element itself!
        // Check if rootElement has contenteditable attribute
        let contentEditable: HTMLElement | null = null;
        
        if (rootElement.hasAttribute('contenteditable') || rootElement.getAttribute('data-lexical-editor') === 'true') {
          contentEditable = rootElement as HTMLElement;
        } else {
          // Fallback: try to find it as a child (shouldn't happen, but just in case)
          contentEditable = rootElement.querySelector(
            '[contenteditable="true"]',
          ) as HTMLElement;
          
          if (!contentEditable) {
            contentEditable = rootElement.querySelector(
              '[data-lexical-editor="true"]',
            ) as HTMLElement;
          }
        }
        
        if (!contentEditable) {
          if (attempt < 20) {
            requestAnimationFrame(() => tryFindAndRestore(attempt + 1));
          } else {
            console.warn("[CursorPositionPlugin] No contentEditable found after 20 attempts, rootElement:", rootElement, "hasContentEditable:", rootElement.hasAttribute('contenteditable'), "dataLexicalEditor:", rootElement.getAttribute('data-lexical-editor'));
            isRestoringRef.current = false;
            hasRestoredRef.current = true;
          }
          return;
        }
        
        console.log("[CursorPositionPlugin] Found contentEditable, proceeding with restoration, attempt:", attempt);

        // Ensure focus is set IMMEDIATELY
        if (document.activeElement !== contentEditable) {
          console.log("[CursorPositionPlugin] Focusing editor");
          contentEditable.focus();
        }
        console.log("[CursorPositionPlugin] Editor focused, activeElement:", document.activeElement?.tagName);
        
        // Set DOM selection IMMEDIATELY and SYNCHRONOUSLY before TextCaret checks
        // This prevents animation from wrong position
        const setDOMSelectionFromOffset = (offset: number): boolean => {
              try {
                console.log("[CursorPositionPlugin] Setting DOM selection at offset:", offset);
                
                const walker = document.createTreeWalker(
                  contentEditable,
                  NodeFilter.SHOW_TEXT,
                );
                
                let currentOffset = 0;
                let textNode: Node | null = null;
                let nodeOffset = 0;
                
                while (walker.nextNode()) {
                  const node = walker.currentNode;
                  const textLength = node.textContent?.length ?? 0;
                  
                  if (offset >= currentOffset && offset <= currentOffset + textLength) {
                    textNode = node;
                    nodeOffset = offset - currentOffset;
                    break;
                  }
                  
                  currentOffset += textLength;
                }
                
                if (textNode && textNode.textContent !== null) {
                  const domSelection = window.getSelection();
                  if (domSelection) {
                    const range = document.createRange();
                    const textLength = textNode.textContent.length;
                    const clampedOffset = Math.min(Math.max(0, nodeOffset), textLength);
                    
                    range.setStart(textNode, clampedOffset);
                    range.setEnd(textNode, clampedOffset);
                    range.collapse(true);
                    
                    domSelection.removeAllRanges();
                    domSelection.addRange(range);
                    
                    console.log("[CursorPositionPlugin] DOM selection set:", {
                      rangeCount: domSelection.rangeCount,
                      collapsed: range.collapsed,
                      textNode: textNode.textContent.substring(0, 20),
                      offset: clampedOffset,
                      activeElement: document.activeElement?.tagName,
                      isContentEditable: document.activeElement === contentEditable,
                    });
                    
                    return true;
                  }
                } else {
                  console.warn("[CursorPositionPlugin] Could not find text node at offset:", offset);
                }
              } catch (error) {
                console.warn("[CursorPositionPlugin] Failed to set DOM selection:", error);
              }
              return false;
            };

        // Set DOM selection IMMEDIATELY and SYNCHRONOUSLY
        const clampedOffset = Math.min(Math.max(0, savedOffset), maxOffset);
        const selectionSet = setDOMSelectionFromOffset(clampedOffset);
        
        if (selectionSet) {
          console.log("[CursorPositionPlugin] DOM selection set synchronously");
          
          // Restore Lexical selection immediately
          editor.update(() => {
            try {
              const root = $getRoot();
              if (root) {
                setSelectionToOffset(clampedOffset);
              }
            } catch (error) {
              console.warn("[CursorPositionPlugin] Failed to restore Lexical selection:", error);
            } finally {
              isRestoringRef.current = false;
            }
          });
          
          // Trigger events after a short delay to ensure TextCaret has mounted
          // Use requestAnimationFrame to ensure TextCaret is ready
          requestAnimationFrame(() => {
            // Ensure focus is still set
            if (document.activeElement !== contentEditable) {
              contentEditable.focus();
            }
            
            // Trigger selectionchange event - this will make TextCaret update
            document.dispatchEvent(new Event("selectionchange"));
            
            // Also trigger focusin to ensure TextCaret knows the editor is focused
            contentEditable.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
            
            // Mark as restored after a short delay to ensure TextCaret has processed
            setTimeout(() => {
              hasRestoredRef.current = true;
              console.log("[CursorPositionPlugin] Restoration complete!");
            }, 50);
          });
        } else {
          console.warn("[CursorPositionPlugin] Failed to set DOM selection synchronously");
          isRestoringRef.current = false;
          hasRestoredRef.current = true;
        }
      };
      
      // Start polling for contentEditable
      requestAnimationFrame(() => tryFindAndRestore());
      
      // Also register update listener as backup (in case editor updates later)
      const removeUpdateListener = editor.registerUpdateListener(() => {
        // If we haven't restored yet, try again
        if (!hasRestoredRef.current && !isRestoringRef.current) {
          console.log("[CursorPositionPlugin] Editor update detected, retrying restoration");
          setTimeout(() => {
            if (!hasRestoredRef.current && !isRestoringRef.current) {
              restorePosition();
            }
          }, 100);
        }
      });
      
      // Clean up update listener on unmount
      return () => {
        removeUpdateListener();
      };
    };

    // Try to restore immediately
    restorePosition();

    // Also try after a short delay in case editor wasn't ready
    const timeoutId = setTimeout(restorePosition, 300);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [editor, documentId]);

  // Track selection changes and save to localStorage
  useEffect(() => {
    const removeSelectionListener = editor.registerCommand(
      SELECTION_CHANGE_COMMAND,
      () => {
        // Don't save position while restoring
        if (isRestoringRef.current) {
          return false;
        }

        // Debounce saves to avoid excessive localStorage writes
        if (debounceTimerRef.current) {
          clearTimeout(debounceTimerRef.current);
        }

        debounceTimerRef.current = setTimeout(() => {
          editor.getEditorState().read(() => {
            const selection = $getSelection();
            if (!$isRangeSelection(selection)) {
              return;
            }

            // Don't save position if document is empty
            const root = $getRoot();
            const textContent = root.getTextContent();
            if (textContent.trim().length === 0) {
              return;
            }

            const serialized = serializeSelection(selection);
            if (serialized) {
              saveCursorPosition(documentId, serialized);
            }
          });
        }, 300); // Debounce for 300ms

        return false;
      },
      COMMAND_PRIORITY_LOW,
    );

    // Also listen to update events to catch selection changes
    const removeUpdateListener = editor.registerUpdateListener(() => {
      // Don't save position while restoring
      if (isRestoringRef.current) {
        return;
      }

      // Debounce saves
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      debounceTimerRef.current = setTimeout(() => {
        editor.getEditorState().read(() => {
          const selection = $getSelection();
          if (!$isRangeSelection(selection)) {
            return;
          }

          // Don't save position if document is empty
          const root = $getRoot();
          const textContent = root.getTextContent();
          if (textContent.trim().length === 0) {
            return;
          }

          const serialized = serializeSelection(selection);
          if (serialized) {
            saveCursorPosition(documentId, serialized);
          }
        });
      }, 300);
    });

    return () => {
      removeSelectionListener();
      removeUpdateListener();
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [editor, documentId]);

  return null;
}

