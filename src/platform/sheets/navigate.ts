/**
 * Visible navigation inside the Sheets UI: Google Sheets follows its URL
 * hash, so setting gid/range actually switches the tab and moves the
 * selection the user (and their screen reader) is on.
 */

export function navigateToTab(sheetId: number, win: Window = window): void {
  win.location.hash = `gid=${sheetId}`;
}

export function navigateToCell(
  sheetId: number,
  a1Range: string,
  win: Window = window,
): void {
  win.location.hash = `gid=${sheetId}&range=${encodeURIComponent(a1Range)}`;
}
