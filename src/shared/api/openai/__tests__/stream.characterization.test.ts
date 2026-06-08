import { describe, it, expect, vi, beforeEach } from 'vitest';

// 轻量 mock：避免拉起真实 store / 日志 / 事件总线副作用。
vi.mock('../../../services/infra/EventEmitter', () => ({
  EventEmitter: { emit: vi.fn() },
  EVENT_NAMES: new Proxy({}, { get: (_t, p) => String(p) }),
}));

import { UnifiedStreamProcessor } from '../unifiedStreamProcessor';
import { ChunkType } from '../../../types/chunk';
import type { Chunk } from '../../../types/chunk';
import type { Model } from '../../../types';

const fakeModel = { id: 'gpt-test', name: 'gpt-test', provider: 'openai' } as unknown as Model;

// 把 OpenAI SDK 风格的 chunk（choices[0].delta.*）包成 async iterable
async function* openAIChunks(deltas: Array<Record<string, unknown>>) {
  for (const delta of deltas) {
    yield { choices: [{ delta, finish_reason: null }] };
  }
}

async function runProcessor(
  deltas: Array<Record<string, unknown>>,
  extra: Record<string, unknown> = {},
) {
  const chunks: Chunk[] = [];
  const proc = new UnifiedStreamProcessor({
    model: fakeModel,
    onChunk: (c: Chunk) => {
      chunks.push(c);
    },
    ...extra,
  } as any);
  const result = await proc.processStream(openAIChunks(deltas));
  return { chunks, result };
}

const types = (chunks: Chunk[]) => chunks.map((c) => c.type);

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// 官方 openai SDK 路径（删除目标）：UnifiedStreamProcessor 负责"流式 DELTA"，
// 最终的 TEXT_COMPLETE / THINKING_COMPLETE 由 provider.ts 在 processStream 返回
// 后根据 result 发出（不在本处理器内）。本测试钉死 DELTA 契约与 result 映射，
// 迁移到 @ai-sdk/openai 前必须保证这条序列不变。
// ---------------------------------------------------------------------------
describe('官方 OpenAI UnifiedStreamProcessor — 流式 Chunk 契约（纯文本）', () => {
  it('delta.content 以累积语义发 TEXT_DELTA；处理器本身不发 TEXT_COMPLETE', async () => {
    const { chunks, result } = await runProcessor([
      { content: 'Hel' },
      { content: 'lo' },
    ]);

    const t = types(chunks);
    expect(t).toContain(ChunkType.TEXT_DELTA);
    // 累积语义：最后一个 TEXT_DELTA 携带完整内容
    const textDeltas = chunks.filter((c) => c.type === ChunkType.TEXT_DELTA) as any[];
    expect(textDeltas[textDeltas.length - 1].text).toBe('Hello');
    // 处理器内 finish 分支不被本管线触发 → 不发 TEXT_COMPLETE（由 provider.ts 负责）
    expect(t).not.toContain(ChunkType.TEXT_COMPLETE);
    expect(t).not.toContain(ChunkType.THINKING_DELTA);

    expect(result.content).toBe('Hello');
    expect(result.hasToolCalls).toBeUndefined();
  });
});

describe('官方 OpenAI UnifiedStreamProcessor — 推理（reasoning_content）', () => {
  it('delta.reasoning_content 以累积语义发 THINKING_DELTA', async () => {
    const { chunks, result } = await runProcessor([
      { reasoning_content: 'be' },
      { reasoning_content: 'cause' },
    ]);

    const t = types(chunks);
    expect(t).toContain(ChunkType.THINKING_DELTA);
    const thinkDeltas = chunks.filter((c) => c.type === ChunkType.THINKING_DELTA) as any[];
    expect(thinkDeltas[thinkDeltas.length - 1].text).toBe('because');
    expect(result.reasoning).toBe('because');
  });

  it('推理后转文本：第一段文本到达时先补发 THINKING_COMPLETE，再发 TEXT_DELTA', async () => {
    const { chunks } = await runProcessor([
      { reasoning_content: 'think' },
      { content: 'answer' },
    ]);

    const t = types(chunks);
    // 顺序：THINKING_DELTA … → THINKING_COMPLETE → TEXT_DELTA
    const idxThinkComplete = t.indexOf(ChunkType.THINKING_COMPLETE);
    const idxTextDelta = t.indexOf(ChunkType.TEXT_DELTA);
    expect(idxThinkComplete).toBeGreaterThanOrEqual(0);
    expect(idxTextDelta).toBeGreaterThan(idxThinkComplete);
    const complete = chunks.find((c) => c.type === ChunkType.THINKING_COMPLETE) as any;
    expect(complete.text).toBe('think');
  });
});

describe('官方 OpenAI UnifiedStreamProcessor — 原生工具调用', () => {
  it('delta.tool_calls 积累进 result.nativeToolCalls，hasToolCalls=true，流式阶段不发 MCP_TOOL_*', async () => {
    const { chunks, result } = await runProcessor([
      {
        tool_calls: [
          {
            index: 0,
            id: 'call_1',
            type: 'function',
            function: { name: 'search', arguments: '{"q":"x"}' },
          },
        ],
      },
    ]);

    const t = types(chunks);
    // 处理器在流式阶段不发 MCP_TOOL_* —— 由 provider.ts 在 buildResult 后统一发
    expect(t).not.toContain(ChunkType.MCP_TOOL_CREATED);
    expect(result.hasToolCalls).toBe(true);
    expect(result.nativeToolCalls?.[0]).toMatchObject({
      id: 'call_1',
      type: 'function',
      function: { name: 'search', arguments: '{"q":"x"}' },
    });
  });

  it('增量 tool_calls 跨 chunk 合并 name/arguments', async () => {
    const { result } = await runProcessor([
      { tool_calls: [{ index: 0, id: 'c1', type: 'function', function: { name: 'sea', arguments: '{"q":' } }] },
      { tool_calls: [{ index: 0, function: { name: 'rch', arguments: '"x"}' } }] },
    ]);

    expect(result.nativeToolCalls?.[0].function).toMatchObject({
      name: 'search',
      arguments: '{"q":"x"}',
    });
  });
});
