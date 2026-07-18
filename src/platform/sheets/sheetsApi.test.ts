import { beforeEach, describe, expect, it, vi } from 'vitest';
import { installChromeMock } from '@/test/chrome';
import { handleEditCell, handleGetWorkbook, handleReadRange } from './sheetsApi';
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
});
