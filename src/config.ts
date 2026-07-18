// Central runtime configuration.
// Values come from the gitignored .env file (see .env.example) and are baked
// into the extension bundle at build time by WXT/Vite.
//
// Note: since Step 4 all Google Sheets access (reads AND writes) goes through
// the user's Google sign-in (OAuth) — no Sheets API key is needed anymore.

export interface NaviConfig {
  openaiApiKey: string;
}

export const naviConfig: NaviConfig = {
  openaiApiKey: import.meta.env.WXT_OPENAI_API_KEY ?? '',
};

/**
 * Logs a console warning for every missing key and returns their names.
 * Lets the extension load (and fail with readable messages) instead of
 * crashing when .env was not set up.
 */
export function warnOnMissingConfig(config: NaviConfig = naviConfig): string[] {
  const missing: string[] = [];
  if (!config.openaiApiKey) missing.push('WXT_OPENAI_API_KEY');
  for (const name of missing) {
    console.warn(
      `NAVI: Missing ${name} — copy .env.example to .env, fill it in, and rebuild.`,
    );
  }
  return missing;
}
