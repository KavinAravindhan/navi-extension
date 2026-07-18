import type { OutputMode } from '@/core/settings/settings';

/**
 * Routes NAVI's spoken output according to the output mode (NAVI-002):
 * - voice mode → the SpeechPlayer talks
 * - screen-reader mode → the text is appended to an aria-live region and the
 *   user's own screen reader reads it; NAVI's TTS stays silent
 *
 * Appending a child per announcement (instead of replacing textContent)
 * makes consecutive identical announcements re-announce reliably.
 */
export class Announcer {
  constructor(
    private readonly player: { speak(text: string): void },
    private readonly getMode: () => OutputMode,
    private readonly liveRegion: HTMLElement,
  ) {}

  say(text: string): void {
    if (this.getMode() === 'voice') {
      this.player.speak(text);
      return;
    }

    const doc = this.liveRegion.ownerDocument;
    const entry = doc.createElement('div');
    entry.textContent = text;
    this.liveRegion.appendChild(entry);

    // Keep the region from growing without bound.
    while (this.liveRegion.childNodes.length > 4) {
      this.liveRegion.removeChild(this.liveRegion.firstChild as Node);
    }
  }
}

/** Creates the visually-hidden polite live region NAVI announces into. */
export function createLiveRegion(doc: Document = document): HTMLElement {
  const region = doc.createElement('div');
  region.id = 'navi-live';
  region.setAttribute('aria-live', 'polite');
  region.className = 'navi-visually-hidden';
  doc.body.appendChild(region);
  return region;
}
