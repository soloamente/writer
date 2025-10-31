import { Point } from './position';

type SelectionDirection = 'forward' | 'backward';

/**
 * Selection class manages text selection state
 * Tracks anchor (start) and focus (end) points of selection
 */
export default class Selection {
  /** @private */
  private _focus: Point;

  /** @private */
  private _anchor: Point;

  start: Point;
  end: Point;

  /** @type {boolean} */
  isCollapsed: boolean;

  /** @type {'forward' | 'backward'} */
  direction: SelectionDirection;

  /**
   * @param {{ point?: Point }} params
   */
  constructor(params: { point?: Point } = {}) {
    const initialPoint = params.point || new Point();
    this._focus = Point.from(initialPoint);
    this._anchor = Point.from(initialPoint);
    this.start = Point.from(initialPoint);
    this.end = Point.from(initialPoint);
    this.isCollapsed = true;
    this.direction = getDirection(this._focus, this._anchor);
  }

  /**
   * Get the focus point (where cursor currently is)
   * @returns {Point}
   */
  get focus(): Point {
    return this._focus;
  }

  /**
   * Get the anchor point (where selection started)
   * @returns {Point}
   */
  get anchor(): Point {
    return this._anchor;
  }

  /**
   * Set the focus point and update derived properties
   * @param {Point} focus
   */
  set focus(focus: Point) {
    this._focus = focus;
    this.derive();
  }

  /**
   * Set the anchor point and update derived properties
   * @param {Point} anchor
   */
  set anchor(anchor: Point) {
    this._anchor = anchor;
    this.derive();
  }

  /**
   * Derive start, end, direction, and collapsed state from anchor and focus
   */
  private derive(): void {
    this.direction = getDirection(this._focus, this._anchor);
    this.isCollapsed = this._focus.equals(this._anchor);
    this.start =
      this.direction === 'forward' ? this._anchor : this._focus;
    this.end =
      this.direction === 'forward' ? this._focus : this._anchor;
  }
}

/**
 * Determine selection direction based on focus and anchor positions
 * @param {Point} focus
 * @param {Point} anchor
 * @returns {'forward' | 'backward'}
 */
function getDirection(focus: Point, anchor: Point): SelectionDirection {
  if (focus.before(anchor)) {
    return 'backward';
  }
  return 'forward';
}

