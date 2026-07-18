import { describe, expect, it, vi } from 'vitest';
import { ToolRegistry } from './tools';

const EDIT_CELL_DEF = {
  name: 'edit_cell',
  description: 'Edit one cell',
  parameters: {
    type: 'object',
    properties: { cellAddress: { type: 'string' } },
    required: ['cellAddress'],
  },
};

describe('ToolRegistry', () => {
  it('exposes OpenAI-shaped tool definitions', () => {
    const registry = new ToolRegistry();
    registry.register(EDIT_CELL_DEF, async () => 'ok');

    expect(registry.size).toBe(1);
    expect(registry.definitions()).toEqual([
      { type: 'function', function: EDIT_CELL_DEF },
    ]);
  });

  it('executes a tool with parsed JSON arguments', async () => {
    const registry = new ToolRegistry();
    const executor = vi.fn(async (args: Record<string, unknown>) => `did ${args.cellAddress}`);
    registry.register(EDIT_CELL_DEF, executor);

    const result = await registry.execute('edit_cell', '{"cellAddress":"B3"}');

    expect(executor).toHaveBeenCalledWith({ cellAddress: 'B3' });
    expect(result).toBe('did B3');
  });

  it('reports unknown tools as text instead of throwing', async () => {
    const registry = new ToolRegistry();
    expect(await registry.execute('nope', '{}')).toContain('unknown tool');
  });

  it('turns malformed JSON arguments into an error string', async () => {
    const registry = new ToolRegistry();
    registry.register(EDIT_CELL_DEF, async () => 'ok');
    expect(await registry.execute('edit_cell', '{broken')).toMatch(/^Error:/);
  });

  it('turns executor exceptions into an error string', async () => {
    const registry = new ToolRegistry();
    registry.register(EDIT_CELL_DEF, async () => {
      throw new Error('backend down');
    });
    expect(await registry.execute('edit_cell', '{}')).toBe('Error: backend down');
  });
});
