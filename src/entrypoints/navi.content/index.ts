import './style.css';
import { naviConfig, warnOnMissingConfig } from '@/config';
import { TwoStepConfirm } from '@/core/commands/twoStepConfirm';
import {
  LLM_LANGUAGE_NAME,
  SPEECH_LANG,
  makeT,
} from '@/core/i18n/i18n';
import { attachSpeechShortcuts } from '@/core/keyboard/speechShortcuts';
import { LLMClient } from '@/core/llm/client';
import { ToolRegistry } from '@/core/llm/tools';
import {
  loadSettings,
  saveSettings,
  type OutputMode,
} from '@/core/settings/settings';
import { Announcer, createLiveRegion } from '@/core/speech/announcer';
import { OpenAITTSEngine } from '@/core/speech/naturalTtsEngine';
import { SpeechPlayer } from '@/core/speech/speechPlayer';
import { VoiceRecognition, type VoiceRecognitionOptions } from '@/core/speech/stt';
import { WebSpeechEngine } from '@/core/speech/webSpeechEngine';
import { WhisperRecognition } from '@/core/speech/whisperStt';
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
 * Composition root. Since Step 5a the assistant works through function
 * calling (edit_cell / read_range tools) instead of text parsing, and every
 * user-facing string, the speech voice, the voice input, and the AI response
 * language follow the language setting (English / Bahasa Indonesia).
 */
async function initializeNavi(): Promise<void> {
  console.log('NAVI: Initializing...');
  warnOnMissingConfig();

  const settings = await loadSettings();
  const t = makeT(() => settings.language);

  // ---- AI + tools -----------------------------------------------------

  const tools = new ToolRegistry();

  tools.register(
    {
      name: 'edit_cell',
      description:
        'Set the value or formula of one cell in the current Google Sheet. Formulas start with =.',
      parameters: {
        type: 'object',
        properties: {
          cellAddress: {
            type: 'string',
            description: 'Cell in A1 notation, e.g. B3',
          },
          newValue: {
            type: 'string',
            description: 'The value or formula to write, e.g. 5000 or =SUM(A1:A5)',
          },
        },
        required: ['cellAddress', 'newValue'],
      },
    },
    async (args) => {
      const cellAddress = String(args.cellAddress ?? '');
      const newValue = String(args.newValue ?? '');
      const response = await requestCellEdit(cellAddress, newValue);
      return response.success
        ? `Cell ${cellAddress} was updated to ${newValue}.`
        : `The edit failed: ${response.error ?? 'unknown error'}. The user may not have edit access to this sheet.`;
    },
  );

  tools.register(
    {
      name: 'read_range',
      description:
        "Read cell values from the workbook. Use A1 notation with a quoted sheet name, e.g. 'Budget'!A1:C20, or just a quoted sheet name like 'Budget' for the whole tab.",
      parameters: {
        type: 'object',
        properties: {
          range: { type: 'string', description: "e.g. 'Budget'!A1:C20" },
        },
        required: ['range'],
      },
    },
    async (args) => {
      const response = await requestRange(String(args.range ?? ''));
      if (!response.success) return `Read failed: ${response.error}`;
      const rows = response.values ?? [];
      if (rows.length === 0) return 'The range is empty.';
      return rows
        .slice(0, 100)
        .map((row, i) => `Row ${i + 1}: ${row.map((c) => c ?? '').join(' | ')}`)
        .join('\n');
    },
  );

  const llm = new LLMClient(naviConfig.openaiApiKey, tools);
  llm.setLanguage(LLM_LANGUAGE_NAME[settings.language]);

  // ---- Speech ----------------------------------------------------------

  // Two TTS engines behind one player: the setting picks per sentence, so
  // switching voices takes effect immediately (NAVI-017).
  const systemVoice = new WebSpeechEngine(SPEECH_LANG[settings.language]);
  const naturalVoice = new OpenAITTSEngine(naviConfig.openaiApiKey);

  const player = new SpeechPlayer(
    settings.speechRate,
    { onStatusChange: (status) => panel.setPlaybackStatus(status) },
    () => (settings.voiceEngine === 'natural' ? naturalVoice : systemVoice),
  );
  player.setLanguage(SPEECH_LANG[settings.language]);

  const liveRegion = createLiveRegion(document);
  const announcer = new Announcer(player, () => settings.outputMode, liveRegion);

  /** Chat responses: voice mode speaks; SR mode lets the live log announce. */
  const speakResponse = (text: string): void => {
    if (settings.outputMode === 'voice') player.speak(text);
  };

  // Two voice-input engines sharing one set of callbacks (NAVI-009/011).
  const sttOptions: VoiceRecognitionOptions = {
    onResult: (transcript) => panel.submitTranscript(transcript),
    onStateChange: (listening) => panel.setVoiceButtonState(listening),
    // Half-duplex (NAVI-009): the moment we listen, nothing may be speaking.
    onBeforeStart: () => player.stop(),
    onPermissionDenied: () => {
      const msg = t('micBlocked');
      panel.addMessage(msg, 'ai');
      speakResponse(msg);
    },
    onTranscriptionError: () => {
      announcer.say(t('transcribeFail'));
    },
  };

  const browserStt = new VoiceRecognition(sttOptions);
  const whisperStt = new WhisperRecognition(naviConfig.openaiApiKey, sttOptions);
  browserStt.setLanguage(SPEECH_LANG[settings.language]);
  whisperStt.setLanguage(SPEECH_LANG[settings.language]);
  const whisperAvailable = whisperStt.init();

  const activeStt = () =>
    settings.sttEngine === 'whisper' && whisperAvailable ? whisperStt : browserStt;

  const stopListening = (): void => {
    if (browserStt.isListening) browserStt.toggle();
    if (whisperStt.isListening) whisperStt.toggle();
  };

  const toggleVoiceInput = (): void => {
    void (async () => {
      // First-time users: warn that Chrome is about to ask for the mic
      // BEFORE the (visual) permission popup appears (NAVI-011).
      if (!activeStt().isListening) {
        try {
          const status = await navigator.permissions.query({
            name: 'microphone' as PermissionName,
          });
          if (status.state === 'prompt') announcer.say(t('micWillPrompt'));
        } catch {
          // permissions API unavailable — proceed silently
        }
      }
      activeStt().toggle();
    })();
  };

  // ---- Panel + menu ----------------------------------------------------

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
          announcer.say(t('greeting'));
        }
        if (!summaryStarted) {
          summaryStarted = true;
          void loadSpreadsheetAndSummarize();
        }
      },
      onUserMessage: (text) => void handleUserMessage(text),
      onVoiceToggle: () => toggleVoiceInput(),
      onPauseToggle: () => player.togglePause(),
      onStop: () => player.stop(),
      onClose: () => {
        menu.hide();
        quitConfirm.reset();
        if (!closingForQuit) player.stop();
        closingForQuit = false;
      },
    },
    { t },
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
    t,
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
    getLanguage: () => settings.language,
    setLanguage: (language) => {
      settings.language = language;
      void saveSettings({ language });
      llm.setLanguage(LLM_LANGUAGE_NAME[language]);
      player.setLanguage(SPEECH_LANG[language]);
      browserStt.setLanguage(SPEECH_LANG[language]);
      whisperStt.setLanguage(SPEECH_LANG[language]);
      void loadSpreadsheetAndSummarize(); // re-summarize in the new language
    },
    getVoiceEngine: () => settings.voiceEngine,
    setVoiceEngine: (engine) => {
      settings.voiceEngine = engine;
      player.stop(); // next speech starts cleanly on the new engine
      void saveSettings({ voiceEngine: engine });
    },
    getSttEngine: () => settings.sttEngine,
    setSttEngine: (engine) => {
      if (engine === 'whisper' && !whisperAvailable) {
        announcer.say(t('micWhisperUnavailable'));
        return;
      }
      stopListening();
      settings.sttEngine = engine;
      void saveSettings({ sttEngine: engine });
    },
    onClose: () => {
      if (panel.isOpen) panel.focusInput();
    },
  });

  browserStt.init();

  attachSpeechShortcuts(document, player, {
    onRateChange: (rate) => {
      settings.speechRate = rate;
      void saveSettings({ speechRate: rate });
      // Mid-speech the sentence restarts at the new speed (feedback enough);
      // when idle, say it out loud so the change is never silent.
      if (player.playbackStatus === 'idle')
        announcer.say(t('speedAnnounce', { rate }));
    },
    onOpenNavi: () => panel.open(),
    onOpenMenu: () => {
      if (!panel.isOpen) panel.open();
      menu.toggle();
    },
    onQuitNavi: () => {
      if (!panel.isOpen) return;
      if (quitConfirm.press() === 'prompt') {
        const msg = t('quitPrompt');
        panel.addMessage(msg, 'ai');
        speakResponse(msg);
      } else {
        const msg = t('quitFarewell');
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
        cell ? t('srModeOnWithCell', { cell }) : t('srModeOn'),
      );
    },
    // Alt/Option+C (tracker "[NAVI+c]"): announce what's on the clipboard.
    onClipboard: () => {
      void (async () => {
        try {
          const text = (await navigator.clipboard.readText()).trim();
          if (!text) {
            announcer.say(t('clipboardEmpty'));
            return;
          }
          const excerpt = text.length > 300 ? `${text.slice(0, 300)}…` : text;
          announcer.say(t('clipboardRead', { text: excerpt }));
        } catch {
          announcer.say(t('clipboardBlocked'));
        }
      })();
    },
  });

  // Browser-level open shortcut, forwarded by the background worker —
  // reaches us even when Google Sheets has trapped in-page keyboard focus.
  chrome.runtime.onMessage.addListener((message: { action?: string }) => {
    if (message?.action === 'openNavi') panel.open();
  });

  async function loadSpreadsheetAndSummarize(): Promise<void> {
    panel.addMessage(t('scanIntro'), 'ai');

    // All reads go through the user's Google sign-in — private sheets work.
    const workbook = await requestWorkbook();
    if (!workbook.success || !workbook.tabs || workbook.tabs.length === 0) {
      const msg = t('readFail', {
        details: workbook.error ?? 'no sheets found',
      });
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
    panel.addMessage(t('thinking'), 'ai', 'navi-thinking');

    // Tool calls (cell edits, extra reads) happen inside the client loop;
    // the model confirms what it did in its final answer.
    const aiResponse = await llm.sendMessage(text);

    panel.removeThinking();
    panel.addMessage(aiResponse, 'ai');
    speakResponse(aiResponse);
  }

  console.log('NAVI: Ready.');
}
