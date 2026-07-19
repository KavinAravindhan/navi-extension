import { summarizeFormatting } from '@/core/workbook/formatting';
import type {
  CreateChartRequest,
  CreateChartResponse,
  EditCellRequest,
  EditCellResponse,
  GetWorkbookRequest,
  GetWorkbookResponse,
  ReadFormattingRequest,
  ReadFormattingResponse,
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

/** Background-side range read via OAuth (formatted values or formulas). */
export async function handleReadRange({
  spreadsheetId,
  range,
  render,
}: ReadRangeRequest): Promise<ReadRangeResponse> {
  try {
    const token = await getAuthToken();
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}?valueRenderOption=${render ?? 'FORMATTED_VALUE'}`;

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
 * Background-side chart creation (NAVI-016): inserts a basic chart (or pie)
 * over the given data range, anchored just right of the data. First row is
 * treated as headers; first column as the domain.
 */
export async function handleCreateChart({
  spreadsheetId,
  sheetId,
  chartType,
  title,
  gridRange,
}: CreateChartRequest): Promise<CreateChartResponse> {
  try {
    const token = await getAuthToken();

    const sourceColumn = (columnIndex: number) => ({
      sources: [
        {
          sheetId,
          startRowIndex: gridRange.startRowIndex,
          endRowIndex: gridRange.endRowIndex,
          startColumnIndex: columnIndex,
          endColumnIndex: columnIndex + 1,
        },
      ],
    });

    const spec: Record<string, unknown> = { title };
    if (chartType === 'PIE') {
      spec.pieChart = {
        legendPosition: 'BOTTOM_LEGEND',
        domain: { sourceRange: sourceColumn(gridRange.startColumnIndex) },
        series: { sourceRange: sourceColumn(gridRange.startColumnIndex + 1) },
      };
    } else {
      const series = [];
      for (
        let column = gridRange.startColumnIndex + 1;
        column < gridRange.endColumnIndex;
        column++
      ) {
        series.push({
          series: { sourceRange: sourceColumn(column) },
          targetAxis: 'LEFT_AXIS',
        });
      }
      spec.basicChart = {
        chartType,
        legendPosition: 'BOTTOM_LEGEND',
        headerCount: 1,
        domains: [
          { domain: { sourceRange: sourceColumn(gridRange.startColumnIndex) } },
        ],
        series,
      };
    }

    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        requests: [
          {
            addChart: {
              chart: {
                spec,
                position: {
                  overlayPosition: {
                    anchorCell: {
                      sheetId,
                      rowIndex: gridRange.startRowIndex,
                      columnIndex: gridRange.endColumnIndex + 1,
                    },
                  },
                },
              },
            },
          },
        ],
      }),
    });
    const data = await response.json();

    if (data.error) return { success: false, error: data.error.message };
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

/** Formatting fields requested for the read_formatting tool. */
const FORMATTING_FIELDS =
  'sheets(properties(title),merges,data(startRow,startColumn,rowData(values(formattedValue,effectiveFormat(textFormat(bold,italic,underline,strikethrough),backgroundColor)))))';

function colorToHex(color: { red?: number; green?: number; blue?: number } | undefined): string | null {
  if (!color) return null;
  const channel = (v: number | undefined) =>
    Math.round((v ?? 0) * 255)
      .toString(16)
      .padStart(2, '0');
  return `#${channel(color.red)}${channel(color.green)}${channel(color.blue)}`;
}

/** Background-side formatting read → short spoken summary. */
export async function handleReadFormatting({
  spreadsheetId,
  range,
}: ReadFormattingRequest): Promise<ReadFormattingResponse> {
  try {
    const token = await getAuthToken();
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?ranges=${encodeURIComponent(range)}&includeGridData=true&fields=${encodeURIComponent(FORMATTING_FIELDS)}`;

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await response.json();

    if (data.error) return { success: false, error: data.error.message };

    const sheet = data.sheets?.[0];
    const grid = sheet?.data?.[0];
    const rows = (grid?.rowData ?? []).map(
      (row: { values?: any[] }) =>
        (row.values ?? []).map((cell: any) => ({
          formattedValue: cell.formattedValue,
          bold: cell.effectiveFormat?.textFormat?.bold ?? false,
          italic: cell.effectiveFormat?.textFormat?.italic ?? false,
          underline: cell.effectiveFormat?.textFormat?.underline ?? false,
          strikethrough: cell.effectiveFormat?.textFormat?.strikethrough ?? false,
          backgroundHex: colorToHex(cell.effectiveFormat?.backgroundColor),
        })),
    );

    const summary = summarizeFormatting({
      sheetTitle: sheet?.properties?.title ?? 'the sheet',
      startRowIndex: grid?.startRow ?? 0,
      startColumnIndex: grid?.startColumn ?? 0,
      rows,
      mergeCount: (sheet?.merges ?? []).length,
    });

    return { success: true, summary };
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
