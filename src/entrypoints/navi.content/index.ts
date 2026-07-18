import './style.css';
import { naviConfig, warnOnMissingConfig } from '@/config';
import { parseEditCommand } from '@/core/commands/editCommand';
import { TwoStepConfirm } from '@/core/commands/twoStepConfirm';
import { attachSpeechShortcuts } from '@/core/keyboard/speechShortcuts';
import { LLMClient } from '@/core/llm/client';
import { loadSettings, saveSettings } from '@/core/settings/settings';
import { SpeechPlayer } from '@/core/speech/speechPlayer';
import { VoiceRecognition } from '@/core/speech/stt';
import { requestCellEdit } from '@/platform/sheets/editCell';
import { readSpreadsheetData } from '@/platform/sheets/readSheet';
import { NaviMenu } from '@/ui/menu';
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
 * Composition root. Flow since Step 2: opening NAVI (icon or Alt/Option+N)
 * greets and immediately scans + summarizes the sheet — no font picker, no
 * confirm click (tracker: "voice prompting available on start"). Text size
 * and other preferences live in the Alt/Option+M menu.
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
    onPermissionDenied: () => {
      const msg =
        'Microphone access is blocked. To fix it, click the microphone icon at the right end of the address bar and choose Allow.';
      panel.addMessage(msg, 'ai');
      player.speak(msg);
    },
  });

  let greeted = false;
  let summaryStarted = false;
  let closingForQuit = false;
  const quitConfirm = new TwoStepConfirm();

  const panel = new NaviPanel(
    chrome.runtime.getURL('icons/navi_eye_black_bg.png'),
    {
      onOpen: () => {
        if (!greeted && settings.greetingEnabled) {
          greeted = true;
          player.speak("Hi, I'm NAVI.");
        }
        if (!summaryStarted) {
          summaryStarted = true;
          void loadSpreadsheetAndSummarize();
        }
      },
      onUserMessage: (text) => void handleUserMessage(text),
      onVoiceToggle: () => stt.toggle(),
      onPauseToggle: () => player.togglePause(),
      onStop: () => player.stop(),
      onClose: () => {
        menu.hide();
        quitConfirm.reset();
        if (!closingForQuit) player.stop();
        closingForQuit = false;
      },
    },
  );

  panel.applyFontSize(settings.fontSize);

  const menu = new NaviMenu(panel.getMenuContainer(), {
    announce: (text) => player.speak(text),
    getFontSize: () => settings.fontSize,
    setFontSize: (size) => {
      settings.fontSize = size;
      panel.applyFontSize(size);
      void saveSettings({ fontSize: size });
    },
    getGreetingEnabled: () => settings.greetingEnabled,
    setGreetingEnabled: (enabled) => {
      settings.greetingEnabled = enabled;
      void saveSettings({ greetingEnabled: enabled });
    },
    getSpeechRate: () => player.getRate(),
    onClose: () => {
      if (panel.isOpen) panel.focusInput();
    },
  });

  stt.init();

  attachSpeechShortcuts(document, player, {
    onRateChange: (rate) => {
      settings.speechRate = rate;
      void saveSettings({ speechRate: rate });
      // Mid-speech the sentence restarts at the new speed (feedback enough);
      // when idle, say it out loud so the change is never silent.
      if (player.playbackStatus === 'idle') player.speak(`Speed ${rate}`);
    },
    onOpenNavi: () => panel.open(),
    onOpenMenu: () => {
      if (!panel.isOpen) panel.open();
      menu.toggle();
    },
    onQuitNavi: () => {
      if (!panel.isOpen) return;
      if (quitConfirm.press() === 'prompt') {
        const msg = 'Do you want to close NAVI? Press the shortcut again to confirm.';
        panel.addMessage(msg, 'ai');
        player.speak(msg);
      } else {
        const msg = 'Closing NAVI. See you next time.';
        panel.addMessage(msg, 'ai');
        closingForQuit = true; // keep the farewell playing through close
        panel.close();
        player.speak(msg);
      }
    },
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
