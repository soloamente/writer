# Custom Cursor Usage Guide

This guide explains how to use the custom cursor system in your editor.

## Quick Start

### Option 1: Using CursorIntegration Component

Add the `CursorIntegration` component to your editor:

```tsx
import { CursorIntegration } from "@/app/editor/_components/CursorIntegration";

export function Editor() {
  const editorRef = useRef<HTMLDivElement>(null);

  return (
    <div ref={editorRef} className="editor">
      {/* Your editor content */}
      
      <CursorIntegration enabled={true} containerRef={editorRef} />
    </div>
  );
}
```

### Option 2: Using the Cursor Hook

Use the `useCustomCursor` hook for more control:

```tsx
import { useCustomCursor } from "@/app/editor/_components/CustomCursor";
import { Point } from "@/lib/writer";

export function Editor() {
  const { cursor, position, moveTo, moveUp, moveDown } = useCustomCursor(
    new Point(0, 0)
  );

  // Use cursor methods
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "ArrowUp") {
      moveUp(1);
    }
    // ...
  };

  return (
    <div>
      {/* Your editor content */}
      <div>Cursor at: {position.line}, {position.column}</div>
    </div>
  );
}
```

### Option 3: Direct Cursor Usage

For full control, use the Cursor class directly:

```tsx
import { Cursor, Point, editor as editorState } from "@/lib/writer";
import { CursorRenderer } from "@/app/editor/_components/CursorRenderer";

export function Editor() {
  const editorRef = useRef<HTMLDivElement>(null);
  const [cursor, setCursor] = useState<Cursor | null>(null);

  useEffect(() => {
    // Create cursor
    const newCursor = new Cursor({ point: new Point(0, 0) });
    editorState.cursors = [newCursor];
    setCursor(newCursor);

    // Handle keyboard
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case "ArrowUp":
          newCursor.moveUp(1, e.shiftKey);
          setCursor(new Cursor({ point: newCursor.position }));
          break;
        // ...
      }
    };

    editorRef.current?.addEventListener("keydown", handleKeyDown);
    return () => {
      editorRef.current?.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  return (
    <div ref={editorRef} writer-editor="">
      {/* Your editor content */}
      {cursor && editorRef.current && (
        <CursorRenderer
          editorElement={editorRef.current}
          cursors={[cursor]}
          visible={true}
        />
      )}
    </div>
  );
}
```

## API Reference

### Cursor Class

```tsx
const cursor = new Cursor({ point: new Point(0, 0) });

// Movement
cursor.moveUp(lines?: number, select?: boolean);
cursor.moveDown(lines?: number, select?: boolean);
cursor.moveLeft(cols?: number, select?: boolean);
cursor.moveRight(cols?: number, select?: boolean);

// Navigation
cursor.moveToStartOfLine(select?: boolean);
cursor.moveToEndOfLine(select?: boolean);
cursor.moveToStartOfWord(select?: boolean);
cursor.moveToEndOfWord(select?: boolean);
cursor.moveToTop(select?: boolean);
cursor.moveToBottom(select?: boolean);

// Selection
cursor.selectWord();
cursor.selectParagraph();
cursor.deleteSelection();

// Properties
cursor.position // Current position (Point)
cursor.selection // Selection object
cursor.drawing // Current x, y coordinates
```

### Point Class

```tsx
const point = new Point(0, 0); // line, column

point.line; // Line number
point.column; // Column number
point.equals(other); // Check equality
point.before(other); // Check if before
point.after(other); // Check if after
```

### Utility Functions

```tsx
import {
  pointToXY,
  moveUp,
  moveDown,
  moveLeft,
  moveRight,
  insertText,
  backspace,
  copy,
  cut,
} from "@/lib/writer/utils";

// Convert point to screen coordinates
const { x, y } = pointToXY(point);

// Move all cursors
moveUp(1);
moveDown(1);
moveLeft(1);
moveRight(1);

// Text operations
insertText("Hello");
backspace();
copy();
cut();
```

## Styling

The cursor uses CSS custom properties defined in `globals.css`:

```css
[writer-cursor] {
  width: var(--cursor-width);
  height: var(--text-line-height);
  background: var(--cursor-color);
  border-radius: var(--cursor-radius);
}
```

You can customize these in your CSS:

```css
:root {
  --cursor-width: 4px;
  --cursor-color: #838383;
  --cursor-radius: 2px;
  --text-line-height: 28px;
}
```

## Next Steps

To fully integrate the cursor with a text editor:

1. **Create a Buffer class** - The cursor system needs a buffer that manages text storage
2. **Implement text rendering** - Render text in the `[writer-lines]` container
3. **Handle text input** - Connect keyboard input to `insertText()` function
4. **Render selections** - Use `[writer-decorations]` for selection highlighting

## Example: Minimal Working Editor

See `CursorExample.tsx` for a complete working example.

