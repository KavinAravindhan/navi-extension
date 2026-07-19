import { columnNumberToLetter } from './a1';

/** Minimal shape of the Sheets API grid-data response we summarize. */
export interface FormattingGridData {
  sheetTitle: string;
  startRowIndex: number;
  startColumnIndex: number;
  rows: Array<
    Array<{
      formattedValue?: string;
      bold?: boolean;
      italic?: boolean;
      underline?: boolean;
      strikethrough?: boolean;
      backgroundHex?: string | null;
    }>
  >;
  mergeCount: number;
}

const MAX_REPORTED = 30;

/**
 * Turns cell formatting into a short spoken summary ("Text formatting
 * detection" tracker row): which cells are bold/italic/colored, plus merge
 * count. Cap-limited and explicit about what was left out.
 */
export function summarizeFormatting(data: FormattingGridData): string {
  const bold: string[] = [];
  const italic: string[] = [];
  const colored: string[] = [];

  data.rows.forEach((row, r) => {
    row.forEach((cell, c) => {
      if (!cell.formattedValue) return;
      const a1 = `${columnNumberToLetter(data.startColumnIndex + c + 1)}${
        data.startRowIndex + r + 1
      }`;
      if (cell.bold) bold.push(a1);
      if (cell.italic) italic.push(a1);
      if (cell.backgroundHex && cell.backgroundHex.toLowerCase() !== '#ffffff') {
        colored.push(`${a1} (${cell.backgroundHex})`);
      }
    });
  });

  const parts: string[] = [];
  const list = (cells: string[]) => {
    const shown = cells.slice(0, MAX_REPORTED).join(', ');
    return cells.length > MAX_REPORTED
      ? `${shown}, and ${cells.length - MAX_REPORTED} more`
      : shown;
  };

  if (bold.length > 0) parts.push(`Bold cells: ${list(bold)}.`);
  if (italic.length > 0) parts.push(`Italic cells: ${list(italic)}.`);
  if (colored.length > 0) parts.push(`Highlighted cells: ${list(colored)}.`);
  if (data.mergeCount > 0) {
    parts.push(
      `${data.mergeCount} merged cell range${data.mergeCount === 1 ? '' : 's'}.`,
    );
  }

  if (parts.length === 0) {
    return `No special formatting detected on ${data.sheetTitle} in that range.`;
  }
  return `Formatting on ${data.sheetTitle}: ${parts.join(' ')}`;
}

/**
 * Finds cells whose FORMULAS embed visuals — IMAGE() and SPARKLINE().
 * (Floating pictures over the grid are NOT exposed by Google's API to
 * anyone; this covers everything that is detectable.)
 */
export function findImageCells(
  formulaRows: Array<Array<string | number | null | undefined>>,
): string[] {
  const hits: string[] = [];
  formulaRows.forEach((row, r) => {
    row.forEach((cell, c) => {
      const formula = String(cell ?? '');
      if (/^\s*=.*\b(IMAGE|SPARKLINE)\s*\(/i.test(formula)) {
        hits.push(`${columnNumberToLetter(c + 1)}${r + 1}`);
      }
    });
  });
  return hits;
}
