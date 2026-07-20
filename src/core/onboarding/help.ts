import type { Translate } from '@/core/i18n/i18n';

export interface HelpOptions {
  /** Speakable form of the real open-NAVI binding ("Option and N"), or null. */
  shortcutSpoken?: string | null;
}

/**
 * The on-demand spoken reference (Alt+H, or saying "help"): every way to
 * reach NAVI and everything she can do. Reuses the tour's pause/speed lines
 * so the two scripts never drift apart. Spoken through the normal player, so
 * pause, skip, and speed all work on the help itself.
 */
export function buildHelpScript(t: Translate, options: HelpOptions = {}): string {
  const parts = [t('helpIntro'), t('helpAsk'), t('helpSummon')];

  if (options.shortcutSpoken) {
    parts.push(t('helpShortcut', { shortcut: options.shortcutSpoken }));
  }

  parts.push(
    t('tourPause'),
    t('tourSpeed'),
    t('helpMenu'),
    t('helpExtras'),
    t('helpQuit'),
    t('helpEnd'),
  );
  return parts.join('\n');
}
