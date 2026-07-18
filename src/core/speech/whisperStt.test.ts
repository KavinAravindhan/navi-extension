import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { VoiceRecognitionOptions } from './stt';
import { WhisperRecognition } from './whisperStt';

class FakeMediaRecorder {
  static instances: FakeMediaRecorder[] = [];
  mimeType = 'audio/webm';
  ondataavailable: ((event: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  start = vi.fn();
  stop = vi.fn(() => {
    this.ondataavailable?.({ data: new Blob(['voice'], { type: 'audio/webm' }) });
    this.onstop?.();
  });

  constructor(public stream: unknown) {
    FakeMediaRecorder.instances.push(this);
  }
}

const mockFetch = vi.fn();
const trackStop = vi.fn();
const getUserMedia = vi.fn(async () => ({
  getTracks: () => [{ stop: trackStop }],
}));

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

function makeOptions() {
  return {
    onResult: vi.fn(),
    onStateChange: vi.fn(),
    onBeforeStart: vi.fn(),
    onPermissionDenied: vi.fn(),
    onTranscriptionError: vi.fn(),
  } satisfies VoiceRecognitionOptions;
}

describe('WhisperRecognition', () => {
  let options: ReturnType<typeof makeOptions>;
  let whisper: WhisperRecognition;

  beforeEach(() => {
    FakeMediaRecorder.instances = [];
    vi.clearAllMocks();
    vi.stubGlobal('fetch', mockFetch);
    vi.stubGlobal('MediaRecorder', FakeMediaRecorder);
    vi.stubGlobal('navigator', {
      ...navigator,
      mediaDevices: { getUserMedia },
    });
    options = makeOptions();
    whisper = new WhisperRecognition('test-key', options);
    whisper.setLanguage('id-ID');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('records with echo cancellation and transcribes on stop', async () => {
    mockFetch.mockResolvedValue({
      json: () => Promise.resolve({ text: ' berapa total pendapatan ' }),
    });

    whisper.toggle(); // start
    await flush();

    expect(options.onBeforeStart).toHaveBeenCalledOnce();
    expect(getUserMedia).toHaveBeenCalledWith({
      audio: { echoCancellation: true, noiseSuppression: true },
    });
    expect(whisper.isListening).toBe(true);
    expect(options.onStateChange).toHaveBeenCalledWith(true);

    whisper.toggle(); // stop → transcribe
    await flush();

    expect(whisper.isListening).toBe(false);
    expect(trackStop).toHaveBeenCalled(); // mic released

    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe('https://api.openai.com/v1/audio/transcriptions');
    expect(init.headers.Authorization).toBe('Bearer test-key');
    const form = init.body as FormData;
    expect(form.get('model')).toBe('whisper-1');
    expect(form.get('language')).toBe('id');
    expect(form.get('file')).toBeInstanceOf(Blob);

    expect(options.onResult).toHaveBeenCalledWith('berapa total pendapatan');
  });

  it('announces permission denial through onPermissionDenied (NAVI-011)', async () => {
    const denied = new Error('Permission denied');
    denied.name = 'NotAllowedError';
    getUserMedia.mockRejectedValueOnce(denied);

    whisper.toggle();
    await flush();

    expect(options.onPermissionDenied).toHaveBeenCalledOnce();
    expect(whisper.isListening).toBe(false);
  });

  it('reports transcription failures instead of failing silently', async () => {
    mockFetch.mockResolvedValue({
      json: () => Promise.resolve({ error: { message: 'file too small' } }),
    });

    whisper.toggle();
    await flush();
    whisper.toggle();
    await flush();

    expect(options.onTranscriptionError).toHaveBeenCalledOnce();
    expect(options.onResult).not.toHaveBeenCalled();
  });

  it('ignores empty transcripts', async () => {
    mockFetch.mockResolvedValue({ json: () => Promise.resolve({ text: '   ' }) });

    whisper.toggle();
    await flush();
    whisper.toggle();
    await flush();

    expect(options.onResult).not.toHaveBeenCalled();
    expect(options.onTranscriptionError).not.toHaveBeenCalled();
  });

  it('init() reports support honestly', () => {
    expect(whisper.init()).toBe(true);
    vi.stubGlobal('navigator', { ...navigator, mediaDevices: undefined });
    expect(whisper.init()).toBe(false);
  });
});
