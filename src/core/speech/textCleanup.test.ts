import { describe, expect, it } from 'vitest';
import { cleanTextForSpeech } from './textCleanup';

describe('cleanTextForSpeech', () => {
  it.each([
    ['**Base Case** is best', 'Base Case is best'],
    ['*emphasis* here', 'emphasis here'],
    ['### Header\nBody', 'Header. Body'],
    ['use `SUM(A1:A5)` here', 'use SUM(A1:A5) here'],
    ['line one\n\n\nline two', 'line one. line two'],
    ['  padded  ', 'padded'],
  ])('cleans %j to %j', (input, expected) => {
    expect(cleanTextForSpeech(input)).toBe(expected);
  });

  it('cleans a realistic GPT answer so no markdown is spoken aloud', () => {
    const answer =
      'This sheet tracks a budget.\n\n1. **Revenue** is in column B\n\n2. **Costs** are in column C';
    expect(cleanTextForSpeech(answer)).toBe(
      'This sheet tracks a budget.. 1. Revenue is in column B. 2. Costs are in column C',
    );
  });
});
