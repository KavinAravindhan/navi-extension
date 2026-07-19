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
import { parseA1Range } from '@/core/workbook/a1';
import { findImageCells } from '@/core/workbook/formatting';
import {
  buildWorkbookContext,
  quoteSheetTitle,
  type TabSection,
  type WorkbookTab,
} from '@/core/workbook/model';
import { buildSpokenOverview, spokenShortcut } from '@/core/workbook/overview';
import { formatFindings, loadFindings, saveFinding } from '@/core/memory/recentFindings';
import { getActiveCellA1 } from '@/platform/sheets/activeCell';
import { requestCellEdit } from '@/platform/sheets/editCell';
import { getActiveSheetName } from '@/platform/sheets/location';
import { navigateToCell, navigateToTab } from '@/platform/sheets/navigate';
import {
  requestCreateChart,
  requestFormatting,
  requestRange,
  requestWorkbook,
} from '@/platform/sheets/workbookGateway';
import {
  SURFACE_LABEL,
  detectSurface,
  getDocumentIdFromUrl,
} from '@/platform/surface';
import { NaviMenu } from '@/ui/menu';
import { NaviPanel } from '@/ui/panel';

export default defineContentScript({
  matches: [
    'https://docs.google.com/spreadsheets/*',
    'https://docs.google.com/document/*',
    'https://docs.google.com/presentation/*',
  ],
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

  const surface = detectSurface(window.location.href) ?? 'sheets';
  let surfaceTitle = 'Untitled'; // set by the pre-scan, used by shared memory

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

  // Tabs cached by the pre-scan; navigation/chart tools resolve names here.
  let knownTabs: WorkbookTab[] = [];

  // Shared across every surface: recall what NAVI said in other tabs.
  tools.register(
    {
      name: 'recall_recent',
      description:
        "Recall NAVI's recent findings from other Google tabs in this browser session (cross-app memory). Use when the user says 'that number', 'the figure from the sheet', etc.",
      parameters: { type: 'object', properties: {} },
    },
    async () => formatFindings(await loadFindings()),
  );

  const registerSheetsTools = () => {
  const findTab = (name?: string): WorkbookTab | undefined => {
    if (knownTabs.length === 0) return undefined;
    if (!name) {
      const active = getActiveSheetName();
      return knownTabs.find((tab) => tab.title === active) ?? knownTabs[0];
    }
    const lower = name.toLowerCase();
    return (
      knownTabs.find((tab) => tab.title.toLowerCase() === lower) ??
      knownTabs.find((tab) => tab.title.toLowerCase().includes(lower))
    );
  };

  tools.register(
    {
      name: 'switch_tab',
      description:
        'Switch which sheet tab the user is looking at — the screen actually changes.',
      parameters: {
        type: 'object',
        properties: { tabName: { type: 'string', description: 'Tab name, e.g. Scenarios' } },
        required: ['tabName'],
      },
    },
    async (args) => {
      const tab = findTab(String(args.tabName ?? ''));
      if (!tab) {
        return `No tab named "${args.tabName}". Available tabs: ${knownTabs
          .map((t) => t.title)
          .join(', ')}.`;
      }
      navigateToTab(tab.sheetId);
      rescan(); // context follows the newly visible tab
      return `Switched the view to tab "${tab.title}".`;
    },
  );

  tools.register(
    {
      name: 'go_to_cell',
      description:
        "Move the user's selection to a cell or range — the screen scrolls there.",
      parameters: {
        type: 'object',
        properties: {
          cell: { type: 'string', description: 'A1 cell or range, e.g. B15 or A1:C3' },
          tabName: { type: 'string', description: 'Optional tab name' },
        },
        required: ['cell'],
      },
    },
    async (args) => {
      const tab = findTab(args.tabName ? String(args.tabName) : undefined);
      if (!tab) return 'I could not resolve which tab to use.';
      const cell = String(args.cell ?? '').trim().toUpperCase();
      if (!parseA1Range(cell)) return `"${cell}" is not a valid cell reference.`;
      navigateToCell(tab.sheetId, cell);
      return `Moved the selection to ${cell} on tab "${tab.title}".`;
    },
  );

  tools.register(
    {
      name: 'create_chart',
      description:
        'Insert a chart into the sheet from a data range. First row = headers, first column = category labels.',
      parameters: {
        type: 'object',
        properties: {
          range: { type: 'string', description: 'Data range in A1, e.g. A1:B10' },
          chartType: { type: 'string', enum: ['LINE', 'COLUMN', 'BAR', 'PIE'] },
          title: { type: 'string' },
          tabName: { type: 'string', description: 'Optional tab name' },
        },
        required: ['range', 'chartType', 'title'],
      },
    },
    async (args) => {
      const tab = findTab(args.tabName ? String(args.tabName) : undefined);
      const gridRange = parseA1Range(String(args.range ?? ''));
      if (!tab || !gridRange) return 'Invalid tab or range for the chart.';
      const requested = String(args.chartType ?? '').toUpperCase();
      const chartType = (['LINE', 'COLUMN', 'BAR', 'PIE'] as const).find(
        (type) => type === requested,
      ) ?? 'COLUMN';
      const title = String(args.title ?? 'Chart');
      const response = await requestCreateChart({
        sheetId: tab.sheetId,
        chartType,
        title,
        gridRange,
      });
      return response.success
        ? `Created a ${chartType.toLowerCase()} chart titled "${title}" next to the data on "${tab.title}".`
        : `Chart creation failed: ${response.error}. The user may lack edit access.`;
    },
  );

  tools.register(
    {
      name: 'read_formatting',
      description:
        'Describe cell formatting (bold, italic, highlight colors, merged cells) for a range.',
      parameters: {
        type: 'object',
        properties: {
          range: { type: 'string', description: 'A1 range, e.g. A1:D20' },
          tabName: { type: 'string', description: 'Optional tab name' },
        },
        required: ['range'],
      },
    },
    async (args) => {
      const tab = findTab(args.tabName ? String(args.tabName) : undefined);
      const rangePart = String(args.range ?? '').trim().toUpperCase();
      if (!tab || !parseA1Range(rangePart)) return 'Invalid tab or range.';
      const response = await requestFormatting(
        `${quoteSheetTitle(tab.title)}!${rangePart}`,
      );
      return response.success
        ? (response.summary ?? 'No formatting information returned.')
        : `Formatting read failed: ${response.error}`;
    },
  );

  tools.register(
    {
      name: 'find_images',
      description:
        'List cells containing embedded images or sparklines (IMAGE/SPARKLINE formulas) on a tab.',
      parameters: {
        type: 'object',
        properties: { tabName: { type: 'string', description: 'Optional tab name' } },
      },
    },
    async (args) => {
      const tab = findTab(args.tabName ? String(args.tabName) : undefined);
      if (!tab) return 'I could not resolve which tab to use.';
      const response = await requestRange(quoteSheetTitle(tab.title), 'FORMULA');
      if (!response.success) return `Read failed: ${response.error}`;
      const cells = findImageCells(response.values ?? []);
      const apiNote =
        "Note: floating pictures over the grid are not exposed by Google's API, so they cannot be detected.";
      return cells.length > 0
        ? `Cells with embedded images or sparklines on "${tab.title}": ${cells.join(', ')}. ${apiNote}`
        : `No embedded IMAGE or SPARKLINE formulas found on "${tab.title}". ${apiNote}`;
    },
  );
  };

  const registerDocsTools = () => {
    tools.register(
      {
        name: 'read_document',
        description: 'Re-read the current Google Doc (title, headings, full text).',
        parameters: { type: 'object', properties: {} },
      },
      async () => {
        const documentId = getDocumentIdFromUrl(window.location.href);
        if (!documentId) return 'Could not find the document ID.';
        const res = await new Promise<any>((resolve) =>
          chrome.runtime.sendMessage({ action: 'getDocument', documentId }, (r) => {
            void chrome.runtime.lastError;
            resolve(r);
          }),
        );
        if (!res?.success) return `Read failed: ${res?.error ?? 'no response'}`;
        const o = res.outline;
        return `Title: ${o.title}
Headings: ${o.headings.join(' | ') || '(none)'}

${o.text}`;
      },
    );

    tools.register(
      {
        name: 'append_paragraph',
        description:
          'Append a paragraph to the END of the current Google Doc. Use for dictation and for inserting facts recalled from other tabs.',
        parameters: {
          type: 'object',
          properties: { text: { type: 'string' } },
          required: ['text'],
        },
      },
      async (args) => {
        const documentId = getDocumentIdFromUrl(window.location.href);
        if (!documentId) return 'Could not find the document ID.';
        const res = await new Promise<any>((resolve) =>
          chrome.runtime.sendMessage(
            { action: 'appendDoc', documentId, text: String(args.text ?? '') },
            (r) => {
              void chrome.runtime.lastError;
              resolve(r);
            },
          ),
        );
        return res?.success
          ? 'Paragraph added at the end of the document.'
          : `Write failed: ${res?.error ?? 'no response'}. The user may lack edit access.`;
      },
    );
  };

  const registerSlidesTools = () => {
    const fetchDeck = async () => {
      const presentationId = getDocumentIdFromUrl(window.location.href);
      if (!presentationId) return null;
      return new Promise<any>((resolve) =>
        chrome.runtime.sendMessage({ action: 'getPresentation', presentationId }, (r) => {
          void chrome.runtime.lastError;
          resolve(r);
        }),
      );
    };

    tools.register(
      {
        name: 'read_slide',
        description: 'Read one slide of the current presentation by its number.',
        parameters: {
          type: 'object',
          properties: { slideNumber: { type: 'number' } },
          required: ['slideNumber'],
        },
      },
      async (args) => {
        const res = await fetchDeck();
        if (!res?.success) return `Read failed: ${res?.error ?? 'no response'}`;
        const n = Number(args.slideNumber ?? 0);
        const slide = res.outline.slides[n - 1];
        if (!slide) return `There is no slide ${n}; the deck has ${res.outline.slides.length} slides.`;
        return `Slide ${n}: "${slide.title}". ${slide.bodyText || '(no body text)'}`;
      },
    );

    tools.register(
      {
        name: 'add_slide',
        description:
          'Add a new slide with a title and body text at the end of the presentation.',
        parameters: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            body: { type: 'string' },
          },
          required: ['title'],
        },
      },
      async (args) => {
        const presentationId = getDocumentIdFromUrl(window.location.href);
        if (!presentationId) return 'Could not find the presentation ID.';
        const res = await new Promise<any>((resolve) =>
          chrome.runtime.sendMessage(
            {
              action: 'addSlide',
              presentationId,
              title: String(args.title ?? ''),
              body: String(args.body ?? ''),
            },
            (r) => {
              void chrome.runtime.lastError;
              resolve(r);
            },
          ),
        );
        return res?.success
          ? `Added a slide titled "${args.title}" at the end.`
          : `Write failed: ${res?.error ?? 'no response'}. The user may lack edit access.`;
      },
    );
  };

  if (surface === 'sheets') registerSheetsTools();
  if (surface === 'docs') registerDocsTools();
  if (surface === 'slides') registerSlidesTools();

  const llm = new LLMClient(naviConfig.openaiApiKey, tools);
  llm.setLanguage(LLM_LANGUAGE_NAME[settings.language]);
  llm.setSurface(SURFACE_LABEL[surface]);

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

    if (surface === 'docs') {
      await preScanDocs();
      return;
    }
    if (surface === 'slides') {
      await preScanSlides();
      return;
    }

    const workbook = await requestWorkbook();
    if (!workbook.success || !workbook.tabs || workbook.tabs.length === 0) {
      scanFailed(workbook.error ?? 'no sheets found');
      return;
    }
    surfaceTitle = workbook.title ?? 'Untitled workbook';

    const tabs = workbook.tabs;
    knownTabs = tabs;
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

    scanReady(
      buildSpokenOverview(t, {
        tabs,
        activeTabTitle,
        activeTabValues:
          sections.find((section) => section.title === activeTabTitle)?.values ??
          [],
      }),
    );
  }

  function scanFailed(details: string): void {
    scanError = details;
    scanState = 'failed';
    if (announceOverviewWhenReady) {
      announceOverviewWhenReady = false;
      scanState = 'idle';
      const failMsg = accountEmail
        ? t('readFailAccount', { email: accountEmail, details })
        : t('readFail', { details });
      speakThenListen(failMsg, { listen: false });
    }
  }

  function scanReady(newOverview: string): void {
    overview = newOverview;
    scanState = 'ready';
    if (announceOverviewWhenReady) {
      announceOverviewWhenReady = false;
      speakThenListen(`${overview} ${t('whatToKnow')}`);
    }
  }

  async function preScanDocs(): Promise<void> {
    const documentId = getDocumentIdFromUrl(window.location.href);
    const res = documentId
      ? await new Promise<any>((resolve) =>
          chrome.runtime.sendMessage({ action: 'getDocument', documentId }, (r) => {
            void chrome.runtime.lastError;
            resolve(r);
          }),
        )
      : null;
    if (!res?.success || !res.outline) {
      scanFailed(res?.error ?? 'could not find the document');
      return;
    }
    const o = res.outline;
    surfaceTitle = o.title;
    llm.setSpreadsheetContext(
      `Google Doc "${o.title}"\nHeadings: ${o.headings.join(' | ') || '(none)'}\n\n${o.text}`,
    );
    scanReady(
      o.headings.length > 0
        ? t('overviewDoc', {
            title: o.title,
            words: o.wordCount,
            count: o.headings.length,
            names: o.headings.slice(0, 6).join(', '),
          })
        : t('overviewDocNoHeadings', { title: o.title, words: o.wordCount }),
    );
  }

  async function preScanSlides(): Promise<void> {
    const presentationId = getDocumentIdFromUrl(window.location.href);
    const res = presentationId
      ? await new Promise<any>((resolve) =>
          chrome.runtime.sendMessage(
            { action: 'getPresentation', presentationId },
            (r) => {
              void chrome.runtime.lastError;
              resolve(r);
            },
          ),
        )
      : null;
    if (!res?.success || !res.outline) {
      scanFailed(res?.error ?? 'could not find the presentation');
      return;
    }
    const o = res.outline;
    surfaceTitle = o.title;
    const slideLines = o.slides
      .map((sl: any) => `Slide ${sl.index}: ${sl.title}\n${sl.bodyText}`)
      .join('\n\n');
    llm.setSpreadsheetContext(`Google Slides "${o.title}"\n\n${slideLines}`);
    scanReady(
      t('overviewSlides', {
        title: o.title,
        count: o.slides.length,
        first: o.slides[0]?.title ?? '(empty)',
      }),
    );
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

  // Which Google account is NAVI using? Spoken in read-failure guidance.
  let accountEmail: string | null = null;
  chrome.runtime.sendMessage(
    { action: 'getProfile' },
    (response: { email?: string | null } | undefined) => {
      void chrome.runtime.lastError;
      accountEmail = response?.email ?? null;
    },
  );

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

    // Cross-app memory: other tabs can recall this answer (NAVI-019 ph. 1).
    void saveFinding(SURFACE_LABEL[surface], surfaceTitle, aiResponse);
  }

  // ---- Kick off: silent readiness ----------------------------------------

  void preScan(); // background read — no panel, no voice
  syncWake(); // wake word live from second zero (default ON)

  console.log('NAVI: Ready.');
}
