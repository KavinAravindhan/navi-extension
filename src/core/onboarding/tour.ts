import type { Translate } from '@/core/i18n/i18n';

/**
 * The first-time audio walkthrough (NAVI-012): greeting, playback controls,
 * speed, the core shortcuts, and how to talk to NAVI. Spoken through the
 * normal player, so the user can PRACTICE pause/skip on the tour itself.
 * Re-runnable from the menu; skippable with double-Shift (taught first).
 */
export function buildTourScript(t: Translate): string {
  return [
    t('tourIntro'),
    t('tourPause'),
    t('tourSpeed'),
    t('tourShortcuts'),
    t('tourTalk'),
    t('tourEnd'),
  ].join('\n');
}
