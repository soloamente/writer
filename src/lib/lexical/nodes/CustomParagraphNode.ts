/**
 * Custom Paragraph Node for Lexical Editor
 *
 * Extends ElementNode to create a custom paragraph node that matches
 * the editor theme styling. This node can be extended in the future
 * to support additional features like alignment, spacing, etc.
 *
 * Uses the legacy API (Lexical v0.24.0) for compatibility with Liveblocks.
 */

import { ElementNode, $applyNodeReplacement } from "lexical";
import type {
  EditorConfig,
  LexicalNode,
  NodeKey,
  SerializedElementNode,
  Spread,
} from "lexical";

/**
 * Serialized representation of CustomParagraphNode
 */
export type SerializedCustomParagraphNode = Spread<
  {
    type: "custom-paragraph";
    version: 1;
  },
  SerializedElementNode
>;

/**
 * Custom Paragraph Node that extends ElementNode
 * Provides consistent paragraph styling aligned with editor theme
 */
export class CustomParagraphNode extends ElementNode {
  static getType(): string {
    return "custom-paragraph";
  }

  static clone(node: CustomParagraphNode): CustomParagraphNode {
    return new CustomParagraphNode(node.__key);
  }

  /**
   * Creates a DOM element for this node
   * Returns a <p> element with appropriate classes
   */
  createDOM(config: EditorConfig): HTMLElement {
    const element = document.createElement("p");
    // Apply theme classes from editorTheme
    element.className = "mb-[0.8em] relative";
    return element;
  }

  /**
   * Updates the DOM element when node changes
   * Returns false since we don't need to replace the element
   */
  updateDOM(prevNode: CustomParagraphNode, dom: HTMLElement): boolean {
    // No updates needed - paragraph styling is static
    return false;
  }

  /**
   * Exports the node to JSON for serialization
   */
  exportJSON(): SerializedCustomParagraphNode {
    return {
      ...super.exportJSON(),
      type: "custom-paragraph",
      version: 1,
    };
  }

  /**
   * Imports node from JSON during deserialization
   */
  static importJSON(
    serializedNode: SerializedCustomParagraphNode,
  ): CustomParagraphNode {
    const { version } = serializedNode;
    const node = $createCustomParagraphNode();
    node.setFormat(serializedNode.format);
    node.setIndent(serializedNode.indent);
    node.setDirection(serializedNode.direction);
    return node;
  }

  /**
   * Checks if this node can be empty
   * Paragraphs can be empty
   */
  canBeEmpty(): boolean {
    return true;
  }

  /**
   * Checks if this node is inline
   * Paragraphs are block-level elements
   */
  isInline(): boolean {
    return false;
  }
}

/**
 * Creates a new CustomParagraphNode instance
 * Use this function instead of calling the constructor directly
 */
export function $createCustomParagraphNode(): CustomParagraphNode {
  return $applyNodeReplacement(new CustomParagraphNode());
}

/**
 * Type guard to check if a node is a CustomParagraphNode
 */
export function $isCustomParagraphNode(
  node: LexicalNode | null | undefined,
): node is CustomParagraphNode {
  return node instanceof CustomParagraphNode;
}
