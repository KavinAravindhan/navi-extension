import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ShiftTapDetector,
  attachSpeechShortcuts,
  type SpeechShortcutTarget,
} from './speechShortcuts';

describe('ShiftTapDetector', () => {
  let taps: string[];
  let detector: ShiftTapDetector;

  const shiftDown = (init: KeyboardEventInit = {}) =>
    new KeyboardEvent('keydown', { key: 'Shift', ...init });
  const shiftUp = () => new KeyboardEvent('keyup', { key: 'Shift' });

  beforeEach(() => {
    taps = [];
    detector = new ShiftTapDetector(
      () => taps.push('single'),
      () => taps.push('double'),
    );
  });

  it('fires a single tap for one clean Shift press', () => {
    detector.handleKeyDown(shiftDown());
    detector.handleKeyUp(shiftUp(), 1000);
    expect(taps).toEqual(['single']);
  });

  it('fires a double tap for two quick presses', () => {
    detector.handleKeyDown(shiftDown());
    detector.handleKeyUp(shiftUp(), 1000);
    detector.handleKeyDown(shiftDown());
    detector.handleKeyUp(shiftUp(), 1300);
    expect(taps).toEqual(['single', 'double']);
  });

  it('treats slow presses as two singles', () => {
    detector.handleKeyDown(shiftDown());
    detector.handleKeyUp(shiftUp(), 1000);
    detector.handleKeyDown(shiftDown());
    detector.handleKeyUp(shiftUp(), 1600);
    expect(taps).toEqual(['single', 'single']);
  });

  it('ignores Shift used in a typing chord (Shift+letter)', () => {
    detector.handleKeyDown(shiftDown());
    detector.handleKeyDown(
      new KeyboardEvent('keydown', { key: 'A', shiftKey: true }),
    );
    detector.handleKeyUp(shiftUp(), 1000);
    expect(taps).toEqual([]);
  });

  it('ignores Shift pressed together with other modifiers', () => {
    detector.handleKeyDown(shiftDown({ ctrlKey: true }));
    detector.handleKeyUp(shiftUp(), 1000);
    expect(taps).toEqual([]);
  });

  it('key-repeat events do not disturb a held Shift', () => {
    detector.handleKeyDown(shiftDown());
    detector.handleKeyDown(shiftDown({ repeat: true }));
    detector.handleKeyUp(shiftUp(), 1000);
    expect(taps).toEqual(['single']);
  });

  it('three quick taps: double fires once, then the count restarts', () => {
    detector.handleKeyDown(shiftDown());
    detector.handleKeyUp(shiftUp(), 1000);
    detector.handleKeyDown(shiftDown());
    detector.handleKeyUp(shiftUp(), 1200);
    detector.handleKeyDown(shiftDown());
    detector.handleKeyUp(shiftUp(), 1400);
    expect(taps).toEqual(['single', 'double', 'single']);
  });

  it('a duplicated keyup within 50ms counts as ONE tap (Sheets double-fire)', () => {
    // One physical tap whose keyup arrives twice, microseconds apart:
    detector.handleKeyDown(shiftDown());
    detector.handleKeyUp(shiftUp(), 1000);
    detector.handleKeyUp(shiftUp(), 1005); // synthetic duplicate
    expect(taps).toEqual(['single']); // NOT single+double

    // And a real second tap later still works:
    detector.handleKeyDown(shiftDown());
    detector.handleKeyUp(shiftUp(), 1300);
    expect(taps).toEqual(['single', 'double']);
  });

  it('duplicated keydown+keyup pairs also collapse into one tap', () => {
    detector.handleKeyDown(shiftDown());
    detector.handleKeyDown(shiftDown()); // duplicate down (not repeat-flagged)
    detector.handleKeyUp(shiftUp(), 2000);
    detector.handleKeyUp(shiftUp(), 2010);
    expect(taps).toEqual(['single']);
  });
});

describe('attachSpeechShortcuts', () => {
  let player: SpeechShortcutTarget & {
    togglePause: ReturnType<typeof vi.fn<() => void>>;
    stop: ReturnType<typeof vi.fn<() => void>>;
    setRate: ReturnType<typeof vi.fn<(rate: number) => void>>;
  };
  let detach: () => void;
  let onRateChange: ReturnType<typeof vi.fn<(rate: number) => void>>;
  let onOpenNavi: ReturnType<typeof vi.fn<() => void>>;
  let onQuitNavi: ReturnType<typeof vi.fn<() => void>>;
  let onOpenMenu: ReturnType<typeof vi.fn<() => void>>;

  beforeEach(() => {
    player = {
      togglePause: vi.fn<() => void>(),
      stop: vi.fn<() => void>(),
      getRate: () => 1.0,
      setRate: vi.fn<(rate: number) => void>(),
    };
    onRateChange = vi.fn<(rate: number) => void>();
    onOpenNavi = vi.fn<() => void>();
    onQuitNavi = vi.fn<() => void>();
    onOpenMenu = vi.fn<() => void>();
    // jsdom-dispatched events are never trusted, so tests opt out of the
    // trusted-only guard; the guard itself has its own test below.
    detach = attachSpeechShortcuts(document, player, {
      onRateChange,
      onOpenNavi,
      onQuitNavi,
      onOpenMenu,
      trustedOnly: false,
    });
  });

  afterEach(() => {
    detach();
  });

  const dispatch = (type: string, init: KeyboardEventInit) =>
    document.dispatchEvent(new KeyboardEvent(type, init));

  it('a bare Shift tap toggles pause', () => {
    dispatch('keydown', { key: 'Shift' });
    dispatch('keyup', { key: 'Shift' });
    expect(player.togglePause).toHaveBeenCalledOnce();
    expect(player.stop).not.toHaveBeenCalled();
  });

  it('a fast double Shift tap stops playback', () => {
    // Real human taps are spaced by ~200ms — inside the 400ms double-tap
    // window but outside the 50ms synthetic-duplicate filter.
    vi.useFakeTimers();
    try {
      dispatch('keydown', { key: 'Shift' });
      dispatch('keyup', { key: 'Shift' });
      vi.advanceTimersByTime(200);
      dispatch('keydown', { key: 'Shift' });
      dispatch('keyup', { key: 'Shift' });
      expect(player.stop).toHaveBeenCalledOnce();
    } finally {
      vi.useRealTimers();
    }
  });

  it('Alt+Period speeds up and persists the new rate', () => {
    dispatch('keydown', { key: '.', code: 'Period', altKey: true });
    expect(player.setRate).toHaveBeenCalledWith(1.25);
    expect(onRateChange).toHaveBeenCalledWith(1.25);
  });

  it('Alt+Comma slows down', () => {
    dispatch('keydown', { key: ',', code: 'Comma', altKey: true });
    expect(player.setRate).toHaveBeenCalledWith(0.75);
    expect(onRateChange).toHaveBeenCalledWith(0.75);
  });

  it('Period without Alt does nothing', () => {
    dispatch('keydown', { key: '.', code: 'Period' });
    expect(player.setRate).not.toHaveBeenCalled();
  });

  it('Alt+N asks to open NAVI', () => {
    const opened = onOpenNavi;
    dispatch('keydown', { key: 'n', code: 'KeyN', altKey: true });
    expect(opened).toHaveBeenCalledOnce();
  });

  it('N without Alt does not open NAVI', () => {
    dispatch('keydown', { key: 'n', code: 'KeyN' });
    expect(onOpenNavi).not.toHaveBeenCalled();
  });

  it('Alt+Q asks to quit NAVI', () => {
    dispatch('keydown', { key: 'q', code: 'KeyQ', altKey: true });
    expect(onQuitNavi).toHaveBeenCalledOnce();
  });

  it('Alt+M asks to open the menu', () => {
    dispatch('keydown', { key: 'm', code: 'KeyM', altKey: true });
    expect(onOpenMenu).toHaveBeenCalledOnce();
  });

  it('Q and M without Alt do nothing', () => {
    dispatch('keydown', { key: 'q', code: 'KeyQ' });
    dispatch('keydown', { key: 'm', code: 'KeyM' });
    expect(onQuitNavi).not.toHaveBeenCalled();
    expect(onOpenMenu).not.toHaveBeenCalled();
  });

  it('detach removes the listeners', () => {
    detach();
    dispatch('keydown', { key: 'Shift' });
    dispatch('keyup', { key: 'Shift' });
    expect(player.togglePause).not.toHaveBeenCalled();
    detach = () => {};
  });

  it('by default ignores synthetic (untrusted) events — Sheets re-dispatches copies', () => {
    detach();
    detach = attachSpeechShortcuts(document, player, { onOpenNavi });

    // Everything jsdom dispatches has isTrusted=false, so with the default
    // trustedOnly guard none of these may trigger anything.
    dispatch('keydown', { key: 'Shift' });
    dispatch('keyup', { key: 'Shift' });
    dispatch('keydown', { key: 'n', code: 'KeyN', altKey: true });

    expect(player.togglePause).not.toHaveBeenCalled();
    expect(player.stop).not.toHaveBeenCalled();
    expect(onOpenNavi).not.toHaveBeenCalled();
  });
});
