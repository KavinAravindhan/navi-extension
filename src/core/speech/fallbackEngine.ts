import type { SentenceEngine, SentenceEngineEvents } from './speechPlayer';

/**
 * Never-goes-mute decorator: speaks through the primary engine (the natural
 * OpenAI voice) and, if a sentence fails there (offline, quota, blocked),
 * re-speaks it through the fallback (the built-in system voice) instead of
 * surfacing an error. A blind user must always hear SOMETHING.
 */
export class FallbackSentenceEngine implements SentenceEngine {
  constructor(
    private readonly primary: SentenceEngine,
    private readonly fallback: SentenceEngine,
    private readonly onFallback?: (error: string) => void,
  ) {}

  speak(
    text: string,
    opts: { rate: number; lang: string },
    events: SentenceEngineEvents,
  ): void {
    this.primary.speak(text, opts, {
      onEnd: events.onEnd,
      onError: (error) => {
        this.onFallback?.(error);
        this.fallback.speak(text, opts, events);
      },
    });
  }

  cancel(): void {
    this.primary.cancel();
    this.fallback.cancel();
  }
}
