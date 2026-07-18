import { vi } from 'vitest';

/**
 * Minimal SpeechSynthesisUtterance double — records the properties the
 * player sets and exposes the event handlers so tests can drive playback.
 */
export class FakeUtterance {
  text: string;
  lang = '';
  rate = 1;
  pitch = 1;
  volume = 1;
  voice: { name: string } | null = null;
  onstart: (() => void) | null = null;
  onend: (() => void) | null = null;
  onerror: ((event: { error: string }) => void) | null = null;

  constructor(text: string) {
    this.text = text;
  }
}

/**
 * speechSynthesis double. Tests advance playback manually via
 * finishCurrent()/errorCurrent() — mirroring how Chrome fires utterance
 * events one at a time.
 */
export class FakeSpeechSynthesis {
  utterances: FakeUtterance[] = [];
  speaking = false;
  paused = false;
  onvoiceschanged: (() => void) | null = null;
  private voices: Array<{ name: string; lang: string; default: boolean }> = [];

  speak = vi.fn((utterance: FakeUtterance) => {
    this.utterances.push(utterance);
    this.speaking = true;
  });

  cancel = vi.fn(() => {
    this.speaking = false;
  });

  resume = vi.fn();

  getVoices = vi.fn(() => this.voices);

  setVoices(voices: Array<{ name: string; lang: string; default: boolean }>): void {
    this.voices = voices;
  }

  /** The most recently queued utterance. */
  get current(): FakeUtterance | undefined {
    return this.utterances[this.utterances.length - 1];
  }

  /** Simulates the current utterance finishing naturally. */
  finishCurrent(): void {
    const utterance = this.current;
    this.speaking = false;
    utterance?.onend?.();
  }

  /** Simulates a speech error on the current utterance. */
  errorCurrent(code: string): void {
    this.current?.onerror?.({ error: code });
  }
}

/** Installs the fakes as globals; returns the synthesis double. */
export function installFakeSpeech(): FakeSpeechSynthesis {
  const synth = new FakeSpeechSynthesis();
  vi.stubGlobal('speechSynthesis', synth);
  vi.stubGlobal('SpeechSynthesisUtterance', FakeUtterance);
  return synth;
}
