import { describe, expect, it } from 'vitest';
import { columnNumberToLetter } from './a1';

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
