/**
 * Extracts the spreadsheet ID from a Google Sheets URL, or null when the URL
 * is not a spreadsheet.
 */
export function getSpreadsheetId(url: string): string | null {
  const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : null;
}

/**
 * Reads the active sheet-tab name from the Google Sheets DOM.
 * The tab element's text is prefixed with its position number (e.g. "2Budget"),
 * so leading digits are stripped. Falls back to "Sheet1" when the element is
 * missing. Ported verbatim from v1.
 */
export function getActiveSheetName(doc: Document = document): string {
  const activeTab = doc.querySelector('.docs-sheet-active-tab');
  let rawName = activeTab ? (activeTab.textContent ?? '').trim() : 'Sheet1';
  rawName = rawName.replace(/^\d+/, '').trim();
  return rawName;
}
