export interface EditCommand {
  cellAddress: string;
  newValue: string;
}

/**
 * Detects the `EDIT_CELL: B3 = 5000` command format that the system prompt
 * asks GPT to use for cell edits. Returns null when the response contains no
 * edit command. Regex ported verbatim from v1 (content.js).
 */
export function parseEditCommand(aiResponse: string): EditCommand | null {
  const editPattern = /EDIT_CELL:\s*([A-Z]+\d+)\s*=\s*(.+)/i;
  const match = aiResponse.match(editPattern);
  if (match) {
    return {
      cellAddress: match[1].trim(),
      newValue: match[2].trim(),
    };
  }
  return null;
}
