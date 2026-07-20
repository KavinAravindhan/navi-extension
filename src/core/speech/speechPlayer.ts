import { cleanTextForSpeech } from './textCleanup';
import { splitIntoSentences } from './sentences';
import { WebSpeechEngine } from './webSpeechEngine';

export type PlaybackStatus = 'idle' | 'speaking' | 'paused';

export interface SpeechPlayerEvents {
  onStatusChange?: (status: PlaybackStatus) => void;
}

export interface SentenceEngineEvents {
  onEnd: () => void;
  onError: (error: string) => void;
}

/**
 * Speaks ONE sentence at a time. Implementations: WebSpeechEngine (built-in,
 * instant) and OpenAITTSEngine (natural neural voice, NAVI-017).
 */
export interface SentenceEngine {
  speak(
    text: string,
    opts: { rate: number; lang: string },
    events: SentenceEngineEvents,
  ): void;
  cancel(): void;
  /** Optional: start fetching audio for an upcoming sentence (latency). */
  prefetch?(text: string, opts: { rate: number; lang: string }): void;
  /** Optional: change the playback rate LIVE, without restarting audio. */
  setRate?(rate: number): void;
}

/**
 * NAVI's text-to-speech player: splits text into sentences and drives a
 * SentenceEngine through the queue (NAVI-005):
 * - pause()  cancels the current sentence but keeps the queue position
 * - resume() re-speaks the current sentence from its start
 * - stop()   clears the queue entirely; a later toggle replays the last text
 * - setRate() applies LIVE when the engine supports it (natural voice keeps
 *   talking, just faster); otherwise the current sentence restarts
 *
 * The engine is resolved per sentence, so switching the voice setting takes
 * effect mid-conversation.
 */
export class SpeechPlayer {
  private sentences: string[] = [];
  private index = 0;
  private status: PlaybackStatus = 'idle';
  private rate: number;
  private speechLang = 'en-US';
  /** Remembered so a Shift-tap while idle can replay the last message. */
  private lastText: string | null = null;
  /** Bumped on every cancel — stale engine callbacks are ignored. */
  private generation = 0;
  private activeEngine: SentenceEngine | null = null;
  private readonly getEngine: () => SentenceEngine;

  constructor(
    initialRate = 1.0,
    private readonly events: SpeechPlayerEvents = {},
    engineProvider?: () => SentenceEngine,
  ) {
    this.rate = initialRate;
    if (engineProvider) {
      this.getEngine = engineProvider;
    } else {
      const webEngine = new WebSpeechEngine(this.speechLang);
      this.getEngine = () => webEngine;
    }
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

  /** Switches the speaking language (e.g. 'id-ID'); voices follow along. */
  setLanguage(speechLang: string): void {
    this.speechLang = speechLang;
  }

  /** Starts speaking `text` from the beginning, replacing anything queued. */
  speak(text: string): void {
    if (!text || text.trim() === '') {
      console.warn('NAVI: No text to speak.');
      return;
    }

    this.lastText = text;
    this.cancelCurrent();
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
    this.cancelCurrent();
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
    this.cancelCurrent();
    this.setStatus('idle');
  }

  /** Applies a new rate — live when possible, so speech keeps flowing. */
  setRate(rate: number): void {
    this.rate = rate;
    if (this.status !== 'speaking') return;
    if (this.activeEngine?.setRate) {
      // The engine adjusts the playing audio in place — no restart. Pressing
      // the speed keys used to replay the whole (often long) sentence.
      this.activeEngine.setRate(rate);
      return;
    }
    // Web Speech can't change rate mid-utterance — restart this sentence.
    this.cancelCurrent();
    this.speakCurrentSentence();
  }

  // ------------------------------------------------------------------

  private speakCurrentSentence(): void {
    if (this.index >= this.sentences.length) {
      this.sentences = [];
      this.index = 0;
      this.setStatus('idle');
      return;
    }

    const generation = ++this.generation;
    const engine = this.getEngine();
    this.activeEngine = engine;

    // Pipeline: fetch the NEXT sentence's audio while this one plays, so
    // natural-voice answers flow without gaps between sentences.
    const next = this.sentences[this.index + 1];
    if (next) engine.prefetch?.(next, { rate: this.rate, lang: this.speechLang });

    engine.speak(
      this.sentences[this.index],
      { rate: this.rate, lang: this.speechLang },
      {
        onEnd: () => {
          if (generation !== this.generation) return;
          this.index += 1;
          this.speakCurrentSentence();
        },
        onError: (error) => {
          if (generation !== this.generation) return;
          console.error('NAVI: Speech error:', error);
          this.sentences = [];
          this.index = 0;
          this.setStatus('idle');
        },
      },
    );
  }

  private cancelCurrent(): void {
    this.generation += 1;
    this.activeEngine?.cancel();
  }

  private setStatus(status: PlaybackStatus): void {
    if (this.status === status) return;
    this.status = status;
    this.events.onStatusChange?.(status);
  }
}
