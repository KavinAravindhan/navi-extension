// User preferences persisted in chrome.storage.sync (falls back to defaults
// when storage is unavailable, e.g. in tests or if the permission is missing).

/** Speech-rate steps from the tracker spec (NAVI-006). */
export const SPEECH_RATE_STEPS = [0.75, 1.0, 1.25, 1.5, 2.0] as const;

/** Panel text sizes (NAVI-018) — lives in core so ui and settings agree. */
export type FontSize = 'small' | 'medium' | 'large' | 'xlarge';

/**
 * How NAVI's responses reach the user (NAVI-002). Browsers cannot detect
 * screen readers, so this is an explicit user choice:
 * - 'voice': NAVI speaks with its own text-to-speech (default)
 * - 'screenreader': NAVI stays silent and announces through an aria-live
 *   region, so the user's own screen reader (NVDA/JAWS/VoiceOver) does the
 *   talking — no more two voices colliding.
 */
export type OutputMode = 'voice' | 'screenreader';

/** How much of the workbook feeds the AI context (NAVI-010). */
export type ContextScope = 'tab' | 'file';

/** UI + speech + response language (tracker P0: Bahasa Indonesia). */
export type { Language } from '@/core/i18n/strings';
import type { Language } from '@/core/i18n/strings';

export interface NaviSettings {
  /** SpeechSynthesis rate multiplier. */
  speechRate: number;
  /** Speak "Hi, I'm NAVI." when the panel opens (NAVI-008). */
  greetingEnabled: boolean;
  /** Chat text size; changed from the NAVI menu, persisted (NAVI-018). */
  fontSize: FontSize;
  /** Voice output vs screen-reader deferral (NAVI-002). */
  outputMode: OutputMode;
  /** Current tab only (default) vs entire workbook (NAVI-010). */
  contextScope: ContextScope;
  /** Language for UI strings, speech, voice input, and AI responses. */
  language: Language;
  /** TTS engine: fast built-in voice vs natural OpenAI voice (NAVI-017). */
  voiceEngine: VoiceEngine;
  /** Which OpenAI voice speaks in natural mode (nova = warm female). */
  naturalVoiceName: string;
  /** Voice input engine: built-in recognition vs Whisper (better for id). */
  sttEngine: SttEngine;
  /** First-run audio walkthrough already played (NAVI-012). */
  onboardingDone: boolean;
  /** "Hey NAVI" wake word — on by default (voice-first design). */
  wakeWordEnabled: boolean;
  /** Typing box hidden by default; menu switch shows it (braille users). */
  typingVisible: boolean;
}

/** 'system' = built-in speechSynthesis; 'natural' = OpenAI neural TTS. */
export type VoiceEngine = 'system' | 'natural';

/** 'browser' = Web Speech recognition; 'whisper' = OpenAI Whisper. */
export type SttEngine = 'browser' | 'whisper';

export const DEFAULT_SETTINGS: NaviSettings = {
  speechRate: 1.0,
  greetingEnabled: true,
  fontSize: 'medium',
  outputMode: 'voice',
  contextScope: 'tab',
  language: 'en',
  voiceEngine: 'natural',
  naturalVoiceName: 'nova',
  sttEngine: 'browser',
  onboardingDone: false,
  wakeWordEnabled: true,
  typingVisible: false,
};

export function loadSettings(): Promise<NaviSettings> {
  return new Promise((resolve) => {
    try {
      chrome.storage.sync.get({ ...DEFAULT_SETTINGS }, (items) => {
        if (chrome.runtime.lastError) {
          resolve({ ...DEFAULT_SETTINGS });
          return;
        }
        resolve({ ...DEFAULT_SETTINGS, ...items } as NaviSettings);
      });
    } catch {
      resolve({ ...DEFAULT_SETTINGS });
    }
  });
}

export function saveSettings(patch: Partial<NaviSettings>): Promise<void> {
  return new Promise((resolve) => {
    try {
      chrome.storage.sync.set(patch, () => {
        // Read lastError so Chrome does not log an unchecked-error warning.
        void chrome.runtime.lastError;
        resolve();
      });
    } catch {
      resolve();
    }
  });
}

/**
 * Returns the next rate step up (+1) or down (-1) from the current rate.
 * A rate between steps (e.g. legacy 0.95) snaps to the nearest step first.
 * Clamps at both ends.
 */
export function nextRate(current: number, direction: 1 | -1): number {
  let closest = 0;
  let smallestDiff = Number.POSITIVE_INFINITY;
  SPEECH_RATE_STEPS.forEach((step, i) => {
    const diff = Math.abs(step - current);
    if (diff < smallestDiff) {
      smallestDiff = diff;
      closest = i;
    }
  });
  const next = Math.min(
    Math.max(closest + direction, 0),
    SPEECH_RATE_STEPS.length - 1,
  );
  return SPEECH_RATE_STEPS[next];
}
