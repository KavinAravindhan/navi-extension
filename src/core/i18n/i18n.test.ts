import { describe, expect, it } from 'vitest';
import { STRINGS, type StringKey } from './strings';
import { LLM_LANGUAGE_NAME, SPEECH_LANG, makeT, type Language } from './i18n';

describe('makeT', () => {
  it('returns English strings for en', () => {
    const t = makeT(() => 'en');
    expect(t('greeting')).toBe("Hi, I'm NAVI.");
  });

  it('returns Indonesian strings for id', () => {
    const t = makeT(() => 'id');
    expect(t('greeting')).toBe('Halo, saya NAVI.');
  });

  it('follows the live language getter', () => {
    let lang: Language = 'en';
    const t = makeT(() => lang);
    expect(t('quitFarewell')).toBe('Closing NAVI. See you next time.');
    lang = 'id';
    expect(t('quitFarewell')).toBe('Menutup NAVI. Sampai jumpa lagi.');
  });

  it('interpolates parameters', () => {
    const t = makeT(() => 'en');
    expect(t('speedAnnounce', { rate: 1.25 })).toBe('Speed 1.25');
    expect(t('srModeOnWithCell', { cell: 'B3' })).toBe(
      'Screen reader mode on. Active cell B3.',
    );
  });

  it('leaves unknown placeholders visible instead of crashing', () => {
    const t = makeT(() => 'en');
    expect(t('speedAnnounce')).toBe('Speed {rate}');
  });
});

describe('string tables', () => {
  it('Indonesian covers every English key', () => {
    const enKeys = Object.keys(STRINGS.en) as StringKey[];
    for (const key of enKeys) {
      expect(STRINGS.id[key], `missing id translation for "${key}"`).toBeTruthy();
    }
  });

  it('speech + LLM language maps cover every language', () => {
    for (const lang of Object.keys(STRINGS) as Language[]) {
      expect(SPEECH_LANG[lang]).toBeTruthy();
      expect(LLM_LANGUAGE_NAME[lang]).toBeTruthy();
    }
  });
});
