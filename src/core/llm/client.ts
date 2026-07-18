import { buildSystemPrompt } from './systemPrompt';
import type { ToolRegistry } from './tools';

interface ToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}

const OPENAI_CHAT_COMPLETIONS_URL = 'https://api.openai.com/v1/chat/completions';

/** Safety valve: max tool round-trips per user message. */
const MAX_TOOL_ROUNDS = 5;

/**
 * OpenAI chat client owning the conversation history, with a function-calling
 * loop: when the model requests tools, they run through the ToolRegistry and
 * the results go back until the model produces the final spoken answer.
 */
export class LLMClient {
  private conversationHistory: ChatMessage[] = [];
  private languageName = 'English';

  constructor(
    private readonly apiKey: string,
    private readonly tools?: ToolRegistry,
  ) {}

  /** Resets the conversation and seeds it with the spreadsheet context. */
  setSpreadsheetContext(data: string): void {
    this.conversationHistory = [
      {
        role: 'system',
        content: buildSystemPrompt(data, this.languageName),
      },
    ];
  }

  /** Response language for future contexts (applies on next context set). */
  setLanguage(languageName: string): void {
    this.languageName = languageName;
  }

  /** Exposed for tests. */
  getConversationHistory(): readonly ChatMessage[] {
    return this.conversationHistory;
  }

  async sendMessage(userMessage: string): Promise<string> {
    this.conversationHistory.push({ role: 'user', content: userMessage });

    try {
      for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
        const body: Record<string, unknown> = {
          model: 'gpt-4o',
          messages: this.conversationHistory,
          max_tokens: 700,
          temperature: 0.5,
        };
        if (this.tools && this.tools.size > 0) {
          body.tools = this.tools.definitions();
        }

        const response = await fetch(OPENAI_CHAT_COMPLETIONS_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify(body),
        });

        const data = await response.json();
        const message = data.choices[0].message as ChatMessage;

        this.conversationHistory.push(message);

        const toolCalls = message.tool_calls ?? [];
        if (toolCalls.length === 0 || !this.tools) {
          return message.content ?? '';
        }

        for (const call of toolCalls) {
          const result = await this.tools.execute(
            call.function.name,
            call.function.arguments,
          );
          this.conversationHistory.push({
            role: 'tool',
            tool_call_id: call.id,
            content: result,
          });
        }
      }

      return 'Sorry, that request needed too many steps. Please try asking in a simpler way.';
    } catch (error) {
      console.error('NAVI: Error calling ChatGPT API:', error);
      return 'Sorry, I had trouble connecting to the AI. Please check your API key and try again.';
    }
  }
}
