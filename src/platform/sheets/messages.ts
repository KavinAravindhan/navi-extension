// Message contract between the content script and the background service
// worker. Keep in sync on both sides — the tests lock this shape.

export const EDIT_CELL_ACTION = 'editCell' as const;

export interface EditCellRequest {
  action: typeof EDIT_CELL_ACTION;
  spreadsheetId: string;
  sheetName: string;
  cellAddress: string;
  newValue: string;
}

export interface EditCellResponse {
  success: boolean;
  error?: string;
}
