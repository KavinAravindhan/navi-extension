import { handleAppendDoc, handleGetDocument } from '@/platform/docs/docsApi';
import {
  handleCreateChart,
  handleEditCell,
  handleGetWorkbook,
  handleReadFormatting,
  handleReadRange,
} from '@/platform/sheets/sheetsApi';
import { handleAddSlide, handleGetPresentation } from '@/platform/slides/slidesApi';
import { OPEN_NAVI_ACTION } from '@/platform/sheets/messages';

// Handles OAuth token retrieval and all Google Sheets API calls (reads and
// writes), plus browser-level keyboard commands. The content script talks to
// this worker via messages.
export default defineBackground(() => {
  chrome.runtime.onMessage.addListener((message: { action?: string }, _sender, sendResponse) => {
    const respond = (promise: Promise<unknown>): true => {
      promise
        .then(sendResponse)
        .catch((err: Error) => sendResponse({ success: false, error: err.message }));
      return true; // Keep message channel open for async response
    };

    switch (message.action) {
      case 'editCell':
        return respond(handleEditCell(message as never));
      case 'getWorkbook':
        return respond(handleGetWorkbook(message as never));
      case 'readRange':
        return respond(handleReadRange(message as never));
      case 'createChart':
        return respond(handleCreateChart(message as never));
      case 'readFormatting':
        return respond(handleReadFormatting(message as never));
      case 'getDocument':
        return respond(handleGetDocument(message as never));
      case 'appendDoc':
        return respond(handleAppendDoc(message as never));
      case 'getPresentation':
        return respond(handleGetPresentation(message as never));
      case 'addSlide':
        return respond(handleAddSlide(message as never));
      case 'getProfile':
        // Which Google account is Chrome (and therefore NAVI) using? Spoken
        // in read-failure guidance so users know how to fix sharing.
        return respond(
          new Promise((resolve) => {
            try {
              chrome.identity.getProfileUserInfo(
                { accountStatus: 'ANY' } as chrome.identity.ProfileDetails,
                (info) => resolve({ email: info?.email || null }),
              );
            } catch {
              resolve({ email: null });
            }
          }),
        );
      case 'getShortcut':
        // What is the open-NAVI key actually bound to on THIS machine?
        // (Chrome can silently fail to bind it — NAVI speaks the truth.)
        return respond(
          new Promise((resolve) => {
            chrome.commands.getAll((commands) => {
              const command = commands.find((c) => c.name === 'open-navi');
              resolve({ shortcut: command?.shortcut ?? null });
            });
          }),
        );
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
