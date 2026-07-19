import { afterEach, describe, expect, it } from 'vitest';
import { navigateToCell, navigateToTab } from './navigate';

describe('sheet navigation via URL hash', () => {
  afterEach(() => {
    history.replaceState(null, '', '/');
  });

  it('switch tab sets the gid the Sheets UI follows', () => {
    navigateToTab(123456);
    expect(window.location.hash).toBe('#gid=123456');
  });

  it('go to cell sets gid and range', () => {
    navigateToCell(42, 'B15');
    expect(window.location.hash).toBe('#gid=42&range=B15');
  });

  it('encodes ranges safely', () => {
    navigateToCell(1, 'A1:C3');
    expect(window.location.hash).toBe('#gid=1&range=A1%3AC3');
  });
});
