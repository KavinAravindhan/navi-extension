import './style.css';
import { naviConfig, warnOnMissingConfig } from '@/config';
import { parseEditCommand } from '@/core/commands/editCommand';
import { attachSpeechShortcuts } from '@/core/keyboard/speechShortcuts';
import { LLMClient } from '@/core/llm/client';
import { loadSettings, saveSettings } from '@/core/settings/settings';
import { SpeechPlayer } from '@/core/speech/speechPlayer';
import { VoiceRecognition } from '@/core/speech/stt';
import { requestCellEdit } from '@/platform/sheets/editCell';
import { readSpreadsheetData } from '@/platform/sheets/readSheet';
import { NaviPanel } from '@/ui/panel';

export default defineContentScript({
  matches: ['https://docs.google.com/spreadsheets/*'],
  runAt: 'document_end',
  cssInjectionMode: 'manifest',
  main() {
    // Same 3s delay as v1 — gives the Google Sheets UI time to finish rendering.
    setTimeout(() => void initializeNavi(), 3000);
  },
});

/**
 * Composition root: builds the services, the panel, and the glue between
 * them. Chat/scan/edit flows are unchanged from v1; speech now runs through
 * the sentence-queue SpeechPlayer with keyboard controls (NAVI-005/006/008):
 * Shift = pause/resume, double-Shift = stop, Alt+. / Alt+, = speed.
 */
async function initializeNavi(): Promise<void> {
  console.log('NAVI: Initializing...');
  warnOnMissingConfig();

  const settings = await loadSettings();

  const llm = new LLMClient(naviConfig.openaiApiKey);

  const player = new SpeechPlayer(settings.speechRate, {
    onStatusChange: (status) => panel.setPlaybackStatus(status),
  });

  const stt = new VoiceRecognition({
    onResult: (transcript) => panel.submitTranscript(transcript),
    onStateChange: (listening) => panel.setVoiceButtonState(listening),
    onBeforeStart: () => player.stop(),
  });

  let greeted = false;

  const panel = new NaviPanel(
    chrome.runtime.getURL('icons/navi_eye_black_bg.png'),
    {
      onOpen: () => {
        if (!greeted && settings.greetingEnabled) {
          greeted = true;
          player.speak("Hi, I'm NAVI.");
        }
      },
      onConfirm: () => void loadSpreadsheetAndSummarize(),
      onUserMessage: (text) => void handleUserMessage(text),
      onVoiceToggle: () => stt.toggle(),
      onPauseToggle: () => player.togglePause(),
      onStop: () => player.stop(),
      onClose: () => player.stop(),
    },
  );

  stt.init();

  attachSpeechShortcuts(document, player, {
    onRateChange: (rate) => void saveSettings({ speechRate: rate }),
    onOpenNavi: () => panel.open(),
  });

  // Browser-level open shortcut, forwarded by the background worker —
  // reaches us even when Google Sheets has trapped in-page keyboard focus.
  chrome.runtime.onMessage.addListener((message: { action?: string }) => {
    if (message?.action === 'openNavi') panel.open();
  });

  async function loadSpreadsheetAndSummarize(): Promise<void> {
    panel.addMessage(
      "Hi! I'm NAVI, your accessibility assistant. Let me scan your spreadsheet now...",
      'ai',
    );

    const data = await readSpreadsheetData(naviConfig.googleSheetsApiKey);
    llm.setSpreadsheetContext(data);

    const summary = await llm.sendMessage(
      'Please summarize this spreadsheet for a blind user. Be concise and describe what data is tracked.',
    );

    panel.addMessage(summary, 'ai');
    player.speak(summary);

    panel.markSummaryLoaded();
  }

  async function handleUserMessage(text: string): Promise<void> {
    player.stop();

    panel.addMessage(text, 'user');
    panel.addMessage('Thinking...', 'ai', 'navi-thinking');

    const aiResponse = await llm.sendMessage(text);

    panel.removeThinking();

    const editCommand = parseEditCommand(aiResponse);
    if (editCommand) {
      const response = await requestCellEdit(
        editCommand.cellAddress,
        editCommand.newValue,
      );
      if (response.success) {
        console.log('NAVI: Cell edited successfully');
        const confirmation = `Done! Cell ${editCommand.cellAddress} has been updated to ${editCommand.newValue}.`;
        panel.addMessage(confirmation, 'ai');
        player.speak(confirmation);
      } else {
        console.error('NAVI: Edit failed:', response.error);
        const errorMsg =
          "Sorry, I couldn't edit that cell. Please make sure you have edit access to this sheet.";
        panel.addMessage(errorMsg, 'ai');
        player.speak(errorMsg);
      }
    } else {
      panel.addMessage(aiResponse, 'ai');
      player.speak(aiResponse);
    }
  }

  console.log('NAVI: Ready.');
}
