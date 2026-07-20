import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { VoiceRecognition } from './stt';

class FakeRecognition {
  static instances: FakeRecognition[] = [];
  /** Simulates Chrome's "engine busy" throw for the next N start() calls. */
  static failStarts = 0;
  lang = '';
  interimResults = true;
  maxAlternatives = 0;
  onresult: ((event: unknown) => void) | null = null;
  onend: (() => void) | null = null;
  onerror: ((event: { error: string }) => void) | null = null;
  start = vi.fn(() => {
    if (FakeRecognition.failStarts > 0) {
      FakeRecognition.failStarts--;
      throw new Error('recognition engine busy');
    }
  });
  stop = vi.fn();

  constructor() {
    FakeRecognition.instances.push(this);
  }

  fireTranscript(transcript: string): void {
    this.onresult?.({ results: [[{ transcript }]] });
  }
}

describe('VoiceRecognition', () => {
  let onResult: ReturnType<typeof vi.fn<(t: string) => void>>;
  let onStateChange: ReturnType<typeof vi.fn<(l: boolean) => void>>;
  let onBeforeStart: ReturnType<typeof vi.fn<() => void>>;
  let onPermissionDenied: ReturnType<typeof vi.fn<() => void>>;
  let onStartFailed: ReturnType<typeof vi.fn<() => void>>;
  let stt: VoiceRecognition;

  const rec = () => FakeRecognition.instances[0];

  beforeEach(() => {
    FakeRecognition.instances = [];
    FakeRecognition.failStarts = 0;
    onResult = vi.fn<(t: string) => void>();
    onStateChange = vi.fn<(l: boolean) => void>();
    onBeforeStart = vi.fn<() => void>();
    onPermissionDenied = vi.fn<() => void>();
    onStartFailed = vi.fn<() => void>();
    vi.stubGlobal('SpeechRecognition', FakeRecognition);
    stt = new VoiceRecognition({
      onResult,
      onStateChange,
      onBeforeStart,
      onPermissionDenied,
      onStartFailed,
    });
    stt.setLanguage('en-US');
    stt.init();
  });

  afterEach(() => {
    stt.stop();
    vi.unstubAllGlobals();
  });

  it('toggle opens the mic and silences everything else first', () => {
    stt.toggle();

    expect(stt.isListening).toBe(true);
    expect(onStateChange).toHaveBeenLastCalledWith(true);
    expect(onBeforeStart.mock.invocationCallOrder[0]).toBeLessThan(
      rec().start.mock.invocationCallOrder[0],
    );
  });

  it('delivers transcripts to onResult', () => {
    stt.toggle();
    rec().fireTranscript('read row five');
    expect(onResult).toHaveBeenCalledWith('read row five');
  });

  it('toggle while listening stops the recognition', () => {
    stt.toggle();
    stt.toggle();

    expect(stt.isListening).toBe(false);
    expect(rec().stop).toHaveBeenCalled();
    expect(onStateChange).toHaveBeenLastCalledWith(false);
  });

  it('goes quiet when Chrome ends the session (silence timeout)', () => {
    stt.toggle();
    rec().onend?.();
    expect(stt.isListening).toBe(false);
  });

  it('reports blocked microphones via onPermissionDenied', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    stt.toggle();
    rec().onerror?.({ error: 'not-allowed' });
    expect(onPermissionDenied).toHaveBeenCalledOnce();
    expect(stt.isListening).toBe(false);
    error.mockRestore();
  });

  it('retries when the engine is busy instead of dying (awake-but-deaf bug)', () => {
    vi.useFakeTimers();
    try {
      FakeRecognition.failStarts = 2; // wake loop still releasing the engine

      stt.toggle();
      expect(stt.isListening).toBe(false);

      vi.advanceTimersByTime(250);
      expect(stt.isListening).toBe(false);

      vi.advanceTimersByTime(250);
      expect(stt.isListening).toBe(true);
      // Every attempt re-silenced the wake loop so it could not steal back.
      expect(onBeforeStart).toHaveBeenCalledTimes(3);
    } finally {
      vi.useRealTimers();
    }
  });

  it('stop() cancels a pending retry', () => {
    vi.useFakeTimers();
    try {
      FakeRecognition.failStarts = 5;
      stt.toggle();
      stt.stop();

      vi.advanceTimersByTime(5000);

      expect(stt.isListening).toBe(false);
      expect(rec().start).toHaveBeenCalledOnce();
    } finally {
      vi.useRealTimers();
    }
  });

  it('a second open request during a retry does not double the attempts', () => {
    vi.useFakeTimers();
    try {
      FakeRecognition.failStarts = 1;
      stt.toggle();
      stt.toggle(); // e.g. mic button pressed while the retry is pending

      vi.advanceTimersByTime(250);

      expect(stt.isListening).toBe(true);
      expect(rec().start).toHaveBeenCalledTimes(2); // initial + one retry
    } finally {
      vi.useRealTimers();
    }
  });

  it('gives up audibly after repeated failures instead of hot-looping', () => {
    vi.useFakeTimers();
    try {
      FakeRecognition.failStarts = 999;
      stt.toggle();
      vi.advanceTimersByTime(60000);

      expect(stt.isListening).toBe(false);
      expect(onStartFailed).toHaveBeenCalledOnce();
      expect(rec().start.mock.calls.length).toBeLessThanOrEqual(9);
    } finally {
      vi.useRealTimers();
    }
  });

  it('can listen again after a failed run (attempts reset)', () => {
    vi.useFakeTimers();
    try {
      FakeRecognition.failStarts = 999;
      stt.toggle();
      vi.advanceTimersByTime(60000);
      expect(onStartFailed).toHaveBeenCalledOnce();

      FakeRecognition.failStarts = 0;
      stt.toggle();
      expect(stt.isListening).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it('toggle warns and does nothing before init()', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const fresh = new VoiceRecognition({ onResult });
    fresh.toggle();
    expect(warn).toHaveBeenCalled();
    expect(fresh.isListening).toBe(false);
    warn.mockRestore();
  });
});
