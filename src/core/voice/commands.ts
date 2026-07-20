/**
 * Local voice commands: short spoken phrases that map to an in-page action
 * and must respond INSTANTLY — no AI round trip. Matched against the whole
 * transcript, so the patterns stay deliberately narrow: "help me make a
 * chart" is a data question for the AI, not a help request.
 */
export type VoiceCommand = 'help' | 'menu';

const COURTESY = /(?:hey |hei |hai )?(?:navi[,.!\s]+)?(?:can you |could you |please |tolong )*/
  .source;

const HELP_PATTERNS = [
  new RegExp(`^${COURTESY}help[.!?]*$`, 'i'),
  /^what can you do[.!?]*$/i,
  /^what are (?:my|the) options[.!?]*$/i,
  /^(?:list|read) (?:the |your )?(?:commands|shortcuts|options)[.!?]*$/i,
  // Indonesian
  new RegExp(`^${COURTESY}bantuan[.!?]*$`, 'i'),
  /^apa yang bisa kamu lakukan[.!?]*$/i,
];

const MENU_PATTERNS = [
  new RegExp(
    `^${COURTESY}(?:open|show|display)(?: the| your| up)? (?:settings? )?menu[.!?]*$`,
    'i',
  ),
  new RegExp(`^${COURTESY}(?:open|go to) settings[.!?]*$`, 'i'),
  /^menu[.!?]*$/i,
  // Indonesian
  new RegExp(`^${COURTESY}(?:buka|tampilkan) (?:menu|pengaturan)(?:nya)?[.!?]*$`, 'i'),
];

/** Returns the matched command, or null when the text is for the AI. */
export function detectVoiceCommand(transcript: string): VoiceCommand | null {
  const text = transcript.trim();
  if (HELP_PATTERNS.some((pattern) => pattern.test(text))) return 'help';
  if (MENU_PATTERNS.some((pattern) => pattern.test(text))) return 'menu';
  return null;
}
