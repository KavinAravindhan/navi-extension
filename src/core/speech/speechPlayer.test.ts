import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installFakeSpeech, type FakeSpeechSynthesis } from '@/test/speech';
import {
  SpeechPlayer,
  type PlaybackStatus,
  type SentenceEngineEvents,
} from './speechPlayer';

describe('SpeechPlayer', () => {
  let synth: FakeSpeechSynthesis;
  let statuses: PlaybackStatus[];
  let player: SpeechPlayer;

  beforeEach(() => {
    synth = installFakeSpeech();
    statuses = [];
    player = new SpeechPlayer(1.0, {
      onStatusChange: (status) => statuses.push(status),
    });
  });

  afterEach(() => {
    player.stop(); // clears the keep-alive interval
    vi.unstubAllGlobals();
  });

  const spokenTexts = () => synth.utterances.map((u) => u.text);

  it('splits text into sentences and speaks the first one', () => {
    player.speak('One. Two. Three.');

    expect(spokenTexts()).toEqual(['One.']);
    expect(synth.current?.rate).toBe(1.0);
    expect(synth.current?.lang).toBe('en-US');
    expect(player.playbackStatus).toBe('speaking');
  });

  it('advances sentence by sentence and goes idle at the end', () => {
    player.speak('One. Two. Three.');
    synth.finishCurrent();
    synth.finishCurrent();
    synth.finishCurrent();

    expect(spokenTexts()).toEqual(['One.', 'Two.', 'Three.']);
    expect(player.playbackStatus).toBe('idle');
    expect(statuses).toEqual(['speaking', 'idle']);
  });

  it('pause keeps the position and resume re-speaks the current sentence (NAVI-005)', () => {
    player.speak('One. Two. Three.');
    synth.finishCurrent(); // "One." done → "Two." starts

    player.pause();
    expect(player.playbackStatus).toBe('paused');
    expect(synth.cancel).toHaveBeenCalled();
    expect(spokenTexts()).toEqual(['One.', 'Two.']); // nothing new while paused

    player.resume();
    expect(spokenTexts()).toEqual(['One.', 'Two.', 'Two.']); // same sentence again

    synth.finishCurrent();
    expect(spokenTexts()).toEqual(['One.', 'Two.', 'Two.', 'Three.']);
  });

  it('ignores events from a cancelled utterance (identity guard)', () => {
    player.speak('One. Two.');
    const cancelled = synth.current!;

    player.pause();
    // Chrome fires onend for cancelled utterances — must not advance the queue.
    cancelled.onend?.();

    expect(player.playbackStatus).toBe('paused');
    expect(spokenTexts()).toEqual(['One.']);

    player.resume();
    expect(spokenTexts()).toEqual(['One.', 'One.']);
  });

  it('stop clears the queue entirely; resume() alone stays silent', () => {
    player.speak('One. Two. Three.');
    player.stop();

    expect(player.playbackStatus).toBe('idle');
    player.resume(); // resume is a paused-only operation
    expect(spokenTexts()).toEqual(['One.']); // nothing new was spoken
    expect(player.playbackStatus).toBe('idle');
  });

  it('togglePause alternates between pause and resume', () => {
    player.speak('One. Two.');
    player.togglePause();
    expect(player.playbackStatus).toBe('paused');
    player.togglePause();
    expect(player.playbackStatus).toBe('speaking');
  });

  it('setRate mid-sentence restarts the current sentence at the new rate', () => {
    player.speak('Alpha beta. Gamma.');
    expect(synth.current?.rate).toBe(1.0);

    player.setRate(1.5);

    expect(player.getRate()).toBe(1.5);
    expect(spokenTexts()).toEqual(['Alpha beta.', 'Alpha beta.']);
    expect(synth.current?.rate).toBe(1.5);
  });

  it('setRate while paused applies when resuming', () => {
    player.speak('Alpha. Beta.');
    player.pause();
    player.setRate(2.0);
    player.resume();

    expect(synth.current?.rate).toBe(2.0);
  });

  it('a new speak() replaces whatever was playing', () => {
    player.speak('Old text one. Old text two.');
    player.speak('New text.');

    expect(synth.current?.text).toBe('New text.');
    synth.finishCurrent();
    expect(player.playbackStatus).toBe('idle');
  });

  it('ignores interrupted/canceled errors but resets on real errors', () => {
    player.speak('One. Two.');

    synth.errorCurrent('interrupted');
    expect(player.playbackStatus).toBe('speaking');

    synth.errorCurrent('network');
    expect(player.playbackStatus).toBe('idle');
  });

  it('warns and stays idle for empty text', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    player.speak('   ');
    expect(player.playbackStatus).toBe('idle');
    expect(synth.utterances).toHaveLength(0);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('applies the preferred voice when available', () => {
    synth.setVoices([
      { name: 'Some Other Voice', lang: 'en-GB', default: true },
      { name: 'Google US English', lang: 'en-US', default: false },
    ]);
    player.speak('Hello.');
    expect(synth.current?.voice?.name).toBe('Google US English');
  });

  it('caches the voice from the voiceschanged warm-up so the FIRST utterance is voiced', () => {
    // Voices arrive late (Chrome behavior). The constructor registered a
    // voiceschanged listener; once it fires, even the first thing spoken —
    // the greeting — must use the preferred voice (bug from manual testing).
    synth.setVoices([
      { name: 'Google US English', lang: 'en-US', default: false },
    ]);
    synth.onvoiceschanged?.();

    player.speak("Hi, I'm NAVI.");

    expect(synth.current?.voice?.name).toBe('Google US English');
  });

  it('togglePause while idle replays the last message from the beginning', () => {
    player.speak('One. Two.');
    synth.finishCurrent();
    synth.finishCurrent();
    expect(player.playbackStatus).toBe('idle');

    player.togglePause();

    expect(player.playbackStatus).toBe('speaking');
    expect(synth.current?.text).toBe('One.');
  });

  it('replays after a hard stop too', () => {
    player.speak('One. Two. Three.');
    synth.finishCurrent(); // now on "Two."
    player.stop();

    player.togglePause();

    expect(spokenTexts()).toEqual(['One.', 'Two.', 'One.']); // starts over
  });

  it('does nothing on togglePause when nothing was ever spoken', () => {
    player.togglePause();
    expect(synth.utterances).toHaveLength(0);
    expect(player.playbackStatus).toBe('idle');
  });

  it('strips markdown before speaking', () => {
    player.speak('**Bold** and `code`.');
    expect(synth.current?.text).toBe('Bold and code.');
  });

  it('prefetches the NEXT sentence while the current one speaks', () => {
    const spoken: string[] = [];
    const prefetched: string[] = [];
    let engineEvents: SentenceEngineEvents | null = null;
    const engine = {
      speak: (text: string, _o: unknown, events: SentenceEngineEvents) => {
        spoken.push(text);
        engineEvents = events;
      },
      cancel: () => {},
      prefetch: (text: string) => prefetched.push(text),
    };
    const piped = new SpeechPlayer(1.0, {}, () => engine);

    piped.speak('One. Two. Three.');
    expect(spoken).toEqual(['One.']);
    expect(prefetched).toEqual(['Two.']); // fetched ahead, no gap later

    engineEvents!.onEnd();
    expect(spoken).toEqual(['One.', 'Two.']);
    expect(prefetched).toEqual(['Two.', 'Three.']);
  });

  it('setLanguage switches the utterance language and re-picks the voice', () => {
    synth.setVoices([
      { name: 'Google US English', lang: 'en-US', default: false },
      { name: 'Google Bahasa Indonesia', lang: 'id-ID', default: false },
    ]);

    player.speak('Hello.');
    expect(synth.current?.lang).toBe('en-US');
    expect(synth.current?.voice?.name).toBe('Google US English');

    player.setLanguage('id-ID');
    player.speak('Halo.');

    expect(synth.current?.lang).toBe('id-ID');
    expect(synth.current?.voice?.name).toBe('Google Bahasa Indonesia');
  });
});
