import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installChromeMock } from '@/test/chrome';
import { requestRange, requestWorkbook } from './workbookGateway';

const chromeMock = installChromeMock();

describe('workbookGateway', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    history.replaceState(null, '', '/spreadsheets/d/WB42/edit');
  });

  afterEach(() => {
    history.replaceState(null, '', '/');
  });

  it('requestWorkbook sends the id and resolves the background response', async () => {
    chromeMock.runtime.sendMessage.mockImplementation(
      (_msg: unknown, cb: (response: unknown) => void) =>
        cb({ success: true, title: 'Book', tabs: [] }),
    );

    const result = await requestWorkbook();

    expect(result).toEqual({ success: true, title: 'Book', tabs: [] });
    expect(chromeMock.runtime.sendMessage).toHaveBeenCalledWith(
      { action: 'getWorkbook', spreadsheetId: 'WB42' },
      expect.any(Function),
    );
  });

  it('requestRange sends the quoted range through', async () => {
    chromeMock.runtime.sendMessage.mockImplementation(
      (_msg: unknown, cb: (response: unknown) => void) =>
        cb({ success: true, values: [['a']] }),
    );

    const result = await requestRange("'My Sheet'");

    expect(result.values).toEqual([['a']]);
    expect(chromeMock.runtime.sendMessage).toHaveBeenCalledWith(
      { action: 'readRange', spreadsheetId: 'WB42', range: "'My Sheet'" },
      expect.any(Function),
    );
  });

  it('fails gracefully outside a spreadsheet URL', async () => {
    history.replaceState(null, '', '/');

    const result = await requestWorkbook();

    expect(result.success).toBe(false);
    expect(chromeMock.runtime.sendMessage).not.toHaveBeenCalled();
  });

  it('fails gracefully when the background never responds', async () => {
    chromeMock.runtime.sendMessage.mockImplementation(
      (_msg: unknown, cb: (response: unknown) => void) => cb(undefined),
    );

    expect(await requestRange('A1:B2')).toEqual({
      success: false,
      error: 'No response from background',
    });
  });
});
