import { STRINGS, type Language, type StringKey } from './strings';

export type { Language, StringKey };

export type Translate = (
  key: StringKey,
  params?: Record<string, string | number>,
) => string;

/** BCP-47 speech tags per NAVI language (TTS utterances + STT). */
export const SPEECH_LANG: Record<Language, string> = {
  en: 'en-US',
  id: 'id-ID',
};

/** Language names as the LLM should be instructed. */
export const LLM_LANGUAGE_NAME: Record<Language, string> = {
  en: 'English',
  id: 'Bahasa Indonesia',
};

function interpolate(
  template: string,
  params: Record<string, string | number> = {},
): string {
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match,
  );
}

/**
 * Builds a translate function bound to a live language getter, so strings
 * always follow the current setting. Unknown keys fall back to English.
 */
export function makeT(getLanguage: () => Language): Translate {
  return (key, params) => {
    const lang = getLanguage();
    const template = STRINGS[lang]?.[key] ?? STRINGS.en[key];
    return interpolate(template, params);
  };
}
