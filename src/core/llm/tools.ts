/**
 * Function-calling tool registry — the single place NAVI's capabilities are
 * declared. Registering a tool makes it reachable from voice AND text
 * automatically, replacing v1's fragile "EDIT_CELL:" string parsing.
 */

export interface ToolDefinition {
  name: string;
  description: string;
  /** JSON Schema for the arguments object. */
  parameters: Record<string, unknown>;
}

export type ToolExecutor = (args: Record<string, unknown>) => Promise<string>;

interface RegisteredTool {
  definition: ToolDefinition;
  execute: ToolExecutor;
}

export class ToolRegistry {
  private tools = new Map<string, RegisteredTool>();

  register(definition: ToolDefinition, execute: ToolExecutor): void {
    this.tools.set(definition.name, { definition, execute });
  }

  get size(): number {
    return this.tools.size;
  }

  /** OpenAI `tools` array for the chat completions request. */
  definitions(): Array<{ type: 'function'; function: ToolDefinition }> {
    return [...this.tools.values()].map((tool) => ({
      type: 'function',
      function: tool.definition,
    }));
  }

  /**
   * Executes a tool call. Never throws — errors come back as text so the
   * model can explain the failure to the user in plain language.
   */
  async execute(name: string, argsJson: string): Promise<string> {
    const tool = this.tools.get(name);
    if (!tool) return `Error: unknown tool "${name}".`;
    try {
      const args = argsJson ? JSON.parse(argsJson) : {};
      return await tool.execute(args);
    } catch (error) {
      return `Error: ${(error as Error).message}`;
    }
  }
}
