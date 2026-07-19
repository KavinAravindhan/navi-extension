/**
 * Google Docs support (cross-app phase 1). Background-side handlers +
 * pure parsing kept together; reads and writes ride the same OAuth token
 * as Sheets.
 */

export interface DocOutline {
  title: string;
  headings: string[];
  /** Plain text, capped — enough for the LLM context. */
  text: string;
  wordCount: number;
}

const TEXT_CAP = 15000;

/** Pure: walks a Docs API document body into title/headings/plain text. */
export function parseDocument(doc: any): DocOutline {
  const headings: string[] = [];
  let text = '';

  for (const element of doc.body?.content ?? []) {
    const paragraph = element.paragraph;
    if (!paragraph) continue;

    const line = (paragraph.elements ?? [])
      .map((el: any) => el.textRun?.content ?? '')
      .join('');

    const style: string = paragraph.paragraphStyle?.namedStyleType ?? '';
    if (style.startsWith('HEADING_') && line.trim()) {
      headings.push(line.trim());
    }
    text += line;
  }

  const trimmed = text.trim();
  return {
    title: doc.title ?? 'Untitled document',
    headings,
    text:
      trimmed.length > TEXT_CAP
        ? `${trimmed.slice(0, TEXT_CAP)}\n(...document truncated...)`
        : trimmed,
    wordCount: trimmed.length === 0 ? 0 : trimmed.split(/\s+/).length,
  };
}

async function getAuthToken(): Promise<string> {
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

export interface GetDocumentResponse {
  success: boolean;
  error?: string;
  outline?: DocOutline;
}

export async function handleGetDocument({
  documentId,
}: {
  documentId: string;
}): Promise<GetDocumentResponse> {
  try {
    const token = await getAuthToken();
    const response = await fetch(
      `https://docs.googleapis.com/v1/documents/${documentId}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    const data = await response.json();
    if (data.error) return { success: false, error: data.error.message };
    return { success: true, outline: parseDocument(data) };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function handleAppendDoc({
  documentId,
  text,
}: {
  documentId: string;
  text: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const token = await getAuthToken();
    const response = await fetch(
      `https://docs.googleapis.com/v1/documents/${documentId}:batchUpdate`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requests: [
            {
              insertText: {
                endOfSegmentLocation: {},
                text: `\n${text}`,
              },
            },
          ],
        }),
      },
    );
    const data = await response.json();
    if (data.error) return { success: false, error: data.error.message };
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}
