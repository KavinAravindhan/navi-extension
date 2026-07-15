import './style.css';
import { naviConfig, warnOnMissingConfig } from '@/config';
import { parseEditCommand } from '@/core/commands/editCommand';
import { LLMClient } from '@/core/llm/client';
import { VoiceRecognition } from '@/core/speech/stt';
import { TextToSpeech } from '@/core/speech/tts';
import { requestCellEdit } from '@/platform/sheets/editCell';
import { readSpreadsheetData } from '@/platform/sheets/readSheet';
import { NaviPanel } from '@/ui/panel';

export default defineContentScript({
  matches: ['https://docs.google.com/spreadsheets/*'],
  runAt: 'document_end',
  cssInjectionMode: 'manifest',
  main() {
    // Same 3s delay as v1 — gives the Google Sheets UI time to finish rendering.
    setTimeout(initializeNavi, 3000);
  },
});

/**
 * Composition root: builds the services, the panel, and the glue between
 * them. All flows and user-facing strings are ported verbatim from v1.
 */
function initializeNavi(): void {
  console.log('NAVI: Initializing...');
  warnOnMissingConfig();

  const llm = new LLMClient(naviConfig.openaiApiKey);

  const tts = new TextToSpeech((speaking) => panel.setStopButtonState(speaking));

  const stt = new VoiceRecognition({
    onResult: (transcript) => panel.submitTranscript(transcript),
    onStateChange: (listening) => panel.setVoiceButtonState(listening),
    onBeforeStart: () => tts.stop(),
  });

  const panel = new NaviPanel(
    chrome.runtime.getURL('icons/navi_eye_black_bg.png'),
    {
      onConfirm: () => void loadSpreadsheetAndSummarize(),
      onUserMessage: (text) => void handleUserMessage(text),
      onVoiceToggle: () => stt.toggle(),
      onStop: () => tts.stop(),
      onClose: () => tts.stop(),
    },
  );

  stt.init();

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
    tts.speak(summary);

    panel.markSummaryLoaded();
  }

  async function handleUserMessage(text: string): Promise<void> {
    tts.stop();

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
        tts.speak(confirmation);
      } else {
        console.error('NAVI: Edit failed:', response.error);
        const errorMsg =
          "Sorry, I couldn't edit that cell. Please make sure you have edit access to this sheet.";
        panel.addMessage(errorMsg, 'ai');
        tts.speak(errorMsg);
      }
    } else {
      panel.addMessage(aiResponse, 'ai');
      tts.speak(aiResponse);
    }
  }

  console.log('NAVI: Ready.');
}
