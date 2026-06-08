import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ChunkType } from '../../../types/chunk';
import { runAisdkStreamContractSuite, makeAisdkHarness } from '../../__tests__/shared/aisdkStreamContract';

// Phase 0 — Chunk 契约特征测试（OpenAI AI SDK 流式路径）。公共用例走共享套件，
// 本文件只额外保留 OpenAI 特有的两条推理通道。见 README.md §2.5。
const streamTextMock = vi.fn();
const generateTextMock = vi.fn();
vi.mock('ai', () => ({ streamText: (...a: unknown[]) => streamTextMock(...a), generateText: (...a: unknown[]) => generateTextMock(...a) }));
vi.mock('../../../store', () => ({ default: { getState: () => ({ settings: { providers: [] } }) } }));
vi.mock('../../../services/infra/LoggerService', () => ({ logApiRequest: vi.fn() }));
vi.mock('../../../services/infra/EventEmitter', () => ({ EventEmitter: { emit: vi.fn() }, EVENT_NAMES: new Proxy({}, { get: (_t, p) => String(p) }) }));

import { streamCompletion, nonStreamCompletion } from '../stream';

const h = makeAisdkHarness(streamTextMock, generateTextMock, 'gpt-test');

beforeEach(() => {
  streamTextMock.mockReset();
  generateTextMock.mockReset();
});

runAisdkStreamContractSuite({
  label: 'OpenAI AISDK',
  modelId: 'gpt-test',
  streamCompletion,
  nonStreamCompletion,
  setStream: h.setStream,
  setGenerate: h.setGenerate,
});

// OpenAI 特有：原生 reasoning-delta + 第三方兼容供应商的 raw.reasoning_content
describe('OpenAI AISDK streamCompletion — 推理通道（特有）', () => {
  it('reasoning-delta 累积发送 THINKING_DELTA，结尾补 THINKING_COMPLETE', async () => {
    const { chunks, types } = await h.runStream(streamCompletion, [
      { type: 'reasoning-delta', text: 'think A' },
      { type: 'reasoning-delta', text: ' think B' },
      { type: 'finish' },
    ]);

    expect(types).toEqual([ChunkType.THINKING_DELTA, ChunkType.THINKING_DELTA, ChunkType.THINKING_COMPLETE]);
    expect((chunks[1] as any).text).toBe('think A think B');
  });

  it('raw chunk 里的 reasoning_content 也映射为 THINKING_DELTA（DeepSeek 等兼容供应商）', async () => {
    const { chunks, types } = await h.runStream(streamCompletion, [
      { type: 'raw', rawValue: { choices: [{ delta: { reasoning_content: 'R1' } }] } },
      { type: 'finish' },
    ]);

    expect(types).toEqual([ChunkType.THINKING_DELTA, ChunkType.THINKING_COMPLETE]);
    expect((chunks[0] as any).text).toBe('R1');
  });

  it('文本与推理交错：结尾 TEXT_COMPLETE 在 THINKING_COMPLETE 之前', async () => {
    const { types } = await h.runStream(streamCompletion, [
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
