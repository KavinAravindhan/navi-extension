import { buildSystemPrompt } from './systemPrompt';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

const OPENAI_CHAT_COMPLETIONS_URL = 'https://api.openai.com/v1/chat/completions';

/**
 * Thin wrapper around the OpenAI Chat Completions API that owns the
 * conversation history. Behavior ported verbatim from v1 (api.js).
 */
export class LLMClient {
  private conversationHistory: ChatMessage[] = [];

  constructor(private readonly apiKey: string) {}

  /** Resets the conversation and seeds it with the spreadsheet context. */
  setSpreadsheetContext(data: string): void {
    this.conversationHistory = [
      { role: 'system', content: buildSystemPrompt(data) },
    ];
  }

  /** Exposed for tests. */
  getConversationHistory(): readonly ChatMessage[] {
    return this.conversationHistory;
  }

  async sendMessage(userMessage: string): Promise<string> {
    this.conversationHistory.push({ role: 'user', content: userMessage });

    try {
      const response = await fetch(OPENAI_CHAT_COMPLETIONS_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: this.conversationHistory,
          max_tokens: 500,
          temperature: 0.5,
        }),
      });

      const data = await response.json();
      const aiReply: string = data.choices[0].message.content;

      this.conversationHistory.push({ role: 'assistant', content: aiReply });

      return aiReply;
    } catch (error) {
      console.error('NAVI: Error calling ChatGPT API:', error);
      return 'Sorry, I had trouble connecting to the AI. Please check your API key and try again.';
    }
  }
}
