/**
 * Point class represents a position in the editor buffer
 * @param {number} line - Line number (0-indexed)
 * @param {number} column - Column number (0-indexed)
 */
export class Point {
  line: number;
  column: number;

  constructor(line = 0, column = 0) {
    this.line = line;
    this.column = column;
  }

  static from(point: Point): Point {
    return new Point(point.line, point.column);
  }

  /**
   * Is this point equal to another
   * @param {Point} point
   */
  equals(point: Point): boolean {
    return this.line === point.line && this.column === point.column;
  }

  /**
   * Is this point before another
   * @param {Point} point
   */
  before(point: Point): boolean {
    return this.line < point.line
      ? true
      : this.line === point.line
      ? this.column < point.column
      : false;
  }

  /**
   * Is this point after another
   * @param {Point} point
   */
  after(point: Point): boolean {
    return this.line > point.line
      ? true
      : this.line === point.line
      ? this.column > point.column
      : false;
  }
}

/**
 * Range class represents a range between two points
 * @param {Point} start
 * @param {Point} end
 */
export class Range {
  start: Point;
  end: Point;

  constructor(start: Point, end: Point) {
    this.start = start;
    this.end = end;
  }
}

