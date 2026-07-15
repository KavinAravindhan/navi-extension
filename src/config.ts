// Central runtime configuration.
// Values come from the gitignored .env file (see .env.example) and are baked
// into the extension bundle at build time by WXT/Vite.

export interface NaviConfig {
  openaiApiKey: string;
  googleSheetsApiKey: string;
}

export const naviConfig: NaviConfig = {
  openaiApiKey: import.meta.env.WXT_OPENAI_API_KEY ?? '',
  googleSheetsApiKey: import.meta.env.WXT_GOOGLE_SHEETS_API_KEY ?? '',
};

/**
 * Logs a console warning for every missing key and returns their names.
 * Lets the extension load (and fail with readable messages) instead of
 * crashing when .env was not set up.
 */
export function warnOnMissingConfig(config: NaviConfig = naviConfig): string[] {
  const missing: string[] = [];
  if (!config.openaiApiKey) missing.push('WXT_OPENAI_API_KEY');
  if (!config.googleSheetsApiKey) missing.push('WXT_GOOGLE_SHEETS_API_KEY');
  for (const name of missing) {
    console.warn(
      `NAVI: Missing ${name} — copy .env.example to .env, fill it in, and rebuild.`,
    );
  }
  return missing;
}
