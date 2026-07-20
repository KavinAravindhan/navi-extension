import { describe, expect, it } from 'vitest';
import { makeT } from '@/core/i18n/i18n';
import { buildHelpScript } from './help';

describe('buildHelpScript', () => {
  it('covers voice, summon, controls, menu, extras, and quit', () => {
    const script = buildHelpScript(makeT(() => 'en'), {
      shortcutSpoken: 'Option and N',
    });

    expect(script).toContain('Just talk to me');
    expect(script).toContain('say Hey NAVI');
    expect(script).toContain('press Option and N');
    expect(script).toContain('tap the Shift key once'); // shared tour line
    expect(script).toContain('Alt and press period'); // shared tour line
    expect(script).toContain('say open menu');
    expect(script).toContain('Alt and M');
    expect(script).toContain('Alt and C');
    expect(script).toContain('Alt and Q');
    expect(script).toContain('Alt and H');
  });

  it('omits the keyboard line when Chrome failed to bind the shortcut', () => {
    const script = buildHelpScript(makeT(() => 'en'), { shortcutSpoken: null });

    expect(script).not.toContain('{shortcut}');
    expect(script).not.toContain('open me with the keyboard');
    expect(script).toContain('say Hey NAVI'); // the wake word always works
  });

  it('is fully translated for Indonesian', () => {
    const script = buildHelpScript(makeT(() => 'id'), {
      shortcutSpoken: 'Option dan N',
    });

    expect(script).toContain('bicara');
    expect(script).not.toContain('Just talk to me');
  });

  it('is multi-sentence so pause/resume works sentence by sentence', () => {
    const script = buildHelpScript(makeT(() => 'en'));
    expect(script.split('\n').length).toBeGreaterThanOrEqual(7);
  });
});
