/**
 * Reactive store for editor state using the React Hook Getter pattern
 * 
 * This replaces the direct mutation of editorState with a reactive store
 * that only triggers re-renders when accessed properties change.
 */

import { createStore } from "@/lib/store";
import type { EditorState } from "./state";
import type Cursor from "./cursor";

// Note: Buffer will be implemented separately
// For now, we'll define a placeholder type
type Buffer = any;

// Note: Canvas context type
type CanvasContext = CanvasRenderingContext2D | null;

/**
 * Store state interface matching EditorState but with reactive properties
 */
interface EditorStoreState extends Record<string, unknown> {
  drawing: {
    scroll: number;
    scrollbar: { opacity: number };
  };
  scroll: number;
  rolloverScroll: number;
  cursors: Cursor[];
  buffer: Buffer | null;
  ctx: CanvasContext;
  moveContext: { detail: number };
  scrollbarContext: Record<string, unknown>;
}

/**
 * Initial editor state
 */
const initialEditorState: EditorStoreState = {
  drawing: { scroll: 0, scrollbar: { opacity: 0 } },
  scroll: 0,
  rolloverScroll: 0,
  cursors: [],
  buffer: null,
  ctx: null,
  moveContext: { detail: 0 },
  scrollbarContext: {},
};

/**
 * Create reactive store for editor state
 * Components using this store will only re-render when accessed properties change
 */
export const useEditorStore = createStore(initialEditorState);

/**
 * Get the raw state object (for actions that need to mutate outside React)
 * Note: This bypasses the reactive system, so use store actions or hooks when possible
 */
export function getEditorStoreState(): EditorStoreState {
  return useEditorStore.getState();
}

/**
 * Helper functions to mutate editor state reactively
 * These ensure that array mutations trigger re-renders properly
 * These can be called from anywhere (not just React components)
 */
export const editorStoreActions = {
  /**
   * Add a cursor to the editor state
   * This creates a new array reference to trigger re-renders
   */
  addCursor: (cursor: Cursor) => {
    const state = useEditorStore.getState();
    useEditorStore.setState("cursors", [...state.cursors, cursor]);
  },

  /**
   * Remove a cursor from the editor state
   * This creates a new array reference to trigger re-renders
   */
  removeCursor: (cursorId: string) => {
    const state = useEditorStore.getState();
    useEditorStore.setState(
      "cursors",
      state.cursors.filter((c) => c.id !== cursorId),
    );
  },

  /**
   * Update cursors array
   * This creates a new array reference to trigger re-renders
   */
  setCursors: (cursors: Cursor[]) => {
    useEditorStore.setState("cursors", cursors);
  },

  /**
   * Update scroll position
   */
  setScroll: (scroll: number) => {
    useEditorStore.setState("scroll", scroll);
  },

  /**
   * Update rollover scroll position
   */
  setRolloverScroll: (rolloverScroll: number) => {
    useEditorStore.setState("rolloverScroll", rolloverScroll);
  },

  /**
   * Update drawing scroll
   */
  setDrawingScroll: (scroll: number) => {
    const state = useEditorStore.getState();
    useEditorStore.setState("drawing", { ...state.drawing, scroll });
  },

  /**
   * Update scrollbar opacity
   */
  setScrollbarOpacity: (opacity: number) => {
    const state = useEditorStore.getState();
    useEditorStore.setState("drawing", {
      ...state.drawing,
      scrollbar: { opacity },
    });
  },

  /**
   * Update canvas context
   */
  setContext: (ctx: CanvasContext) => {
    useEditorStore.setState("ctx", ctx);
  },

  /**
   * Update move context detail
   */
  setMoveContextDetail: (detail: number) => {
    useEditorStore.setState("moveContext", { detail });
  },
};

