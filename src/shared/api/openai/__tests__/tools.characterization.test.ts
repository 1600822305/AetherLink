import { describe, it, expect } from 'vitest';
import {
  convertMcpToolsToOpenAI,
  findMcpToolByName,
  convertToolCallsToMcpResponses,
  mcpToolCallResponseToOpenAIMessage
} from '../tools';
import type { MCPTool, MCPToolResponse, MCPCallToolResponse, Model } from '../../../types';

// Characterization tests for the OpenAI Function-Calling tool pipeline.
//
// Goal of Phase 0: pin the CURRENT behavior so the Phase 1 fix can be made
// with confidence. Tests are split into:
//   1. Invariants that MUST hold before AND after the fix (the safety net).
//   2. Tests documenting the CURRENT P1-a bug (unknown tool dropped). These
//      are expected to be intentionally flipped by the Phase 1 fix.

const makeTool = (name: string): MCPTool => ({
  name,
  description: `desc of ${name}`,
  inputSchema: { type: 'object', properties: {} },
  serverName: 'srv',
  serverId: 'srv-1'
});

const makeToolCall = (id: string, name: string, args: Record<string, unknown> = {}) => ({
  id,
  type: 'function',
  function: { name, arguments: JSON.stringify(args) }
});

const fakeModel = { id: 'gpt-test', name: 'gpt-test', provider: 'openai' } as unknown as Model;

const okResponse = (text: string): MCPCallToolResponse => ({
  content: [{ type: 'text', text }],
  isError: false
});

/**
 * Simulate exactly what OpenAIProvider does when assembling the next turn:
 * convert tool_calls -> execute (mocked) -> build tool result messages.
 * Returns the tool result messages that would be pushed back to the model.
 */
function assembleToolResultMessages(toolCalls: any[], mcpTools: MCPTool[]) {
  const responses = convertToolCallsToMcpResponses(toolCalls, mcpTools);
  return responses
    .map((r: MCPToolResponse) => mcpToolCallResponseToOpenAIMessage(r, okResponse('result'), fakeModel))
    .filter(Boolean);
}

describe('OpenAI tool pipeline — invariants (must hold before AND after fix)', () => {
  it('round-trips a tool name: convertMcpToolsToOpenAI -> findMcpToolByName', () => {
    const tools = [makeTool('my-server.search_web')];
    const openaiTools = convertMcpToolsToOpenAI(tools) as any[];
    const sentName = openaiTools[0].function.name;
    expect(findMcpToolByName(tools, sentName)).toBe(tools[0]);
  });

  it('happy path: all tool_calls matched -> one tool message per tool_call_id, ids preserved', () => {
    const tools = [makeTool('alpha'), makeTool('beta')];
    const toolCalls = [makeToolCall('call_1', 'alpha'), makeToolCall('call_2', 'beta')];

    const messages = assembleToolResultMessages(toolCalls, tools);

    expect(messages).toHaveLength(toolCalls.length);
    expect(messages.map((m: any) => m.role)).toEqual(['tool', 'tool']);
    expect(messages.map((m: any) => m.tool_call_id)).toEqual(['call_1', 'call_2']);
  });

  it('a matched tool result message has role "tool" and carries its tool_call_id', () => {
    const resp: MCPToolResponse = {
      id: 'call_x',
      toolCallId: 'call_x',
      tool: makeTool('alpha'),
      arguments: {},
      status: 'pending'
    };
    const msg = mcpToolCallResponseToOpenAIMessage(resp, okResponse('hi'), fakeModel) as any;
    expect(msg.role).toBe('tool');
    expect(msg.tool_call_id).toBe('call_x');
    expect(typeof msg.content).toBe('string');
  });
});

describe('OpenAI tool pipeline — P1-a fix: unknown tools are never dropped', () => {
  it('unknown tool name is preserved (one response per tool_call), with a placeholder tool', () => {
    const tools = [makeTool('alpha')];
    const toolCalls = [makeToolCall('call_1', 'alpha'), makeToolCall('call_2', 'ghost_tool')];

    const responses = convertToolCallsToMcpResponses(toolCalls, tools);

    // Every tool_call gets a response; ids preserved in order.
    expect(responses).toHaveLength(toolCalls.length);
    expect(responses.map((r) => r.toolCallId)).toEqual(['call_1', 'call_2']);

    // The unmatched call keeps a placeholder tool (empty serverId) so it can
    // still be executed into an error result instead of being silently lost.
    expect(responses[1].tool.name).toBe('ghost_tool');
    expect(responses[1].tool.serverId).toBe('');
  });

  it('partial match -> exactly one tool result message per tool_call_id (no 400)', () => {
    const tools = [makeTool('alpha')];
    const toolCalls = [makeToolCall('call_1', 'alpha'), makeToolCall('call_2', 'ghost_tool')];

    const messages = assembleToolResultMessages(toolCalls, tools);

    // Assistant message carries 2 tool_calls; we now return 2 tool results.
    expect(messages).toHaveLength(toolCalls.length);
    expect(messages.map((m: any) => m.tool_call_id)).toEqual(['call_1', 'call_2']);
    expect(messages.every((m: any) => m.role === 'tool')).toBe(true);
  });

  it('all unknown tools (M=0) still produce a full set of tool results', () => {
    const tools = [makeTool('alpha')];
    const toolCalls = [makeToolCall('call_1', 'ghost_a'), makeToolCall('call_2', 'ghost_b')];

    const messages = assembleToolResultMessages(toolCalls, tools);

    expect(messages).toHaveLength(2);
    expect(messages.map((m: any) => m.tool_call_id)).toEqual(['call_1', 'call_2']);
  });
});
