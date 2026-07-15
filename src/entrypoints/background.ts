import { handleEditCell } from '@/platform/sheets/sheetsApi';
import type { EditCellRequest } from '@/platform/sheets/messages';

// Handles OAuth token retrieval and Google Sheets API write calls.
// Runs as a service worker — the content script sends messages here to edit cells.
export default defineBackground(() => {
  chrome.runtime.onMessage.addListener((message: EditCellRequest, _sender, sendResponse) => {
    if (message.action === 'editCell') {
      handleEditCell(message)
        .then(sendResponse)
        .catch((err: Error) => sendResponse({ success: false, error: err.message }));
      return true; // Keep message channel open for async response
    }
  });
});
