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
import { buildTourScript } from '@/core/onboarding/tour';
import {
  loadSettings,
  saveSettings,
  type OutputMode,
} from '@/core/settings/settings';
import { Announcer, createLiveRegion } from '@/core/speech/announcer';
import { FallbackSentenceEngine } from '@/core/speech/fallbackEngine';
import { OpenAITTSEngine } from '@/core/speech/naturalTtsEngine';
import { SpeechPlayer } from '@/core/speech/speechPlayer';
import { VoiceRecognition, type VoiceRecognitionOptions } from '@/core/speech/stt';
import { WakeWordListener } from '@/core/speech/wakeWord';
import { WebSpeechEngine } from '@/core/speech/webSpeechEngine';
import { WhisperRecognition } from '@/core/speech/whisperStt';
import {
  buildWorkbookContext,
  quoteSheetTitle,
  type TabSection,
} from '@/core/workbook/model';
import { buildSpokenOverview, spokenShortcut } from '@/core/workbook/overview';
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
 * Composition root — voice-first design:
 * - Page load: NAVI silently pre-reads the workbook. No panel, no voice.
 * - First summon ("Hey NAVI" / Alt+N / the eye): a short LOCAL overview
 *   speaks instantly, then the mic opens by itself.
 * - Later summons: just "Yes?" + listening.
 * - The wake word runs at all times, auto-paused while NAVI speaks or
 *   records (so she can't trigger herself).
 * Depth is always pulled by asking — the greeting stays constant-time no
 * matter how many capabilities are added.
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

  // ---- Speech: player + wake coordination ------------------------------

  const systemVoice = new WebSpeechEngine(SPEECH_LANG[settings.language]);
  const naturalVoice = new OpenAITTSEngine(
    naviConfig.openaiApiKey,
    () => settings.naturalVoiceName,
  );
  // Natural first, system as the never-mute safety net (offline, quota...).
  const naturalWithFallback = new FallbackSentenceEngine(
    naturalVoice,
    systemVoice,
    (error) => console.warn('NAVI: natural voice failed, using system voice:', error),
  );

  // Voice preview: speaks a sample in whatever voice the menu focuses.
  let previewVoiceName = settings.naturalVoiceName;
  const previewEngine = new OpenAITTSEngine(
    naviConfig.openaiApiKey,
    () => previewVoiceName,
  );

  // One-shot hook: chains "greeting finished → open the mic" and
  // "tour finished → introduce the sheet". A double-Shift skip lands in the
  // same place, so skipping never breaks the flow.
  let afterIdle: (() => void) | null = null;
  const afterSpeechEnds = (fn: () => void): void => {
    afterIdle = fn;
  };

  let playerBusy = false;
  let micBusy = false;
  const syncWake = (): void => {
    const shouldRun =
      settings.wakeWordEnabled && wakeAvailable && !playerBusy && !micBusy;
    if (shouldRun) {
      wake.start();
    } else {
      wake.stop();
    }
  };

  const player = new SpeechPlayer(
    settings.speechRate,
    {
      onStatusChange: (status) => {
        panel.setPlaybackStatus(status);
        playerBusy = status === 'speaking';
        if (status === 'idle' && afterIdle) {
          const fn = afterIdle;
          afterIdle = null;
          fn();
        }
        syncWake();
      },
    },
    () => (settings.voiceEngine === 'natural' ? naturalWithFallback : systemVoice),
  );
  player.setLanguage(SPEECH_LANG[settings.language]);

  const liveRegion = createLiveRegion(document);
  const announcer = new Announcer(player, () => settings.outputMode, liveRegion);

  /** Queued while the menu is open — nothing may talk over the menu. */
  let pendingSpeech: string | null = null;

  /** Chat responses: voice mode speaks; SR mode lets the live log announce. */
  const speakResponse = (text: string): void => {
    if (settings.outputMode !== 'voice') return;
    if (menu.isOpen) {
      pendingSpeech = text;
      return;
    }
    player.speak(text);
  };

  // ---- Voice input ------------------------------------------------------

  const sttOptions: VoiceRecognitionOptions = {
    onResult: (transcript) => panel.submitTranscript(transcript),
    onStateChange: (listening) => {
      micBusy = listening;
      panel.setVoiceButtonState(listening);
      syncWake();
    },
    // Half-duplex (NAVI-009): the moment we listen, nothing may be speaking
    // and the wake loop must release the recognition engine.
    onBeforeStart: () => {
      player.stop();
      wake.stop();
    },
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

  // NAVI auto-picks the best microphone — one less menu decision.
  const activeStt = () => (whisperAvailable ? whisperStt : browserStt);

  const stopListening = (): void => {
    if (browserStt.isListening) browserStt.toggle();
    if (whisperStt.isListening) whisperStt.toggle();
  };

  const startListening = (): void => {
    if (activeStt().isListening) return;
    void (async () => {
      try {
        const status = await navigator.permissions.query({
          name: 'microphone' as PermissionName,
        });
        if (status.state === 'prompt') announcer.say(t('micWillPrompt'));
      } catch {
        // permissions API unavailable — proceed silently
      }
      activeStt().toggle();
    })();
  };

  // ---- Wake word (always on, voice-first) -------------------------------

  const wake = new WakeWordListener(() => {
    if (panel.isOpen) {
      speakThenListen(t('wakeHeard'));
    } else {
      panel.open(); // onOpen decides: intro or "Yes?"
    }
  });
  wake.setLanguage(SPEECH_LANG[settings.language]);
  const wakeAvailable = wake.isSupported();

  // ---- Silent pre-scan ---------------------------------------------------

  let scanState: 'idle' | 'scanning' | 'ready' | 'failed' = 'idle';
  let scanError = '';
  let overview: string | null = null;
  let announceOverviewWhenReady = false;
  let introduced = false;

  async function preScan(): Promise<void> {
    if (scanState === 'scanning') return;
    scanState = 'scanning';
    overview = null;

    const workbook = await requestWorkbook();
    if (!workbook.success || !workbook.tabs || workbook.tabs.length === 0) {
      scanError = workbook.error ?? 'no sheets found';
      scanState = 'failed';
      if (announceOverviewWhenReady) {
        announceOverviewWhenReady = false;
        scanState = 'idle'; // next summon retries
        speakThenListen(t('readFail', { details: scanError }), { listen: false });
      }
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

    llm.setSpreadsheetContext(
      buildWorkbookContext({
        workbookTitle: workbook.title ?? 'Untitled workbook',
        tabs,
        activeTabTitle,
        scope: settings.contextScope,
        sections,
      }),
    );

    overview = buildSpokenOverview(t, {
      tabs,
      activeTabTitle,
      activeTabValues:
        sections.find((section) => section.title === activeTabTitle)?.values ?? [],
    });
    scanState = 'ready';

    if (announceOverviewWhenReady) {
      announceOverviewWhenReady = false;
      speakThenListen(`${overview} ${t('whatToKnow')}`);
    }
  }

  // ---- Summon flow -------------------------------------------------------

  /** Speaks (or queues) a message; optionally opens the mic when it ends. */
  function speakThenListen(text: string, opts: { listen?: boolean } = {}): void {
    const listen = opts.listen ?? true;
    panel.addMessage(text, 'ai');
    if (settings.outputMode === 'voice') {
      if (menu.isOpen) {
        pendingSpeech = text;
        return;
      }
      if (listen) afterSpeechEnds(() => startListening());
      player.speak(text);
    } else if (listen) {
      // SR mode: the live log reads the text; open the mic right away.
      startListening();
    }
  }

  /** First summon: greeting + instant local overview; later: just "Yes?". */
  function introduce(): void {
    const hello = settings.greetingEnabled ? `${t('greeting')} ` : '';

    if (scanState === 'ready' && overview) {
      introduced = true;
      speakThenListen(`${hello}${overview} ${t('whatToKnow')}`);
      return;
    }

    if (scanState === 'failed' || scanState === 'idle') {
      scanState = 'idle';
      void preScan();
    }
    // Scan in flight — greet now; the overview speaks the moment it lands.
    announceOverviewWhenReady = true;
    speakThenListen(`${hello}${t('stillScanning')}`, { listen: false });
  }

  const runTour = (opts: { firstTime: boolean }): void => {
    const script = buildTourScript(t, { shortcutSpoken: shortcutPhrase });
    panel.addMessage(script, 'ai');
    const proceed = () => {
      if (opts.firstTime) introduce();
    };
    if (settings.outputMode === 'voice') {
      if (opts.firstTime) afterSpeechEnds(proceed);
      player.speak(script);
    } else {
      proceed();
    }
  };

  // ---- Panel + menu ------------------------------------------------------

  let closingForQuit = false;
  const quitConfirm = new TwoStepConfirm();

  const panel = new NaviPanel(
    chrome.runtime.getURL('icons/navi_eye_black_bg.png'),
    {
      onOpen: () => {
        if (!settings.onboardingDone) {
          settings.onboardingDone = true;
          void saveSettings({ onboardingDone: true });
          runTour({ firstTime: true });
          return;
        }
        if (!introduced) {
          introduce();
        } else {
          speakThenListen(t('wakeHeard'));
        }
      },
      onUserMessage: (text) => void handleUserMessage(text),
      onVoiceToggle: () => {
        if (activeStt().isListening) {
          stopListening();
        } else {
          startListening();
        }
      },
      onPauseToggle: () => player.togglePause(),
      onStop: () => player.stop(),
      onClose: () => {
        menu.hide();
        quitConfirm.reset();
        stopListening();
        if (!closingForQuit) player.stop();
        closingForQuit = false;
        syncWake();
      },
    },
    { t },
  );

  panel.applyFontSize(settings.fontSize);
  panel.setOutputMode(settings.outputMode);
  panel.setInputVisible(settings.typingVisible);

  const setOutputMode = (mode: OutputMode): void => {
    settings.outputMode = mode;
    panel.setOutputMode(mode);
    if (mode === 'screenreader') player.stop();
    void saveSettings({ outputMode: mode });
  };

  const rescan = (): void => {
    scanState = 'idle';
    introduced = false;
    void preScan();
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
      rescan();
    },
    getLanguage: () => settings.language,
    setLanguage: (language) => {
      settings.language = language;
      void saveSettings({ language });
      llm.setLanguage(LLM_LANGUAGE_NAME[language]);
      player.setLanguage(SPEECH_LANG[language]);
      browserStt.setLanguage(SPEECH_LANG[language]);
      whisperStt.setLanguage(SPEECH_LANG[language]);
      wake.setLanguage(SPEECH_LANG[language]);
      rescan();
    },
    getVoiceChoice: () =>
      settings.voiceEngine === 'system' ? 'system' : settings.naturalVoiceName,
    setVoiceChoice: (choice) => {
      previewEngine.cancel();
      if (choice === 'system') {
        settings.voiceEngine = 'system';
        void saveSettings({ voiceEngine: 'system' });
      } else {
        settings.voiceEngine = 'natural';
        settings.naturalVoiceName = choice;
        void saveSettings({ voiceEngine: 'natural', naturalVoiceName: choice });
      }
      player.stop(); // the confirmation speaks in the NEW voice
    },
    previewVoice: (choice, text) => {
      player.stop();
      previewEngine.cancel();
      if (settings.outputMode !== 'voice') return; // SR mode: no audio previews
      if (choice === 'system') {
        systemVoice.speak(
          text,
          { rate: settings.speechRate, lang: SPEECH_LANG[settings.language] },
          { onEnd: () => {}, onError: () => {} },
        );
      } else {
        previewVoiceName = choice;
        previewEngine.speak(
          text,
          { rate: settings.speechRate, lang: SPEECH_LANG[settings.language] },
          { onEnd: () => {}, onError: () => {} },
        );
      }
    },
    getWakeWordEnabled: () => settings.wakeWordEnabled,
    setWakeWordEnabled: (enabled) => {
      if (enabled && !wakeAvailable) {
        announcer.say(t('wakeUnavailable'));
        return;
      }
      settings.wakeWordEnabled = enabled;
      void saveSettings({ wakeWordEnabled: enabled });
      syncWake();
    },
    getTypingVisible: () => settings.typingVisible,
    setTypingVisible: (visible) => {
      settings.typingVisible = visible;
      void saveSettings({ typingVisible: visible });
    },
    onPlayTour: () => runTour({ firstTime: false }),
    onVisibilityChange: (open) => {
      panel.setMenuMode(open);
      if (!open) {
        panel.setInputVisible(settings.typingVisible);
        if (pendingSpeech) {
          const text = pendingSpeech;
          pendingSpeech = null;
          player.speak(text);
        }
      }
    },
    onClose: () => {
      if (panel.isOpen) panel.focusInput();
    },
  });

  browserStt.init();

  // ---- Global shortcuts + browser command --------------------------------

  attachSpeechShortcuts(document, player, {
    onRateChange: (rate) => {
      settings.speechRate = rate;
      void saveSettings({ speechRate: rate });
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
    onScreenReaderMode: () => {
      if (!panel.isOpen) panel.open();
      setOutputMode('screenreader');
      const cell = getActiveCellA1();
      announcer.say(cell ? t('srModeOnWithCell', { cell }) : t('srModeOn'));
    },
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

  // Browser-level open shortcut, forwarded by the background worker.
  chrome.runtime.onMessage.addListener((message: { action?: string }) => {
    if (message?.action === 'openNavi') panel.open();
  });

  // What is Alt+N really bound to on this machine? Spoken in the tour.
  let shortcutPhrase: string | null = null;
  chrome.runtime.sendMessage(
    { action: 'getShortcut' },
    (response: { shortcut?: string | null } | undefined) => {
      void chrome.runtime.lastError;
      shortcutPhrase = spokenShortcut(response?.shortcut);
    },
  );

  // ---- Conversation ------------------------------------------------------

  async function handleUserMessage(text: string): Promise<void> {
    player.stop();

    panel.addMessage(text, 'user');
    panel.addMessage(t('thinking'), 'ai', 'navi-thinking');

    const aiResponse = await llm.sendMessage(text);

    panel.removeThinking();
    panel.addMessage(aiResponse, 'ai');
    speakResponse(aiResponse);
  }

  // ---- Kick off: silent readiness ----------------------------------------

  void preScan(); // background read — no panel, no voice
  syncWake(); // wake word live from second zero (default ON)

  console.log('NAVI: Ready.');
}
