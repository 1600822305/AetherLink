import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ChunkType } from '../../../types/chunk';
import { runAisdkStreamContractSuite, makeAisdkHarness } from '../../__tests__/shared/aisdkStreamContract';

// Phase 0 — Chunk 契约特征测试（Gemini AI SDK 流式路径）。公共用例走共享套件，
// 本文件只额外保留 Gemini 特有的 THINKING_COMPLETE 时机。见 README.md §2.5。
const streamTextMock = vi.fn();
const generateTextMock = vi.fn();
vi.mock('ai', () => ({ streamText: (...a: unknown[]) => streamTextMock(...a), generateText: (...a: unknown[]) => generateTextMock(...a) }));
vi.mock('../../../store', () => ({ default: { getState: () => ({ settings: { providers: [] } }) } }));
vi.mock('../../../services/infra/LoggerService', () => ({ logApiRequest: vi.fn() }));
vi.mock('../../../services/infra/EventEmitter', () => ({ EventEmitter: { emit: vi.fn() }, EVENT_NAMES: new Proxy({}, { get: (_t, p) => String(p) }) }));

import { streamCompletion, nonStreamCompletion } from '../stream';

const h = makeAisdkHarness(streamTextMock, generateTextMock, 'gemini-test');

beforeEach(() => {
  streamTextMock.mockReset();
  generateTextMock.mockReset();
});

runAisdkStreamContractSuite({
  label: 'Gemini AISDK',
  modelId: 'gemini-test',
  streamCompletion,
  nonStreamCompletion,
  setStream: h.setStream,
  setGenerate: h.setGenerate,
});

describe('Gemini AISDK streamCompletion — 思考时机（特有）', () => {
  it('只有 reasoning（无正文）：结尾补发唯一 THINKING_COMPLETE，不发 TEXT_COMPLETE', async () => {
    const { chunks, types } = await h.runStream(streamCompletion, [
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
    const { types } = await h.runStream(streamCompletion, [
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
