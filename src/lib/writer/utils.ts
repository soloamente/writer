import { editor, settings, elements } from './state';
import { measure } from './measure';
import { Point } from './position';
import type Selection from './selection';

/**
 * Convert a buffer point to screen coordinates (x, y)
 * @param {Point} point Buffer point
 * @return {{ x: number, y: number }}
 */
export function pointToXY(point: Point): { x: number; y: number } {
  const { buffer } = editor;

  // If no buffer, return basic positioning based on point coordinates
  // This allows cursor to render even without a buffer implementation
  if (!buffer) {
    // Simple fallback: approximate position based on line/column
    // For a typical font, we can estimate ~8px per character
    const approximateCharWidth = 8;
    const x = point.column * approximateCharWidth;
    const y = point.line * settings.text.lineHeight;
    return { x, y };
  }

  const [screenLine, screenColumn] = buffer.bufferToScreen(
    point.line,
    point.column,
  );

  const text = buffer.getScreenLineContent(screenLine);
  const x = screenColumn === 0 ? 0 : measure(text.slice(0, screenColumn));
  const y = screenLine * settings.text.lineHeight;

  return { x, y };
}

/**
 * Swap line positions (move lines up or down)
 * @param {number} change Positive to move down, negative to move up
 */
export function swapLine(change: number): void {
  // No change provided
  if (change == null) return;

  const { cursors, buffer } = editor;

  if (!buffer) return;

  cursors.forEach((cursor) => {
    if (cursor.selection.isCollapsed) {
      const { line, column } = cursor.position;
      if (buffer.swapLine(line, change)) {
        cursor.moveTo(line + change, column);
      }
    } else {
      const { start, end } = cursor.selection;
      buffer.swapLines(start.line, end.line, change);
      cursor.moveSelection(
        new Point(start.line + change, start.column),
        new Point(end.line + change, end.column),
      );
    }
  });
}

/**
 * Copy selected text to clipboard
 */
export function copy(): void {
  const { cursors } = editor;
  const texts: string[] = [];

  cursors.forEach((cursor) => {
    if (cursor.selection.isCollapsed) {
      return;
    }

    const text = getSelectionText(cursor.selection);
    texts.push(text);
  });

  navigator.clipboard.writeText(texts.join('\n')).catch((e) => {
    console.error('Failed to copy to clipboard!');
    console.error(e);
  });
}

/**
 * Cut selected text to clipboard
 */
export function cut(): void {
  const { cursors } = editor;

  // Copy, then delete
  copy();

  cursors.forEach((cursor) => {
    cursor.deleteSelection();
  });
}

/**
 * Insert text at cursor position(s)
 * @param {string} text
 */
export function insertText(text: string): void {
  const { cursors, buffer } = editor;

  if (!buffer) return;

  cursors.forEach((cursor) => {
    cursor.deleteSelection();

    const { line, column } = cursor.position;
    buffer.insert(line, column, text);
    buffer.wrapLine(line);
    cursor.moveRight(text.length);
  });
}

/**
 * Delete to start of line
 */
export function deleteToStartOfLine(): void {
  const { cursors, buffer } = editor;

  if (!buffer) return;

  cursors.forEach((cursor) => {
    const { line, column } = cursor.position;

    if (column === 0) {
      cursor.moveLeft();
      removeLine(line);
    } else {
      buffer.delete(line, column, -column);
      buffer.wrapLine(line);
      cursor.moveToStartOfLine();
    }
  });
}

/**
 * Delete to start of word
 */
export function deleteToStartOfWord(): void {
  const { cursors } = editor;

  cursors.forEach((cursor) => {
    if (!cursor.selection.isCollapsed) {
      cursor.deleteSelection();
      return;
    }

    const { line, column } = cursor.position;

    if (column === 0) {
      cursor.moveLeft();
      removeLine(line);
    } else {
      const current = cursor.selection.focus;
      cursor.moveToStartOfWord();
      cursor.moveWithSelect(current, true);
      cursor.deleteSelection();
    }
  });
}

/**
 * Handle backspace key
 */
export function backspace(): void {
  const { cursors, buffer } = editor;

  if (!buffer) return;

  cursors.forEach((cursor) => {
    const { line, column } = cursor.position;

    if (cursor.selection.isCollapsed) {
      if (column === 0) {
        cursor.moveLeft();
        removeLine(line);
      } else {
        buffer.delete(line, column, -1);
        buffer.wrapLine(line);
        cursor.moveLeft();
      }
    } else {
      cursor.deleteSelection();
    }
  });
}

/**
 * Get text content from a selection
 * @param {Selection} selection
 * @returns {string}
 */
export function getSelectionText(selection: Selection): string {
  const { buffer } = editor;

  if (!buffer) return '';

  const { start, end } = selection;

  if (start.line === end.line) {
    // Single buffer line
    const text = buffer.getLineContent(start.line);
    return text.slice(start.column, end.column);
  } else {
    // Spans multiple buffer lines
    const text: string[] = [];

    // Get portion from first buffer line
    const textFirst = buffer.getLineContent(start.line);
    text.push(textFirst.slice(start.column));

    // Get buffer lines in between
    const x = start.line + 1;
    const y = end.line - 1;
    const between = y - x + 1;

    for (let i = 0; i < between; i++) {
      text.push(buffer.getLineContent(i));
    }

    // Get portion from last buffer line
    const textLast = buffer.getLineContent(end.line);
    text.push(textLast.slice(0, end.column));

    return text.join('\n');
  }
}

/**
 * Insert a newline at cursor position(s)
 */
export function newline(): void {
  const { cursors, buffer } = editor;

  if (!buffer) return;

  cursors.forEach((cursor) => {
    const { line, column } = cursor.position;
    buffer.splitDown(line, column);
    cursor.startOfNextLine();
  });
}

/**
 * Remove a line and merge with previous line
 * @param {number} line
 */
export function removeLine(line: number): void {
  if (line === 0) return;

  const { buffer } = editor;

  if (!buffer) return;

  buffer.splitUp(line);
}

/**
 * Move cursor(s) right
 * @param {number} columns
 * @param {boolean} select
 */
export function moveRight(columns = 1, select?: boolean): void {
  const { cursors } = editor;

  cursors.forEach((cursor) => {
    cursor.moveRight(columns, select);
  });

  mergeCursors();
}

/**
 * Move cursor(s) left
 * @param {number} columns
 * @param {boolean} select
 */
export function moveLeft(columns = 1, select?: boolean): void {
  const { cursors } = editor;

  cursors.forEach((cursor) => {
    cursor.moveLeft(columns, select);
  });

  mergeCursors();
}

/**
 * Move cursor(s) up
 * @param {number} lines
 * @param {boolean} select
 */
export function moveUp(lines: number, select?: boolean): void {
  const { cursors } = editor;

  cursors.forEach((cursor) => {
    cursor.moveUp(lines, select);
  });

  mergeCursors();
}

/**
 * Move cursor(s) down
 * @param {number} lines
 * @param {boolean} select
 */
export function moveDown(lines: number, select?: boolean): void {
  const { cursors } = editor;

  cursors.forEach((cursor) => {
    cursor.moveDown(lines, select);
  });

  mergeCursors();
}

/**
 * Move to top of document
 * @param {boolean} select
 */
export function moveToTop(select?: boolean): void {
  flattenToOneCursor();
  const { cursors } = editor;

  if (cursors.length > 0) {
    cursors[0].moveToTop(select);
  }
}

/**
 * Move to bottom of document
 * @param {boolean} select
 */
export function moveToBottom(select?: boolean): void {
  flattenToOneCursor();
  const { cursors } = editor;

  if (cursors.length > 0) {
    cursors[0].moveToBottom(select);
  }
}

/**
 * Select all text
 */
export function selectAll(): void {
  flattenToOneCursor();
  const { cursors } = editor;

  if (cursors.length > 0) {
    cursors[0].moveToTop();
    cursors[0].moveToBottom(true);
  }
}

/**
 * Move to end of line
 * @param {boolean} select
 */
export function moveToEndOfLine(select?: boolean): void {
  const { cursors } = editor;

  cursors.forEach((cursor) => {
    cursor.moveToEndOfLine(select);
  });
}

/**
 * Move to start of line
 * @param {boolean} select
 */
export function moveToStartOfLine(select?: boolean): void {
  const { cursors } = editor;

  cursors.forEach((cursor) => {
    cursor.moveToStartOfLine(select);
  });
}

/**
 * Move to start of word
 * @param {boolean} select
 */
export function moveToStartOfWord(select?: boolean): void {
  const { cursors } = editor;

  cursors.forEach((cursor) => {
    cursor.moveToStartOfWord(select);
  });
}

/**
 * Move to end of word
 * @param {boolean} select
 */
export function moveToEndOfWord(select?: boolean): void {
  const { cursors } = editor;

  cursors.forEach((cursor) => {
    cursor.moveToEndOfWord(select);
  });
}

/**
 * Merge cursors at the same position
 */
export function mergeCursors(): void {
  const { cursors } = editor;

  const newCursors = [...cursors];
  const unique: Point[] = [];
  let i = 0;

  for (const cursor of cursors) {
    if (unique.some((pos) => pos.equals(cursor.position))) {
      newCursors.splice(i, 1);
    } else {
      unique.push(cursor.position);
      i++;
    }
  }

  editor.cursors = newCursors;
}

/**
 * Flatten to a single cursor
 */
export function flattenToOneCursor(): void {
  if (editor.cursors.length > 0) {
    editor.cursors = [editor.cursors[0]];
  }
}

/**
 * Get the main cursor (first cursor)
 * @returns {Cursor | undefined}
 */
export function getMainCursor() {
  return editor.cursors[0];
}

/**
 * Get total number of screen lines
 * @returns {number}
 */
export function getTotalLines(): number {
  const { buffer } = editor;

  if (!buffer) return 0;

  return buffer.screenLength;
}

/**
 * Get total height of document
 * @returns {number}
 */
export function getTotalHeight(): number {
  return getTotalLines() * settings.text.lineHeight;
}

/**
 * Get top buffer line
 * @returns {number}
 */
export function getTopBufferLine(): number {
  const { buffer } = editor;

  if (!buffer) return 0;

  const screen = getTopScreenLine();
  const [bl] = buffer.screenToBuffer(screen, 0);
  return bl;
}

/**
 * Get bottom buffer line
 * @returns {number}
 */
export function getBottomBufferLine(): number {
  const { buffer } = editor;

  if (!buffer) return 0;

  const screen = getBottomScreenLine();
  const [bl] = buffer.screenToBuffer(screen, 0);
  return bl;
}

/**
 * Get current scroll position
 * @returns {number}
 */
export function getScroll(): number {
  return editor.scroll;
}

/**
 * Scroll into view if needed
 * @param {number} scroll
 * @returns {boolean}
 */
export function scrollIntoViewIfNeeded(scroll: number): boolean {
  const currentScroll = getScroll();

  // New scroll is above the current screen view
  if (scroll <= currentScroll) {
    return setScroll(scroll);
  }

  const height = getEditorHeight();

  // New scroll is below the current screen view
  // only scroll amount needed
  if (scroll + settings.text.lineHeight > currentScroll + height) {
    return setScroll(scroll + settings.text.lineHeight - height);
  }

  return false;
}

/**
 * Really really long documents can have millions of pixels of scroll
 * if it gets above 1M px, our scroll hack will stop working correctly
 * so at the interval listed below, we'll reset the scroll back to 0
 * and render lines as if they were offset from the new scroll of 0
 * this lets us scroll infinitely without running into the 1M issue
 * The 500k limit is copied from Monaco
 */
const SCROLL_ROLLOVER = 500000;

/**
 * Get the top position of a screen line
 * @param {number} screenIndex
 * @returns {number}
 */
export function getLineTop(screenIndex: number): number {
  let top = (screenIndex * settings.text.lineHeight) % SCROLL_ROLLOVER;

  if (editor.rolloverScroll > SCROLL_ROLLOVER) {
    top -= SCROLL_ROLLOVER;
  }

  return top;
}

/**
 * Set scroll position
 * @param {number} newScroll
 * @returns {boolean}
 */
export function setScroll(newScroll: number): boolean {
  const old = editor.scroll;

  newScroll = clamp(0, getMaxScroll(), newScroll);
  editor.scroll = newScroll;

  if (newScroll !== old) {
    let top = editor.scroll % SCROLL_ROLLOVER;

    if (top > SCROLL_ROLLOVER) {
      top -= SCROLL_ROLLOVER;
    }

    editor.rolloverScroll = top;

    if (elements.editor) {
      const wrapper = elements.editor.querySelector<HTMLElement>(
        '[writer-wrapper]',
      );
      if (wrapper) {
        wrapper.style.top = `${-top}px`;
      }
    }
  }

  return newScroll !== old;
}

/**
 * Cache a function result until resize
 * @param {() => T} fn
 * @returns {() => T}
 */
function cachedUntilResize<T>(fn: () => T): () => T {
  let cache: T | null = null;

  window.addEventListener('resize', () => {
    cache = null;
  });

  return () => {
    if (!cache) {
      cache = fn();
    }
    return cache;
  };
}

/**
 * Get editor height (cached until resize)
 */
export const getEditorHeight = cachedUntilResize(() => {
  return elements.editor?.offsetHeight ?? 0;
});

/**
 * Get editor width (cached until resize)
 */
export const getEditorWidth = cachedUntilResize(() => {
  return elements.editor?.offsetWidth ?? 0;
});

/**
 * Get editor top position (cached until resize)
 */
export const getEditorTop = cachedUntilResize(() => {
  return elements.editor?.offsetTop ?? 0;
});

/**
 * Get editor left position (cached until resize)
 */
export const getEditorLeft = cachedUntilResize(() => {
  return elements.editor?.offsetLeft ?? 0;
});

/**
 * Get scrollbar track length
 * @returns {number}
 */
export function getScrollbarTrackLength(): number {
  return getEditorHeight() - settings.scrollbar.gap * 2;
}

/**
 * Get scrollbar thumb length
 * @returns {number}
 */
export function getScrollbarThumbLength(): number {
  const trackLength = getScrollbarTrackLength();
  return clamp(
    settings.scrollbar.minHeight,
    trackLength,
    trackLength / (1 + getMaxScroll() / trackLength),
  );
}

/**
 * Get top visible screen line
 * @returns {number}
 */
export function getTopScreenLine(): number {
  return Math.max(0, Math.floor(getScroll() / settings.text.lineHeight));
}

/**
 * Get bottom visible screen line
 * @returns {number}
 */
export function getBottomScreenLine(): number {
  // Why -1? who knows
  const bottom = getScroll() + getEditorHeight() - 1;
  return Math.min(
    getTotalLines() - 1,
    Math.max(0, Math.floor(bottom / settings.text.lineHeight)),
  );
}

/**
 * Convert line number to Y position with scroll
 * @param {number} lineNumber
 * @returns {number}
 */
export function lineToYWithScroll(lineNumber: number): number {
  const { scroll } = editor;
  return lineNumber * settings.text.lineHeight - scroll / 2;
}

/**
 * Convert line number to Y position
 * @param {number} lineNumber
 * @returns {number}
 */
export function lineToY(lineNumber: number): number {
  return lineNumber * settings.text.lineHeight;
}

/**
 * Convert Y coordinate to screen line
 * @param {number} y screen coordinate
 * @returns {number} Screen Line
 */
export function yToLine(y: number): number {
  const realY = y + getScroll() - getEditorTop();
  return Math.max(0, Math.floor(realY / settings.text.lineHeight));
}

/**
 * Convert Y coordinate to clamped screen line
 * @param {number} y
 * @returns {number}
 */
export function yToClampedLine(y: number): number {
  return clamp(0, getLastLineNumber(), yToLine(y));
}

/**
 * Convert X coordinate to screen column
 * @param {number} x screen coordinate
 * @param {number} lineNumber Screen line
 * @returns {number} Screen Column
 */
export function xToColumn(x: number, lineNumber: number): number {
  const { buffer } = editor;

  if (!buffer) return 0;

  const line = buffer.getScreenLineContent(lineNumber);
  const realX = x - getEditorLeft();
  let column = 0;

  // TODO: speed up lol, binary search or smthn
  for (let i = 0; i <= line.length; i++) {
    const width = measure(line.slice(0, i));
    const char = line.slice(i - 1, i);
    const charWidth = measure(char);

    column = i;

    if (width - charWidth / 2 > realX) {
      column = i - 1;
      break;
    }
  }

  return clamp(0, line.length, column);
}

/**
 * Get last buffer line number
 * @returns {number}
 */
export function getLastLineNumber(): number {
  const { buffer } = editor;

  if (!buffer) return 0;

  return buffer.length - 1;
}

/**
 * Get last screen line number
 * @returns {number}
 */
export function getLastScreenLineNumber(): number {
  const { buffer } = editor;

  if (!buffer) return 0;

  return buffer.screenLength - 1;
}

/**
 * Get last buffer line content
 * @returns {string}
 */
export function getLastLine(): string {
  const { buffer } = editor;

  if (!buffer) return '';

  return buffer.getLineContent(getLastLineNumber());
}

/**
 * Get last screen line content
 * @returns {string}
 */
export function getLastScreenLine(): string {
  const { buffer } = editor;

  if (!buffer) return '';

  return buffer.getScreenLineContent(getLastScreenLineNumber());
}

/**
 * Get last line last column point
 * @returns {Point}
 */
export function getLastLineLastColumn(): Point {
  return new Point(getLastLineNumber(), getLastLine().length);
}

/**
 * Get last screen line last column point
 * @returns {Point}
 */
export function getLastScreenLineLastColumn(): Point {
  return new Point(getLastScreenLineNumber(), getLastScreenLine().length);
}

/**
 * Get editor bounds
 * @returns {{ height: number, width: number }}
 */
export function bounds(): { height: number; width: number } {
  return {
    height: getEditorHeight(),
    width: getEditorWidth(),
  };
}

/**
 * Get maximum scroll value
 * @returns {number}
 */
export function getMaxScroll(): number {
  const { height } = bounds();
  const totalHeight = getTotalHeight();

  if (totalHeight > height) {
    return totalHeight - height;
  }

  return Math.min(totalHeight, height) - settings.text.lineHeight;
}

/**
 * Get relative X coordinate
 * @param {number} x
 * @returns {number}
 */
export function relativeX(x: number): number {
  return x - getEditorLeft();
}

/**
 * Get relative Y coordinate
 * @param {number} y
 * @returns {number}
 */
export function relativeY(y: number): number {
  return y - getEditorTop();
}

/**
 * Check if point is within bounds
 * @param {number} x
 * @param {number} y
 * @param {{ top: number, left: number, width: number, height: number }} bounds
 * @returns {boolean}
 */
export function withinBounds(
  x: number,
  y: number,
  bounds: { top: number; left: number; width: number; height: number },
): boolean {
  const relX = relativeX(x);
  const relY = relativeY(y);
  const { top, left, width, height } = bounds;

  return (
    relX >= left &&
    relX <= left + width &&
    relY >= top &&
    relY <= top + height
  );
}

/**
 * Delay execution until next animation frame
 * @returns {Promise<void>}
 */
export async function delay(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(resolve));
}

/**
 * Clamp a value between min and max
 * @param {number} min
 * @param {number} max
 * @param {number} val
 * @returns {number}
 */
export function clamp(min: number, max: number, val: number): number {
  return Math.max(min, Math.min(val, max));
}

/**
 * Get last element of array
 * @template T
 * @param {T[]} arr
 * @returns {T | undefined}
 */
export function last<T>(arr: T[]): T | undefined {
  return arr[arr.length - 1];
}

/**
 * Get first element of array
 * @template T
 * @param {T[]} arr
 * @returns {T | undefined}
 */
export function first<T>(arr: T[]): T | undefined {
  return arr[0];
}

/**
 * Sleep for specified milliseconds
 * @param {number} ms
 */
export async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => {
    setTimeout(() => resolve(void 0), ms);
  });
}

/**
 * Prevent default event and call function
 * @param {() => void} fn
 * @returns {(e: Event) => void}
 */
export function preventDefault(fn?: () => void): (e: Event) => void {
  return (e: Event) => {
    e.preventDefault();
    fn?.();
  };
}

/**
 * Remove all children from element
 * @param {HTMLElement} el
 */
export function removeAllChildren(el: HTMLElement): void {
  while (el.firstChild) {
    el.removeChild(el.firstChild);
  }
}

