import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { OutputMode } from '@/core/settings/settings';
import { Announcer, createLiveRegion } from './announcer';

describe('Announcer', () => {
  let mode: OutputMode;
  let speak: ReturnType<typeof vi.fn<(text: string) => void>>;
  let region: HTMLElement;
  let announcer: Announcer;

  beforeEach(() => {
    document.body.innerHTML = '';
    mode = 'voice';
    speak = vi.fn<(text: string) => void>();
    region = createLiveRegion(document);
    announcer = new Announcer({ speak }, () => mode, region);
  });

  it('speaks through the player in voice mode', () => {
    announcer.say('Hello there.');
    expect(speak).toHaveBeenCalledWith('Hello there.');
    expect(region.textContent).toBe('');
  });

  it('stays silent and writes to the live region in screen-reader mode', () => {
    mode = 'screenreader';
    announcer.say('Menu opened.');

    expect(speak).not.toHaveBeenCalled();
    expect(region.lastChild?.textContent).toBe('Menu opened.');
  });

  it('appends a fresh child per announcement so repeats re-announce', () => {
    mode = 'screenreader';
    announcer.say('Speed 1.25');
    announcer.say('Speed 1.25');
    expect(region.childNodes).toHaveLength(2);
  });

  it('prunes old announcements', () => {
    mode = 'screenreader';
    for (let i = 0; i < 10; i++) announcer.say(`msg ${i}`);
    expect(region.childNodes.length).toBeLessThanOrEqual(4);
    expect(region.lastChild?.textContent).toBe('msg 9');
  });
});

describe('createLiveRegion', () => {
  it('creates a polite, visually hidden region attached to the body', () => {
    document.body.innerHTML = '';
    const region = createLiveRegion(document);

    expect(region.id).toBe('navi-live');
    expect(region.getAttribute('aria-live')).toBe('polite');
    expect(region.className).toBe('navi-visually-hidden');
    expect(region.parentElement).toBe(document.body);
  });
});
