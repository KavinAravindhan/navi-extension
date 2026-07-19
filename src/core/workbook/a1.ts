/**
 * Converts a 1-based column number to its A1-notation letter(s):
 * 1 → A, 26 → Z, 27 → AA, 703 → AAA.
 */
export function columnNumberToLetter(colNumber: number): string {
  let letter = '';
  while (colNumber > 0) {
    const remainder = (colNumber - 1) % 26;
    letter = String.fromCharCode(65 + remainder) + letter;
    colNumber = Math.floor((colNumber - 1) / 26);
  }
  return letter;
}

/** A1 letters → 1-based column number: A → 1, Z → 26, AA → 27. */
export function letterToColumnNumber(letters: string): number {
  let value = 0;
  for (const char of letters.toUpperCase()) {
    value = value * 26 + (char.charCodeAt(0) - 64);
  }
  return value;
}

/** 0-based, end-exclusive grid coordinates (the Sheets API GridRange shape). */
export interface GridRange {
  startRowIndex: number;
  endRowIndex: number;
  startColumnIndex: number;
  endColumnIndex: number;
}

/**
 * Parses "A1:B10" (or a single cell "B3") into a GridRange.
 * Returns null for anything it cannot parse — callers speak an honest
 * failure instead of charting the wrong cells.
 */
export function parseA1Range(range: string): GridRange | null {
  const match = range
    .trim()
    .match(/^\$?([A-Za-z]{1,3})\$?(\d+)(?::\$?([A-Za-z]{1,3})\$?(\d+))?$/);
  if (!match) return null;

  const [, startColLetters, startRowStr, endColLetters, endRowStr] = match;
  const startCol = letterToColumnNumber(startColLetters);
  const startRow = parseInt(startRowStr, 10);
  const endCol = endColLetters ? letterToColumnNumber(endColLetters) : startCol;
  const endRow = endRowStr ? parseInt(endRowStr, 10) : startRow;

  if (startRow < 1 || endRow < startRow || endCol < startCol) return null;

  return {
    startRowIndex: startRow - 1,
    endRowIndex: endRow,
    startColumnIndex: startCol - 1,
    endColumnIndex: endCol,
  };
}
