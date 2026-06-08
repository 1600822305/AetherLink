import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ChunkType } from '../../types/chunk';
import { runAisdkStreamContractSuite, makeAisdkHarness } from './shared/aisdkStreamContract';

// ---------------------------------------------------------------------------
// Phase 0 — Chunk 契约特征测试（三家 AI SDK 流式路径合并文件）
//
// openai-aisdk / anthropic-aisdk / gemini-aisdk 的 streamCompletion 结构同构，
// 都把 `ai` 的 streamText/generateText fullStream 转成 onChunk(Chunk) 序列。
// 为避免重复 mock 样板（SonarCloud 新代码重复率门禁），三家在同一文件里 mock
// 一次、循环跑共享套件 runAisdkStreamContractSuite，再各自补特有的推理用例。
// 见 plans/ai-provider-refactor/README.md §2.5。
// ---------------------------------------------------------------------------

const streamTextMock = vi.fn();
const generateTextMock = vi.fn();
vi.mock('ai', () => ({
  streamText: (...a: unknown[]) => streamTextMock(...a),
  generateText: (...a: unknown[]) => generateTextMock(...a),
}));
vi.mock('../../store', () => ({ default: { getState: () => ({ settings: { providers: [] } }) } }));
vi.mock('../../services/infra/LoggerService', () => ({ logApiRequest: vi.fn() }));
vi.mock('../../services/infra/EventEmitter', () => ({
  EventEmitter: { emit: vi.fn() },
  EVENT_NAMES: new Proxy({}, { get: (_t, p) => String(p) }),
}));

import { streamCompletion as openaiStream, nonStreamCompletion as openaiNonStream } from '../openai-aisdk/stream';
import { streamCompletion as anthropicStream, nonStreamCompletion as anthropicNonStream } from '../../ai/adapters/anthropic/stream';
import { streamCompletion as geminiStream, nonStreamCompletion as geminiNonStream } from '../gemini-aisdk/stream';

beforeEach(() => {
  streamTextMock.mockReset();
  generateTextMock.mockReset();
});

// 三家共享契约：纯文本 / 空响应 / 工具调用 / 非流式结果映射
const providers = [
  { label: 'OpenAI AISDK', modelId: 'gpt-test', streamCompletion: openaiStream, nonStreamCompletion: openaiNonStream },
  { label: 'Anthropic AISDK', modelId: 'claude-test', streamCompletion: anthropicStream, nonStreamCompletion: anthropicNonStream },
  { label: 'Gemini AISDK', modelId: 'gemini-test', streamCompletion: geminiStream, nonStreamCompletion: geminiNonStream },
];

for (const p of providers) {
  const h = makeAisdkHarness(streamTextMock, generateTextMock, p.modelId);
  runAisdkStreamContractSuite({
    label: p.label,
    modelId: p.modelId,
    streamCompletion: p.streamCompletion,
    nonStreamCompletion: p.nonStreamCompletion,
    setStream: h.setStream,
    setGenerate: h.setGenerate,
  });
}

// --- OpenAI 特有：原生 reasoning-delta + 第三方兼容供应商的 raw.reasoning_content ---
describe('OpenAI AISDK streamCompletion — 推理通道（特有）', () => {
  const h = makeAisdkHarness(streamTextMock, generateTextMock, 'gpt-test');

  it('reasoning-delta 累积发送 THINKING_DELTA，结尾补 THINKING_COMPLETE', async () => {
    const { chunks, types } = await h.runStream(openaiStream, [
      { type: 'reasoning-delta', text: 'think A' },
      { type: 'reasoning-delta', text: ' think B' },
      { type: 'finish' },
    ]);
    expect(types).toEqual([ChunkType.THINKING_DELTA, ChunkType.THINKING_DELTA, ChunkType.THINKING_COMPLETE]);
    expect((chunks[1] as any).text).toBe('think A think B');
  });

  it('raw chunk 里的 reasoning_content 也映射为 THINKING_DELTA（DeepSeek 等兼容供应商）', async () => {
    const { chunks, types } = await h.runStream(openaiStream, [
      { type: 'raw', rawValue: { choices: [{ delta: { reasoning_content: 'R1' } }] } },
      { type: 'finish' },
    ]);
    expect(types).toEqual([ChunkType.THINKING_DELTA, ChunkType.THINKING_COMPLETE]);
    expect((chunks[0] as any).text).toBe('R1');
  });

  it('文本与推理交错：结尾 TEXT_COMPLETE 在 THINKING_COMPLETE 之前', async () => {
    const { types } = await h.runStream(openaiStream, [
      { type: 'reasoning-delta', text: 'r' },
      { type: 'text-delta', text: 'hi' },
      { type: 'finish' },
    ]);
    expect(types).toEqual([
      ChunkType.THINKING_DELTA,
      ChunkType.TEXT_DELTA,
      ChunkType.TEXT_COMPLETE,
      ChunkType.THINKING_COMPLETE,
    ]);
  });
});

// --- Anthropic 特有：Claude Extended Thinking 原生 reasoning-delta ---
describe('Anthropic AISDK streamCompletion — Extended Thinking（特有）', () => {
  const h = makeAisdkHarness(streamTextMock, generateTextMock, 'claude-test');

  it('reasoning-delta 累积发 THINKING_DELTA，转正文后结尾发唯一 THINKING/TEXT_COMPLETE', async () => {
    const { chunks, types } = await h.runStream(anthropicStream, [
      { type: 'reasoning-delta', text: 'th' },
      { type: 'reasoning-delta', text: 'ink' },
      { type: 'text-delta', text: 'answer' },
      { type: 'finish' },
    ]);
    const thinkDeltas = chunks.filter((c) => c.type === ChunkType.THINKING_DELTA) as any[];
    expect(thinkDeltas[thinkDeltas.length - 1].text).toBe('think');
    expect(types.filter((x) => x === ChunkType.THINKING_COMPLETE)).toHaveLength(1);
    expect(types.filter((x) => x === ChunkType.TEXT_COMPLETE)).toHaveLength(1);
  });
});

// --- Gemini 特有：THINKING_COMPLETE 时机（首个 text-delta 触发 vs 结尾补发）---
describe('Gemini AISDK streamCompletion — 思考时机（特有）', () => {
  const h = makeAisdkHarness(streamTextMock, generateTextMock, 'gemini-test');

  it('只有 reasoning（无正文）：结尾补发唯一 THINKING_COMPLETE，不发 TEXT_COMPLETE', async () => {
    const { chunks, types } = await h.runStream(geminiStream, [
      { type: 'reasoning-delta', text: 'th' },
      { type: 'reasoning-delta', text: 'ink' },
      { type: 'finish' },
    ]);
    expect(types).toContain(ChunkType.THINKING_DELTA);
    expect(types.filter((x) => x === ChunkType.THINKING_COMPLETE)).toHaveLength(1);
    expect(types).not.toContain(ChunkType.TEXT_COMPLETE);
    const thinkDeltas = chunks.filter((c) => c.type === ChunkType.THINKING_DELTA) as any[];
    expect(thinkDeltas[thinkDeltas.length - 1].text).toBe('think');
  });

  it('reasoning 后转正文：首个 text-delta 触发 THINKING_COMPLETE，且不重复发', async () => {
    const { types } = await h.runStream(geminiStream, [
      { type: 'reasoning-delta', text: 'think' },
      { type: 'text-delta', text: 'answer' },
      { type: 'finish' },
    ]);
    expect(types.indexOf(ChunkType.TEXT_DELTA)).toBeGreaterThan(types.indexOf(ChunkType.THINKING_COMPLETE));
    expect(types.indexOf(ChunkType.THINKING_COMPLETE)).toBeGreaterThanOrEqual(0);
    expect(types.filter((x) => x === ChunkType.THINKING_COMPLETE)).toHaveLength(1);
    expect(types.filter((x) => x === ChunkType.TEXT_COMPLETE)).toHaveLength(1);
  });
});
