import { beforeEach, describe, expect, it, vi } from 'vitest';
import { installChromeMock } from '@/test/chrome';
import { fetchJsonWithAuth } from './googleAuth';

const chromeMock = installChromeMock();
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

const ok = (body: unknown) => ({
  status: 200,
  json: () => Promise.resolve(body),
});
const unauthorized = () => ({
  status: 401,
  json: () => Promise.resolve({ error: { code: 401, message: 'Invalid credentials' } }),
});

describe('fetchJsonWithAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    chromeMock.runtime.lastError = undefined;
    chromeMock.identity.getAuthToken.mockImplementation(
      (_opts: unknown, cb: (token?: string) => void) => cb('tok-1'),
    );
  });

  it('sends the OAuth token and returns the parsed JSON', async () => {
    mockFetch.mockResolvedValue(ok({ hello: 'world' }));

    const data = await fetchJsonWithAuth('https://api.test/x');

    expect(data).toEqual({ hello: 'world' });
    expect(mockFetch).toHaveBeenCalledOnce();
    expect(mockFetch.mock.calls[0][1].headers.Authorization).toBe('Bearer tok-1');
  });

  it('merges the auth header into existing request options', async () => {
    mockFetch.mockResolvedValue(ok({}));

    await fetchJsonWithAuth('https://api.test/x', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{"a":1}',
    });

    const [, init] = mockFetch.mock.calls[0];
    expect(init.method).toBe('POST');
    expect(init.body).toBe('{"a":1}');
    expect(init.headers).toEqual({
      'Content-Type': 'application/json',
      Authorization: 'Bearer tok-1',
    });
  });

  it('recovers from a stale cached token: drop it, refresh, retry once', async () => {
    // The mid-session bug: Chrome kept serving an expired token and NAVI
    // said "I can't read this spreadsheet" on a file the user owns.
    const tokens = ['stale-tok', 'fresh-tok'];
    chromeMock.identity.getAuthToken.mockImplementation(
      (_opts: unknown, cb: (token?: string) => void) => cb(tokens.shift()),
    );
    mockFetch
      .mockResolvedValueOnce(unauthorized())
      .mockResolvedValueOnce(ok({ values: [['42']] }));

    const data = await fetchJsonWithAuth('https://api.test/x');

    expect(data).toEqual({ values: [['42']] });
    expect(chromeMock.identity.removeCachedAuthToken).toHaveBeenCalledWith(
      { token: 'stale-tok' },
      expect.any(Function),
    );
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(mockFetch.mock.calls[1][1].headers.Authorization).toBe('Bearer fresh-tok');
  });

  it('retries only once — a second 401 surfaces as the API error', async () => {
    mockFetch.mockResolvedValue(unauthorized());

    const data = await fetchJsonWithAuth('https://api.test/x');

    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(data.error.code).toBe(401);
  });

  it('does NOT retry a real permission error (403 stays a 403)', async () => {
    mockFetch.mockResolvedValue({
      status: 403,
      json: () => Promise.resolve({ error: { code: 403, message: 'No access' } }),
    });

    const data = await fetchJsonWithAuth('https://api.test/x');

    expect(mockFetch).toHaveBeenCalledOnce();
    expect(chromeMock.identity.removeCachedAuthToken).not.toHaveBeenCalled();
    expect(data.error.code).toBe(403);
  });

  it('propagates sign-in failures from getAuthToken', async () => {
    chromeMock.identity.getAuthToken.mockImplementation(
      (_opts: unknown, cb: (token?: string) => void) => {
        chromeMock.runtime.lastError = { message: 'user not signed in' };
        cb(undefined);
        chromeMock.runtime.lastError = undefined;
      },
    );

    await expect(fetchJsonWithAuth('https://api.test/x')).rejects.toThrow(
      'user not signed in',
    );
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
