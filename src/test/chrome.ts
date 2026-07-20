import { vi } from 'vitest';

/**
 * Minimal chrome.* stub for unit tests — direct global assignment, same
 * pattern policy-editor uses for jsdom gaps. Install per test file and
 * configure the returned mocks as needed.
 */
export function installChromeMock() {
  const chromeMock = {
    runtime: {
      getURL: vi.fn((path: string) => `chrome-extension://test-id/${path}`),
      sendMessage: vi.fn(),
      lastError: undefined as { message: string } | undefined,
      onMessage: { addListener: vi.fn() },
    },
    identity: {
      getAuthToken: vi.fn(),
      removeCachedAuthToken: vi.fn(
        (_details: { token: string }, cb?: () => void) => cb?.(),
      ),
    },
    storage: {
      sync: {
        get: vi.fn(
          (defaults: Record<string, unknown>, cb: (items: Record<string, unknown>) => void) =>
            cb({ ...defaults }),
        ),
        set: vi.fn((_items: Record<string, unknown>, cb?: () => void) => cb?.()),
      },
      session: (() => {
        // A real tiny store — the cross-app memory tests need persistence.
        let data: Record<string, unknown> = {};
        return {
          get: vi.fn(
            (defaults: Record<string, unknown>, cb: (items: Record<string, unknown>) => void) =>
              cb({ ...defaults, ...data }),
          ),
          set: vi.fn((items: Record<string, unknown>, cb?: () => void) => {
            data = { ...data, ...items };
            cb?.();
          }),
          __reset: () => {
            data = {};
          },
        };
      })(),
    },
  };
  vi.stubGlobal('chrome', chromeMock);
  return chromeMock;
}
