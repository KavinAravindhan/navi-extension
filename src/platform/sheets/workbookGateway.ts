import { getSpreadsheetId } from './location';
import {
  GET_WORKBOOK_ACTION,
  READ_RANGE_ACTION,
  type GetWorkbookRequest,
  type GetWorkbookResponse,
  type ReadRangeRequest,
  type ReadRangeResponse,
} from './messages';

/**
 * Content-script side of workbook reads: packages requests for the
 * background worker, which holds the OAuth token.
 */

function currentSpreadsheetId(): string | null {
  return getSpreadsheetId(window.location.href);
}

export function requestWorkbook(): Promise<GetWorkbookResponse> {
  return new Promise((resolve) => {
    const spreadsheetId = currentSpreadsheetId();
    if (!spreadsheetId) {
      resolve({ success: false, error: 'Could not find spreadsheet ID in URL.' });
      return;
    }
    const message: GetWorkbookRequest = {
      action: GET_WORKBOOK_ACTION,
      spreadsheetId,
    };
    chrome.runtime.sendMessage(message, (response: GetWorkbookResponse | undefined) => {
      resolve(response ?? { success: false, error: 'No response from background' });
    });
  });
}

export function requestRange(range: string): Promise<ReadRangeResponse> {
  return new Promise((resolve) => {
    const spreadsheetId = currentSpreadsheetId();
    if (!spreadsheetId) {
      resolve({ success: false, error: 'Could not find spreadsheet ID in URL.' });
      return;
    }
    const message: ReadRangeRequest = {
      action: READ_RANGE_ACTION,
      spreadsheetId,
      range,
    };
    chrome.runtime.sendMessage(message, (response: ReadRangeResponse | undefined) => {
      resolve(response ?? { success: false, error: 'No response from background' });
    });
  });
}
