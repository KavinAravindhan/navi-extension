/** Wraps chrome.identity.getAuthToken in a promise; prompts sign-in if needed. */
export function getAuthToken(): Promise<string> {
  return new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive: true }, (token) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(token as string);
      }
    });
  });
}

/** Drops a token from Chrome's cache so the next getAuthToken mints a new one. */
function removeCachedToken(token: string): Promise<void> {
  return new Promise((resolve) => {
    try {
      chrome.identity.removeCachedAuthToken({ token }, () => {
        void chrome.runtime.lastError;
        resolve();
      });
    } catch {
      resolve();
    }
  });
}

/**
 * Authenticated JSON fetch with stale-token recovery. Chrome caches OAuth
 * tokens and keeps serving them after they expire (~1 hour), so mid-session
 * every Google API call suddenly starts returning 401 — and NAVI wrongly
 * told users "I can't read this spreadsheet" on files they own. A 401 here
 * just means "refresh": drop the cached token, mint a fresh one, and retry
 * the request once. Real permission problems (403) surface unchanged.
 */
export async function fetchJsonWithAuth(
  url: string,
  init: RequestInit = {},
): Promise<any> {
  const call = (token: string) =>
    fetch(url, {
      ...init,
      headers: { ...(init.headers ?? {}), Authorization: `Bearer ${token}` },
    });

  const token = await getAuthToken();
  let response = await call(token);
  if (response.status === 401) {
    await removeCachedToken(token);
    response = await call(await getAuthToken());
  }
  return response.json();
}
