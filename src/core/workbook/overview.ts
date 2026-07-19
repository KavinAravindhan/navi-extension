import type { Translate } from '@/core/i18n/i18n';
import { detectHeading, type CellValue, type WorkbookTab } from './model';

export interface OverviewInput {
  tabs: WorkbookTab[];
  activeTabTitle: string;
  /** Values of the active tab, for heading detection + real row count. */
  activeTabValues: CellValue[][];
}

/**
 * The instant spoken overview (voice-first design): computed locally with
 * ZERO AI latency, kept to a couple of sentences no matter how many features
 * NAVI grows — depth is pulled by asking, never pushed into the greeting.
 */
export function buildSpokenOverview(t: Translate, input: OverviewInput): string {
  const sorted = [...input.tabs].sort((a, b) => a.index - b.index);
  const names = sorted.map((tab) => tab.title).join(', ');

  const parts: string[] = [];
  parts.push(
    sorted.length === 1
      ? t('overviewOneTab', { names })
      : t('overviewTabs', { count: sorted.length, names }),
  );

  const heading = detectHeading(input.activeTabValues);
  const rows = input.activeTabValues.length;
  parts.push(
    heading
      ? t('overviewCurrentWithHeading', {
          tab: input.activeTabTitle,
          heading,
          rows,
        })
      : t('overviewCurrent', { tab: input.activeTabTitle, rows }),
  );

  const chartCount = sorted.reduce((sum, tab) => sum + tab.charts.length, 0);
  if (chartCount > 0) {
    parts.push(
      t('overviewCharts', {
        count: chartCount,
        plural: chartCount === 1 ? '' : 's',
      }),
    );
  }

  return parts.join(' ');
}

/**
 * Turns a chrome.commands shortcut string into speakable words:
 * "Alt+N" → "Alt and N", "⌥N" → "Option and N", "MacCtrl+Shift+K" →
 * "Control and Shift and K". Returns null for unset shortcuts.
 */
export function spokenShortcut(shortcut: string | null | undefined): string | null {
  if (!shortcut || !shortcut.trim()) return null;

  const symbolWords: Record<string, string> = {
    '⌥': 'Option',
    '⇧': 'Shift',
    '⌘': 'Command',
    '⌃': 'Control',
  };

  let normalized = shortcut.trim();
  for (const [symbol, word] of Object.entries(symbolWords)) {
    normalized = normalized.split(symbol).join(`${word}+`);
  }

  const words = normalized
    .split('+')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => (part === 'MacCtrl' ? 'Control' : part));

  return words.length > 0 ? words.join(' and ') : null;
}
