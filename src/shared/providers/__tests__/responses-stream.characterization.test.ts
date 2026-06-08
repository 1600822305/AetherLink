import { describe, it, expect } from 'vitest';

import { OpenAIResponseProvider } from '../OpenAIResponseProvider';
import { ChunkType } from '../../types/chunk';
import type { Chunk } from '../../types/chunk';
import type { Usage, Metrics, MCPToolResponse } from '../../types';

// ---------------------------------------------------------------------------
// 特征测试（characterization）：OpenAI **Responses API** 路径
// (`OpenAIResponseProvider.processStream`)。
//
// 背景：Phase 0 的护栏覆盖了 4 条聊天路径（3 家 AI SDK + 官方 openai
// chat），但 Responses 路径此前 **0 覆盖**。它和官方 openai 共享 SDK/配置，
// 在 Phase 4 删官方 openai 聊天实现时极易被误伤。本测试把它当前的
// "Responses 事件 → onChunk(Chunk)" 序列钉死，作为后续重构的报警器。
//
// 这里直接钉死 `processStream` 的契约（流式事件分发 + 末尾收尾），不依赖
// 真实网络 / OpenAI SDK 实例 —— 用 `Object.create` 跳过构造器（构造器只做
// SDK/baseURL 初始化，`processStream` 仅用到 `this.handleToolCalls`，后者
// 不依赖任何实例状态）。
// ---------------------------------------------------------------------------

/** 把 Responses API 事件序列包成 async iterable（模拟 sdk.responses.create 的流） */
async function* responseEvents(events: Array<Record<string, unknown>>) {
  for (const ev of events) {
    yield ev;
  }
}

/** 在不触发构造器（不建真实 OpenAI SDK）的前提下，跑一遍 processStream，收集 Chunk 序列 */
async function runResponsesStream(events: Array<Record<string, unknown>>) {
  const provider = Object.create(OpenAIResponseProvider.prototype) as OpenAIResponseProvider;

  const chunks: Chunk[] = [];
  const onChunk = (c: Chunk) => {
    chunks.push(c);
  };

  const usage: Usage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 } as Usage;
  const metrics: Metrics = {} as Metrics;
  const toolResponses: MCPToolResponse[] = [];

  // processStream 是 protected —— 测试经类型擦除访问
  await (provider as any).processStream(
    responseEvents(events),
    onChunk,
    usage,
    metrics,
    toolResponses,
  );

  return { chunks, usage, metrics };
}

const types = (chunks: Chunk[]) => chunks.map((c) => c.type);

describe('OpenAI Responses 路径 — 纯文本流式契约', () => {
  it('output_text.delta 逐段发 TEXT_DELTA；output_text.done 发一次 TEXT_COMPLETE；末尾补 LLM_RESPONSE_COMPLETE', async () => {
    const { chunks } = await runResponsesStream([
      { type: 'response.created' },
      { type: 'response.output_text.delta', delta: 'Hel' },
      { type: 'response.output_text.delta', delta: 'lo' },
      { type: 'response.output_text.done', text: 'Hello' },
      { type: 'response.completed' },
    ]);

    expect(types(chunks)).toEqual([
      ChunkType.TEXT_DELTA,
      ChunkType.TEXT_DELTA,
      ChunkType.TEXT_COMPLETE,
      ChunkType.LLM_RESPONSE_COMPLETE,
    ]);

    const textDeltas = chunks.filter((c) => c.type === ChunkType.TEXT_DELTA) as any[];
    expect(textDeltas.map((c) => c.text)).toEqual(['Hel', 'lo']);
    const complete = chunks.find((c) => c.type === ChunkType.TEXT_COMPLETE) as any;
    expect(complete.text).toBe('Hello');
  });

  it('output_text.done 无 text 时不发 TEXT_COMPLETE（仅 delta + 末尾完成信号）', async () => {
    const { chunks } = await runResponsesStream([
      { type: 'response.output_text.delta', delta: 'hi' },
      { type: 'response.output_text.done' },
    ]);

    expect(types(chunks)).toEqual([
      ChunkType.TEXT_DELTA,
      ChunkType.LLM_RESPONSE_COMPLETE,
    ]);
  });
});

describe('OpenAI Responses 路径 — 推理（reasoning）契约', () => {
  it('reasoning.delta → THINKING_DELTA；reasoning.done → THINKING_COMPLETE（不像官方 chat 路径那样在转正文时自动补发）', async () => {
    const { chunks } = await runResponsesStream([
      { type: 'response.reasoning.delta', delta: 'be' },
      { type: 'response.reasoning.delta', delta: 'cause' },
      { type: 'response.reasoning.done', reasoning: 'because' },
      { type: 'response.output_text.delta', delta: 'answer' },
      { type: 'response.output_text.done', text: 'answer' },
    ]);

    expect(types(chunks)).toEqual([
      ChunkType.THINKING_DELTA,
      ChunkType.THINKING_DELTA,
      ChunkType.THINKING_COMPLETE,
      ChunkType.TEXT_DELTA,
      ChunkType.TEXT_COMPLETE,
      ChunkType.LLM_RESPONSE_COMPLETE,
    ]);

    const thinkComplete = chunks.find((c) => c.type === ChunkType.THINKING_COMPLETE) as any;
    expect(thinkComplete.text).toBe('because');
  });

  it('reasoning.delta 为空时跳过，不发 THINKING_DELTA', async () => {
    const { chunks } = await runResponsesStream([
      { type: 'response.reasoning.delta', delta: '' },
      { type: 'response.output_text.delta', delta: 'x' },
    ]);

    expect(types(chunks)).toEqual([
      ChunkType.TEXT_DELTA,
      ChunkType.LLM_RESPONSE_COMPLETE,
    ]);
  });
});

describe('OpenAI Responses 路径 — 工具调用契约', () => {
  it('function_call.done 累积工具，流末尾依次发 MCP_TOOL_IN_PROGRESS → MCP_TOOL_COMPLETE → LLM_RESPONSE_COMPLETE', async () => {
    const fnCall = { name: 'search', arguments: '{"q":"x"}' };
    const { chunks } = await runResponsesStream([
      { type: 'response.output_text.delta', delta: 'using tool' },
      { type: 'response.function_call.done', function_call: fnCall },
      { type: 'response.completed' },
    ]);

    expect(types(chunks)).toEqual([
      ChunkType.TEXT_DELTA,
      ChunkType.MCP_TOOL_IN_PROGRESS,
      ChunkType.MCP_TOOL_COMPLETE,
      ChunkType.LLM_RESPONSE_COMPLETE,
    ]);

    const inProgress = chunks.find((c) => c.type === ChunkType.MCP_TOOL_IN_PROGRESS) as any;
    const complete = chunks.find((c) => c.type === ChunkType.MCP_TOOL_COMPLETE) as any;
    expect(inProgress.responses).toEqual([fnCall]);
    expect(complete.responses).toEqual([fnCall]);
  });

  it('无工具调用时不发 MCP_TOOL_* 事件', async () => {
    const { chunks } = await runResponsesStream([
      { type: 'response.output_text.delta', delta: 'hi' },
    ]);

    expect(types(chunks)).not.toContain(ChunkType.MCP_TOOL_IN_PROGRESS);
    expect(types(chunks)).not.toContain(ChunkType.MCP_TOOL_COMPLETE);
  });
});

describe('OpenAI Responses 路径 — 状态事件 / 非标准 output 数组 / usage', () => {
  it('纯状态事件不产出内容 Chunk，只在末尾发 LLM_RESPONSE_COMPLETE', async () => {
    const { chunks } = await runResponsesStream([
      { type: 'response.created' },
      { type: 'response.in_progress' },
      { type: 'response.output_item.added' },
      { type: 'response.content_part.added' },
      { type: 'response.content_part.done' },
      { type: 'response.output_item.done' },
      { type: 'response.completed' },
    ]);

    expect(types(chunks)).toEqual([ChunkType.LLM_RESPONSE_COMPLETE]);
  });

  it('非标准 output 数组（default 分支）：message/output_text → TEXT_DELTA，reasoning → THINKING_DELTA', async () => {
    const { chunks } = await runResponsesStream([
      {
        type: 'unknown.aggregate',
        output: [
          { type: 'reasoning', content: 'thinking' },
          { type: 'message', content: [{ type: 'output_text', text: 'Hi there' }] },
        ],
      },
    ]);

    expect(types(chunks)).toEqual([
      ChunkType.THINKING_DELTA,
      ChunkType.TEXT_DELTA,
      ChunkType.LLM_RESPONSE_COMPLETE,
    ]);
    const textDelta = chunks.find((c) => c.type === ChunkType.TEXT_DELTA) as any;
    expect(textDelta.text).toBe('Hi there');
  });

  it('chunk.usage 映射到 finalUsage（output/input/total → completion/prompt/total）', async () => {
    const { usage } = await runResponsesStream([
      { type: 'response.output_text.delta', delta: 'x' },
      {
        type: 'response.completed',
        usage: { output_tokens: 5, input_tokens: 7, total_tokens: 12 },
      },
    ]);

    expect(usage.completionTokens).toBe(5);
    expect(usage.promptTokens).toBe(7);
    expect(usage.totalTokens).toBe(12);
  });
});
