/**
 * Custom Code Block Node for Lexical Editor
 *
 * Extends ElementNode to create a code block node with language support.
 * This node can store an optional language identifier for syntax highlighting.
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
 * Serialized representation of CustomCodeBlockNode
 */
export type SerializedCustomCodeBlockNode = Spread<
  {
    type: "custom-codeblock";
    language?: string;
    version: 1;
  },
  SerializedElementNode
>;

/**
 * Custom Code Block Node that extends ElementNode
 * Provides code block styling with optional language identifier
 */
export class CustomCodeBlockNode extends ElementNode {
  __language?: string;

  constructor(language?: string, key?: NodeKey) {
    super(key);
    this.__language = language;
  }

  static getType(): string {
    return "custom-codeblock";
  }

  static clone(node: CustomCodeBlockNode): CustomCodeBlockNode {
    return new CustomCodeBlockNode(node.__language, node.__key);
  }

  /**
   * Gets the language identifier for this code block
   */
  getLanguage(): string | undefined {
    const self = this.getLatest();
    return self.__language;
  }

  /**
   * Sets the language identifier for this code block
   */
  setLanguage(language: string | undefined): this {
    const self = this.getWritable();
    self.__language = language;
    return self;
  }

  /**
   * Creates a DOM element for this node
   * Returns a <pre> element with <code> child and appropriate classes
   */
  createDOM(config: EditorConfig): HTMLElement {
    const element = document.createElement("pre");
    // Apply theme classes from editorTheme
    element.className =
      "bg-muted text-foreground font-mono block px-4 py-3 mb-[0.8em] rounded-lg overflow-x-auto relative text-sm leading-[1.5] dark:bg-card";

    const codeElement = document.createElement("code");
    if (this.__language) {
      codeElement.setAttribute("data-language", this.__language);
      codeElement.className = `language-${this.__language}`;
    }
    element.appendChild(codeElement);

    return element;
  }

  /**
   * Updates the DOM element when node changes
   * Returns false if the element doesn't need to be replaced
   */
  updateDOM(
    prevNode: CustomCodeBlockNode,
    dom: HTMLElement,
    config: EditorConfig,
  ): boolean {
    // If language changed, we need to update the code element
    const codeElement = dom.querySelector("code");
    if (codeElement) {
      const languageChanged = prevNode.__language !== this.__language;
      if (languageChanged) {
        if (this.__language) {
          codeElement.setAttribute("data-language", this.__language);
          codeElement.className = `language-${this.__language}`;
        } else {
          codeElement.removeAttribute("data-language");
          codeElement.className = "";
        }
      }
    }
    return false; // Don't replace the element
  }

  /**
   * Exports the node to JSON for serialization
   */
  exportJSON(): SerializedCustomCodeBlockNode {
    const baseSerialized = super.exportJSON();
    const serialized: SerializedCustomCodeBlockNode = {
      ...baseSerialized,
      type: "custom-codeblock",
      version: 1,
    };

    const language = this.getLanguage();
    if (language) {
      serialized.language = language;
    }

    return serialized;
  }

  /**
   * Imports node from JSON during deserialization
   */
  static importJSON(
    serializedNode: SerializedCustomCodeBlockNode,
  ): CustomCodeBlockNode {
    const { version, language } = serializedNode;
    const node = $createCustomCodeBlockNode(language);
    node.setFormat(serializedNode.format);
    node.setIndent(serializedNode.indent);
    node.setDirection(serializedNode.direction);
    return node;
  }

  /**
   * Handles cloning from another node
   */
  afterCloneFrom(node: CustomCodeBlockNode): void {
    this.__language = node.__language;
  }

  /**
   * Checks if this node can be empty
   * Code blocks can be empty
   */
  canBeEmpty(): boolean {
    return true;
  }

  /**
   * Checks if this node is inline
   * Code blocks are block-level elements
   */
  isInline(): boolean {
    return false;
  }

  /**
   * Checks if text can be inserted before this node
   */
  canInsertTextBefore(): boolean {
    return false;
  }

  /**
   * Checks if text can be inserted after this node
   */
  canInsertTextAfter(): boolean {
    return false;
  }
}

/**
 * Creates a new CustomCodeBlockNode instance
 * Use this function instead of calling the constructor directly
 *
 * @param language - Optional programming language identifier
 */
export function $createCustomCodeBlockNode(
  language?: string,
): CustomCodeBlockNode {
  return $applyNodeReplacement(new CustomCodeBlockNode(language));
}

/**
 * Type guard to check if a node is a CustomCodeBlockNode
 */
export function $isCustomCodeBlockNode(
  node: LexicalNode | null | undefined,
): node is CustomCodeBlockNode {
  return node instanceof CustomCodeBlockNode;
}
