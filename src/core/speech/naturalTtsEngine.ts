import type { SentenceEngine, SentenceEngineEvents } from './speechPlayer';

const OPENAI_TTS_URL = 'https://api.openai.com/v1/audio/speech';

/**
 * Natural-sounding neural voice via OpenAI TTS (NAVI-017). Each sentence is
 * fetched as mp3 and played through an HTMLAudioElement; speed uses
 * playbackRate so the existing rate controls keep working. Speaks Indonesian
 * text natively — no per-language voice hunting needed.
 */
export class OpenAITTSEngine implements SentenceEngine {
  private audio: HTMLAudioElement | null = null;
  private objectUrl: string | null = null;
  /** Current playback rate — mutable mid-clip via setRate (speed keys). */
  private rate = 1;
  /** Identity token: any cancel()/new speak() invalidates in-flight work. */
  private token: object = {};
  /** Next-sentence audio fetched ahead of time (kills inter-sentence gaps). */
  private prefetchCache = new Map<string, Promise<Blob>>();

  constructor(
    private readonly apiKey: string,
    private readonly getVoice: () => string = () => 'nova',
  ) {}

  speak(
    text: string,
    opts: { rate: number; lang: string },
    events: SentenceEngineEvents,
  ): void {
    this.cancel();
    const token = {};
    this.token = token;
    this.rate = opts.rate;

    void (async () => {
      try {
        const key = this.cacheKey(text);
        const cached = this.prefetchCache.get(key);
        if (cached) this.prefetchCache.delete(key);

        const blob = await (cached ?? this.fetchAudio(text));
        if (this.token !== token) return; // cancelled while fetching

        const url = URL.createObjectURL(blob);
        this.objectUrl = url;
        const audio = new Audio(url);
        this.audio = audio;
        // this.rate, not opts.rate: the speed keys may have changed it while
        // the clip was still being fetched.
        audio.playbackRate = this.rate;

        audio.onended = () => {
          if (this.token !== token) return;
          this.cleanup();
          events.onEnd();
        };
        audio.onerror = () => {
          if (this.token !== token) return;
          this.cleanup();
          events.onError('natural voice playback failed');
        };

        await audio.play();
      } catch (error) {
        if (this.token !== token) return;
        this.cleanup();
        events.onError((error as Error).message);
      }
    })();
  }

  /** Live speed change: adjusts the playing clip in place — no restart. */
  setRate(rate: number): void {
    this.rate = rate;
    if (this.audio) this.audio.playbackRate = rate;
  }

  /** Kick off the audio fetch for an upcoming sentence. */
  prefetch(text: string, _opts: { rate: number; lang: string }): void {
    const key = this.cacheKey(text);
    if (this.prefetchCache.has(key)) return;
    const promise = this.fetchAudio(text);
    promise.catch(() => this.prefetchCache.delete(key)); // never cache failures
    this.prefetchCache.set(key, promise);
    if (this.prefetchCache.size > 4) {
      const oldest = this.prefetchCache.keys().next().value;
      if (oldest) this.prefetchCache.delete(oldest);
    }
  }

  private cacheKey(text: string): string {
    return `${this.getVoice()}::${text}`;
  }

  private async fetchAudio(text: string): Promise<Blob> {
    const response = await fetch(OPENAI_TTS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini-tts',
        voice: this.getVoice(),
        input: text,
        response_format: 'mp3',
      }),
    });
    if (!response.ok) {
      throw new Error(`natural voice request failed (${response.status})`);
    }
    return response.blob();
  }

  cancel(): void {
    this.token = {};
    if (this.audio) {
      this.audio.onended = null;
      this.audio.onerror = null;
      this.audio.pause();
    }
    this.cleanup();
  }

  private cleanup(): void {
    this.audio = null;
    if (this.objectUrl) {
      URL.revokeObjectURL(this.objectUrl);
      this.objectUrl = null;
    }
  }
}
