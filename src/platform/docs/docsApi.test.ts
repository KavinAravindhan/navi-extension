import { beforeEach, describe, expect, it, vi } from 'vitest';
import { installChromeMock } from '@/test/chrome';
import { handleAppendDoc, parseDocument } from './docsApi';

const chromeMock = installChromeMock();
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

function paragraph(text: string, style?: string) {
  return {
    paragraph: {
      elements: [{ textRun: { content: text } }],
      ...(style ? { paragraphStyle: { namedStyleType: style } } : {}),
    },
  };
}

describe('parseDocument', () => {
  it('extracts title, headings, text, and word count', () => {
    const outline = parseDocument({
      title: 'Quarterly Memo',
      body: {
        content: [
          paragraph('Overview\n', 'HEADING_1'),
          paragraph('Revenue grew nicely this quarter.\n'),
          paragraph('Risks\n', 'HEADING_2'),
          paragraph('Flooding remains a concern.\n'),
        ],
      },
    });

    expect(outline.title).toBe('Quarterly Memo');
    expect(outline.headings).toEqual(['Overview', 'Risks']);
    expect(outline.text).toContain('Revenue grew nicely');
    expect(outline.wordCount).toBeGreaterThan(5);
  });

  it('caps very long documents and says so', () => {
    const long = paragraph('word '.repeat(6000));
    const outline = parseDocument({ title: 'Big', body: { content: [long] } });
    expect(outline.text.length).toBeLessThan(16000);
    expect(outline.text).toContain('(...document truncated...)');
  });

  it('handles an empty document', () => {
    const outline = parseDocument({ title: 'Empty', body: { content: [] } });
    expect(outline.headings).toEqual([]);
    expect(outline.wordCount).toBe(0);
  });
});

describe('handleAppendDoc', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    chromeMock.runtime.lastError = undefined;
    chromeMock.identity.getAuthToken.mockImplementation(
      (_opts: unknown, cb: (token?: string) => void) => cb('tok-123'),
    );
  });

  it('appends the paragraph at the end of the document', async () => {
    mockFetch.mockResolvedValue({ json: () => Promise.resolve({}) });

    const result = await handleAppendDoc({
      documentId: 'DOC1',
      text: 'Revenue was 4.9 billion.',
    });

    expect(result).toEqual({ success: true });
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe('https://docs.googleapis.com/v1/documents/DOC1:batchUpdate');
    const body = JSON.parse(init.body);
    expect(body.requests[0].insertText.endOfSegmentLocation).toEqual({});
    expect(body.requests[0].insertText.text).toBe('\nRevenue was 4.9 billion.');
  });

  it('surfaces API errors', async () => {
    mockFetch.mockResolvedValue({
      json: () => Promise.resolve({ error: { message: 'no edit access' } }),
    });

    expect(await handleAppendDoc({ documentId: 'DOC1', text: 'x' })).toEqual({
      success: false,
      error: 'no edit access',
    });
  });
});
