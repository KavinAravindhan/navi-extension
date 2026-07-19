/**
 * Cross-app memory (NAVI-019 phase 1): the last few things NAVI told the
 * user, shared across ALL Google tabs via chrome.storage.session. Ask about
 * revenue in Sheets, switch to Docs, and say "insert that revenue figure" —
 * the recall tool bridges the two conversations.
 */

export interface Finding {
  surface: string;
  documentTitle: string;
  text: string;
  at: number;
}

const KEY = 'navi-recent-findings';
const MAX_FINDINGS = 10;
const MAX_TEXT = 400;

export async function saveFinding(
  surface: string,
  documentTitle: string,
  text: string,
): Promise<void> {
  try {
    const trimmed = text.trim();
    if (!trimmed) return;
    const entry: Finding = {
      surface,
      documentTitle,
      text: trimmed.length > MAX_TEXT ? `${trimmed.slice(0, MAX_TEXT)}…` : trimmed,
      at: Date.now(),
    };
    const existing = await loadFindings();
    const updated = [...existing, entry].slice(-MAX_FINDINGS);
    await new Promise<void>((resolve) => {
      chrome.storage.session.set({ [KEY]: updated }, () => {
        void chrome.runtime.lastError;
        resolve();
      });
    });
  } catch {
    // memory is best-effort; never break the conversation over it
  }
}

export function loadFindings(): Promise<Finding[]> {
  return new Promise((resolve) => {
    try {
      chrome.storage.session.get({ [KEY]: [] }, (items) => {
        if (chrome.runtime.lastError) {
          resolve([]);
          return;
        }
        resolve((items[KEY] as Finding[]) ?? []);
      });
    } catch {
      resolve([]);
    }
  });
}

/** Text block the recall tool hands to the LLM. */
export function formatFindings(findings: Finding[]): string {
  if (findings.length === 0) {
    return 'No recent findings from other tabs in this browser session.';
  }
  return findings
    .map(
      (finding) =>
        `From ${finding.surface} "${finding.documentTitle}": ${finding.text}`,
    )
    .join('\n');
}
