"use client";

import { useEffect } from "react";

/**
 * Component that dynamically styles Liveblocks cursors by observing DOM changes
 * This ensures we catch cursors regardless of their class names or structure
 */
export function CursorStyler() {
  useEffect(() => {
    // Inject a style element with high-specificity CSS that will override Liveblocks
    const styleId = "writer-cursor-styles";
    let styleElement = document.getElementById(styleId) as HTMLStyleElement;
    if (!styleElement) {
      styleElement = document.createElement("style");
      styleElement.id = styleId;
      styleElement.textContent = `
        /* High-specificity overrides for Liveblocks cursors */
        .lb-root.lb-lexical-cursors,
        div.lb-root.lb-lexical-cursors {
          position: relative !important;
          display: flex !important;
          align-items: flex-start !important;
        }
        
        .lb-root.lb-lexical-cursors > div:first-child,
        div.lb-root.lb-lexical-cursors > div:first-child {
          width: 2px !important;
          min-width: 2px !important;
          opacity: 0.9 !important;
          border-radius: 1px !important;
          box-shadow: 0 0 2px rgba(0, 0, 0, 0.2) !important;
          transition: opacity 200ms ease-out, transform 80ms cubic-bezier(0.25, 0.46, 0.45, 0.94) !important;
        }
        
        .lb-root.lb-lexical-cursors > div:last-child,
        div.lb-root.lb-lexical-cursors > div:last-child {
          padding: 0.375rem 0.625rem !important;
          border-radius: 0.375rem !important;
          font-size: 0.8125rem !important;
          font-weight: 500 !important;
          line-height: 1.2 !important;
          white-space: nowrap !important;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(0, 0, 0, 0.05) !important;
          backdrop-filter: blur(8px) !important;
          -webkit-backdrop-filter: blur(8px) !important;
          background-color: rgba(255, 255, 255, 0.9) !important;
          color: #111111 !important;
          margin-left: 4px !important;
        }
      `;
      document.head.appendChild(styleElement);
    }
    
    const styleCursors = () => {
      const editor = document.querySelector("[data-lexical-editor]");
      if (!editor) return;

      // Target Liveblocks cursor container directly
      const cursorContainers = document.querySelectorAll(".lb-lexical-cursors");
      cursorContainers.forEach((cursorContainer, containerIndex) => {
        console.log(`✅ Found .lb-lexical-cursors container ${containerIndex}:`, cursorContainer);
        
        const containerEl = cursorContainer as HTMLElement;
        const containerStyle = window.getComputedStyle(containerEl);
        const containerInlineStyle = containerEl.getAttribute("style") || "";
        
        // Check if container itself might be the cursor line
        const containerIsPositioned = containerStyle.position === "fixed" || containerStyle.position === "absolute";
        const containerHeight = parseFloat(containerStyle.height) || 0;
        const containerWidth = parseFloat(containerStyle.width) || 0;
        
        console.log(`Container ${containerIndex} details:`, {
          position: containerStyle.position,
          width: containerStyle.width,
          height: containerStyle.height,
          backgroundColor: containerStyle.backgroundColor,
          color: containerStyle.color,
          children: cursorContainer.children.length,
          innerHTML: cursorContainer.innerHTML.substring(0, 200)
        });
        
        // Set color on container so ::before pseudo-element can use currentColor
        // Try to extract color from inline styles or computed styles
        if (!containerEl.style.color && containerStyle.color === "rgba(0, 0, 0, 0)") {
          // If no color is set, try to get it from the background or use a default
          const bgColor = containerStyle.backgroundColor;
          if (bgColor && bgColor !== "rgba(0, 0, 0, 0)" && bgColor !== "transparent") {
            containerEl.style.setProperty("color", bgColor, "important");
          } else {
            // Use a default visible color
            containerEl.style.setProperty("color", "#1177ff", "important");
          }
        }
        
        // Find the existing cursor line - it might be the container itself or a child element
        // Check if container itself is the cursor line (has background color and is thin)
        const containerBg = containerStyle.backgroundColor;
        const hasBgColor = containerBg && containerBg !== "rgba(0, 0, 0, 0)" && containerBg !== "transparent";
        
        if (containerWidth < 5 && containerHeight > 10 && hasBgColor) {
          // Container itself is the cursor line
          console.log(`Container ${containerIndex} IS the cursor line`);
          containerEl.style.setProperty("width", "2px", "important");
          containerEl.style.setProperty("min-width", "2px", "important");
          containerEl.style.setProperty("opacity", "0.9", "important");
          containerEl.style.setProperty("border-radius", "1px", "important");
          containerEl.style.setProperty("box-shadow", "0 0 2px rgba(0, 0, 0, 0.2)", "important");
          containerEl.style.setProperty("transition", "opacity 200ms ease-out, transform 80ms cubic-bezier(0.25, 0.46, 0.45, 0.94)", "important");
        } else {
          // Look for a child element that's the cursor line (thin, tall, has background)
          const allChildren = Array.from(containerEl.children) as HTMLElement[];
          const cursorLine = allChildren.find((child) => {
            const childStyle = window.getComputedStyle(child);
            const childWidth = parseFloat(childStyle.width) || 0;
            const childHeight = parseFloat(childStyle.height) || 0;
            const childBg = childStyle.backgroundColor;
            const hasChildBg = childBg && childBg !== "rgba(0, 0, 0, 0)" && childBg !== "transparent";
            return childWidth < 5 && childHeight > 10 && hasChildBg && !child.textContent?.trim();
          });
          
          if (cursorLine) {
            console.log(`Found cursor line element in container ${containerIndex}`);
            cursorLine.style.setProperty("width", "2px", "important");
            cursorLine.style.setProperty("min-width", "2px", "important");
            cursorLine.style.setProperty("opacity", "0.9", "important");
            cursorLine.style.setProperty("border-radius", "1px", "important");
            cursorLine.style.setProperty("box-shadow", "0 0 2px rgba(0, 0, 0, 0.2)", "important");
            cursorLine.style.setProperty("transition", "opacity 200ms ease-out, transform 80ms cubic-bezier(0.25, 0.46, 0.45, 0.94)", "important");
          } else {
            // Create cursor line element if it doesn't exist
            const newCursorLine = document.createElement("div");
            newCursorLine.setAttribute("data-writer-cursor-line", "true");
            newCursorLine.style.cssText = `
              position: absolute !important;
              left: 0 !important;
              top: 0 !important;
              bottom: 0 !important;
              width: 2px !important;
              background-color: currentColor !important;
              opacity: 0.9 !important;
              border-radius: 1px !important;
              box-shadow: 0 0 2px rgba(0, 0, 0, 0.2) !important;
              pointer-events: none !important;
              z-index: 0 !important;
              transition: opacity 200ms ease-out, transform 80ms cubic-bezier(0.25, 0.46, 0.45, 0.94) !important;
            `;
            containerEl.insertBefore(newCursorLine, containerEl.firstChild);
          }
        }
        
        // Style all elements within the container
        const allChildren = Array.from(containerEl.children) as HTMLElement[];
        console.log(`Found ${allChildren.length} children in cursor container ${containerIndex}`);
        
        allChildren.forEach((child, index) => {
          const style = window.getComputedStyle(child);
          const inlineStyle = child.getAttribute("style") || "";
          const hasText = child.textContent && child.textContent.trim().length > 0;
          const width = parseFloat(style.width) || 0;
          const height = parseFloat(style.height) || 0;
          const bgColor = style.backgroundColor;
          
          console.log(`  Child ${index} (${child.tagName}):`, {
            width: style.width,
            height: style.height,
            hasText,
            textContent: child.textContent?.substring(0, 20),
            backgroundColor: bgColor,
            color: style.color,
            classes: child.className,
            inlineStyle: inlineStyle.substring(0, 200),
            computedStyles: {
              position: style.position,
              display: style.display,
              pointerEvents: style.pointerEvents
            }
          });
          
          if (hasText) {
            // This is the label - apply improved styling
            console.log(`🎨 Styling label element ${index}`);
            // Use Object.assign to completely override styles
            Object.assign(child.style, {
              padding: "0.375rem 0.625rem",
              borderRadius: "0.375rem",
              fontSize: "0.8125rem",
              fontWeight: "500",
              lineHeight: "1.2",
              whiteSpace: "nowrap",
              boxShadow: "0 2px 8px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(0, 0, 0, 0.05)",
              backdropFilter: "blur(8px)",
              WebkitBackdropFilter: "blur(8px)",
              zIndex: "1",
              position: "relative",
              marginLeft: "4px",
              backgroundColor: "rgba(255, 255, 255, 0.9)",
              color: "#111111",
            });
            
            // Also set with setProperty as backup
            child.style.setProperty("padding", "0.375rem 0.625rem", "important");
            child.style.setProperty("border-radius", "0.375rem", "important");
            child.style.setProperty("font-size", "0.8125rem", "important");
            child.style.setProperty("font-weight", "500", "important");
            child.style.setProperty("line-height", "1.2", "important");
            child.style.setProperty("white-space", "nowrap", "important");
            child.style.setProperty("box-shadow", "0 2px 8px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(0, 0, 0, 0.05)", "important");
            child.style.setProperty("backdrop-filter", "blur(8px)", "important");
            child.style.setProperty("-webkit-backdrop-filter", "blur(8px)", "important");
            child.style.setProperty("z-index", "1", "important");
            child.style.setProperty("position", "relative", "important");
            child.style.setProperty("margin-left", "4px", "important");
            child.style.setProperty("background-color", "rgba(255, 255, 255, 0.9)", "important");
            child.style.setProperty("color", "#111111", "important");
          } else if (width < 5 && height > 10 && bgColor && bgColor !== "rgba(0, 0, 0, 0)" && bgColor !== "transparent") {
            // This might be the cursor line
            console.log(`🎨 Styling cursor line element ${index}`);
            Object.assign(child.style, {
              width: "2px",
              minWidth: "2px",
              opacity: "0.9",
              borderRadius: "1px",
              boxShadow: "0 0 2px rgba(0, 0, 0, 0.2)",
              transition: "opacity 200ms ease-out, transform 80ms cubic-bezier(0.25, 0.46, 0.45, 0.94)",
            });
            
            child.style.setProperty("width", "2px", "important");
            child.style.setProperty("min-width", "2px", "important");
            child.style.setProperty("opacity", "0.9", "important");
            child.style.setProperty("border-radius", "1px", "important");
            child.style.setProperty("box-shadow", "0 0 2px rgba(0, 0, 0, 0.2)", "important");
          }
        });
        
        // Ensure container has proper styling
        containerEl.style.setProperty("position", "relative", "important");
        containerEl.style.setProperty("display", "flex", "important");
        containerEl.style.setProperty("align-items", "flex-start", "important");
        
        // Check if container itself acts as cursor line (has background color and is thin)
        // If so, ensure it's visible and styled properly
        if (containerWidth < 10 && containerHeight > 10 && hasBgColor) {
          containerEl.style.setProperty("width", "2px", "important");
          containerEl.style.setProperty("min-width", "2px", "important");
          containerEl.style.setProperty("opacity", "0.9", "important");
          containerEl.style.setProperty("border-radius", "1px", "important");
          containerEl.style.setProperty("box-shadow", "0 0 2px rgba(0, 0, 0, 0.2)", "important");
        } else if (!hasBgColor && allChildren.length === 1 && allChildren[0].textContent?.trim()) {
          // Container only has label, cursor line might be missing - add it via border
          containerEl.style.setProperty("border-left", "2px solid currentColor", "important");
          containerEl.style.setProperty("padding-left", "4px", "important");
          containerEl.style.setProperty("border-radius", "1px", "important");
          containerEl.style.setProperty("box-shadow", "0 0 2px rgba(0, 0, 0, 0.2)", "important");
        }
      });

      // Also check for any divs that look like cursors (fallback)
      const allDivs = editor.querySelectorAll("div");
      
      // Style cursor divs
      allDivs.forEach((div) => {
        const style = window.getComputedStyle(div);
        const inlineStyle = div.getAttribute("style") || "";
        
        // Check if this looks like a cursor element
        const isPositioned = style.position === "absolute" || style.position === "fixed";
        const hasPointerEventsNone = style.pointerEvents === "none" || inlineStyle.includes("pointer-events: none");
        const isSmall = parseFloat(style.width) < 10 || parseFloat(style.height) > 10;
        const hasColor = style.backgroundColor !== "rgba(0, 0, 0, 0)" && style.backgroundColor !== "transparent";
        
        if (isPositioned && hasPointerEventsNone && (isSmall || hasColor)) {
          // Apply cursor line styles
          (div as HTMLElement).style.setProperty("width", "2px", "important");
          (div as HTMLElement).style.setProperty("opacity", "0.9", "important");
          (div as HTMLElement).style.setProperty("border-radius", "1px", "important");
          (div as HTMLElement).style.setProperty("box-shadow", "0 0 2px rgba(0, 0, 0, 0.2)", "important");
          (div as HTMLElement).style.setProperty("transition", "opacity 200ms ease-out, transform 80ms cubic-bezier(0.25, 0.46, 0.45, 0.94)", "important");
          
          // Check if this div contains text (user label)
          const hasText = div.textContent && div.textContent.trim().length > 0;
          if (hasText) {
            // Apply label styles
            (div as HTMLElement).style.setProperty("padding", "0.375rem 0.625rem", "important");
            (div as HTMLElement).style.setProperty("border-radius", "0.375rem", "important");
            (div as HTMLElement).style.setProperty("font-size", "0.8125rem", "important");
            (div as HTMLElement).style.setProperty("font-weight", "500", "important");
            (div as HTMLElement).style.setProperty("line-height", "1.2", "important");
            (div as HTMLElement).style.setProperty("white-space", "nowrap", "important");
            (div as HTMLElement).style.setProperty("box-shadow", "0 2px 8px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(0, 0, 0, 0.05)", "important");
            (div as HTMLElement).style.setProperty("backdrop-filter", "blur(8px)", "important");
            (div as HTMLElement).style.setProperty("-webkit-backdrop-filter", "blur(8px)", "important");
            (div as HTMLElement).style.setProperty("z-index", "10000", "important");
          }
        }
      });

      // Style selection spans - Liveblocks wraps selected text in spans with background colors
      const allSpans = editor.querySelectorAll("span[data-lexical-text='true']");
      allSpans.forEach((span) => {
        const style = window.getComputedStyle(span);
        const inlineStyle = span.getAttribute("style") || "";
        const bgColor = style.backgroundColor;
        
        // Check if this span has a background color (indicating a selection from another user)
        // Liveblocks sets background colors like rgba(230, 126, 34, 0.2) or similar
        const hasBackground = bgColor !== "rgba(0, 0, 0, 0)" && 
                             bgColor !== "transparent" &&
                             (inlineStyle.includes("background") || 
                              bgColor.includes("rgba") || 
                              bgColor.includes("rgb"));
        
        // Also check if it's not the user's own selection (which would be the default selection color)
        const isOtherUserSelection = hasBackground && 
                                     !span.classList.contains("editor-selection") &&
                                     inlineStyle.includes("background");
        
        if (isOtherUserSelection) {
          // Improve selection styling for other users' selections
          const spanEl = span as HTMLElement;
          
          // Preserve the original background color but make it more visible
          if (inlineStyle.includes("background")) {
            // Extract and enhance the opacity
            const bgMatch = inlineStyle.match(/background(?:-color)?:\s*([^;]+)/);
            if (bgMatch) {
              const bgValue = bgMatch[1].trim();
              // Increase opacity if it's rgba
              const rgbaMatch = bgValue.match(/rgba?\(([^)]+)\)/);
              if (rgbaMatch) {
                const values = rgbaMatch[1].split(",").map(v => v.trim());
                if (values.length === 4) {
                  // Increase opacity to 0.3 for better visibility
                  const newBg = `rgba(${values[0]}, ${values[1]}, ${values[2]}, 0.3)`;
                  spanEl.style.setProperty("background-color", newBg, "important");
                }
              }
            }
          }
          
          spanEl.style.setProperty("border-radius", "2px", "important");
          spanEl.style.setProperty("padding", "1px 2px", "important");
          spanEl.style.setProperty("margin", "-1px -2px", "important");
          spanEl.style.setProperty("transition", "opacity 200ms ease-out, background-color 200ms ease-out", "important");
          spanEl.style.setProperty("box-shadow", "0 0 0 1px rgba(0, 0, 0, 0.1)", "important");
          
          // Add a data attribute to mark it as styled
          spanEl.setAttribute("data-lb-selection-styled", "true");
        }
      });
    };

    // Run immediately
    styleCursors();

    // Watch for new elements being added (Liveblocks cursors are added dynamically)
    const observer = new MutationObserver(() => {
      styleCursors();
    });

    // Watch both the editor and the Liveblocks cursor container
    const editor = document.querySelector("[data-lexical-editor]");
    const cursorContainer = document.querySelector(".lb-lexical-cursors");
    
    if (editor) {
      observer.observe(editor, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["style", "class"],
      });
    }
    
    // Also watch the cursor container specifically if it exists
    if (cursorContainer) {
      observer.observe(cursorContainer, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["style", "class"],
      });
    }
    
    // Watch for when the cursor container is added to the DOM
    const containerObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const element = node as Element;
            if (element.classList.contains("lb-lexical-cursors") || 
                element.querySelector(".lb-lexical-cursors")) {
              styleCursors();
              // Start observing the new container
              observer.observe(element, {
                childList: true,
                subtree: true,
                attributes: true,
                attributeFilter: ["style", "class"],
              });
            }
          }
        });
      });
    });
    
    // Watch the document body for when Liveblocks adds the cursor container
    containerObserver.observe(document.body, {
      childList: true,
      subtree: true,
    });

    // Also check periodically in case MutationObserver misses something
    const interval = setInterval(styleCursors, 500);

    return () => {
      observer.disconnect();
      containerObserver.disconnect();
      clearInterval(interval);
    };
  }, []);

  return null;
}

