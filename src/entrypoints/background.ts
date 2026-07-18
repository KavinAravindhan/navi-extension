import { handleEditCell } from '@/platform/sheets/sheetsApi';
import { OPEN_NAVI_ACTION, type EditCellRequest } from '@/platform/sheets/messages';

// Handles OAuth token retrieval and Google Sheets API write calls, plus
// browser-level keyboard commands. The content script talks to this worker
// via messages.
export default defineBackground(() => {
  chrome.runtime.onMessage.addListener((message: EditCellRequest, _sender, sendResponse) => {
    if (message.action === 'editCell') {
      handleEditCell(message)
        .then(sendResponse)
        .catch((err: Error) => sendResponse({ success: false, error: err.message }));
      return true; // Keep message channel open for async response
    }
  });

  // The open-NAVI shortcut (chrome://extensions/shortcuts) — forward it to
  // the content script in the active tab. Sheets can't swallow this one.
  chrome.commands.onCommand.addListener((command) => {
    if (command !== 'open-navi') return;
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tabId = tabs[0]?.id;
      if (tabId === undefined) return;
      chrome.tabs.sendMessage(tabId, { action: OPEN_NAVI_ACTION }, () => {
        // Reading lastError silences "no receiver" when the active tab
        // isn't a Google Sheet — pressing the shortcut there is a no-op.
        void chrome.runtime.lastError;
      });
    });
  });
});
