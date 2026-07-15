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
