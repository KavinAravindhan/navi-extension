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
  /** Identity token: any cancel()/new speak() invalidates in-flight work. */
  private token: object = {};

  constructor(
    private readonly apiKey: string,
    private readonly voice = 'alloy',
  ) {}

  speak(
    text: string,
    opts: { rate: number; lang: string },
    events: SentenceEngineEvents,
  ): void {
    this.cancel();
    const token = {};
    this.token = token;

    void (async () => {
      try {
        const response = await fetch(OPENAI_TTS_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini-tts',
            voice: this.voice,
            input: text,
            response_format: 'mp3',
          }),
        });

        if (!response.ok) {
          throw new Error(`natural voice request failed (${response.status})`);
        }

        const blob = await response.blob();
        if (this.token !== token) return; // cancelled while fetching

        const url = URL.createObjectURL(blob);
        this.objectUrl = url;
        const audio = new Audio(url);
        this.audio = audio;
        audio.playbackRate = opts.rate;

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
