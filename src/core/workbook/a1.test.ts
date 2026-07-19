import { describe, expect, it } from 'vitest';
import { columnNumberToLetter, letterToColumnNumber, parseA1Range } from './a1';

describe('columnNumberToLetter', () => {
  it.each([
    [1, 'A'],
    [2, 'B'],
    [26, 'Z'],
    [27, 'AA'],
    [28, 'AB'],
    [52, 'AZ'],
    [53, 'BA'],
    [702, 'ZZ'],
    [703, 'AAA'],
  ])('maps column %i to %s', (num, letters) => {
    expect(columnNumberToLetter(num)).toBe(letters);
  });

  it('returns an empty string for 0 (columns are 1-based)', () => {
    expect(columnNumberToLetter(0)).toBe('');
  });
});

describe('letterToColumnNumber', () => {
  it.each([
    ['A', 1],
    ['Z', 26],
    ['AA', 27],
    ['az', 52],
    ['AAA', 703],
  ])('maps %s to %i', (letters, num) => {
    expect(letterToColumnNumber(letters)).toBe(num);
  });
});

describe('parseA1Range', () => {
  it.each([
    [
      'A1:B10',
      { startRowIndex: 0, endRowIndex: 10, startColumnIndex: 0, endColumnIndex: 2 },
    ],
    [
      'B3',
      { startRowIndex: 2, endRowIndex: 3, startColumnIndex: 1, endColumnIndex: 2 },
    ],
    [
      '$C$2:$D$5',
      { startRowIndex: 1, endRowIndex: 5, startColumnIndex: 2, endColumnIndex: 4 },
    ],
    [
      ' a1:c3 ',
      { startRowIndex: 0, endRowIndex: 3, startColumnIndex: 0, endColumnIndex: 3 },
    ],
  ])('parses %j', (input, expected) => {
    expect(parseA1Range(input)).toEqual(expected);
  });

  it.each([['nonsense'], ['B10:A1'], ['A0'], ['1:5'], ['']])(
    'rejects %j',
    (input) => {
      expect(parseA1Range(input)).toBeNull();
    },
  );
});
