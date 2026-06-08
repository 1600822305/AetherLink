import { describe, it, expect } from 'vitest';
import { StreamIncrementTracker } from '../StreamIncrementTracker';

// 归一化边界的核心单测：把上游「累积全文 / 增量」统一归一成增量。
//
// 这是两次重构（信息块 + API 架构）的接缝，必须钉死语义：
//   - 累积语义（官方 OpenAI SDK）：每个 chunk 携带从头到现在的全文。
//   - 增量语义（Vercel AI SDK 的 text-delta / reasoning-delta）：每个 chunk 是新增片段。
// 两者归一后，块层只需 append，永远不会重复。

describe('StreamIncrementTracker — 累积语义（cumulative，官方 OpenAI 行为）', () => {
  it('单调增长的累积全文被正确差分成增量，拼接后等于最终全文', () => {
    const t = new StreamIncrementTracker();
    const cumulativeFrames = ['Hello', 'Hello world', 'Hello world!'];

    const increments = cumulativeFrames.map((text) => {
      const { increment, newRound } = t.next({ text });
      expect(newRound).toBe(false);
      return increment;
    });

    expect(increments).toEqual(['Hello', ' world', '!']);
    expect(increments.join('')).toBe('Hello world!');
  });

  it('累积长度变短 → 判定为新一轮，增量为整个新文本', () => {
    const t = new StreamIncrementTracker();
    t.next({ text: 'first round answer' }); // prevLen = 18

    const { increment, newRound } = t.next({ text: 'new' }); // 变短
    expect(newRound).toBe(true);
    expect(increment).toBe('new');

    // 新一轮后继续单调增长，正常差分
    const next = t.next({ text: 'new round' });
    expect(next.newRound).toBe(false);
    expect(next.increment).toBe(' round');
  });

  it('相同长度（如 TEXT_COMPLETE 携带与最后一帧相同的全文）→ 增量为空', () => {
    const t = new StreamIncrementTracker();
    t.next({ text: 'done' });
    const { increment, newRound } = t.next({ text: 'done' });
    expect(newRound).toBe(false);
    expect(increment).toBe('');
  });
});

describe('StreamIncrementTracker — 增量语义（incremental，AI SDK 行为）', () => {
  it('增量片段直接透传为增量，且不会误判新一轮（修复重复渲染的关键）', () => {
    const t = new StreamIncrementTracker();
    // AI SDK 的 text-delta 片段长度忽长忽短：旧逻辑会把"变短"当新一轮 → 重复切块
    const deltas = ['Hello', ' world', '!', ' Bye'];

    const results = deltas.map((delta) => t.next({ delta }));

    expect(results.map((r) => r.increment)).toEqual(deltas);
    // 关键断言：增量序列永远不触发"新一轮"，因此不会重复建块
    expect(results.every((r) => r.newRound === false)).toBe(true);
  });

  it('isFirstChunk 在已有内容后作为「新一轮」的显式信号', () => {
    const t = new StreamIncrementTracker();
    t.next({ delta: 'round one' });

    const { increment, newRound } = t.next({ delta: 'round two', isFirstChunk: true });
    expect(newRound).toBe(true);
    expect(increment).toBe('round two');
  });

  it('isFirstChunk 作为整条流的第一片时不算新一轮', () => {
    const t = new StreamIncrementTracker();
    const { increment, newRound } = t.next({ delta: 'first piece', isFirstChunk: true });
    expect(newRound).toBe(false);
    expect(increment).toBe('first piece');
  });
});

describe('StreamIncrementTracker — reset 与混合', () => {
  it('reset 后从零重新差分累积全文', () => {
    const t = new StreamIncrementTracker();
    t.next({ text: 'abcdef' });
    t.reset();
    const { increment, newRound } = t.next({ text: 'abc' });
    expect(newRound).toBe(false); // reset 后 prevLen=0，'abc' 不算变短
    expect(increment).toBe('abc');
  });

  it('增量与累积混用时各自语义独立，拼接结果正确', () => {
    const t = new StreamIncrementTracker();
    // 先增量
    expect(t.next({ delta: 'AB' }).increment).toBe('AB'); // prevLen=2
    // 再来一帧累积全文（长度覆盖已处理部分）
    const r = t.next({ text: 'ABCDE' }); // prevLen 2 -> slice(2) = 'CDE'
    expect(r.newRound).toBe(false);
    expect(r.increment).toBe('CDE');
  });
});
