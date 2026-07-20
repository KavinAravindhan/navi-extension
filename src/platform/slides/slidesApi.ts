/**
 * Google Slides support (cross-app phase 1): read the deck, read one slide,
 * add a titled slide — via the shared OAuth token.
 */
import { fetchJsonWithAuth } from '@/platform/googleAuth';

export interface SlideInfo {
  index: number;
  title: string;
  bodyText: string;
}

export interface DeckOutline {
  title: string;
  slides: SlideInfo[];
}

/** Pure: turns a presentations.get response into per-slide title/body. */
export function parsePresentation(deck: any): DeckOutline {
  const slides: SlideInfo[] = (deck.slides ?? []).map((slide: any, i: number) => {
    let title = '';
    let bodyText = '';

    for (const element of slide.pageElements ?? []) {
      const shape = element.shape;
      if (!shape) continue;
      const content = (shape.text?.textElements ?? [])
        .map((el: any) => el.textRun?.content ?? '')
        .join('')
        .trim();
      if (!content) continue;

      const placeholderType: string = shape.placeholder?.type ?? '';
      if ((placeholderType === 'TITLE' || placeholderType === 'CENTERED_TITLE') && !title) {
        title = content;
      } else {
        bodyText += (bodyText ? '\n' : '') + content;
      }
    }

    return { index: i + 1, title: title || `Slide ${i + 1}`, bodyText };
  });

  return { title: deck.title ?? 'Untitled presentation', slides };
}

export interface GetPresentationResponse {
  success: boolean;
  error?: string;
  outline?: DeckOutline;
}

export async function handleGetPresentation({
  presentationId,
}: {
  presentationId: string;
}): Promise<GetPresentationResponse> {
  try {
    const data = await fetchJsonWithAuth(
      `https://slides.googleapis.com/v1/presentations/${presentationId}?fields=${encodeURIComponent(
        'title,slides(objectId,pageElements(shape(placeholder(type),text(textElements(textRun(content))))))',
      )}`,
    );
    if (data.error) return { success: false, error: data.error.message };
    return { success: true, outline: parsePresentation(data) };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function handleAddSlide({
  presentationId,
  title,
  body,
}: {
  presentationId: string;
  title: string;
  body: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const stamp = Date.now().toString(36);
    const slideId = `navi_slide_${stamp}`;
    const titleId = `navi_title_${stamp}`;
    const bodyId = `navi_body_${stamp}`;

    const requests: unknown[] = [
      {
        createSlide: {
          objectId: slideId,
          slideLayoutReference: { predefinedLayout: 'TITLE_AND_BODY' },
          placeholderIdMappings: [
            { layoutPlaceholder: { type: 'TITLE', index: 0 }, objectId: titleId },
            { layoutPlaceholder: { type: 'BODY', index: 0 }, objectId: bodyId },
          ],
        },
      },
      { insertText: { objectId: titleId, text: title } },
    ];
    if (body.trim()) {
      requests.push({ insertText: { objectId: bodyId, text: body } });
    }

    const data = await fetchJsonWithAuth(
      `https://slides.googleapis.com/v1/presentations/${presentationId}:batchUpdate`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requests }),
      },
    );
    if (data.error) return { success: false, error: data.error.message };
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}
