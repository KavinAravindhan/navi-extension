import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OpenAITTSEngine } from './naturalTtsEngine';

class FakeAudio {
  static instances: FakeAudio[] = [];
  src: string;
  playbackRate = 1;
  onended: (() => void) | null = null;
  onerror: (() => void) | null = null;
  play = vi.fn(async () => {});
  pause = vi.fn();

  constructor(src: string) {
    this.src = src;
    FakeAudio.instances.push(this);
  }
}

const mockFetch = vi.fn();

function makeAudioResponse() {
  return {
    ok: true,
    blob: () => Promise.resolve(new Blob(['mp3-bytes'], { type: 'audio/mpeg' })),
  };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('OpenAITTSEngine', () => {
  let engine: OpenAITTSEngine;
  let onEnd: ReturnType<typeof vi.fn<() => void>>;
  let onError: ReturnType<typeof vi.fn<(e: string) => void>>;

  beforeEach(() => {
    FakeAudio.instances = [];
    vi.clearAllMocks();
    vi.stubGlobal('fetch', mockFetch);
    vi.stubGlobal('Audio', FakeAudio);
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: vi.fn(() => 'blob:fake-url'),
      revokeObjectURL: vi.fn(),
    });
    engine = new OpenAITTSEngine('test-key', () => 'alloy');
    onEnd = vi.fn<() => void>();
    onError = vi.fn<(e: string) => void>();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('fetches neural audio and plays it at the requested rate', async () => {
    mockFetch.mockResolvedValue(makeAudioResponse());

    engine.speak('Hello there.', { rate: 1.5, lang: 'en-US' }, { onEnd, onError });
    await flush();

    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe('https://api.openai.com/v1/audio/speech');
    expect(init.headers.Authorization).toBe('Bearer test-key');
    expect(JSON.parse(init.body)).toEqual({
      model: 'gpt-4o-mini-tts',
      voice: 'alloy',
      input: 'Hello there.',
      response_format: 'mp3',
    });

    const audio = FakeAudio.instances[0];
    expect(audio.src).toBe('blob:fake-url');
    expect(audio.playbackRate).toBe(1.5);
    expect(audio.play).toHaveBeenCalled();

    audio.onended?.();
    expect(onEnd).toHaveBeenCalledOnce();
  });

  it('reports HTTP failures through onError', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 401 });

    engine.speak('Hi.', { rate: 1, lang: 'en-US' }, { onEnd, onError });
    await flush();

    expect(onError).toHaveBeenCalledWith(
      expect.stringContaining('natural voice request failed (401)'),
    );
    expect(onEnd).not.toHaveBeenCalled();
  });

  it('a cancel during the fetch prevents playback and callbacks', async () => {
    mockFetch.mockResolvedValue(makeAudioResponse());

    engine.speak('Hi.', { rate: 1, lang: 'en-US' }, { onEnd, onError });
    engine.cancel(); // before the fetch resolves
    await flush();

    expect(FakeAudio.instances).toHaveLength(0); // never played
    expect(onEnd).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
  });

  it('cancel during playback pauses the audio and mutes its events', async () => {
    mockFetch.mockResolvedValue(makeAudioResponse());
    engine.speak('Hi.', { rate: 1, lang: 'en-US' }, { onEnd, onError });
    await flush();
    const audio = FakeAudio.instances[0];

    engine.cancel();

    expect(audio.pause).toHaveBeenCalled();
    expect(audio.onended).toBeNull();
    expect(onEnd).not.toHaveBeenCalled();
  });

  it('setRate adjusts the PLAYING clip live — no restart, no refetch', async () => {
    mockFetch.mockResolvedValue(makeAudioResponse());
    engine.speak('Hello.', { rate: 1.0, lang: 'en-US' }, { onEnd, onError });
    await flush();

    engine.setRate(2.0);

    expect(FakeAudio.instances[0].playbackRate).toBe(2.0);
    expect(mockFetch).toHaveBeenCalledOnce(); // same clip keeps playing
  });

  it('a rate set while the clip is still fetching applies at playback', async () => {
    mockFetch.mockResolvedValue(makeAudioResponse());
    engine.speak('Hello.', { rate: 1.0, lang: 'en-US' }, { onEnd, onError });

    engine.setRate(1.75); // speed key pressed before the fetch resolves
    await flush();

    expect(FakeAudio.instances[0].playbackRate).toBe(1.75);
  });

  it('prefetch caches the audio so speak() needs no second fetch', async () => {
    mockFetch.mockResolvedValue(makeAudioResponse());

    engine.prefetch('Hello there.', { rate: 1, lang: 'en-US' });
    await flush();
    expect(mockFetch).toHaveBeenCalledTimes(1);

    engine.speak('Hello there.', { rate: 1, lang: 'en-US' }, { onEnd, onError });
    await flush();

    expect(mockFetch).toHaveBeenCalledTimes(1); // reused the prefetched audio
    expect(FakeAudio.instances).toHaveLength(1);
    expect(FakeAudio.instances[0].play).toHaveBeenCalled();
  });

  it('a failed prefetch is not cached — speak retries the fetch', async () => {
    mockFetch.mockRejectedValueOnce(new Error('offline'));
    engine.prefetch('Hi.', { rate: 1, lang: 'en-US' });
    await flush();

    mockFetch.mockResolvedValue(makeAudioResponse());
    engine.speak('Hi.', { rate: 1, lang: 'en-US' }, { onEnd, onError });
    await flush();

    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(onError).not.toHaveBeenCalled();
    expect(FakeAudio.instances).toHaveLength(1);
  });

  it('network failures surface as onError', async () => {
    mockFetch.mockRejectedValue(new Error('offline'));

    engine.speak('Hi.', { rate: 1, lang: 'en-US' }, { onEnd, onError });
    await flush();

    expect(onError).toHaveBeenCalledWith('offline');
  });
});
