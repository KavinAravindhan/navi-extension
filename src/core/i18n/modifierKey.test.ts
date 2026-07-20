import { describe, expect, it } from 'vitest';
import { modifierKeyWord } from './modifierKey';

describe('modifierKeyWord', () => {
  it.each([
    ['MacIntel', 'Option'],
    ['MacPPC', 'Option'],
    ['Win32', 'Alt'],
    ['Linux x86_64', 'Alt'],
    ['', 'Alt'],
  ] as const)('%j → %s', (platform, word) => {
    expect(modifierKeyWord(platform)).toBe(word);
  });
});
