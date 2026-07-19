/** Which Google editor NAVI is living in on this page. */
export type Surface = 'sheets' | 'docs' | 'slides';

export function detectSurface(url: string): Surface | null {
  if (url.includes('docs.google.com/spreadsheets/')) return 'sheets';
  if (url.includes('docs.google.com/document/')) return 'docs';
  if (url.includes('docs.google.com/presentation/')) return 'slides';
  return null;
}

/** Human name used in the system prompt and error messages. */
export const SURFACE_LABEL: Record<Surface, string> = {
  sheets: 'Google Sheets',
  docs: 'Google Docs',
  slides: 'Google Slides',
};

export function getDocumentIdFromUrl(url: string): string | null {
  const match = url.match(/\/(?:document|presentation)\/d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : null;
}
