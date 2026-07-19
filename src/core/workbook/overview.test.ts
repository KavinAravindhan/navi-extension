import { describe, expect, it } from 'vitest';
import { makeT } from '@/core/i18n/i18n';
import type { WorkbookTab } from './model';
import { buildSpokenOverview, spokenShortcut } from './overview';

function makeTab(overrides: Partial<WorkbookTab> = {}): WorkbookTab {
  return {
    sheetId: 1,
    title: 'Income',
    index: 0,
    rowCount: 200,
    columnCount: 8,
    charts: [],
    ...overrides,
  };
}

const tEn = makeT(() => 'en');

describe('buildSpokenOverview', () => {
  it('speaks tabs, current tab with heading, and stays short', () => {
    const overview = buildSpokenOverview(tEn, {
      tabs: [
        makeTab({ title: 'Income', index: 0 }),
        makeTab({ title: 'Charts', index: 1, sheetId: 2 }),
      ],
      activeTabTitle: 'Income',
      activeTabValues: [['Quarterly Revenue'], ['Product', 'Q1'], ['Apples', '10']],
    });

    expect(overview).toBe(
      'This workbook has 2 tabs: Income, Charts. ' +
        "You're on Income — a table called Quarterly Revenue with 3 rows.",
    );
  });

  it('uses singular wording for one tab and no heading', () => {
    const overview = buildSpokenOverview(tEn, {
      tabs: [makeTab({ title: 'Data' })],
      activeTabTitle: 'Data',
      activeTabValues: [
        ['a', 'b'],
        ['1', '2'],
      ],
    });

    expect(overview).toBe(
      "This workbook has one tab: Data. You're on Data, with 2 rows.",
    );
  });

  it('mentions charts when any tab has them', () => {
    const overview = buildSpokenOverview(tEn, {
      tabs: [
        makeTab(),
        makeTab({
          title: 'Charts',
          index: 1,
          charts: [
            { chartId: 1, title: 'Revenue', chartType: 'LINE' },
            { chartId: 2, title: 'Costs', chartType: 'COLUMN' },
          ],
        }),
      ],
      activeTabTitle: 'Income',
      activeTabValues: [['x']],
    });

    expect(overview).toContain('It also has 2 charts.');
  });

  it('is fully translated for Indonesian', () => {
    const overview = buildSpokenOverview(makeT(() => 'id'), {
      tabs: [makeTab({ title: 'Data' })],
      activeTabTitle: 'Data',
      activeTabValues: [['x']],
    });

    expect(overview).toContain('Workbook ini punya satu tab: Data.');
    expect(overview).toContain('Anda berada di Data');
  });
});

describe('spokenShortcut', () => {
  it.each([
    ['Alt+N', 'Alt and N'],
    ['⌥N', 'Option and N'],
    ['⌥⇧N', 'Option and Shift and N'],
    ['MacCtrl+Shift+K', 'Control and Shift and K'],
    ['Ctrl+Shift+Y', 'Ctrl and Shift and Y'],
    ['', null],
    ['   ', null],
    [null, null],
    [undefined, null],
  ])('%j → %j', (input, expected) => {
    expect(spokenShortcut(input)).toBe(expected);
  });
});
