import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WAKE_PATTERN, WakeWordListener } from './wakeWord';

class FakeRecognition {
  static instances: FakeRecognition[] = [];
  /** Simulates Chrome's "engine busy" throw for the next N start() calls. */
  static failStarts = 0;
  continuous = false;
  interimResults = false;
  lang = '';
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
    this.onresult?.({
      resultIndex: 0,
      results: [[{ transcript }]],
    });
  }
}

describe('WAKE_PATTERN', () => {
  it.each([
    ['hey navi', true],
    ['Hey, NAVI!', true],
    ['hei navi tolong', true],
    ['hai navi', true],
    ['okay so hey navi what is this', true],
    ['heavy navigation', false],
    ['navi', false],
    ['hey nabby', false],
  ])('%j → %s', (text, matches) => {
    expect(WAKE_PATTERN.test(text)).toBe(matches);
  });
});

describe('WakeWordListener', () => {
  let onWake: ReturnType<typeof vi.fn<() => void>>;
  let listener: WakeWordListener;

  beforeEach(() => {
    FakeRecognition.instances = [];
    FakeRecognition.failStarts = 0;
    onWake = vi.fn<() => void>();
    vi.stubGlobal('SpeechRecognition', FakeRecognition);
    listener = new WakeWordListener(onWake);
    listener.setLanguage('id-ID');
  });

  afterEach(() => {
    listener.stop();
    vi.unstubAllGlobals();
  });

  it('starts a continuous, interim recognition in the set language', () => {
    listener.start();

    const rec = FakeRecognition.instances[0];
    expect(rec.continuous).toBe(true);
    expect(rec.interimResults).toBe(true);
    expect(rec.lang).toBe('id-ID');
    expect(rec.start).toHaveBeenCalledOnce();
    expect(listener.isRunning).toBe(true);
  });

  it('fires onWake and stops itself when the phrase is heard', () => {
    listener.start();
    const rec = FakeRecognition.instances[0];

    rec.fireTranscript('uhm hey navi open please');

    expect(onWake).toHaveBeenCalledOnce();
    expect(listener.isRunning).toBe(false);
    expect(rec.stop).toHaveBeenCalled();
  });

  it('ignores non-matching speech', () => {
    listener.start();
    FakeRecognition.instances[0].fireTranscript('what a heavy navigation menu');
    expect(onWake).not.toHaveBeenCalled();
    expect(listener.isRunning).toBe(true);
  });

  it('restarts the loop when Chrome ends the recognition', () => {
    listener.start();
    const rec = FakeRecognition.instances[0];

    rec.onend?.();

    expect(rec.start).toHaveBeenCalledTimes(2); // initial + restart
    expect(listener.isRunning).toBe(true);
  });

  it('stop() prevents the auto-restart', () => {
    listener.start();
    const rec = FakeRecognition.instances[0];

    listener.stop();

    expect(rec.onend).toBeNull(); // restart hook removed
    expect(listener.isRunning).toBe(false);
  });

  it('shuts down permanently when the mic permission is denied', () => {
    listener.start();
    const rec = FakeRecognition.instances[0];

    rec.onerror?.({ error: 'not-allowed' });

    expect(listener.isRunning).toBe(false);
  });

  it('start() is a no-op while already running', () => {
    listener.start();
    listener.start();
    expect(FakeRecognition.instances).toHaveLength(1);
  });

  it('retries when the engine is busy (the dead-after-quit bug)', () => {
    vi.useFakeTimers();
    try {
      FakeRecognition.failStarts = 1; // mic still releasing the engine

      listener.start();
      expect(listener.isRunning).toBe(false); // first attempt threw

      vi.advanceTimersByTime(400); // retry fires

      expect(listener.isRunning).toBe(true);
      expect(FakeRecognition.instances).toHaveLength(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('stop() cancels a pending retry', () => {
    vi.useFakeTimers();
    try {
      FakeRecognition.failStarts = 1;
      listener.start();
      listener.stop();

      vi.advanceTimersByTime(2000);

      expect(listener.isRunning).toBe(false);
      expect(FakeRecognition.instances).toHaveLength(1); // no retry instance
    } finally {
      vi.useRealTimers();
    }
  });

  it('gives up after repeated failures instead of hot-looping forever', () => {
    vi.useFakeTimers();
    try {
      FakeRecognition.failStarts = 999;
      listener.start();
      vi.advanceTimersByTime(60000);

      expect(listener.isRunning).toBe(false);
      expect(FakeRecognition.instances.length).toBeLessThanOrEqual(11);
    } finally {
      vi.useRealTimers();
    }
  });

  it('isSupported() reflects the environment', () => {
    expect(listener.isSupported()).toBe(true);
    vi.unstubAllGlobals();
    expect(new WakeWordListener(onWake).isSupported()).toBe(false);
  });
});
