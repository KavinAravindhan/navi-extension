import type { Translate } from '@/core/i18n/i18n';

export interface TourOptions {
  /** Speakable form of the real open-NAVI binding ("Option and N"), or null. */
  shortcutSpoken?: string | null;
}

/**
 * The first-time audio walkthrough (NAVI-012), voice-first edition: the wake
 * word comes first (it's the primary access), then playback controls, then
 * the REAL keyboard binding on this machine — or spoken setup guidance when
 * Chrome failed to bind it. Spoken through the normal player, so the user
 * can practice pause/skip on the tour itself. Re-runnable from the menu.
 */
export function buildTourScript(t: Translate, options: TourOptions = {}): string {
  const parts = [t('tourIntro'), t('tourWake'), t('tourPause'), t('tourSpeed')];

  if (options.shortcutSpoken) {
    parts.push(t('tourShortcutBound', { shortcut: options.shortcutSpoken }));
  } else {
    parts.push(t('shortcutNotSet'));
  }

  parts.push(t('tourTalk'), t('tourEnd'));
  return parts.join('\n');
}
