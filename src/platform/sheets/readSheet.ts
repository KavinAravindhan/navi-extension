import { getActiveSheetName, getSpreadsheetId } from './location';

type CellValue = string | number | null | undefined;

/**
 * Formats raw Sheets API row values into the plain-text layout NAVI feeds to
 * the LLM ("Row 1: a | b | c"). Ported verbatim from v1, including its quirks:
 * - rows whose cells are all empty are skipped, but row numbers keep counting
 * - every row is padded to the widest row's column count
 * - falsy cell values (including numeric 0) render as empty strings
 */
export function formatRows(sheetName: string, rows: CellValue[][]): string {
  const maxCols = Math.max(...rows.map((r) => r.length));
  let result = `Sheet: ${sheetName}\n\n`;

  rows.forEach((row, i) => {
    if (row.every((cell) => !cell || cell.toString().trim() === '')) return;
    const paddedRow = Array.from({ length: maxCols }, (_, j) => row[j] || '');
    result += `Row ${i + 1}: ${paddedRow.join(' | ')}\n`;
  });

  return result;
}

/**
 * Reads the active sheet's values through the Google Sheets REST API and
 * returns them as plain text for the LLM context. Any failure returns a
 * human-readable message instead of throwing, so the assistant can speak it.
 */
export async function readSpreadsheetData(apiKey: string): Promise<string> {
  try {
    const spreadsheetId = getSpreadsheetId(window.location.href);
    if (!spreadsheetId) return 'Could not find spreadsheet ID in URL.';

    const sheetName = getActiveSheetName();

    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(sheetName)}?key=${apiKey}&valueRenderOption=FORMATTED_VALUE`;

    const response = await fetch(url);
    const data = await response.json();

    if (data.error) return `API error: ${data.error.message}`;

    const rows: CellValue[][] = data.values || [];
    if (rows.length === 0) return 'Sheet appears to be empty.';

    const result = formatRows(sheetName, rows);

    console.log('NAVI DATA:', result);
    return result;
  } catch (error) {
    console.error('NAVI: Error reading spreadsheet:', error);
    return 'Error reading spreadsheet data.';
  }
}
