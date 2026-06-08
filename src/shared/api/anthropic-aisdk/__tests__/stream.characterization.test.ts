import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ChunkType, type Chunk } from '../../../types/chunk';

// ---------------------------------------------------------------------------
// Phase 0 — Chunk 契约特征测试（Anthropic AI SDK 流式路径）
//
// 与 openai-aisdk 同构：mock `ai` 的 streamText，喂入伪造 fullStream parts，
// 断言 onChunk 的 Chunk 序列。Claude Extended Thinking 走原生 reasoning-delta。
// 见 plans/ai-provider-refactor/README.md §2.5。
// ---------------------------------------------------------------------------

const streamTextMock = vi.fn();
const generateTextMock = vi.fn();
vi.mock('ai', () => ({
  streamText: (...args: unknown[]) => streamTextMock(...args),
  generateText: (...args: unknown[]) => generateTextMock(...args),
}));
vi.mock('../../../services/infra/LoggerService', () => ({
  logApiRequest: vi.fn(),
}));
vi.mock('../../../services/infra/EventEmitter', () => ({
  EventEmitter: { emit: vi.fn() },
  EVENT_NAMES: new Proxy({}, { get: (_t, p) => String(p) }),
}));

import { streamCompletion, nonStreamCompletion } from '../stream';

function mockStream(parts: unknown[]) {
  async function* gen() {
    for (const p of parts) yield p;
  }
  streamTextMock.mockReturnValue({ fullStream: gen() });
}

async function runStream(parts: unknown[], extra?: Record<string, unknown>) {
  mockStream(parts);
  const chunks: Chunk[] = [];
  const fakeClient = ((_id: string) => ({})) as any;
  const result = await streamCompletion(
    fakeClient,
    'claude-test',
    [{ role: 'user', content: 'hi' }],
    undefined,
    undefined,
    extra as any,
    (c) => chunks.push(c),
  );
  return { chunks, result };
}

const types = (chunks: Chunk[]) => chunks.map((c) => c.type);

beforeEach(() => {
  streamTextMock.mockReset();
  generateTextMock.mockReset();
});

describe('Anthropic AI SDK streamCompletion — Chunk 契约（纯文本）', () => {
  it('text-delta 累积发送，结尾恰好一个 TEXT_COMPLETE 携带完整内容，无 THINKING', async () => {
    const { chunks, result } = await runStream([
      { type: 'text-delta', text: 'Hel' },
      { type: 'text-delta', text: 'lo' },
      { type: 'finish' },
    ]);

    const t = types(chunks);
    expect(t).toContain(ChunkType.TEXT_DELTA);
    expect(t.filter((x) => x === ChunkType.TEXT_COMPLETE)).toHaveLength(1);
    expect(t[t.length - 1]).toBe(ChunkType.TEXT_COMPLETE);
    expect(t).not.toContain(ChunkType.THINKING_DELTA);
    expect(t).not.toContain(ChunkType.THINKING_COMPLETE);

    const textDeltas = chunks.filter((c) => c.type === ChunkType.TEXT_DELTA) as any[];
    expect(textDeltas[textDeltas.length - 1].text).toBe('Hello');
    const complete = chunks.find((c) => c.type === ChunkType.TEXT_COMPLETE) as any;
    expect(complete.text).toBe('Hello');

    expect(result.content).toBe('Hello');
    expect(result.hasToolCalls).toBe(false);
  });

  it('空响应（仅 finish）不产生任何 chunk', async () => {
    const { chunks } = await runStream([{ type: 'finish' }]);
    expect(chunks).toHaveLength(0);
  });
});

describe('Anthropic AI SDK streamCompletion — Extended Thinking（reasoning-delta）', () => {
  it('reasoning-delta 累积发 THINKING_DELTA，结尾发 THINKING_COMPLETE', async () => {
    const { chunks } = await runStream([
      { type: 'reasoning-delta', text: 'th' },
      { type: 'reasoning-delta', text: 'ink' },
      { type: 'text-delta', text: 'answer' },
      { type: 'finish' },
    ]);

    const t = types(chunks);
    const thinkDeltas = chunks.filter((c) => c.type === ChunkType.THINKING_DELTA) as any[];
    expect(thinkDeltas.length).toBeGreaterThanOrEqual(1);
    expect(thinkDeltas[thinkDeltas.length - 1].text).toBe('think');
    expect(t.filter((x) => x === ChunkType.THINKING_COMPLETE)).toHaveLength(1);
    expect(t.filter((x) => x === ChunkType.TEXT_COMPLETE)).toHaveLength(1);

    const complete = chunks.find((c) => c.type === ChunkType.THINKING_COMPLETE) as any;
    expect(complete.text).toBe('think');
  });
});

describe('Anthropic AI SDK streamCompletion — 工具调用', () => {
  it('tool-call → MCP_TOOL_CREATED，且检测到工具后【不】发 TEXT_COMPLETE', async () => {
    const { chunks, result } = await runStream([
      { type: 'text-delta', text: 'let me search' },
      { type: 'tool-call', toolCallId: 'call_1', toolName: 'search', input: { q: 'x' } },
      { type: 'finish' },
    ]);

    const t = types(chunks);
    expect(t).toContain(ChunkType.MCP_TOOL_CREATED);
    expect(t).not.toContain(ChunkType.TEXT_COMPLETE);

    const toolChunk = chunks.find((c) => c.type === ChunkType.MCP_TOOL_CREATED) as any;
    expect(toolChunk.responses[0]).toMatchObject({
      id: 'call_1',
      name: 'search',
      arguments: { q: 'x' },
      status: 'pending',
    });
    expect(result.hasToolCalls).toBe(true);
  });
});

// 非流式：generateText 结果 → StreamResult 映射（provider.ts 据此发 COMPLETE）
async function runNonStream(genResult: Record<string, unknown>) {
  generateTextMock.mockResolvedValue(genResult);
  const fakeClient = ((_id: string) => ({})) as any;
  return nonStreamCompletion(
    fakeClient,
    'claude-test',
    [{ role: 'user', content: 'hi' }],
  );
}

describe('Anthropic AI SDK nonStreamCompletion — StreamResult 契约', () => {
  it('纯文本：content = result.text，无工具', async () => {
    const r = await runNonStream({ text: 'Hello', toolCalls: [] });
    expect(r.content).toBe('Hello');
    expect(r.hasToolCalls).toBe(false);
  });

  it('带工具调用：hasToolCalls=true', async () => {
    const r = await runNonStream({
      text: '',
      toolCalls: [{ toolCallId: 'c1', toolName: 'search', input: { q: 'x' } }],
    });
    expect(r.hasToolCalls).toBe(true);
  });
});
