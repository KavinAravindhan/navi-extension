import type { SentenceEngine, SentenceEngineEvents } from './speechPlayer';

/**
 * Built-in speechSynthesis engine — instant and free. Holds the voice cache
 * (resolved eagerly because Chrome loads its voice list asynchronously; the
 * greeting used to go out with the wrong voice before this warm-up).
 */
export class WebSpeechEngine implements SentenceEngine {
  private cachedVoice: SpeechSynthesisVoice | null = null;
  private cachedLang: string | null = null;
  private current: SpeechSynthesisUtterance | null = null;
  private resumeInterval: ReturnType<typeof setInterval> | null = null;

  constructor(initialLang = 'en-US') {
    this.warmUpVoices(initialLang);
  }

  speak(
    text: string,
    opts: { rate: number; lang: string },
    events: SentenceEngineEvents,
  ): void {
    if (!window.speechSynthesis) {
      console.warn('NAVI: Text-to-speech is not supported in this browser.');
      events.onError('speech synthesis unavailable');
      return;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = opts.lang;
    utterance.rate = opts.rate;
    utterance.pitch = 1;
    utterance.volume = 1;

    if (this.cachedLang !== opts.lang || !this.cachedVoice) {
      this.cachedVoice = this.pickPreferredVoice(opts.lang);
      this.cachedLang = opts.lang;
    }
    if (this.cachedVoice) utterance.voice = this.cachedVoice;

    this.current = utterance;

    // Belt-and-braces port of v1's fix for Chrome pausing long utterances.
    this.clearResumeInterval();
    this.resumeInterval = setInterval(() => {
      if (window.speechSynthesis.speaking && !window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }
    }, 10000);

    utterance.onend = () => {
      if (this.current !== utterance) return;
      this.clearResumeInterval();
      events.onEnd();
    };

    utterance.onerror = (event) => {
      if (this.current !== utterance) return;
      if (event.error === 'interrupted' || event.error === 'canceled') return;
      this.clearResumeInterval();
      events.onError(String(event.error));
    };

    window.speechSynthesis.speak(utterance);
  }

  cancel(): void {
    this.current = null;
    this.clearResumeInterval();
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  }

  // ------------------------------------------------------------------

  private warmUpVoices(lang: string): void {
    if (!window.speechSynthesis) return;
    this.cachedVoice = this.pickPreferredVoice(lang);
    this.cachedLang = lang;
    if (!this.cachedVoice) {
      window.speechSynthesis.onvoiceschanged = () => {
        this.cachedVoice = this.pickPreferredVoice(this.cachedLang ?? lang);
        window.speechSynthesis.onvoiceschanged = null;
      };
    }
  }

  /** v1's preferred English voices; other languages match by lang prefix. */
  private pickPreferredVoice(lang: string): SpeechSynthesisVoice | null {
    const voices = window.speechSynthesis?.getVoices() ?? [];
    const langPrefix = lang.split('-')[0];

    if (langPrefix === 'en') {
      const preferred = [
        'Google US English',
        'Google UK English Female',
        'Google UK English Male',
        'Microsoft Aria Online (Natural) - English (United States)',
        'Microsoft Guy Online (Natural) - English (United States)',
      ];
      for (const name of preferred) {
        const match = voices.find((v) => v.name === name);
        if (match) return match;
      }
    }

    return (
      voices.find((v) => v.lang.startsWith(langPrefix) && !v.default) ??
      voices.find((v) => v.lang.startsWith(langPrefix)) ??
      null
    );
  }

  private clearResumeInterval(): void {
    if (this.resumeInterval !== null) {
      clearInterval(this.resumeInterval);
      this.resumeInterval = null;
    }
  }
}
