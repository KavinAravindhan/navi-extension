/**
 * The spoken name of NAVI's modifier key on this machine. Chrome maps the
 * manifest's Alt to Option on macOS, and Mac keyboards label the key Option —
 * hearing "press Alt and M" sent users hunting for a key their keyboard
 * doesn't have (Kavin's feedback). Strings use a {mod} placeholder; callers
 * fill it with this word.
 */
export function modifierKeyWord(
  platform: string = globalThis.navigator?.platform ?? '',
): 'Option' | 'Alt' {
  return /mac/i.test(platform) ? 'Option' : 'Alt';
}
