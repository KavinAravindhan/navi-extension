import { describe, expect, it, vi } from 'vitest';
import { FallbackSentenceEngine } from './fallbackEngine';
import type { SentenceEngine, SentenceEngineEvents } from './speechPlayer';

function makeEngine() {
  let lastEvents: SentenceEngineEvents | null = null;
  const speak = vi.fn<SentenceEngine['speak']>((_text, _opts, events) => {
    lastEvents = events;
  });
  const cancel = vi.fn<() => void>();
  return {
    speak,
    cancel,
    fireEnd: () => lastEvents?.onEnd(),
    fireError: (e: string) => lastEvents?.onError(e),
  };
}

const OPTS = { rate: 1, lang: 'en-US' };

describe('FallbackSentenceEngine', () => {
  it('uses the primary engine when it works', () => {
    const primary = makeEngine();
    const fallback = makeEngine();
    const onEnd = vi.fn();
    const engine = new FallbackSentenceEngine(primary, fallback);

    engine.speak('Hello.', OPTS, { onEnd, onError: vi.fn() });
    primary.fireEnd();

    expect(primary.speak).toHaveBeenCalledOnce();
    expect(fallback.speak).not.toHaveBeenCalled();
    expect(onEnd).toHaveBeenCalledOnce();
  });

  it('re-speaks the SAME sentence through the fallback when the primary fails', () => {
    const primary = makeEngine();
    const fallback = makeEngine();
    const onEnd = vi.fn();
    const onError = vi.fn();
    const onFallback = vi.fn();
    const engine = new FallbackSentenceEngine(primary, fallback, onFallback);

    engine.speak('Important message.', OPTS, { onEnd, onError });
    primary.fireError('quota exceeded');

    expect(onFallback).toHaveBeenCalledWith('quota exceeded');
    expect(fallback.speak).toHaveBeenCalledWith(
      'Important message.',
      OPTS,
      expect.anything(),
    );
    expect(onError).not.toHaveBeenCalled(); // user never hears a failure

    fallback.fireEnd();
    expect(onEnd).toHaveBeenCalledOnce(); // queue continues normally
  });

  it('surfaces an error only when BOTH engines fail', () => {
    const primary = makeEngine();
    const fallback = makeEngine();
    const onError = vi.fn();
    const engine = new FallbackSentenceEngine(primary, fallback);

    engine.speak('Hello.', OPTS, { onEnd: vi.fn(), onError });
    primary.fireError('offline');
    fallback.fireError('no voices');

    expect(onError).toHaveBeenCalledWith('no voices');
  });

  it('cancel() reaches both engines', () => {
    const primary = makeEngine();
    const fallback = makeEngine();
    const engine = new FallbackSentenceEngine(primary, fallback);

    engine.cancel();

    expect(primary.cancel).toHaveBeenCalledOnce();
    expect(fallback.cancel).toHaveBeenCalledOnce();
  });
});
