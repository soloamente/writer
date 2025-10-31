import type Cursor from './cursor';
// Note: Buffer will be implemented separately
// For now, we'll define a placeholder type
type Buffer = any;

// Note: Canvas context type
type CanvasContext = CanvasRenderingContext2D | null;

export interface EditorState {
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

export interface EditorElements {
  editor: HTMLElement | null;
  lines: HTMLElement | null;
  decorations: HTMLElement | null;
  textarea: HTMLTextAreaElement | null;
  scrollbar: HTMLElement | null;
  scrollbarThumb: HTMLElement | null;
  dumpButton: HTMLElement | null;
}

export interface EditorSettings {
  text: {
    color: string;
    lineHeight: number;
    fontSize: number;
    font: string;
  };
  cursor: {
    width: number;
    color: string;
    radius: number;
    animation: {
      duration: number;
    };
  };
  scroll: {
    animation: {
      duration: number;
    };
  };
  scrollbar: {
    width: number;
    gap: number;
    minHeight: number;
    color: string;
    activeColor: string;
    animation: {
      delay: number;
      duration: number;
    };
  };
  selection: {
    color: string;
  };
  wrapping: {
    /** @type {'break-all' | 'break-word' | 'measure'} */
    algorithm: 'break-all' | 'break-word' | 'measure';
  };
}

export const editor: EditorState = {
  drawing: { scroll: 0, scrollbar: { opacity: 0 } },
  scroll: 0,
  rolloverScroll: 0,
  cursors: [],
  buffer: null,
  ctx: null,
  moveContext: { detail: 0 },
  scrollbarContext: {},
};

export const elements: EditorElements = {
  editor: null,
  lines: null,
  decorations: null,
  textarea: null,
  scrollbar: null,
  scrollbarThumb: null,
  dumpButton: null,
};

export const settings: EditorSettings = {
  text: {
    color: '#e5e5e5',
    lineHeight: 28,
    fontSize: 16,
    font: 'iA Writer Mono V, Menlo, monospace',
  },
  cursor: {
    width: 4,
    color: '#838383',
    radius: 2,
    animation: {
      duration: 80,
    },
  },
  scroll: {
    animation: {
      duration: 80,
    },
  },
  scrollbar: {
    width: 8,
    gap: 5,
    minHeight: 32,
    color: 'rgba(127, 127, 127, 0.5)',
    activeColor: 'rgba(200, 200, 200, 0.5)',
    animation: {
      delay: 800,
      duration: 200,
    },
  },
  selection: {
    color: '#444',
  },
  wrapping: {
    algorithm: 'measure',
  },
};

