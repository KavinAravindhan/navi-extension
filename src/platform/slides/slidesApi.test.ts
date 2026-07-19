import { beforeEach, describe, expect, it, vi } from 'vitest';
import { installChromeMock } from '@/test/chrome';
import { handleAddSlide, parsePresentation } from './slidesApi';

const chromeMock = installChromeMock();
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

function shape(text: string, placeholderType?: string) {
  return {
    shape: {
      ...(placeholderType ? { placeholder: { type: placeholderType } } : {}),
      text: { textElements: [{ textRun: { content: text } }] },
    },
  };
}

describe('parsePresentation', () => {
  it('extracts per-slide titles and body text', () => {
    const outline = parsePresentation({
      title: 'Pitch Deck',
      slides: [
        { pageElements: [shape('Welcome', 'TITLE'), shape('Agenda for today')] },
        { pageElements: [shape('Numbers', 'CENTERED_TITLE'), shape('Revenue up 12%')] },
      ],
    });

    expect(outline.title).toBe('Pitch Deck');
    expect(outline.slides).toEqual([
      { index: 1, title: 'Welcome', bodyText: 'Agenda for today' },
      { index: 2, title: 'Numbers', bodyText: 'Revenue up 12%' },
    ]);
  });

  it('falls back to slide numbers when there is no title', () => {
    const outline = parsePresentation({
      title: 'Deck',
      slides: [{ pageElements: [shape('just text')] }],
    });
    expect(outline.slides[0].title).toBe('Slide 1');
    expect(outline.slides[0].bodyText).toBe('just text');
  });
});

describe('handleAddSlide', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    chromeMock.runtime.lastError = undefined;
    chromeMock.identity.getAuthToken.mockImplementation(
      (_opts: unknown, cb: (token?: string) => void) => cb('tok-123'),
    );
  });

  it('creates a titled slide with mapped placeholders and inserts the text', async () => {
    mockFetch.mockResolvedValue({ json: () => Promise.resolve({}) });

    const result = await handleAddSlide({
      presentationId: 'DECK1',
      title: 'Q4 Results',
      body: 'Revenue grew 12 percent.',
    });

    expect(result).toEqual({ success: true });
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe(
      'https://slides.googleapis.com/v1/presentations/DECK1:batchUpdate',
    );
    const requests = JSON.parse(init.body).requests;
    const create = requests[0].createSlide;
    expect(create.slideLayoutReference.predefinedLayout).toBe('TITLE_AND_BODY');
    expect(create.placeholderIdMappings).toHaveLength(2);

    const titleInsert = requests[1].insertText;
    expect(titleInsert.text).toBe('Q4 Results');
    expect(titleInsert.objectId).toBe(create.placeholderIdMappings[0].objectId);

    const bodyInsert = requests[2].insertText;
    expect(bodyInsert.text).toBe('Revenue grew 12 percent.');
    expect(bodyInsert.objectId).toBe(create.placeholderIdMappings[1].objectId);
  });

  it('skips the body insert when body is empty', async () => {
    mockFetch.mockResolvedValue({ json: () => Promise.resolve({}) });

    await handleAddSlide({ presentationId: 'DECK1', title: 'Only title', body: '' });

    expect(JSON.parse(mockFetch.mock.calls[0][1].body).requests).toHaveLength(2);
  });

  it('surfaces API errors', async () => {
    mockFetch.mockResolvedValue({
      json: () => Promise.resolve({ error: { message: 'read only' } }),
    });

    expect(
      await handleAddSlide({ presentationId: 'DECK1', title: 'X', body: 'y' }),
    ).toEqual({ success: false, error: 'read only' });
  });
});
