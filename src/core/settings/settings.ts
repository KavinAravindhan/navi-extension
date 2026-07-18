// User preferences persisted in chrome.storage.sync (falls back to defaults
// when storage is unavailable, e.g. in tests or if the permission is missing).

/** Speech-rate steps from the tracker spec (NAVI-006). */
export const SPEECH_RATE_STEPS = [0.75, 1.0, 1.25, 1.5, 2.0] as const;

/** Panel text sizes (NAVI-018) — lives in core so ui and settings agree. */
export type FontSize = 'small' | 'medium' | 'large' | 'xlarge';

export interface NaviSettings {
  /** SpeechSynthesis rate multiplier. */
  speechRate: number;
  /** Speak "Hi, I'm NAVI." when the panel opens (NAVI-008). */
  greetingEnabled: boolean;
  /** Chat text size; changed from the NAVI menu, persisted (NAVI-018). */
  fontSize: FontSize;
}

export const DEFAULT_SETTINGS: NaviSettings = {
  speechRate: 1.0,
  greetingEnabled: true,
  fontSize: 'medium',
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
