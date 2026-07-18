import { describe, expect, it } from 'vitest';
import {
  buildWorkbookContext,
  describeLayout,
  detectHeading,
  formatRows,
  quoteSheetTitle,
  type WorkbookTab,
} from './model';

function makeTab(overrides: Partial<WorkbookTab> = {}): WorkbookTab {
  return {
    sheetId: 1,
    title: 'Budget',
    index: 0,
    rowCount: 50,
    columnCount: 4,
    charts: [],
    ...overrides,
  };
}

describe('formatRows', () => {
  it('renders the sheet header and one line per row', () => {
    expect(formatRows('Budget', [['Name', 'Qty'], ['Apples', '4']])).toBe(
      'Sheet: Budget\n\nRow 1: Name | Qty\nRow 2: Apples | 4\n',
    );
  });

  // Skipped rows still count toward maxCols → trailing " | " (v1 quirk kept).
  it('skips empty rows but keeps the original row numbers', () => {
    expect(formatRows('S', [['a'], ['', ''], ['b']])).toBe(
      'Sheet: S\n\nRow 1: a | \nRow 3: b | \n',
    );
  });

  it('pads every row to the widest row', () => {
    expect(formatRows('S', [['a'], ['b', 'c', 'd']])).toBe(
      'Sheet: S\n\nRow 1: a |  | \nRow 2: b | c | d\n',
    );
  });

  it('renders numeric 0 cells as empty strings (v1 quirk)', () => {
    expect(formatRows('S', [[0, 'x']])).toBe('Sheet: S\n\nRow 1:  | x\n');
  });
});

describe('detectHeading', () => {
  it('detects a single-cell banner row as the table heading', () => {
    expect(
      detectHeading([
        ['Quarterly Revenue Report', '', ''],
        ['Product', 'Q1', 'Q2'],
        ['Apples', 100, 120],
      ]),
    ).toBe('Quarterly Revenue Report');
  });

  it('skips fully empty rows before the banner', () => {
    expect(detectHeading([[], ['', ''], ['Sales 2026']])).toBe('Sales 2026');
  });

  it('returns null when the first content row is a normal header row', () => {
    expect(
      detectHeading([
        ['Product', 'Q1', 'Q2'],
        ['Apples', 100, 120],
      ]),
    ).toBeNull();
  });

  it('returns null for an empty sheet', () => {
    expect(detectHeading([])).toBeNull();
  });
});

describe('describeLayout', () => {
  it('announces tab count, sizes, and charts (NAVI-007)', () => {
    const tabs: WorkbookTab[] = [
      makeTab({ title: 'Income', index: 0, rowCount: 120, columnCount: 8 }),
      makeTab({
        title: 'Charts',
        index: 1,
        rowCount: 20,
        columnCount: 3,
        charts: [{ chartId: 7, title: 'Revenue over time', chartType: 'LINE' }],
      }),
    ];

    expect(describeLayout('Newmont Model', tabs)).toBe(
      'Workbook "Newmont Model" has 2 tabs. ' +
        'Tab 1: "Income" (120 rows, columns A to H). ' +
        'Tab 2: "Charts" (20 rows, columns A to C) containing 1 chart: "Revenue over time" (line chart).',
    );
  });

  it('uses singular wording for one tab', () => {
    expect(describeLayout('Solo', [makeTab({ columnCount: 2 })])).toBe(
      'Workbook "Solo" has 1 tab. Tab 1: "Budget" (50 rows, columns A to B).',
    );
  });

  it('orders tabs by their index, not array order', () => {
    const tabs = [
      makeTab({ title: 'Second', index: 1 }),
      makeTab({ title: 'First', index: 0 }),
    ];
    expect(describeLayout('W', tabs)).toContain('Tab 1: "First"');
    expect(describeLayout('W', tabs)).toContain('Tab 2: "Second"');
  });
});

describe('quoteSheetTitle', () => {
  it.each([
    ['Budget', "'Budget'"],
    ['My Sheet', "'My Sheet'"],
    ["Bob's Data", "'Bob''s Data'"],
  ])('quotes %j as %j', (title, quoted) => {
    expect(quoteSheetTitle(title)).toBe(quoted);
  });
});

describe('buildWorkbookContext', () => {
  const tabs: WorkbookTab[] = [
    makeTab({ title: 'Data', index: 0, columnCount: 2 }),
    makeTab({ title: 'Notes', index: 1, columnCount: 1 }),
  ];

  it('tab scope: layout covers all tabs but data covers only the active one', () => {
    const context = buildWorkbookContext({
      workbookTitle: 'Book',
      tabs,
      activeTabTitle: 'Data',
      scope: 'tab',
      sections: [{ title: 'Data', values: [['Sales Report'], ['a', 'b']] }],
    });

    expect(context).toContain('has 2 tabs');
    expect(context).toContain('currently on tab "Data"');
    expect(context).toContain('only the current tab');
    expect(context).toContain('=== Tab: Data ===');
    expect(context).toContain('Table heading: Sales Report');
    expect(context).not.toContain('=== Tab: Notes ===');
  });

  it('file scope: includes every section and says so', () => {
    const context = buildWorkbookContext({
      workbookTitle: 'Book',
      tabs,
      activeTabTitle: 'Data',
      scope: 'file',
      sections: [
        { title: 'Data', values: [['x', 'y']] },
        { title: 'Notes', values: [['note one']] },
      ],
    });

    expect(context).toContain('ENTIRE workbook');
    expect(context).toContain('=== Tab: Data ===');
    expect(context).toContain('=== Tab: Notes ===');
  });

  it('caps rows per tab and says how many were left out', () => {
    const values = Array.from({ length: 5 }, (_, i) => [`row ${i + 1}`]);
    const context = buildWorkbookContext({
      workbookTitle: 'Big',
      tabs: [tabs[0]],
      activeTabTitle: 'Data',
      scope: 'tab',
      sections: [{ title: 'Data', values }],
      maxRowsPerTab: 2,
    });

    expect(context).toContain('Row 2: row 2');
    expect(context).not.toContain('row 3');
    expect(context).toContain('3 more rows not shown');
  });

  it('says explicitly when no heading was detected (NAVI-014)', () => {
    const context = buildWorkbookContext({
      workbookTitle: 'Book',
      tabs: [tabs[0]],
      activeTabTitle: 'Data',
      scope: 'tab',
      sections: [{ title: 'Data', values: [['a', 'b'], ['1', '2']] }],
    });
    expect(context).toContain('No table heading detected.');
  });
});
