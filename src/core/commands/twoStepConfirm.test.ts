import { describe, expect, it } from 'vitest';
import { TwoStepConfirm } from './twoStepConfirm';

describe('TwoStepConfirm', () => {
  it('prompts on the first press and confirms on a second press inside the window', () => {
    const confirm = new TwoStepConfirm(10000);
    expect(confirm.press(1000)).toBe('prompt');
    expect(confirm.press(5000)).toBe('confirmed');
  });

  it('re-prompts when the second press arrives after the window', () => {
    const confirm = new TwoStepConfirm(10000);
    expect(confirm.press(1000)).toBe('prompt');
    expect(confirm.press(12000)).toBe('prompt');
    expect(confirm.press(13000)).toBe('confirmed');
  });

  it('starts over after a confirmation', () => {
    const confirm = new TwoStepConfirm(10000);
    confirm.press(1000);
    expect(confirm.press(2000)).toBe('confirmed');
    expect(confirm.press(3000)).toBe('prompt');
  });

  it('reset() disarms a pending confirmation', () => {
    const confirm = new TwoStepConfirm(10000);
    confirm.press(1000);
    confirm.reset();
    expect(confirm.press(2000)).toBe('prompt');
  });
});
