import type {
  EditCellRequest,
  EditCellResponse,
  GetWorkbookRequest,
  GetWorkbookResponse,
  ReadRangeRequest,
  ReadRangeResponse,
  SheetTabInfo,
} from './messages';

/** Wraps chrome.identity.getAuthToken in a promise; prompts sign-in if needed. */
function getAuthToken(): Promise<string> {
  return new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive: true }, (token) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(token as string);
      }
    });
  });
}

/** Sheet metadata requested for the workbook model (NAVI-007/013/014). */
const WORKBOOK_FIELDS =
  'properties.title,sheets(properties(sheetId,title,index,gridProperties(rowCount,columnCount)),charts(chartId,spec(title,basicChart(chartType))))';

/**
 * Background-side workbook metadata read: title, tabs (with sizes), and
 * embedded charts — via OAuth, so private sheets work.
 */
export async function handleGetWorkbook({
  spreadsheetId,
}: GetWorkbookRequest): Promise<GetWorkbookResponse> {
  try {
    const token = await getAuthToken();
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=${encodeURIComponent(WORKBOOK_FIELDS)}`;

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await response.json();

    if (data.error) return { success: false, error: data.error.message };

    const tabs: SheetTabInfo[] = (data.sheets ?? []).map((sheet: any) => ({
      sheetId: sheet.properties?.sheetId ?? 0,
      title: sheet.properties?.title ?? 'Untitled',
      index: sheet.properties?.index ?? 0,
      rowCount: sheet.properties?.gridProperties?.rowCount ?? 0,
      columnCount: sheet.properties?.gridProperties?.columnCount ?? 0,
      charts: (sheet.charts ?? []).map((chart: any) => ({
        chartId: chart.chartId ?? 0,
        title: chart.spec?.title || 'Untitled chart',
        chartType: chart.spec?.basicChart?.chartType ?? 'CHART',
      })),
    }));

    return { success: true, title: data.properties?.title ?? '', tabs };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

/** Background-side range read via OAuth (formatted values). */
export async function handleReadRange({
  spreadsheetId,
  range,
}: ReadRangeRequest): Promise<ReadRangeResponse> {
  try {
    const token = await getAuthToken();
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}?valueRenderOption=FORMATTED_VALUE`;

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await response.json();

    if (data.error) return { success: false, error: data.error.message };

    return { success: true, values: data.values ?? [] };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

/**
 * Background-side cell edit: fetches an OAuth token and PUTs the new value to
 * the Google Sheets API. Never throws — always resolves to a response the
 * content script can turn into a spoken message. Ported verbatim from v1.
 */
export async function handleEditCell({
  spreadsheetId,
  sheetName,
  cellAddress,
  newValue,
}: EditCellRequest): Promise<EditCellResponse> {
  try {
    const token = await getAuthToken();

    const range = `${sheetName}!${cellAddress}`;
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`;

    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        range: range,
        values: [[newValue]],
      }),
    });

    const data = await response.json();

    if (data.error) {
      return { success: false, error: data.error.message };
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}
