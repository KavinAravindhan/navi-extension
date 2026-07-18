import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LLMClient } from './client';
import { ToolRegistry } from './tools';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

function makeTextResponse(content: string) {
  return {
    ok: true,
    json: () =>
      Promise.resolve({ choices: [{ message: { role: 'assistant', content } }] }),
  };
}

function makeToolCallResponse(
  callId: string,
  name: string,
  args: Record<string, unknown>,
) {
  return {
    ok: true,
    json: () =>
      Promise.resolve({
        choices: [
          {
            message: {
              role: 'assistant',
              content: null,
              tool_calls: [
                {
                  id: callId,
                  type: 'function',
                  function: { name, arguments: JSON.stringify(args) },
                },
              ],
            },
          },
        ],
      }),
  };
}

describe('LLMClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('POSTs the conversation with auth header and model settings', async () => {
    mockFetch.mockResolvedValue(makeTextResponse('Hello!'));
    const client = new LLMClient('test-key');
    client.setSpreadsheetContext('Sheet: Budget\n\nRow 1: A | B');

    const reply = await client.sendMessage('What is this sheet about?');

    expect(reply).toBe('Hello!');
    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe('https://api.openai.com/v1/chat/completions');
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toBe('Bearer test-key');

    const body = JSON.parse(init.body);
    expect(body.model).toBe('gpt-4o');
    expect(body.max_tokens).toBe(700);
    expect(body.temperature).toBe(0.5);
    expect(body.tools).toBeUndefined(); // no registry attached
    expect(body.messages[0].role).toBe('system');
    expect(body.messages[0].content).toContain('You are NAVI');
    expect(body.messages[0].content).toContain('Sheet: Budget');
    expect(body.messages[0].content).toContain('Always respond in English');
    expect(body.messages[1]).toEqual({
      role: 'user',
      content: 'What is this sheet about?',
    });
  });

  it('injects the configured response language into the system prompt', async () => {
    const client = new LLMClient('k');
    client.setLanguage('Bahasa Indonesia');
    client.setSpreadsheetContext('data');

    expect(client.getConversationHistory()[0].content).toContain(
      'Always respond in Bahasa Indonesia',
    );
  });

  it('runs tool calls through the registry and returns the final answer', async () => {
    const registry = new ToolRegistry();
    const executor = vi.fn(async () => 'Cell B3 was updated to 5000.');
    registry.register(
      {
        name: 'edit_cell',
        description: 'Edit one cell',
        parameters: { type: 'object', properties: {} },
      },
      executor,
    );

    mockFetch
      .mockResolvedValueOnce(
        makeToolCallResponse('call_1', 'edit_cell', {
          cellAddress: 'B3',
          newValue: '5000',
        }),
      )
      .mockResolvedValueOnce(makeTextResponse('Done! B3 is now 5000.'));

    const client = new LLMClient('k', registry);
    client.setSpreadsheetContext('data');

    const reply = await client.sendMessage('set B3 to 5000');

    expect(reply).toBe('Done! B3 is now 5000.');
    expect(executor).toHaveBeenCalledWith({ cellAddress: 'B3', newValue: '5000' });
    expect(mockFetch).toHaveBeenCalledTimes(2);

    // Both requests advertise the tools; the second carries the tool result.
    const secondBody = JSON.parse(mockFetch.mock.calls[1][1].body);
    expect(secondBody.tools).toHaveLength(1);
    const toolMsg = secondBody.messages.find(
      (m: { role: string }) => m.role === 'tool',
    );
    expect(toolMsg).toMatchObject({
      tool_call_id: 'call_1',
      content: 'Cell B3 was updated to 5000.',
    });
  });

  it('gives up politely when the model loops on tools forever', async () => {
    const registry = new ToolRegistry();
    registry.register(
      {
        name: 'read_range',
        description: 'read',
        parameters: { type: 'object', properties: {} },
      },
      async () => 'some data',
    );
    mockFetch.mockResolvedValue(
      makeToolCallResponse('call_x', 'read_range', { range: 'A1' }),
    );

    const client = new LLMClient('k', registry);
    client.setSpreadsheetContext('data');

    const reply = await client.sendMessage('loop please');

    expect(reply).toContain('too many steps');
  });

  it('accumulates user and assistant turns in the history', async () => {
    mockFetch.mockResolvedValueOnce(makeTextResponse('First reply'));
    mockFetch.mockResolvedValueOnce(makeTextResponse('Second reply'));
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
  });

  it('resets the conversation when spreadsheet context is set again', async () => {
    mockFetch.mockResolvedValue(makeTextResponse('ok'));
    const client = new LLMClient('k');
    client.setSpreadsheetContext('old data');
    await client.sendMessage('question');

    client.setSpreadsheetContext('new data');

    expect(client.getConversationHistory()).toHaveLength(1);
    expect(client.getConversationHistory()[0].content).toContain('new data');
  });

  it('returns the spoken apology when the request fails', async () => {
    mockFetch.mockRejectedValue(new Error('network down'));
    const client = new LLMClient('k');
    client.setSpreadsheetContext('data');

    expect(await client.sendMessage('hi')).toBe(
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

    expect(await client.sendMessage('hi')).toBe(
      'Sorry, I had trouble connecting to the AI. Please check your API key and try again.',
    );
  });
});
