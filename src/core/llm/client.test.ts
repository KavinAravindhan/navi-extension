import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LLMClient } from './client';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

function makeOpenAIResponse(content: string) {
  return {
    ok: true,
    json: () => Promise.resolve({ choices: [{ message: { content } }] }),
  };
}

describe('LLMClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('POSTs the conversation to the chat completions API with the auth header', async () => {
    mockFetch.mockResolvedValue(makeOpenAIResponse('Hello!'));
    const client = new LLMClient('test-key');
    client.setSpreadsheetContext('Sheet: Budget\n\nRow 1: A | B');

    const reply = await client.sendMessage('What is this sheet about?');

    expect(reply).toBe('Hello!');
    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe('https://api.openai.com/v1/chat/completions');
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toBe('Bearer test-key');
    expect(init.headers['Content-Type']).toBe('application/json');

    const body = JSON.parse(init.body);
    expect(body.model).toBe('gpt-4o');
    expect(body.max_tokens).toBe(500);
    expect(body.temperature).toBe(0.5);
    expect(body.messages).toHaveLength(2);
    expect(body.messages[0].role).toBe('system');
    expect(body.messages[0].content).toContain('You are NAVI');
    expect(body.messages[0].content).toContain('Sheet: Budget');
    expect(body.messages[1]).toEqual({
      role: 'user',
      content: 'What is this sheet about?',
    });
  });

  it('accumulates user and assistant turns in the history', async () => {
    mockFetch.mockResolvedValueOnce(makeOpenAIResponse('First reply'));
    mockFetch.mockResolvedValueOnce(makeOpenAIResponse('Second reply'));
    const client = new LLMClient('k');
    client.setSpreadsheetContext('data');

    await client.sendMessage('one');
    await client.sendMessage('two');

    const body = JSON.parse(mockFetch.mock.calls[1][1].body);
    expect(body.messages.map((m: { role: string }) => m.role)).toEqual([
      'system',
      'user',
      'assistant',
      'user',
    ]);
    expect(body.messages[2].content).toBe('First reply');
    expect(body.messages[3].content).toBe('two');
  });

  it('resets the conversation when spreadsheet context is set again', async () => {
    mockFetch.mockResolvedValue(makeOpenAIResponse('ok'));
    const client = new LLMClient('k');
    client.setSpreadsheetContext('old data');
    await client.sendMessage('question about old data');

    client.setSpreadsheetContext('new data');

    expect(client.getConversationHistory()).toHaveLength(1);
    expect(client.getConversationHistory()[0].role).toBe('system');
    expect(client.getConversationHistory()[0].content).toContain('new data');
  });

  it('returns the spoken apology when the request fails', async () => {
    mockFetch.mockRejectedValue(new Error('network down'));
    const client = new LLMClient('k');
    client.setSpreadsheetContext('data');

    const reply = await client.sendMessage('hi');

    expect(reply).toBe(
      'Sorry, I had trouble connecting to the AI. Please check your API key and try again.',
    );
  });

  it('returns the spoken apology when the API responds without choices', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: { message: 'invalid key' } }),
    });
    const client = new LLMClient('bad-key');
    client.setSpreadsheetContext('data');

    const reply = await client.sendMessage('hi');

    expect(reply).toBe(
      'Sorry, I had trouble connecting to the AI. Please check your API key and try again.',
    );
  });
});
