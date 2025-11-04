# Custom Lexical Nodes

This directory contains custom Lexical nodes that extend the base Lexical functionality to provide enhanced styling and features aligned with the editor theme.

## Overview

All custom nodes are built using the **modern $config API with NodeState** (compatible with Lexical v0.33.0+). Current version: Lexical v0.38.2.

The `$config` API provides:
- Automatic serialization/deserialization
- Reduced boilerplate (no manual `exportJSON()`, `importJSON()`, `afterCloneFrom()`)
- Type-safe state management with `createState()`
- Better collaboration support

## Available Custom Nodes

### 1. CustomParagraphNode

A custom paragraph node that provides consistent paragraph styling aligned with the editor theme.

**Features:**
- Consistent margin-bottom styling (`mb-[0.8em]`)
- Relative positioning for advanced styling

**Usage:**
```typescript
import { $createCustomParagraphNode } from "@/lib/lexical/nodes";

// Create a new paragraph node
const paragraph = $createCustomParagraphNode();

// Insert into editor
editor.update(() => {
  const selection = $getSelection();
  if ($isRangeSelection(selection)) {
    selection.insertNodes([paragraph]);
  }
});
```

### 2. CustomQuoteNode

A custom blockquote/quote node with left border and italic text styling.

**Features:**
- Left margin and padding (`ml-4 pl-4`)
- Left border (`border-l-4`)
- Italic text styling
- Muted foreground color

**Usage:**
```typescript
import { $createCustomQuoteNode } from "@/lib/lexical/nodes";

// Create a new quote node
const quote = $createCustomQuoteNode();

// Insert into editor
editor.update(() => {
  const selection = $getSelection();
  if ($isRangeSelection(selection)) {
    selection.insertNodes([quote]);
  }
});
```

### 3. CustomDividerNode

A horizontal rule/divider decorator node that renders a React component.

**Features:**
- Renders as an `<hr>` element
- Spacing margins (`my-4`)
- Border styling aligned with theme

**Usage:**
```typescript
import { $createCustomDividerNode } from "@/lib/lexical/nodes";

// Create a new divider node
const divider = $createCustomDividerNode();

// Insert into editor
editor.update(() => {
  const selection = $getSelection();
  if ($isRangeSelection(selection)) {
    selection.insertNodes([divider]);
  }
});
```

### 4. CustomCodeBlockNode

A custom code block node with optional language support.

**Features:**
- Programming language identifier (optional)
- Syntax highlighting ready (via `data-language` attribute)
- Monospace font styling
- Background and padding aligned with theme

**Usage:**
```typescript
import { $createCustomCodeBlockNode } from "@/lib/lexical/nodes";

// Create a code block with language
const codeBlock = $createCustomCodeBlockNode("typescript");

// Create a code block without language
const plainCodeBlock = $createCustomCodeBlockNode();

// Get/set language
const language = codeBlock.getLanguage(); // "typescript"
codeBlock.setLanguage("javascript");
```

## Node Registration

All custom nodes are automatically registered in the editor configuration:

```typescript
import { customNodes } from "@/lib/lexical/nodes";

const initialConfig = {
  // ... other config
  nodes: [...customNodes],
};
```

## Serialization

All custom nodes support JSON serialization and deserialization:

- **Export**: `node.exportJSON()` - Returns serialized JSON representation
- **Import**: `NodeClass.importJSON(serializedNode)` - Reconstructs node from JSON

This ensures that custom nodes persist correctly when saving/loading editor state.

## Type Guards

Each custom node provides a type guard function:

```typescript
import {
  $isCustomParagraphNode,
  $isCustomQuoteNode,
  $isCustomDividerNode,
  $isCustomCodeBlockNode,
} from "@/lib/lexical/nodes";

// Check if a node is a specific custom node type
if ($isCustomParagraphNode(node)) {
  // TypeScript knows node is CustomParagraphNode
}
```

## Utility Functions

Helper functions are available in `utils.ts` for common operations:

```typescript
import {
  $insertCustomParagraph,
  $insertCustomQuote,
  $insertCustomDivider,
  $insertCustomCodeBlock,
} from "@/lib/lexical/nodes/utils";

// Insert nodes directly
$insertCustomParagraph(editor);
$insertCustomQuote(editor);
$insertCustomDivider(editor);
$insertCustomCodeBlock(editor, "typescript");
```

## Migration Notes

✅ **Already migrated to $config API!** All nodes use the modern API.

### For Reference: Legacy vs Modern API

The nodes have been migrated from the legacy API to the modern `$config` API:

**Legacy (v0.24.0):**
```typescript
export class CustomParagraphNode extends ElementNode {
  static getType(): string { return "custom-paragraph"; }
  static clone(node: CustomParagraphNode): CustomParagraphNode {
    return new CustomParagraphNode(node.__key);
  }
  exportJSON(): SerializedCustomParagraphNode { ... }
  static importJSON(...): CustomParagraphNode { ... }
}
```

**Modern (v0.33.0+):**
```typescript
export class CustomParagraphNode extends ElementNode {
  $config() {
    return this.config("custom-paragraph", { extends: ElementNode });
  }
  // exportJSON() and importJSON() are automatic!
}
```

**With NodeState (for properties):**
```typescript
const languageState = createState("language", {
  parse: (value) => (typeof value === "string" ? value : undefined),
});

export class CustomCodeBlockNode extends ElementNode {
  $config() {
    return this.config("custom-codeblock", {
      extends: ElementNode,
      stateConfigs: [{ flat: true, stateConfig: languageState }],
    });
  }
  
  getLanguage(): string | undefined {
    return $getState(this, languageState);
  }
  
  setLanguage(language: string | undefined): this {
    return $setState(this, languageState, language);
  }
}
```

## Best Practices

1. **Always use factory functions**: Use `$createCustomParagraphNode()` instead of `new CustomParagraphNode()`
2. **Use type guards**: Check node types before casting
3. **Handle serialization**: Ensure all custom properties are serializable (no functions, Symbols, etc.)
4. **Follow naming conventions**: Use `__` prefix for private properties
5. **Zero-argument constructors**: Support zero-argument instantiation for better collab support

## Testing

To test custom nodes:

1. Create a node using the factory function
2. Insert it into the editor
3. Export the editor state to JSON
4. Reload the editor with the exported JSON
5. Verify the node is correctly reconstructed

Example test:

```typescript
// Create and insert node
const node = $createCustomParagraphNode();
editor.update(() => {
  const root = $getRoot();
  root.append(node);
});

// Export state
const editorState = editor.getEditorState();
const json = editorState.toJSON();

// Reload and verify
const newEditor = createEditor();
newEditor.setEditorState(editor.parseEditorState(json));
```

## Future Enhancements

Potential improvements for these custom nodes:

- [ ] Add alignment support to CustomParagraphNode
- [ ] Add citation/source support to CustomQuoteNode
- [ ] Add syntax highlighting integration to CustomCodeBlockNode
- [ ] Add customizable divider styles to CustomDividerNode
- [ ] Add support for nested code blocks
- [ ] Migrate to `$config` API when upgrading Lexical

