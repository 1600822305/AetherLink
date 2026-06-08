import { describe, it, expect, beforeEach, vi } from 'vitest';

// 「响应收尾单一不变量」单测。
//
// 历史上 complete / 中断 / 出错 三条路径各自只收尾一部分块，导致中断/出错后
// 思考块停留 streaming → 计时不停。finalizeNonTerminalBlocks 把「所有非终态块
// 推进到终态」收口成一处，这里钉死它的关键性质：
//   - 收尾后无非终态块（不变量）
//   - 幂等（重复调用无副作用）
//   - 思考块盖最终时长（时间戳派生）
//   - skipBlockIds 跳过调用方已单独处理的块

// ---- 用内存态替身 mock 掉 store / dexie / action，做纯逻辑单测 ----
const state = {
  messages: { entities: {} as Record<string, any> },
  messageBlocks: { entities: {} as Record<string, any> }
};
const dexieUpdates: { id: string; changes: any }[] = [];

vi.mock('../../../../store', () => ({
  default: {
    getState: () => state,
    dispatch: (action: any) => {
      if (action?.__updateOneBlock) {
        const { id, changes } = action.payload;
        state.messageBlocks.entities[id] = { ...state.messageBlocks.entities[id], ...changes };
      }
    }
  }
}));

vi.mock('../../../storage/DexieStorageService', () => ({
  dexieStorage: {
    updateMessageBlock: (id: string, changes: any) => {
      dexieUpdates.push({ id, changes });
      return Promise.resolve();
    }
  }
}));

vi.mock('../../../../store/slices/messageBlocksSlice', () => ({
  updateOneBlock: (payload: any) => ({ __updateOneBlock: true, payload })
}));

import { finalizeNonTerminalBlocks } from '../blockFinalization';
import { MessageBlockStatus, MessageBlockType, isTerminalBlockStatus } from '../../../../types/newMessage';

function setup(blocks: any[]) {
  state.messages.entities = { m1: { id: 'm1', blocks: blocks.map((b) => b.id) } };
  state.messageBlocks.entities = Object.fromEntries(blocks.map((b) => [b.id, b]));
  dexieUpdates.length = 0;
}

const NOW = '2026-06-08T20:00:10.000Z'; // 比下面 createdAt 晚 10s

describe('finalizeNonTerminalBlocks — 收尾不变量', () => {
  beforeEach(() => {
    state.messages.entities = {};
    state.messageBlocks.entities = {};
    dexieUpdates.length = 0;
  });

  it('中断含思考块：思考块 + 文本块都被收尾为终态，思考块盖最终时长', async () => {
    setup([
      {
        id: 'think1',
        messageId: 'm1',
        type: MessageBlockType.THINKING,
        status: MessageBlockStatus.STREAMING,
        createdAt: '2026-06-08T20:00:00.000Z',
        thinkingStartTime: Date.parse('2026-06-08T20:00:00.000Z'),
        thinking_millsec: 0,
        content: '想一想'
      },
      {
        id: 'text1',
        messageId: 'm1',
        type: MessageBlockType.MAIN_TEXT,
        status: MessageBlockStatus.STREAMING,
        createdAt: '2026-06-08T20:00:05.000Z',
        content: '答案'
      }
    ]);

    const finalized = await finalizeNonTerminalBlocks('m1', { now: NOW });

    expect(finalized).toBe(2);
    expect(state.messageBlocks.entities.think1.status).toBe(MessageBlockStatus.SUCCESS);
    expect(state.messageBlocks.entities.text1.status).toBe(MessageBlockStatus.SUCCESS);
    // 思考时长按时间戳派生：20:00:10 − 20:00:00 = 10000ms
    expect(state.messageBlocks.entities.think1.thinking_millsec).toBe(10000);
    // Redux 与 Dexie 一致：两块都写库
    expect(dexieUpdates.map((u) => u.id).sort()).toEqual(['text1', 'think1']);
  });

  it('收尾后不存在任何非终态块（不变量）', async () => {
    setup([
      { id: 'a', messageId: 'm1', type: MessageBlockType.MAIN_TEXT, status: MessageBlockStatus.PENDING, createdAt: NOW, content: '' },
      { id: 'b', messageId: 'm1', type: MessageBlockType.THINKING, status: MessageBlockStatus.PROCESSING, createdAt: NOW, content: '' },
      { id: 'c', messageId: 'm1', type: MessageBlockType.TOOL, status: MessageBlockStatus.STREAMING, createdAt: NOW, content: '' }
    ]);

    await finalizeNonTerminalBlocks('m1', { now: NOW });

    for (const id of ['a', 'b', 'c']) {
      expect(isTerminalBlockStatus(state.messageBlocks.entities[id].status)).toBe(true);
    }
  });

  it('幂等：已终态块跳过；重复调用返回 0 且不再写库', async () => {
    setup([
      { id: 'ok', messageId: 'm1', type: MessageBlockType.MAIN_TEXT, status: MessageBlockStatus.SUCCESS, createdAt: NOW, content: 'done' },
      { id: 'run', messageId: 'm1', type: MessageBlockType.MAIN_TEXT, status: MessageBlockStatus.STREAMING, createdAt: NOW, content: 'x' }
    ]);

    const first = await finalizeNonTerminalBlocks('m1', { now: NOW });
    expect(first).toBe(1); // 只收尾 run，跳过已 SUCCESS 的 ok
    expect(dexieUpdates.map((u) => u.id)).toEqual(['run']);

    dexieUpdates.length = 0;
    const second = await finalizeNonTerminalBlocks('m1', { now: NOW });
    expect(second).toBe(0); // 全部终态，no-op
    expect(dexieUpdates).toEqual([]);
  });

  it('skipBlockIds：跳过调用方已单独处理的块', async () => {
    setup([
      { id: 'main', messageId: 'm1', type: MessageBlockType.MAIN_TEXT, status: MessageBlockStatus.STREAMING, createdAt: NOW, content: 'm' },
      { id: 'think', messageId: 'm1', type: MessageBlockType.THINKING, status: MessageBlockStatus.STREAMING, createdAt: NOW, content: 't' }
    ]);

    const finalized = await finalizeNonTerminalBlocks('m1', { now: NOW, skipBlockIds: ['main'] });

    expect(finalized).toBe(1);
    expect(dexieUpdates.map((u) => u.id)).toEqual(['think']);
    // main 未被触碰
    expect(state.messageBlocks.entities.main.status).toBe(MessageBlockStatus.STREAMING);
  });

  it('思考时长优先级：已有有效值 > 兜底值 > 时间戳推算', async () => {
    // 已有有效值：保留
    setup([{ id: 't', messageId: 'm1', type: MessageBlockType.THINKING, status: MessageBlockStatus.STREAMING, createdAt: '2026-06-08T20:00:00.000Z', thinking_millsec: 4200, content: '' }]);
    await finalizeNonTerminalBlocks('m1', { now: NOW, thinkingDurationMs: 9999 });
    expect(state.messageBlocks.entities.t.thinking_millsec).toBe(4200);

    // 无已有值 → 用兜底值
    setup([{ id: 't', messageId: 'm1', type: MessageBlockType.THINKING, status: MessageBlockStatus.STREAMING, createdAt: '2026-06-08T20:00:00.000Z', thinking_millsec: 0, content: '' }]);
    await finalizeNonTerminalBlocks('m1', { now: NOW, thinkingDurationMs: 7777 });
    expect(state.messageBlocks.entities.t.thinking_millsec).toBe(7777);

    // 无已有值、无兜底 → 按 createdAt/now 推算（10s）
    setup([{ id: 't', messageId: 'm1', type: MessageBlockType.THINKING, status: MessageBlockStatus.STREAMING, createdAt: '2026-06-08T20:00:00.000Z', content: '' }]);
    await finalizeNonTerminalBlocks('m1', { now: NOW });
    expect(state.messageBlocks.entities.t.thinking_millsec).toBe(10000);
  });
});
