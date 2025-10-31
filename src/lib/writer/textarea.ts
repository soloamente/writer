import { elements } from './state';

export interface CalculateSelectionParams {
  text: string;
  direction: 'forward' | 'backward';
  amount: 'word' | 'character' | 'line';
  column: number;
}

/**
 * Calculate selection position using native textarea behavior
 * This leverages the browser's native selection logic for word/character movement
 * @param {CalculateSelectionParams} params
 * @returns {number}
 */
export function calculateSelection({
  text,
  direction,
  amount,
  column,
}: CalculateSelectionParams): number {
  const { textarea: element } = elements;

  if (!element) {
    throw new Error('Textarea element not initialized');
  }

  element.value = text;
  element.setSelectionRange(column, column, 'forward');

  const selection = window.getSelection();
  element.focus();

  if (selection) {
    // Use native selection modification
    // Note: This API may have limited browser support
    selection.modify('move', direction, amount);
  }

  const col = element.selectionStart;
  element.value = '';

  return col;
}

