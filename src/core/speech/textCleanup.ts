/**
 * Strips markdown noise from text before it is sent to text-to-speech, so the
 * voice never reads out asterisks or pound signs. Ported verbatim from v1.
 */
export function cleanTextForSpeech(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/#{1,6}\s/g, '')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\n+/g, '. ')
    .trim();
}
