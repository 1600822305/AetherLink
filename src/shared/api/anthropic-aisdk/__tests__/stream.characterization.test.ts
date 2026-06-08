import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ChunkType } from '../../../types/chunk';
import { runAisdkStreamContractSuite, makeAisdkHarness } from '../../__tests__/shared/aisdkStreamContract';

// Phase 0 — Chunk 契约特征测试（Anthropic AI SDK 流式路径）。公共用例走共享套件，
// 本文件只额外保留 Claude Extended Thinking 的原生 reasoning-delta。见 README.md §2.5。
const streamTextMock = vi.fn();
const generateTextMock = vi.fn();
vi.mock('ai', () => ({ streamText: (...a: unknown[]) => streamTextMock(...a), generateText: (...a: unknown[]) => generateTextMock(...a) }));
vi.mock('../../../services/infra/LoggerService', () => ({ logApiRequest: vi.fn() }));
vi.mock('../../../services/infra/EventEmitter', () => ({ EventEmitter: { emit: vi.fn() }, EVENT_NAMES: new Proxy({}, { get: (_t, p) => String(p) }) }));

import { streamCompletion, nonStreamCompletion } from '../stream';

const h = makeAisdkHarness(streamTextMock, generateTextMock, 'claude-test');

beforeEach(() => {
  streamTextMock.mockReset();
  generateTextMock.mockReset();
});

runAisdkStreamContractSuite({
  label: 'Anthropic AISDK',
  modelId: 'claude-test',
  streamCompletion,
  nonStreamCompletion,
  setStream: h.setStream,
  setGenerate: h.setGenerate,
});

describe('Anthropic AISDK streamCompletion — Extended Thinking（特有）', () => {
  it('reasoning-delta 累积发 THINKING_DELTA，转正文后结尾发 THINKING_COMPLETE', async () => {
    const { chunks, types } = await h.runStream(streamCompletion, [
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
