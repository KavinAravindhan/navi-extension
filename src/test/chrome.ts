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
    },
  };
  vi.stubGlobal('chrome', chromeMock);
  return chromeMock;
}
