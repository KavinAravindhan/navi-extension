import { describe, expect, it } from 'vitest';
import { parseEditCommand } from './editCommand';

describe('parseEditCommand', () => {
  it.each([
    ['EDIT_CELL: B3 = 5000', 'B3', '5000'],
    ['EDIT_CELL: E10 = =C10+D10', 'E10', '=C10+D10'],
    // /i flag: the marker and cell letters match case-insensitively, and the
    // address is kept exactly as written (not upper-cased).
    ['edit_cell: b3 = 42', 'b3', '42'],
    ['Sure thing! EDIT_CELL: AB12 = Total', 'AB12', 'Total'],
    ['EDIT_CELL:C7=99', 'C7', '99'],
    ['EDIT_CELL: D4 =   hello world  ', 'D4', 'hello world'],
  ])('parses %j', (input, cellAddress, newValue) => {
    expect(parseEditCommand(input)).toEqual({ cellAddress, newValue });
  });

  it.each([
    ['plain answer with no command'],
    ['EDIT_CELL: 123 = 5'], // address must start with letters
    ['EDIT_CELL: B3 ='], // no value
    [''],
  ])('returns null for %j', (input) => {
    expect(parseEditCommand(input)).toBeNull();
  });

  it('captures only the first line of a multi-line value', () => {
    expect(parseEditCommand('EDIT_CELL: B3 = 5000\nAll done!')).toEqual({
      cellAddress: 'B3',
      newValue: '5000',
    });
  });
});
