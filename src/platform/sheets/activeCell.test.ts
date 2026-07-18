import { afterEach, describe, expect, it } from 'vitest';
import { getActiveCellA1 } from './activeCell';

describe('getActiveCellA1', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('reads the reference from the Sheets name box', () => {
    document.body.innerHTML = '<input id="t-name-box" value="B3" />';
    expect(getActiveCellA1()).toBe('B3');
  });

  it('trims whitespace', () => {
    document.body.innerHTML = '<input id="t-name-box" value="  AB12  " />';
    expect(getActiveCellA1()).toBe('AB12');
  });

  it('returns null when the name box is missing or empty', () => {
    expect(getActiveCellA1()).toBeNull();

    document.body.innerHTML = '<input id="t-name-box" value="" />';
    expect(getActiveCellA1()).toBeNull();
  });
});
