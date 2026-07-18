import { describe, expect, it } from 'vitest';
import { splitIntoSentences } from './sentences';

describe('splitIntoSentences', () => {
  it.each([
    ['One. Two! Three?', ['One.', 'Two!', 'Three?']],
    ['Hello world', ['Hello world']],
    ['', []],
    ['   ', []],
    // Decimals and amounts must not split mid-number.
    [
      'Revenue grew 5.5 percent. Costs fell.',
      ['Revenue grew 5.5 percent.', 'Costs fell.'],
    ],
    ['The total is $5,000.25 this year.', ['The total is $5,000.25 this year.']],
    // List markers introduce the sentence that follows them.
    [
      'Summary first. 1. Revenue is up. 2. Costs are down.',
      ['Summary first.', '1. Revenue is up.', '2. Costs are down.'],
    ],
    // A lone trailing marker still comes out.
    ['1.', ['1.']],
  ])('splits %j into %j', (input, expected) => {
    expect(splitIntoSentences(input)).toEqual(expected);
  });

  it('handles the cleaned form of a typical GPT list answer', () => {
    // cleanTextForSpeech turns newlines into ". " before splitting happens.
    const cleaned =
      'This sheet tracks a budget.. 1. Revenue is in column B. 2. Costs are in column C';
    expect(splitIntoSentences(cleaned)).toEqual([
      'This sheet tracks a budget..',
      '1. Revenue is in column B.',
      '2. Costs are in column C',
    ]);
  });
});
