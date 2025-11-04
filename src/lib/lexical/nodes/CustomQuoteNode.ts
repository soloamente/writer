/**
 * Custom Quote/Blockquote Node for Lexical Editor
 *
 * Extends ElementNode to create a custom quote node that matches
 * the editor theme styling with left border and italic text.
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
 * Serialized representation of CustomQuoteNode
 */
export type SerializedCustomQuoteNode = Spread<
  {
    type: "custom-quote";
    version: 1;
  },
  SerializedElementNode
>;

/**
 * Custom Quote Node that extends ElementNode
 * Provides blockquote styling aligned with editor theme
 */
export class CustomQuoteNode extends ElementNode {
  static getType(): string {
    return "custom-quote";
  }

  static clone(node: CustomQuoteNode): CustomQuoteNode {
    return new CustomQuoteNode(node.__key);
  }

  /**
   * Creates a DOM element for this node
   * Returns a <blockquote> element with appropriate classes
   */
  createDOM(config: EditorConfig): HTMLElement {
    const element = document.createElement("blockquote");
    // Apply theme classes from editorTheme: left margin, left padding, border, italic, muted color
    element.className =
      "m-0 ml-4 pl-4 border-l-4 border-border text-muted-foreground italic";
    return element;
  }

  /**
   * Updates the DOM element when node changes
   * Returns false since we don't need to replace the element
   */
  updateDOM(prevNode: CustomQuoteNode, dom: HTMLElement): boolean {
    // No updates needed - quote styling is static
    return false;
  }

  /**
   * Exports the node to JSON for serialization
   */
  exportJSON(): SerializedCustomQuoteNode {
    return {
      ...super.exportJSON(),
      type: "custom-quote",
      version: 1,
    };
  }

  /**
   * Imports node from JSON during deserialization
   */
  static importJSON(
    serializedNode: SerializedCustomQuoteNode,
  ): CustomQuoteNode {
    const { version } = serializedNode;
    const node = $createCustomQuoteNode();
    node.setFormat(serializedNode.format);
    node.setIndent(serializedNode.indent);
    node.setDirection(serializedNode.direction);
    return node;
  }

  /**
   * Checks if this node can be empty
   * Quotes can be empty
   */
  canBeEmpty(): boolean {
    return true;
  }

  /**
   * Checks if this node is inline
   * Quotes are block-level elements
   */
  isInline(): boolean {
    return false;
  }

  /**
   * Indent handling for nested quotes
   */
  canIndent(): boolean {
    return false;
  }
}

/**
 * Creates a new CustomQuoteNode instance
 * Use this function instead of calling the constructor directly
 */
export function $createCustomQuoteNode(): CustomQuoteNode {
  return $applyNodeReplacement(new CustomQuoteNode());
}

/**
 * Type guard to check if a node is a CustomQuoteNode
 */
export function $isCustomQuoteNode(
  node: LexicalNode | null | undefined,
): node is CustomQuoteNode {
  return node instanceof CustomQuoteNode;
}
