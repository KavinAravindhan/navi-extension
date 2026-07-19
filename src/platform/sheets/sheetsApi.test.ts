import { beforeEach, describe, expect, it, vi } from 'vitest';
import { installChromeMock } from '@/test/chrome';
import {
  handleCreateChart,
  handleEditCell,
  handleGetWorkbook,
  handleReadFormatting,
  handleReadRange,
} from './sheetsApi';
import type { EditCellRequest } from './messages';

const chromeMock = installChromeMock();
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

function makeRequest(overrides: Partial<EditCellRequest> = {}): EditCellRequest {
  return {
    action: 'editCell',
    spreadsheetId: 'SID',
    sheetName: 'My Sheet',
    cellAddress: 'B3',
    newValue: '5000',
    ...overrides,
  };
}

describe('handleEditCell', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    chromeMock.runtime.lastError = undefined;
    chromeMock.identity.getAuthToken.mockImplementation(
      (_opts: unknown, cb: (token?: string) => void) => cb('tok-123'),
    );
  });

  it('PUTs the value to the Sheets API with the OAuth token', async () => {
    mockFetch.mockResolvedValue({ json: () => Promise.resolve({}) });

    const result = await handleEditCell(makeRequest());

    expect(result).toEqual({ success: true });
    expect(chromeMock.identity.getAuthToken).toHaveBeenCalledWith(
      { interactive: true },
      expect.any(Function),
    );
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe(
      'https://sheets.googleapis.com/v4/spreadsheets/SID/values/My%20Sheet!B3?valueInputOption=USER_ENTERED',
    );
    expect(init.method).toBe('PUT');
    expect(init.headers.Authorization).toBe('Bearer tok-123');
    expect(JSON.parse(init.body)).toEqual({
      range: 'My Sheet!B3',
      values: [['5000']],
    });
  });

  it('writes formulas as-is so Sheets evaluates them (USER_ENTERED)', async () => {
    mockFetch.mockResolvedValue({ json: () => Promise.resolve({}) });

    await handleEditCell(makeRequest({ cellAddress: 'E10', newValue: '=C10+D10' }));

    expect(JSON.parse(mockFetch.mock.calls[0][1].body).values).toEqual([
      ['=C10+D10'],
    ]);
  });

  it('returns the API error message on a failed write', async () => {
    mockFetch.mockResolvedValue({
      json: () =>
        Promise.resolve({
          error: { message: 'The caller does not have permission' },
        }),
    });

    expect(await handleEditCell(makeRequest())).toEqual({
      success: false,
      error: 'The caller does not have permission',
    });
  });

  it('returns the auth error when the OAuth token cannot be fetched', async () => {
    chromeMock.runtime.lastError = {
      message: 'OAuth2 not granted or revoked.',
    };
    chromeMock.identity.getAuthToken.mockImplementation(
      (_opts: unknown, cb: (token?: string) => void) => cb(undefined),
    );

    expect(await handleEditCell(makeRequest())).toEqual({
      success: false,
      error: 'OAuth2 not granted or revoked.',
    });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('returns a failure when the network call throws', async () => {
    mockFetch.mockRejectedValue(new Error('offline'));

    expect(await handleEditCell(makeRequest())).toEqual({
      success: false,
      error: 'offline',
    });
  });
});

describe('handleGetWorkbook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    chromeMock.runtime.lastError = undefined;
    chromeMock.identity.getAuthToken.mockImplementation(
      (_opts: unknown, cb: (token?: string) => void) => cb('tok-123'),
    );
  });

  it('fetches workbook metadata with the OAuth token and maps tabs + charts', async () => {
    mockFetch.mockResolvedValue({
      json: () =>
        Promise.resolve({
          properties: { title: 'Budget Book' },
          sheets: [
            {
              properties: {
                sheetId: 11,
                title: 'Data',
                index: 0,
                gridProperties: { rowCount: 100, columnCount: 26 },
              },
              charts: [
                {
                  chartId: 5,
                  spec: { title: 'Revenue', basicChart: { chartType: 'LINE' } },
                },
              ],
            },
          ],
        }),
    });

    const result = await handleGetWorkbook({
      action: 'getWorkbook',
      spreadsheetId: 'SID',
    });

    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toContain('https://sheets.googleapis.com/v4/spreadsheets/SID?fields=');
    expect(init.headers.Authorization).toBe('Bearer tok-123');
    expect(result).toEqual({
      success: true,
      title: 'Budget Book',
      tabs: [
        {
          sheetId: 11,
          title: 'Data',
          index: 0,
          rowCount: 100,
          columnCount: 26,
          charts: [{ chartId: 5, title: 'Revenue', chartType: 'LINE' }],
        },
      ],
    });
  });

  it('surfaces API errors', async () => {
    mockFetch.mockResolvedValue({
      json: () =>
        Promise.resolve({ error: { message: 'The caller does not have permission' } }),
    });

    expect(
      await handleGetWorkbook({ action: 'getWorkbook', spreadsheetId: 'SID' }),
    ).toEqual({ success: false, error: 'The caller does not have permission' });
  });
});

describe('handleReadRange', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    chromeMock.runtime.lastError = undefined;
    chromeMock.identity.getAuthToken.mockImplementation(
      (_opts: unknown, cb: (token?: string) => void) => cb('tok-123'),
    );
  });

  it('reads formatted values for the (encoded) range', async () => {
    mockFetch.mockResolvedValue({
      json: () => Promise.resolve({ values: [['a', 'b']] }),
    });

    const result = await handleReadRange({
      action: 'readRange',
      spreadsheetId: 'SID',
      range: "'My Sheet'",
    });

    expect(mockFetch.mock.calls[0][0]).toBe(
      "https://sheets.googleapis.com/v4/spreadsheets/SID/values/'My%20Sheet'?valueRenderOption=FORMATTED_VALUE",
    );
    expect(result).toEqual({ success: true, values: [['a', 'b']] });
  });

  it('returns empty values when the tab has no data', async () => {
    mockFetch.mockResolvedValue({ json: () => Promise.resolve({}) });

    expect(
      await handleReadRange({ action: 'readRange', spreadsheetId: 'SID', range: 'A1' }),
    ).toEqual({ success: true, values: [] });
  });

  it('surfaces auth failures', async () => {
    chromeMock.runtime.lastError = { message: 'OAuth2 revoked' };
    chromeMock.identity.getAuthToken.mockImplementation(
      (_opts: unknown, cb: (token?: string) => void) => cb(undefined),
    );

    expect(
      await handleReadRange({ action: 'readRange', spreadsheetId: 'SID', range: 'A1' }),
    ).toEqual({ success: false, error: 'OAuth2 revoked' });
  });

  it('passes the FORMULA render option through', async () => {
    chromeMock.runtime.lastError = undefined;
    chromeMock.identity.getAuthToken.mockImplementation(
      (_opts: unknown, cb: (token?: string) => void) => cb('tok-123'),
    );
    mockFetch.mockResolvedValue({ json: () => Promise.resolve({ values: [] }) });

    await handleReadRange({
      action: 'readRange',
      spreadsheetId: 'SID',
      range: 'A1',
      render: 'FORMULA',
    });

    expect(mockFetch.mock.calls[0][0]).toContain('valueRenderOption=FORMULA');
  });
});

describe('handleCreateChart', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    chromeMock.runtime.lastError = undefined;
    chromeMock.identity.getAuthToken.mockImplementation(
      (_opts: unknown, cb: (token?: string) => void) => cb('tok-123'),
    );
  });

  const GRID = {
    startRowIndex: 0,
    endRowIndex: 10,
    startColumnIndex: 0,
    endColumnIndex: 2,
  };

  it('POSTs an addChart batchUpdate anchored beside the data', async () => {
    mockFetch.mockResolvedValue({ json: () => Promise.resolve({ replies: [{}] }) });

    const result = await handleCreateChart({
      action: 'createChart',
      spreadsheetId: 'SID',
      sheetId: 7,
      chartType: 'LINE',
      title: 'Revenue',
      gridRange: GRID,
    });

    expect(result).toEqual({ success: true });
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe('https://sheets.googleapis.com/v4/spreadsheets/SID:batchUpdate');
    const body = JSON.parse(init.body);
    const chart = body.requests[0].addChart.chart;
    expect(chart.spec.title).toBe('Revenue');
    expect(chart.spec.basicChart.chartType).toBe('LINE');
    expect(chart.spec.basicChart.series).toHaveLength(1); // B column
    expect(chart.position.overlayPosition.anchorCell).toEqual({
      sheetId: 7,
      rowIndex: 0,
      columnIndex: 3, // one right of the data
    });
  });

  it('uses the pie spec for PIE charts', async () => {
    mockFetch.mockResolvedValue({ json: () => Promise.resolve({}) });

    await handleCreateChart({
      action: 'createChart',
      spreadsheetId: 'SID',
      sheetId: 7,
      chartType: 'PIE',
      title: 'Split',
      gridRange: GRID,
    });

    const chart = JSON.parse(mockFetch.mock.calls[0][1].body).requests[0].addChart.chart;
    expect(chart.spec.pieChart).toBeDefined();
    expect(chart.spec.basicChart).toBeUndefined();
  });

  it('surfaces API errors', async () => {
    mockFetch.mockResolvedValue({
      json: () => Promise.resolve({ error: { message: 'no edit access' } }),
    });

    expect(
      await handleCreateChart({
        action: 'createChart',
        spreadsheetId: 'SID',
        sheetId: 7,
        chartType: 'COLUMN',
        title: 'X',
        gridRange: GRID,
      }),
    ).toEqual({ success: false, error: 'no edit access' });
  });
});

describe('handleReadFormatting', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    chromeMock.runtime.lastError = undefined;
    chromeMock.identity.getAuthToken.mockImplementation(
      (_opts: unknown, cb: (token?: string) => void) => cb('tok-123'),
    );
  });

  it('summarizes grid formatting from the API response', async () => {
    mockFetch.mockResolvedValue({
      json: () =>
        Promise.resolve({
          sheets: [
            {
              properties: { title: 'Budget' },
              merges: [{}],
              data: [
                {
                  startRow: 0,
                  startColumn: 0,
                  rowData: [
                    {
                      values: [
                        {
                          formattedValue: 'Header',
                          effectiveFormat: {
                            textFormat: { bold: true },
                            backgroundColor: { red: 1, green: 1, blue: 0 },
                          },
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        }),
    });

    const result = await handleReadFormatting({
      action: 'readFormatting',
      spreadsheetId: 'SID',
      range: "'Budget'!A1:B2",
    });

    expect(result.success).toBe(true);
    expect(result.summary).toContain('Bold cells: A1.');
    expect(result.summary).toContain('#ffff00');
    expect(result.summary).toContain('1 merged cell range.');
    expect(mockFetch.mock.calls[0][0]).toContain('includeGridData=true');
  });

  it('surfaces API errors', async () => {
    mockFetch.mockResolvedValue({
      json: () => Promise.resolve({ error: { message: 'not found' } }),
    });

    expect(
      await handleReadFormatting({
        action: 'readFormatting',
        spreadsheetId: 'SID',
        range: 'A1',
      }),
    ).toEqual({ success: false, error: 'not found' });
  });
});
