import { describe, expect, it } from 'vitest';
import { makeT } from '@/core/i18n/i18n';
import { buildTourScript } from './tour';

describe('buildTourScript', () => {
  it('covers the NAVI-012 walkthrough contents in English', () => {
    const script = buildTourScript(makeT(() => 'en'));

    // greeting, skip hint, pause control, speed, core shortcuts, mic, replay
    expect(script).toContain("I'm NAVI");
    expect(script).toContain('Shift twice at any time to skip');
    expect(script).toContain('tap the Shift key once');
    expect(script).toContain('Alt and press period');
    expect(script).toContain('Alt and N');
    expect(script).toContain('Alt and M');
    expect(script).toContain('Alt and Q');
    expect(script).toContain('microphone button');
    expect(script).toContain('replay this tour');
  });

  it('is fully translated for Indonesian', () => {
    const script = buildTourScript(makeT(() => 'id'));

    expect(script).toContain('Saya NAVI');
    expect(script).toContain('Shift dua kali');
    expect(script).toContain('mikrofon');
    // No English sentences leaked through.
    expect(script).not.toContain("I'm NAVI");
  });

  it('is multi-sentence so pause/resume works sentence by sentence', () => {
    const script = buildTourScript(makeT(() => 'en'));
    expect(script.split('\n').length).toBeGreaterThanOrEqual(5);
  });
});
