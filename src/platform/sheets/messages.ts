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

// Sent from the background worker to the content script when the user
// presses the browser-level open-NAVI shortcut (chrome.commands).
export const OPEN_NAVI_ACTION = 'openNavi' as const;

export interface OpenNaviMessage {
  action: typeof OPEN_NAVI_ACTION;
}

// ---------------------------------------------------------------------
// Workbook reads — routed through the background's OAuth token so private
// sheets work (the v1 API-key reads only worked on link-public sheets).
// ---------------------------------------------------------------------

export const GET_WORKBOOK_ACTION = 'getWorkbook' as const;

export interface GetWorkbookRequest {
  action: typeof GET_WORKBOOK_ACTION;
  spreadsheetId: string;
}

export interface SheetChartInfo {
  chartId: number;
  title: string;
  chartType: string;
}

export interface SheetTabInfo {
  sheetId: number;
  title: string;
  index: number;
  rowCount: number;
  columnCount: number;
  charts: SheetChartInfo[];
}

export interface GetWorkbookResponse {
  success: boolean;
  error?: string;
  title?: string;
  tabs?: SheetTabInfo[];
}

export const READ_RANGE_ACTION = 'readRange' as const;

export interface ReadRangeRequest {
  action: typeof READ_RANGE_ACTION;
  spreadsheetId: string;
  /** A1 range or a (quoted) sheet title for the whole tab. */
  range: string;
  /** FORMULA returns formulas instead of values (image detection). */
  render?: 'FORMATTED_VALUE' | 'FORMULA';
}

export interface ReadRangeResponse {
  success: boolean;
  error?: string;
  values?: (string | number | null)[][];
}

export const CREATE_CHART_ACTION = 'createChart' as const;

export interface CreateChartRequest {
  action: typeof CREATE_CHART_ACTION;
  spreadsheetId: string;
  sheetId: number;
  chartType: 'LINE' | 'COLUMN' | 'BAR' | 'PIE';
  title: string;
  gridRange: {
    startRowIndex: number;
    endRowIndex: number;
    startColumnIndex: number;
    endColumnIndex: number;
  };
}

export interface CreateChartResponse {
  success: boolean;
  error?: string;
}

export const READ_FORMATTING_ACTION = 'readFormatting' as const;

export interface ReadFormattingRequest {
  action: typeof READ_FORMATTING_ACTION;
  spreadsheetId: string;
  /** Quoted-sheet A1 range, e.g. 'Budget'!A1:D20 */
  range: string;
}

export interface ReadFormattingResponse {
  success: boolean;
  error?: string;
  summary?: string;
}
