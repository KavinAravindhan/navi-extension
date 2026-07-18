import { beforeEach, describe, expect, it, vi } from 'vitest';
import { installChromeMock } from '@/test/chrome';
import {
  DEFAULT_SETTINGS,
  loadSettings,
  nextRate,
  saveSettings,
} from './settings';

const chromeMock = installChromeMock();

describe('loadSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    chromeMock.runtime.lastError = undefined;
    vi.stubGlobal('chrome', chromeMock);
  });

  it('returns defaults when nothing is stored', async () => {
    chromeMock.storage.sync.get.mockImplementation(
      (defaults: Record<string, unknown>, cb: (items: Record<string, unknown>) => void) =>
        cb({ ...defaults }),
    );
    expect(await loadSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it('returns stored values merged over defaults', async () => {
    chromeMock.storage.sync.get.mockImplementation(
      (defaults: Record<string, unknown>, cb: (items: Record<string, unknown>) => void) =>
        cb({ ...defaults, speechRate: 1.5, fontSize: 'xlarge' }),
    );
    expect(await loadSettings()).toEqual({
      ...DEFAULT_SETTINGS,
      speechRate: 1.5,
      fontSize: 'xlarge',
    });
  });

  it('defaults include a medium font size', () => {
    expect(DEFAULT_SETTINGS.fontSize).toBe('medium');
  });

  it('falls back to defaults when storage reports an error', async () => {
    chromeMock.runtime.lastError = { message: 'storage unavailable' };
    chromeMock.storage.sync.get.mockImplementation(
      (_defaults: Record<string, unknown>, cb: (items: Record<string, unknown>) => void) => cb({}),
    );
    expect(await loadSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it('falls back to defaults when chrome.storage is missing entirely', async () => {
    vi.stubGlobal('chrome', undefined);
    expect(await loadSettings()).toEqual(DEFAULT_SETTINGS);
  });
});

describe('saveSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('chrome', chromeMock);
  });

  it('persists the patch to chrome.storage.sync', async () => {
    await saveSettings({ speechRate: 1.25 });
    expect(chromeMock.storage.sync.set).toHaveBeenCalledWith(
      { speechRate: 1.25 },
      expect.any(Function),
    );
  });

  it('resolves even when chrome.storage is missing', async () => {
    vi.stubGlobal('chrome', undefined);
    await expect(saveSettings({ speechRate: 2 })).resolves.toBeUndefined();
  });
});

describe('nextRate', () => {
  it.each([
    [1.0, 1, 1.25],
    [1.0, -1, 0.75],
    [1.25, 1, 1.5],
    [2.0, 1, 2.0], // clamped at the top
    [0.75, -1, 0.75], // clamped at the bottom
    [0.95, 1, 1.25], // legacy v1 rate snaps to 1.0 first
    [0.95, -1, 0.75],
    [1.6, 1, 2.0], // between steps snaps to nearest (1.5) then moves
    [5, -1, 1.5], // absurd value snaps to 2.0 then steps down
  ])('nextRate(%d, %d) → %d', (current, direction, expected) => {
    expect(nextRate(current, direction as 1 | -1)).toBe(expected);
  });
});
