import { settings } from './state';
import { getEditorWidth } from './utils';

// Note: LineBreaker package needs to be installed: npm install @rkusa/linebreak
// For now, using a simple implementation that can be enhanced later

/** @type {CanvasRenderingContext2D | null} */
let measureCtx: CanvasRenderingContext2D | null = null;
let monospaceWidth: number | null = null;

const measureCache = new Map<string, number>();

/**
 * Cache text measurements for performance
 * @param {string} text
 * @returns {number}
 */
function cacheOrMeasure(text: string): number {
  let width = measureCache.get(text);
  if (!width) {
    if (!measureCtx) {
      setup();
    }
    width = measureCtx!.measureText(text).width;
    measureCache.set(text, width);
  }
  return width;
}

/**
 * Measure the width of text
 * @param {string} text
 * @returns {number}
 */
export function measure(text: string): number {
  if (!text) {
    return 0;
  }

  if (monospaceWidth) {
    return text.length * monospaceWidth;
  }

  let width = 0;
  for (const char of text) {
    width += cacheOrMeasure(char);
  }
  return width;
}

const empty: number[] = [];

/**
 * Get line break positions for text wrapping
 * Uses a simple word-breaking algorithm
 * TODO: Install @rkusa/linebreak for better line breaking support
 * @param {string} text
 * @returns {number[]}
 */
export function getLineBreak(text: string): number[] {
  // Skip measuring empty lines
  if (!text) return empty;

  const maxWidth = getEditorWidth() - 10;

  // Skip wrapping any lines that don't reach the full width of the editor
  if (measure(text) < maxWidth) {
    return empty;
  }

  // Simple word-break implementation
  // Split by whitespace and break at word boundaries
  const breaks: number[] = [];
  const words = text.split(/(\s+)/);
  let currentWidth = 0;
  let position = 0;

  for (const word of words) {
    const wordWidth = measure(word);

    if (currentWidth + wordWidth > maxWidth && currentWidth > 0) {
      breaks.push(position);
      currentWidth = wordWidth;
    } else {
      currentWidth += wordWidth;
    }

    position += word.length;
  }

  return breaks;
}

/**
 * Initialize the measurement context
 */
function setup(): void {
  measureCtx = document
    .createElement('canvas')
    .getContext('2d', { alpha: false, desynchronized: true });

  if (!measureCtx) {
    throw new Error('Failed to create canvas context for text measurement');
  }

  const font = `${settings.text.fontSize}px ${settings.text.font}`;
  measureCtx.font = font;

  const i = cacheOrMeasure('i');
  const W = cacheOrMeasure('W');

  if (i === W) {
    monospaceWidth = i;
  }
}

// Initialize on module load
setup();

