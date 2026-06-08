import { describe, it, expect } from 'vitest';
import { convertMcpToolsToAISDK } from '../tools';
import type { MCPTool } from '../../../types';

// ---------------------------------------------------------------------------
// 回归测试：convertMcpToolsToAISDK 必须返回 AI SDK 的 ToolSet（Record<string, Tool>）
//
// 背景：openai-aisdk 切成默认引擎后（Phase 4f/4g），开启 MCP 函数工具时
// `streamText({ tools })` 报 `Invalid schema for function '0': schema must be a
// JSON Schema of 'type: "object"', got 'type: null'`。根因是本函数曾返回
// OpenAI 函数数组 `[{ type:'function', function:{...} }]`，而 AI SDK 需要按工具名
// 做 key 的对象、每个用 tool()/jsonSchema() 包装；传数组会让 AI SDK 把工具名当成
// 数组下标 '0' 且找不到 inputSchema，schema 解析成 type:null → 400。
// ---------------------------------------------------------------------------

const mcpTool = (over: Partial<MCPTool>): MCPTool =>
  ({ id: over.name || 'x', name: over.name || 'x', serverName: 's', serverId: 's', ...over } as unknown as MCPTool);

describe('convertMcpToolsToAISDK — 返回 AI SDK ToolSet', () => {
  it('按工具名做 key（不是数组下标 0/1）', () => {
    const result = convertMcpToolsToAISDK([
      mcpTool({ name: 'searxng_search', inputSchema: { type: 'object', properties: { q: { type: 'string' } } } }),
      mcpTool({ name: 'searxng_read_url', inputSchema: { type: 'object', properties: { url: { type: 'string' } } } }),
    ]);

    expect(Array.isArray(result)).toBe(false);
    expect(Object.keys(result).sort()).toEqual(['searxng_read_url', 'searxng_search']);
    // 不应出现把数组下标当工具名的情况
    expect(result['0']).toBeUndefined();
  });

  it('每个工具的 inputSchema 是 AI SDK Schema，顶层 type 为 object', () => {
    const result = convertMcpToolsToAISDK([
      mcpTool({ name: 'searxng_search', description: '搜索', inputSchema: { type: 'object', properties: { q: { type: 'string' } } } }),
    ]);

    const t = result['searxng_search'];
    expect(t.description).toBe('搜索');
    // jsonSchema() 包装后通过 .inputSchema.jsonSchema 拿到原始 JSON Schema
    expect(t.inputSchema.jsonSchema.type).toBe('object');
    expect(t.inputSchema.jsonSchema.properties).toEqual({ q: { type: 'string' } });
  });

  it('inputSchema 的 type 为 null 时兜底成 object（避免 AI SDK 校验 400）', () => {
    const result = convertMcpToolsToAISDK([
      mcpTool({ name: 'bad', inputSchema: { type: null, properties: { a: { type: 'string' } } } as any }),
    ]);

    expect(result['bad'].inputSchema.jsonSchema.type).toBe('object');
    expect(result['bad'].inputSchema.jsonSchema.properties).toEqual({ a: { type: 'string' } });
  });

  it('缺失 inputSchema 时兜底为 { type:object, properties:{} }', () => {
    const result = convertMcpToolsToAISDK([mcpTool({ name: 'noschema', inputSchema: undefined })]);

    expect(result['noschema'].inputSchema.jsonSchema).toEqual({ type: 'object', properties: {} });
  });

  it('过滤无名工具', () => {
    const result = convertMcpToolsToAISDK([mcpTool({ name: '' })]);
    expect(Object.keys(result)).toEqual([]);
  });
});
