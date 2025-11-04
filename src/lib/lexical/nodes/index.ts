/**
 * Custom Lexical Nodes
 *
 * This module exports all custom nodes for the Lexical editor.
 * These nodes extend the base Lexical nodes to provide custom
 * functionality and styling aligned with the editor theme.
 *
 * These nodes use the legacy API (Lexical v0.24.0) for compatibility with Liveblocks.
 * When @liveblocks/react-lexical supports newer Lexical versions, we can upgrade and use $config API.
 */

// Custom Paragraph Node
export {
  CustomParagraphNode,
  $createCustomParagraphNode,
  $isCustomParagraphNode,
  type SerializedCustomParagraphNode,
} from "./CustomParagraphNode";

// Custom Quote Node
export {
  CustomQuoteNode,
  $createCustomQuoteNode,
  $isCustomQuoteNode,
  type SerializedCustomQuoteNode,
} from "./CustomQuoteNode";

// Custom Divider Node
export {
  CustomDividerNode,
  $createCustomDividerNode,
  $isCustomDividerNode,
  type SerializedCustomDividerNode,
} from "./CustomDividerNode";

// Custom Code Block Node
export {
  CustomCodeBlockNode,
  $createCustomCodeBlockNode,
  $isCustomCodeBlockNode,
  type SerializedCustomCodeBlockNode,
} from "./CustomCodeBlockNode";

// Import node classes for registration array
import { CustomParagraphNode } from "./CustomParagraphNode";
import { CustomQuoteNode } from "./CustomQuoteNode";
import { CustomDividerNode } from "./CustomDividerNode";
import { CustomCodeBlockNode } from "./CustomCodeBlockNode";

/**
 * Array of all custom node classes for registration
 */
export const customNodes = [
  CustomParagraphNode,
  CustomQuoteNode,
  CustomDividerNode,
  CustomCodeBlockNode,
] as const;
