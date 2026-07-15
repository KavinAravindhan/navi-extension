import { getActiveSheetName, getSpreadsheetId } from './location';
import {
  EDIT_CELL_ACTION,
  type EditCellRequest,
  type EditCellResponse,
} from './messages';

/**
 * Content-script side of a cell edit: packages the request and sends it to
 * the background service worker, which holds the OAuth token and performs the
 * actual Sheets API write.
 */
export function requestCellEdit(
  cellAddress: string,
  newValue: string,
): Promise<EditCellResponse> {
  return new Promise((resolve) => {
    const spreadsheetId = getSpreadsheetId(window.location.href);
    if (!spreadsheetId) {
      console.error('NAVI: Could not find spreadsheet ID');
      resolve({ success: false, error: 'Could not find spreadsheet ID' });
      return;
    }

    const message: EditCellRequest = {
      action: EDIT_CELL_ACTION,
      spreadsheetId,
      sheetName: getActiveSheetName(),
      cellAddress,
      newValue,
    };

    chrome.runtime.sendMessage(
      message,
      (response: EditCellResponse | undefined) => {
        resolve(
          response ?? { success: false, error: 'No response from background' },
        );
      },
    );
  });
}
