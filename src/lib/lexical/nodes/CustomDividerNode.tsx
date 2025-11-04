/**
 * Custom Divider Node for Lexical Editor
 *
 * Extends DecoratorNode to create a horizontal rule/divider element.
 * This is a decorator node that renders a React component.
 *
 * Uses the legacy API (Lexical v0.24.0) for compatibility with Liveblocks.
 */

"use client";

import { DecoratorNode, $applyNodeReplacement } from "lexical";
import type {
  EditorConfig,
  LexicalNode,
  NodeKey,
  SerializedLexicalNode,
  Spread,
} from "lexical";
import type { ReactNode } from "react";

/**
 * Serialized representation of CustomDividerNode
 */
export type SerializedCustomDividerNode = Spread<
  {
    type: "custom-divider";
    version: 1;
  },
  SerializedLexicalNode
>;

/**
 * Custom Divider Node that extends DecoratorNode
 * Renders a horizontal rule component
 */
export class CustomDividerNode extends DecoratorNode<ReactNode> {
  static getType(): string {
    return "custom-divider";
  }

  static clone(node: CustomDividerNode): CustomDividerNode {
    return new CustomDividerNode(node.__key);
  }

  /**
   * Creates a DOM element container for the decorator
   * Returns a <div> element
   */
  createDOM(config: EditorConfig): HTMLElement {
    const element = document.createElement("div");
    element.className = "my-4"; // Margin for spacing
    return element;
  }

  /**
   * Updates the DOM element when node changes
   * Returns false since we don't need to replace the element
   */
  updateDOM(): boolean {
    return false;
  }

  /**
   * Renders the React component for the divider
   * Returns a horizontal rule element
   */
  decorate(): ReactNode {
    return (
      <hr
        className="border-border my-4 border-0 border-t"
        style={{
          borderTopWidth: "1px",
          borderTopStyle: "solid",
        }}
      />
    );
  }

  /**
   * Exports the node to JSON for serialization
   */
  exportJSON(): SerializedCustomDividerNode {
    return {
      type: "custom-divider",
      version: 1,
    };
  }

  /**
   * Imports node from JSON during deserialization
   */
  static importJSON(
    serializedNode: SerializedCustomDividerNode,
  ): CustomDividerNode {
    const { version } = serializedNode;
    return $createCustomDividerNode();
  }

  /**
   * Checks if this node can be deleted
   * Dividers can be deleted
   */
  isInline(): boolean {
    return false;
  }
}

/**
 * Creates a new CustomDividerNode instance
 * Use this function instead of calling the constructor directly
 */
export function $createCustomDividerNode(): CustomDividerNode {
  return $applyNodeReplacement(new CustomDividerNode());
}

/**
 * Type guard to check if a node is a CustomDividerNode
 */
export function $isCustomDividerNode(
  node: LexicalNode | null | undefined,
): node is CustomDividerNode {
  return node instanceof CustomDividerNode;
}
