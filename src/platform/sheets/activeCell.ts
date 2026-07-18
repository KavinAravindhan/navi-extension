/**
 * Reads the active cell reference (e.g. "B3") from Google Sheets' Name Box.
 * Returns null when it cannot be found — callers must speak a graceful
 * fallback instead of failing silently (NAVI-004).
 */
export function getActiveCellA1(doc: Document = document): string | null {
  const nameBox = doc.querySelector<HTMLInputElement>('#t-name-box');
  const value = nameBox?.value?.trim();
  return value ? value : null;
}
