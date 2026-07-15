import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { formatRows, readSpreadsheetData } from './readSheet';

describe('formatRows', () => {
  it('renders the sheet header and one line per row', () => {
    expect(formatRows('Budget', [['Name', 'Qty'], ['Apples', '4']])).toBe(
      'Sheet: Budget\n\nRow 1: Name | Qty\nRow 2: Apples | 4\n',
    );
  });

  // Note: skipped rows still count toward maxCols, so surviving rows are
  // padded to their width — hence the trailing " | ". Faithful v1 behavior.
  it('skips empty rows but keeps the original row numbers', () => {
    expect(formatRows('S', [['a'], ['', ''], ['b']])).toBe(
      'Sheet: S\n\nRow 1: a | \nRow 3: b | \n',
    );
  });

  it('skips rows containing only whitespace', () => {
    expect(formatRows('S', [[' ', '\t'], ['x']])).toBe(
      'Sheet: S\n\nRow 2: x | \n',
    );
  });

  it('pads every row to the widest row', () => {
    expect(formatRows('S', [['a'], ['b', 'c', 'd']])).toBe(
      'Sheet: S\n\nRow 1: a |  | \nRow 2: b | c | d\n',
    );
  });

  // v1 quirk locked on purpose: falsy cells — including a real numeric 0 —
  // render as empty strings. Revisit when the workbook model lands (PR 4).
  it('renders numeric 0 cells as empty strings (v1 quirk)', () => {
    expect(formatRows('S', [[0, 'x']])).toBe('Sheet: S\n\nRow 1:  | x\n');
  });
});

describe('readSpreadsheetData', () => {
  const mockFetch = vi.fn();
  vi.stubGlobal('fetch', mockFetch);

  beforeEach(() => {
    vi.clearAllMocks();
    history.replaceState(null, '', '/spreadsheets/d/TEST123/edit');
    document.body.innerHTML =
      '<div class="docs-sheet-active-tab">3Data</div>';
  });

  afterEach(() => {
    history.replaceState(null, '', '/');
    document.body.innerHTML = '';
  });

  it('fetches the active sheet values with the API key', async () => {
    mockFetch.mockResolvedValue({
      json: () =>
        Promise.resolve({ values: [['Name', 'Qty'], ['Apples', '4']] }),
    });

    const result = await readSpreadsheetData('fake-key');

    expect(mockFetch).toHaveBeenCalledWith(
      'https://sheets.googleapis.com/v4/spreadsheets/TEST123/values/Data?key=fake-key&valueRenderOption=FORMATTED_VALUE',
    );
    expect(result).toBe('Sheet: Data\n\nRow 1: Name | Qty\nRow 2: Apples | 4\n');
  });

  it('returns a readable message when the URL has no spreadsheet id', async () => {
    history.replaceState(null, '', '/');
    expect(await readSpreadsheetData('k')).toBe(
      'Could not find spreadsheet ID in URL.',
    );
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('surfaces API errors as a readable message', async () => {
    mockFetch.mockResolvedValue({
      json: () =>
        Promise.resolve({ error: { message: 'API key not valid' } }),
    });
    expect(await readSpreadsheetData('bad')).toBe(
      'API error: API key not valid',
    );
  });

  it('reports an empty sheet', async () => {
    mockFetch.mockResolvedValue({ json: () => Promise.resolve({}) });
    expect(await readSpreadsheetData('k')).toBe('Sheet appears to be empty.');
  });

  it('reports a readable message when the network call throws', async () => {
    mockFetch.mockRejectedValue(new Error('offline'));
    expect(await readSpreadsheetData('k')).toBe(
      'Error reading spreadsheet data.',
    );
  });
});
