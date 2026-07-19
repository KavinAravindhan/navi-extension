import { describe, expect, it } from 'vitest';
import { findImageCells, summarizeFormatting } from './formatting';

describe('summarizeFormatting', () => {
  it('reports bold, italic, highlighted cells and merges', () => {
    const summary = summarizeFormatting({
      sheetTitle: 'Budget',
      startRowIndex: 0,
      startColumnIndex: 0,
      rows: [
        [
          { formattedValue: 'Title', bold: true, backgroundHex: '#ffff00' },
          { formattedValue: 'Note', italic: true, backgroundHex: '#ffffff' },
        ],
        [{ formattedValue: 'x', backgroundHex: null }],
      ],
      mergeCount: 2,
    });

    expect(summary).toContain('Bold cells: A1.');
    expect(summary).toContain('Italic cells: B1.');
    expect(summary).toContain('Highlighted cells: A1 (#ffff00).');
    expect(summary).toContain('2 merged cell ranges.');
  });

  it('respects the range offset when naming cells', () => {
    const summary = summarizeFormatting({
      sheetTitle: 'S',
      startRowIndex: 4, // range started at row 5
      startColumnIndex: 2, // column C
      rows: [[{ formattedValue: 'x', bold: true }]],
      mergeCount: 0,
    });
    expect(summary).toContain('Bold cells: C5.');
  });

  it('says so when nothing special was found', () => {
    const summary = summarizeFormatting({
      sheetTitle: 'Plain',
      startRowIndex: 0,
      startColumnIndex: 0,
      rows: [[{ formattedValue: 'a' }]],
      mergeCount: 0,
    });
    expect(summary).toBe('No special formatting detected on Plain in that range.');
  });

  it('caps long lists and says how many more there are', () => {
    const row = Array.from({ length: 40 }, () => ({
      formattedValue: 'x',
      bold: true,
    }));
    const summary = summarizeFormatting({
      sheetTitle: 'S',
      startRowIndex: 0,
      startColumnIndex: 0,
      rows: [row],
      mergeCount: 0,
    });
    expect(summary).toContain('and 10 more');
  });
});

describe('findImageCells', () => {
  it('finds IMAGE and SPARKLINE formulas, case-insensitively', () => {
    expect(
      findImageCells([
        ['=IMAGE("http://x/logo.png")', 'plain'],
        ['500', '=sparkline(A1:A5)'],
        ['=SUM(A1:A2)', null],
      ]),
    ).toEqual(['A1', 'B2']);
  });

  it('returns empty for sheets without embedded visuals', () => {
    expect(findImageCells([['a', '=SUM(A1:B1)']])).toEqual([]);
  });
});
