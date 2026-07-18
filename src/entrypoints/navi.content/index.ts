import './style.css';
import { naviConfig, warnOnMissingConfig } from '@/config';
import { parseEditCommand } from '@/core/commands/editCommand';
import { TwoStepConfirm } from '@/core/commands/twoStepConfirm';
import { attachSpeechShortcuts } from '@/core/keyboard/speechShortcuts';
import { LLMClient } from '@/core/llm/client';
import {
  loadSettings,
  saveSettings,
  type OutputMode,
} from '@/core/settings/settings';
import { Announcer, createLiveRegion } from '@/core/speech/announcer';
import { SpeechPlayer } from '@/core/speech/speechPlayer';
import { VoiceRecognition } from '@/core/speech/stt';
import {
  buildWorkbookContext,
  quoteSheetTitle,
  type TabSection,
} from '@/core/workbook/model';
import { getActiveCellA1 } from '@/platform/sheets/activeCell';
import { requestCellEdit } from '@/platform/sheets/editCell';
import { getActiveSheetName } from '@/platform/sheets/location';
import { requestRange, requestWorkbook } from '@/platform/sheets/workbookGateway';
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
 * Composition root. Output routing (NAVI-002): in voice mode NAVI's own TTS
 * speaks; in screen-reader mode NAVI stays silent — chat messages announce
 * through the message log's aria-live and system feedback goes through the
 * hidden live region — so the user's screen reader is the only voice.
 */
async function initializeNavi(): Promise<void> {
  console.log('NAVI: Initializing...');
  warnOnMissingConfig();

  const settings = await loadSettings();

  const llm = new LLMClient(naviConfig.openaiApiKey);

  const player = new SpeechPlayer(settings.speechRate, {
    onStatusChange: (status) => panel.setPlaybackStatus(status),
  });

  const liveRegion = createLiveRegion(document);
  const announcer = new Announcer(player, () => settings.outputMode, liveRegion);

  /** Chat responses: voice mode speaks; SR mode lets the live log announce. */
  const speakResponse = (text: string): void => {
    if (settings.outputMode === 'voice') player.speak(text);
  };

  const stt = new VoiceRecognition({
    onResult: (transcript) => panel.submitTranscript(transcript),
    onStateChange: (listening) => panel.setVoiceButtonState(listening),
    // Half-duplex (NAVI-009): the moment we listen, nothing may be speaking.
    onBeforeStart: () => player.stop(),
    onPermissionDenied: () => {
      const msg =
        'Microphone access is blocked. To fix it, click the microphone icon at the right end of the address bar and choose Allow.';
      panel.addMessage(msg, 'ai');
      speakResponse(msg);
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
          announcer.say("Hi, I'm NAVI.");
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
  panel.setOutputMode(settings.outputMode);

  const setOutputMode = (mode: OutputMode): void => {
    settings.outputMode = mode;
    panel.setOutputMode(mode);
    if (mode === 'screenreader') player.stop();
    void saveSettings({ outputMode: mode });
  };

  const menu = new NaviMenu(panel.getMenuContainer(), {
    announce: (text) => announcer.say(text),
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
    getOutputMode: () => settings.outputMode,
    setOutputMode,
    getContextScope: () => settings.contextScope,
    setContextScope: (scope) => {
      settings.contextScope = scope;
      void saveSettings({ contextScope: scope });
      void loadSpreadsheetAndSummarize(); // rescan with the new scope
    },
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
      if (player.playbackStatus === 'idle') announcer.say(`Speed ${rate}`);
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
        speakResponse(msg);
      } else {
        const msg = 'Closing NAVI. See you next time.';
        closingForQuit = true; // keep the farewell playing through close
        panel.close();
        announcer.say(msg);
      }
    },
    // Ctrl+Alt+Z (NAVI-004): screen reader mode + announce the active cell.
    onScreenReaderMode: () => {
      if (!panel.isOpen) panel.open();
      setOutputMode('screenreader');
      const cell = getActiveCellA1();
      announcer.say(
        cell
          ? `Screen reader mode on. Active cell ${cell}.`
          : 'Screen reader mode on.',
      );
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

    // All reads go through the user's Google sign-in — private sheets work.
    const workbook = await requestWorkbook();
    if (!workbook.success || !workbook.tabs || workbook.tabs.length === 0) {
      const msg = `I couldn't read this spreadsheet. Please make sure Chrome is signed in to a Google account that can view it. Details: ${workbook.error ?? 'no sheets found'}.`;
      panel.addMessage(msg, 'ai');
      speakResponse(msg);
      summaryStarted = false; // allow retrying by reopening
      return;
    }

    const tabs = workbook.tabs;
    const domTabName = getActiveSheetName();
    const activeTabTitle =
      tabs.find((tab) => tab.title === domTabName)?.title ?? tabs[0].title;

    const includedTabs =
      settings.contextScope === 'file'
        ? tabs
        : tabs.filter((tab) => tab.title === activeTabTitle);

    const sections: TabSection[] = [];
    for (const tab of includedTabs) {
      const range = await requestRange(quoteSheetTitle(tab.title));
      sections.push({
        title: tab.title,
        values: range.success ? (range.values ?? []) : [],
      });
    }

    const context = buildWorkbookContext({
      workbookTitle: workbook.title ?? 'Untitled workbook',
      tabs,
      activeTabTitle,
      scope: settings.contextScope,
      sections,
    });
    llm.setSpreadsheetContext(context);

    const summary = await llm.sendMessage(
      'Please summarize this spreadsheet for a blind user. Start with how many tabs the workbook has and what each one is for, then describe the current tab in more detail, including its table heading if one exists. If the data or any charts show a trend, describe the direction and size of the trend in plain language. Be concise.',
    );

    panel.addMessage(summary, 'ai');
    speakResponse(summary);
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
        speakResponse(confirmation);
      } else {
        console.error('NAVI: Edit failed:', response.error);
        const errorMsg =
          "Sorry, I couldn't edit that cell. Please make sure you have edit access to this sheet.";
        panel.addMessage(errorMsg, 'ai');
        speakResponse(errorMsg);
      }
    } else {
      panel.addMessage(aiResponse, 'ai');
      speakResponse(aiResponse);
    }
  }

  console.log('NAVI: Ready.');
}
