import { describe, expect, it } from 'vitest';
import { detectSurface, getDocumentIdFromUrl } from './surface';

describe('detectSurface', () => {
  it.each([
    ['https://docs.google.com/spreadsheets/d/ABC/edit#gid=0', 'sheets'],
    ['https://docs.google.com/document/d/DEF/edit', 'docs'],
    ['https://docs.google.com/presentation/d/GHI/edit#slide=1', 'slides'],
    ['https://example.com/', null],
  ])('%s → %s', (url, surface) => {
    expect(detectSurface(url)).toBe(surface);
  });
});

describe('getDocumentIdFromUrl', () => {
  it.each([
    ['https://docs.google.com/document/d/1AbC-def_456/edit', '1AbC-def_456'],
    ['https://docs.google.com/presentation/d/XYZ/edit#slide=2', 'XYZ'],
    ['https://docs.google.com/spreadsheets/d/S1/edit', null],
  ])('%s → %j', (url, id) => {
    expect(getDocumentIdFromUrl(url)).toBe(id);
  });
});
