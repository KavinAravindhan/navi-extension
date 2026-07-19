import { describe, expect, it } from 'vitest';
import { makeT } from '@/core/i18n/i18n';
import { buildTourScript } from './tour';

describe('buildTourScript', () => {
  it('teaches wake word first, then controls, with the REAL shortcut', () => {
    const script = buildTourScript(makeT(() => 'en'), {
      shortcutSpoken: 'Option and N',
    });

    expect(script).toContain("I'm NAVI");
    expect(script).toContain('Shift twice at any time to skip');
    expect(script).toContain('just say Hey NAVI');
    expect(script).toContain('tap the Shift key once');
    expect(script).toContain('Alt and press period');
    expect(script).toContain('press Option and N');
    expect(script).toContain('Alt and M');
    expect(script).toContain('Alt and Q');
    expect(script).toContain('replay this tour');
  });

  it('speaks setup guidance when Chrome failed to bind the shortcut', () => {
    const script = buildTourScript(makeT(() => 'en'), { shortcutSpoken: null });

    expect(script).toContain('keyboard shortcut is not set');
    expect(script).toContain('say Hey NAVI anytime');
    expect(script).not.toContain('{shortcut}');
  });

  it('is fully translated for Indonesian', () => {
    const script = buildTourScript(makeT(() => 'id'), {
      shortcutSpoken: 'Option dan N',
    });

    expect(script).toContain('Saya NAVI');
    expect(script).toContain('Hey NAVI');
    expect(script).not.toContain("I'm NAVI");
  });

  it('is multi-sentence so pause/resume works sentence by sentence', () => {
    const script = buildTourScript(makeT(() => 'en'));
    expect(script.split('\n').length).toBeGreaterThanOrEqual(5);
  });
});
