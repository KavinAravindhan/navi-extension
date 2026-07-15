import type { EditCellRequest, EditCellResponse } from './messages';

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
