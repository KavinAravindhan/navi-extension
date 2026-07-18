/**
 * Splits cleaned text into speakable sentences — the unit of NAVI's speech
 * queue. Pausing and resuming happens on sentence boundaries (NAVI-005:
 * "Resuming continues from the last spoken sentence").
 *
 * Rules:
 * - split after . ! ? only when followed by whitespace or end of text,
 *   so decimals ("5.5 percent") and amounts ("$5,000.25") stay intact
 * - list markers ("1.", "2.") are glued to the sentence they introduce
 */
export function splitIntoSentences(text: string): string[] {
  // Lazy scan up to punctuation that is followed by whitespace/end — dots
  // inside numbers ("5.5", "$5,000.25") never sit before whitespace, so the
  // scan runs straight past them.
  const parts = text.match(/.*?[.!?]+(?=\s|$)|.+$/g) ?? [];

  const sentences: string[] = [];
  let pendingPrefix = '';

  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;

    // A bare list marker like "1." introduces the NEXT sentence.
    if (/^\d{1,3}\.$/.test(trimmed)) {
      pendingPrefix += `${trimmed} `;
      continue;
    }

    sentences.push(pendingPrefix + trimmed);
    pendingPrefix = '';
  }

  if (pendingPrefix.trim()) sentences.push(pendingPrefix.trim());

  return sentences;
}
