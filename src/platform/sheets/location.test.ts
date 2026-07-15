import { afterEach, describe, expect, it } from 'vitest';
import { getActiveSheetName, getSpreadsheetId } from './location';

describe('getSpreadsheetId', () => {
  it.each([
    [
      'https://docs.google.com/spreadsheets/d/1AbC-def_456/edit#gid=0',
      '1AbC-def_456',
    ],
    ['https://docs.google.com/spreadsheets/d/XYZ/edit?usp=sharing', 'XYZ'],
  ])('extracts the id from %s', (url, id) => {
    expect(getSpreadsheetId(url)).toBe(id);
  });

  it.each([
    ['https://example.com/'],
    ['https://docs.google.com/document/d/123/edit'],
    [''],
  ])('returns null for non-spreadsheet URL %j', (url) => {
    expect(getSpreadsheetId(url)).toBeNull();
  });
});

describe('getActiveSheetName', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('reads the active tab and strips the leading position number', () => {
    document.body.innerHTML =
      '<div class="docs-sheet-active-tab">2Budget 2026</div>';
    expect(getActiveSheetName()).toBe('Budget 2026');
  });

  it('keeps names that do not start with a digit intact', () => {
    document.body.innerHTML =
      '<div class="docs-sheet-active-tab">Revenue</div>';
    expect(getActiveSheetName()).toBe('Revenue');
  });

  it('falls back to Sheet1 when the tab element is missing', () => {
    expect(getActiveSheetName()).toBe('Sheet1');
  });

  it('trims surrounding whitespace', () => {
    document.body.innerHTML =
      '<div class="docs-sheet-active-tab">  3  Data  </div>';
    expect(getActiveSheetName()).toBe('Data');
  });
});
