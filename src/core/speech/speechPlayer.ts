import { cleanTextForSpeech } from './textCleanup';
import { splitIntoSentences } from './sentences';

export type PlaybackStatus = 'idle' | 'speaking' | 'paused';

export interface SpeechPlayerEvents {
  onStatusChange?: (status: PlaybackStatus) => void;
}

/**
 * NAVI's text-to-speech engine (replaces v1's single-utterance TextToSpeech).
 *
 * Text is split into sentences and spoken one utterance at a time, which is
 * what makes reliable control possible (NAVI-005):
 * - pause()  cancels the current sentence but keeps the queue position
 * - resume() re-speaks the current sentence from its start
 * - stop()   clears the queue entirely
 * - setRate() applies immediately by restarting the current sentence
 *
 * Short per-sentence utterances also sidestep Chrome's long-utterance
 * auto-pause bug far better than v1's resume-interval hack did.
 */
export class SpeechPlayer {
  private sentences: string[] = [];
  private index = 0;
  private status: PlaybackStatus = 'idle';
  private rate: number;
  /** Identity guard: events from cancelled utterances must be ignored. */
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private resumeInterval: ReturnType<typeof setInterval> | null = null;
  /** Voice resolved once up-front so the greeting and content match. */
  private cachedVoice: SpeechSynthesisVoice | null = null;
  /** Remembered so a Shift-tap while idle can replay the last message. */
  private lastText: string | null = null;

  constructor(
    initialRate = 1.0,
    private readonly events: SpeechPlayerEvents = {},
  ) {
    this.rate = initialRate;
    this.warmUpVoices();
  }

  get playbackStatus(): PlaybackStatus {
    return this.status;
  }

  get isSpeaking(): boolean {
    return this.status === 'speaking';
  }

  getRate(): number {
    return this.rate;
  }

  /** Starts speaking `text` from the beginning, replacing anything queued. */
  speak(text: string): void {
    if (!window.speechSynthesis) {
      console.warn('NAVI: Text-to-speech is not supported in this browser.');
      return;
    }
    if (!text || text.trim() === '') {
      console.warn('NAVI: No text to speak.');
      return;
    }

    this.lastText = text;
    this.cancelCurrentUtterance();
    this.sentences = splitIntoSentences(cleanTextForSpeech(text));
    this.index = 0;

    if (this.sentences.length === 0) {
      this.setStatus('idle');
      return;
    }

    this.setStatus('speaking');
    this.speakCurrentSentence();
  }

  /** Pauses after cancelling the current sentence; position is kept. */
  pause(): void {
    if (this.status !== 'speaking') return;
    this.cancelCurrentUtterance();
    this.setStatus('paused');
  }

  /** Resumes by re-speaking the current sentence from its start. */
  resume(): void {
    if (this.status !== 'paused') return;
    this.setStatus('speaking');
    this.speakCurrentSentence();
  }

  togglePause(): void {
    if (this.status === 'speaking') {
      this.pause();
    } else if (this.status === 'paused') {
      this.resume();
    } else if (this.lastText) {
      // Idle + a Shift-tap (or ⏯️ click) replays the last message from the
      // start — the "restart after stop" affordance testers asked for.
      this.speak(this.lastText);
    }
  }

  /** Stops and clears the whole queue (double-Shift behavior). */
  stop(): void {
    this.sentences = [];
    this.index = 0;
    this.cancelCurrentUtterance();
    this.setStatus('idle');
  }

  /** Applies a new rate; a sentence being spoken restarts at the new rate. */
  setRate(rate: number): void {
    this.rate = rate;
    if (this.status === 'speaking') {
      this.cancelCurrentUtterance();
      this.speakCurrentSentence();
    }
  }

  // ------------------------------------------------------------------

  private speakCurrentSentence(): void {
    if (this.index >= this.sentences.length) {
      this.sentences = [];
      this.index = 0;
      this.setStatus('idle');
      return;
    }

    const utterance = new SpeechSynthesisUtterance(this.sentences[this.index]);
    utterance.lang = 'en-US';
    utterance.rate = this.rate;
    utterance.pitch = 1;
    utterance.volume = 1;
    if (!this.cachedVoice) this.cachedVoice = this.pickPreferredVoice();
    if (this.cachedVoice) utterance.voice = this.cachedVoice;

    this.currentUtterance = utterance;

    // Belt-and-braces port of v1's fix for Chrome pausing long utterances.
    this.clearResumeInterval();
    this.resumeInterval = setInterval(() => {
      if (window.speechSynthesis.speaking && !window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }
    }, 10000);

    utterance.onend = () => {
      if (this.currentUtterance !== utterance) return;
      this.clearResumeInterval();
      this.index += 1;
      this.speakCurrentSentence();
    };

    utterance.onerror = (event) => {
      if (this.currentUtterance !== utterance) return;
      if (event.error === 'interrupted' || event.error === 'canceled') return;
      console.error('NAVI: Speech error:', event.error);
      this.clearResumeInterval();
      this.sentences = [];
      this.index = 0;
      this.setStatus('idle');
    };

    window.speechSynthesis.speak(utterance);
  }

  /**
   * Detaches the current utterance BEFORE cancelling, so the onend/onerror
   * Chrome fires for the cancelled utterance is ignored by the identity guard.
   */
  private cancelCurrentUtterance(): void {
    this.currentUtterance = null;
    this.clearResumeInterval();
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  }

  private clearResumeInterval(): void {
    if (this.resumeInterval !== null) {
      clearInterval(this.resumeInterval);
      this.resumeInterval = null;
    }
  }

  private setStatus(status: PlaybackStatus): void {
    if (this.status === status) return;
    this.status = status;
    this.events.onStatusChange?.(status);
  }

  /**
   * Resolves the preferred voice ONCE, as early as possible. Chrome loads
   * its voice list asynchronously; without this warm-up the very first
   * utterance (the greeting) went out with the OS default voice and sounded
   * different from everything after it.
   */
  private warmUpVoices(): void {
    if (!window.speechSynthesis) return;
    this.cachedVoice = this.pickPreferredVoice();
    if (!this.cachedVoice) {
      window.speechSynthesis.onvoiceschanged = () => {
        this.cachedVoice = this.pickPreferredVoice();
        window.speechSynthesis.onvoiceschanged = null;
      };
    }
  }

  /** v1's preferred-voice list, unchanged. */
  private pickPreferredVoice(): SpeechSynthesisVoice | null {
    const voices = window.speechSynthesis?.getVoices() ?? [];
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
    return voices.find((v) => v.lang.startsWith('en') && !v.default) ?? null;
  }
}
