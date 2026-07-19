import { getSpreadsheetId } from './location';
import {
  CREATE_CHART_ACTION,
  GET_WORKBOOK_ACTION,
  READ_FORMATTING_ACTION,
  READ_RANGE_ACTION,
  type CreateChartRequest,
  type CreateChartResponse,
  type GetWorkbookRequest,
  type GetWorkbookResponse,
  type ReadFormattingRequest,
  type ReadFormattingResponse,
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

export function requestRange(
  range: string,
  render?: 'FORMATTED_VALUE' | 'FORMULA',
): Promise<ReadRangeResponse> {
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
      render,
    };
    chrome.runtime.sendMessage(message, (response: ReadRangeResponse | undefined) => {
      resolve(response ?? { success: false, error: 'No response from background' });
    });
  });
}

export function requestCreateChart(
  input: Omit<CreateChartRequest, 'action' | 'spreadsheetId'>,
): Promise<CreateChartResponse> {
  return new Promise((resolve) => {
    const spreadsheetId = currentSpreadsheetId();
    if (!spreadsheetId) {
      resolve({ success: false, error: 'Could not find spreadsheet ID in URL.' });
      return;
    }
    const message: CreateChartRequest = {
      action: CREATE_CHART_ACTION,
      spreadsheetId,
      ...input,
    };
    chrome.runtime.sendMessage(message, (response: CreateChartResponse | undefined) => {
      resolve(response ?? { success: false, error: 'No response from background' });
    });
  });
}

export function requestFormatting(range: string): Promise<ReadFormattingResponse> {
  return new Promise((resolve) => {
    const spreadsheetId = currentSpreadsheetId();
    if (!spreadsheetId) {
      resolve({ success: false, error: 'Could not find spreadsheet ID in URL.' });
      return;
    }
    const message: ReadFormattingRequest = {
      action: READ_FORMATTING_ACTION,
      spreadsheetId,
      range,
    };
    chrome.runtime.sendMessage(message, (response: ReadFormattingResponse | undefined) => {
      resolve(response ?? { success: false, error: 'No response from background' });
    });
  });
}
