import { beforeEach, describe, expect, it } from 'vitest';
import { installChromeMock } from '@/test/chrome';
import { formatFindings, loadFindings, saveFinding } from './recentFindings';

const chromeMock = installChromeMock();

describe('recent findings (cross-app memory)', () => {
  beforeEach(() => {
    (chromeMock.storage.session as { __reset: () => void }).__reset();
  });

  it('saves and recalls findings across surfaces', async () => {
    await saveFinding('Google Sheets', 'Budget 2026', 'Total revenue is $4.9M.');
    await saveFinding('Google Docs', 'Memo', 'Draft introduction added.');

    const findings = await loadFindings();
    expect(findings).toHaveLength(2);
    expect(formatFindings(findings)).toBe(
      'From Google Sheets "Budget 2026": Total revenue is $4.9M.\n' +
        'From Google Docs "Memo": Draft introduction added.',
    );
  });

  it('keeps only the most recent entries', async () => {
    for (let i = 1; i <= 14; i++) {
      await saveFinding('Google Sheets', 'S', `finding ${i}`);
    }
    const findings = await loadFindings();
    expect(findings).toHaveLength(10);
    expect(findings[0].text).toBe('finding 5');
    expect(findings[9].text).toBe('finding 14');
  });

  it('truncates very long answers', async () => {
    await saveFinding('Google Sheets', 'S', 'x'.repeat(1000));
    const [finding] = await loadFindings();
    expect(finding.text.length).toBeLessThanOrEqual(401);
    expect(finding.text.endsWith('…')).toBe(true);
  });

  it('ignores empty text and never throws without storage', async () => {
    await saveFinding('Google Sheets', 'S', '   ');
    expect(await loadFindings()).toHaveLength(0);
    expect(formatFindings([])).toContain('No recent findings');
  });
});
