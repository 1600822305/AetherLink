import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ChunkType, type Chunk } from '../../../types/chunk';

// ---------------------------------------------------------------------------
// Phase 0 — Chunk 契约特征测试（AI SDK 流式路径）
//
// 目的（见 plans/ai-provider-refactor/README.md §2.5）：
//   钉死 "AI SDK fullStream parts → onChunk(Chunk) 序列" 这条边界。
//   信息块系统只消费 Chunk 事件流，与具体 SDK 解耦。只要本测试断言的
//   Chunk 序列（类型 + 顺序 + 内容）在重构前后保持不变，块系统就不受影响。
//
// 做法：mock `ai` 的 streamText，喂入伪造的 fullStream parts，捕获 onChunk
//   的调用序列并断言。重 SDK / store / 基础设施依赖全部 mock 掉，保持纯单测。
// ---------------------------------------------------------------------------

// mock 重依赖，使 stream.ts 能在 node 环境下被纯导入
const streamTextMock = vi.fn();
const generateTextMock = vi.fn();
vi.mock('ai', () => ({
  streamText: (...args: unknown[]) => streamTextMock(...args),
  generateText: (...args: unknown[]) => generateTextMock(...args),
}));
vi.mock('../../../store', () => ({
  default: { getState: () => ({ settings: { providers: [] } }) },
}));
vi.mock('../../../services/infra/LoggerService', () => ({
  logApiRequest: vi.fn(),
}));
vi.mock('../../../services/infra/EventEmitter', () => ({
  EventEmitter: { emit: vi.fn() },
  EVENT_NAMES: new Proxy({}, { get: (_t, p) => String(p) }),
}));

import { streamCompletion, nonStreamCompletion } from '../stream';

// 把一组 fullStream parts 包成 async iterable，并让 streamText 返回它
function mockStream(parts: unknown[]) {
  async function* gen() {
    for (const p of parts) yield p;
  }
  streamTextMock.mockReturnValue({ fullStream: gen() });
}

// 运行一次 streamCompletion，返回捕获到的 Chunk 序列
async function runStream(parts: unknown[], extra?: Record<string, unknown>) {
  mockStream(parts);
  const chunks: Chunk[] = [];
  const fakeClient = { chat: () => ({}), responses: () => ({}) } as any;
  const result = await streamCompletion(
    fakeClient,
    'gpt-test',
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

// 已记录的当前行为：text-delta 经 ThinkTagParser 缓冲，可能在 flush 时
// 才发出（故 TEXT_DELTA 个数是实现细节，不予硬钉）；而 reasoning-delta
// 在循环内逐片发出（见下一个 describe）。本测试钉住块系统真正依赖的契约：
// TEXT_DELTA 为累积语义、结尾恰好一个 TEXT_COMPLETE 且携带完整内容。
describe('AI SDK streamCompletion — Chunk 契约（纯文本）', () => {
  it('text-delta 以累积语义发送，结尾恰好一个 TEXT_COMPLETE 携带完整内容', async () => {
    const { chunks, result } = await runStream([
      { type: 'text-delta', text: 'Hel' },
      { type: 'text-delta', text: 'lo' },
      { type: 'finish' },
    ]);

    const t = types(chunks);
    // 至少有一个 TEXT_DELTA，且整条序列以唯一的 TEXT_COMPLETE 收尾
    expect(t).toContain(ChunkType.TEXT_DELTA);
    expect(t.filter((x) => x === ChunkType.TEXT_COMPLETE)).toHaveLength(1);
    expect(t[t.length - 1]).toBe(ChunkType.TEXT_COMPLETE);
    // 纯文本场景不应出现任何 thinking chunk
    expect(t).not.toContain(ChunkType.THINKING_DELTA);
    expect(t).not.toContain(ChunkType.THINKING_COMPLETE);

    // 累积语义：最后一个 TEXT_DELTA 携带到目前为止的完整内容
    const textDeltas = chunks.filter((c) => c.type === ChunkType.TEXT_DELTA);
    expect((textDeltas[textDeltas.length - 1] as any).text).toBe('Hello');
    const complete = chunks.find((c) => c.type === ChunkType.TEXT_COMPLETE) as any;
    expect(complete.text).toBe('Hello');

    expect(result.content).toBe('Hello');
    expect(result.hasToolCalls).toBe(false);
  });

  it('无内容时不发送任何 TEXT_COMPLETE', async () => {
    const { chunks } = await runStream([{ type: 'finish' }]);
    expect(chunks).toHaveLength(0);
  });
});

describe('AI SDK streamCompletion — Chunk 契约（推理 / thinking）', () => {
  it('reasoning-delta 累积发送 THINKING_DELTA，结尾补 THINKING_COMPLETE', async () => {
    const { chunks } = await runStream([
      { type: 'reasoning-delta', text: 'think A' },
      { type: 'reasoning-delta', text: ' think B' },
      { type: 'finish' },
    ]);

    expect(types(chunks)).toEqual([
      ChunkType.THINKING_DELTA,
      ChunkType.THINKING_DELTA,
      ChunkType.THINKING_COMPLETE,
    ]);
    expect((chunks[0] as any).text).toBe('think A');
    expect((chunks[1] as any).text).toBe('think A think B');
    expect((chunks[2] as any).text).toBe('think A think B');
  });

  it('raw chunk 里的 reasoning_content 也映射为 THINKING_DELTA', async () => {
    const { chunks } = await runStream([
      {
        type: 'raw',
        rawValue: { choices: [{ delta: { reasoning_content: 'R1' } }] },
      },
      { type: 'finish' },
    ]);

    expect(types(chunks)).toEqual([
      ChunkType.THINKING_DELTA,
      ChunkType.THINKING_COMPLETE,
    ]);
    expect((chunks[0] as any).text).toBe('R1');
  });

  it('文本与推理交错：各自累积，结尾 TEXT_COMPLETE 在 THINKING_COMPLETE 之前', async () => {
    const { chunks } = await runStream([
      { type: 'reasoning-delta', text: 'r' },
      { type: 'text-delta', text: 'hi' },
      { type: 'finish' },
    ]);

    expect(types(chunks)).toEqual([
      ChunkType.THINKING_DELTA,
      ChunkType.TEXT_DELTA,
      ChunkType.TEXT_COMPLETE,
      ChunkType.THINKING_COMPLETE,
    ]);
  });
});

describe('AI SDK streamCompletion — Chunk 契约（工具调用）', () => {
  it('tool-call 发送 MCP_TOOL_CREATED，且有工具时跳过 TEXT_COMPLETE', async () => {
    const { chunks, result } = await runStream([
      { type: 'text-delta', text: 'use a tool' },
      {
        type: 'tool-call',
        toolCallId: 'call_1',
        toolName: 'search',
        input: { q: 'x' },
      },
      { type: 'finish' },
    ]);

    const t = types(chunks);
    expect(t).toContain(ChunkType.MCP_TOOL_CREATED);
    expect(t).toContain(ChunkType.TEXT_DELTA);
    // 关键契约：检测到工具调用时，streamCompletion 不发 TEXT_COMPLETE，
    // 由 provider 在多轮循环里控制最终发送（防止重复创建块）
    expect(t).not.toContain(ChunkType.TEXT_COMPLETE);
    expect(t).not.toContain(ChunkType.THINKING_COMPLETE);

    const toolChunk = chunks.find((c) => c.type === ChunkType.MCP_TOOL_CREATED) as any;
    expect(toolChunk.responses[0]).toMatchObject({
      id: 'call_1',
      name: 'search',
      arguments: { q: 'x' },
      status: 'pending',
    });
    expect(result.hasToolCalls).toBe(true);
    expect(result.nativeToolCalls?.[0]).toMatchObject({
      id: 'call_1',
      type: 'function',
      function: { name: 'search' },
    });
  });
});

// ---------------------------------------------------------------------------
// 非流式路径：nonStreamCompletion 不直接发 onChunk（发送在 provider.ts），
// 它的契约是 generateText 结果 → StreamResult 的映射。这是 provider 据以发出
// TEXT_COMPLETE / THINKING_COMPLETE 的数据源，故同样需要钉死。
// ---------------------------------------------------------------------------
async function runNonStream(genResult: Record<string, unknown>) {
  generateTextMock.mockResolvedValue(genResult);
  const fakeClient = { chat: () => ({}), responses: () => ({}) } as any;
  return nonStreamCompletion(
    fakeClient,
    'gpt-test',
    [{ role: 'user', content: 'hi' }],
  );
}

describe('AI SDK nonStreamCompletion — StreamResult 契约', () => {
  it('纯文本：content = result.text，无推理、无工具', async () => {
    const r = await runNonStream({ text: 'Hello', toolCalls: [] });
    expect(r.content).toBe('Hello');
    expect(r.reasoning).toBeUndefined();
    expect(r.hasToolCalls).toBe(false);
    expect(r.reasoningTime).toBeUndefined();
  });

  it('带推理：reasoning 透传，reasoningTime 被赋值', async () => {
    const r = await runNonStream({ text: 'Hi', reasoning: 'because', toolCalls: [] });
    expect(r.content).toBe('Hi');
    expect(r.reasoning).toBe('because');
    expect(typeof r.reasoningTime).toBe('number');
  });

  it('带工具调用：hasToolCalls=true 且 nativeToolCalls 透传', async () => {
    const toolCalls = [{ toolCallId: 'c1', toolName: 'search', input: { q: 'x' } }];
    const r = await runNonStream({ text: '', toolCalls });
    expect(r.hasToolCalls).toBe(true);
    expect(r.nativeToolCalls).toBe(toolCalls);
  });
});
