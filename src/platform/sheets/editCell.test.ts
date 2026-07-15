import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installChromeMock } from '@/test/chrome';
import { requestCellEdit } from './editCell';

const chromeMock = installChromeMock();

describe('requestCellEdit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    history.replaceState(null, '', '/spreadsheets/d/SHEET42/edit');
    document.body.innerHTML =
      '<div class="docs-sheet-active-tab">1Budget</div>';
  });

  afterEach(() => {
    history.replaceState(null, '', '/');
    document.body.innerHTML = '';
  });

  it('sends the edit request to the background and resolves its response', async () => {
    chromeMock.runtime.sendMessage.mockImplementation(
      (_msg: unknown, cb: (response: unknown) => void) => cb({ success: true }),
    );

    const result = await requestCellEdit('B3', '99');

    expect(result).toEqual({ success: true });
    expect(chromeMock.runtime.sendMessage).toHaveBeenCalledWith(
      {
        action: 'editCell',
        spreadsheetId: 'SHEET42',
        sheetName: 'Budget',
        cellAddress: 'B3',
        newValue: '99',
      },
      expect.any(Function),
    );
  });

  it('passes background failures through', async () => {
    chromeMock.runtime.sendMessage.mockImplementation(
      (_msg: unknown, cb: (response: unknown) => void) =>
        cb({ success: false, error: 'no permission' }),
    );

    expect(await requestCellEdit('B3', '99')).toEqual({
      success: false,
      error: 'no permission',
    });
  });

  it('fails gracefully when the background never responds', async () => {
    chromeMock.runtime.sendMessage.mockImplementation(
      (_msg: unknown, cb: (response: unknown) => void) => cb(undefined),
    );

    expect(await requestCellEdit('B3', '99')).toEqual({
      success: false,
      error: 'No response from background',
    });
  });

  it('fails without messaging the background when the URL has no sheet id', async () => {
    history.replaceState(null, '', '/');

    const result = await requestCellEdit('B3', '99');

    expect(result.success).toBe(false);
    expect(chromeMock.runtime.sendMessage).not.toHaveBeenCalled();
  });
});
