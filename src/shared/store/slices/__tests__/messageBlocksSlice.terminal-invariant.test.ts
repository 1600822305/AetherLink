import { describe, it, expect } from 'vitest';
import reducer, { updateOneBlock, updateManyBlocks, addOneBlock } from '../messageBlocksSlice';
import { MessageBlockStatus, MessageBlockType } from '../../../types/newMessage';
import type { MessageBlock } from '../../../types/newMessage';

/** 创建一个最小 MessageBlock 用于测试 */
function makeBlock(id: string, status: MessageBlockStatus): MessageBlock {
  return {
    id,
    messageId: 'msg-1',
    type: MessageBlockType.MAIN_TEXT,
    content: 'test',
    createdAt: new Date().toISOString(),
    status,
  } as MessageBlock;
}

/** 在空 state 中插入一个块，返回含该块的 state */
function stateWithBlock(block: MessageBlock) {
  const empty = reducer(undefined, { type: '@@INIT' });
  return reducer(empty, addOneBlock(block));
}

describe('messageBlocksSlice — 终态不可逆守卫', () => {
  // 1. 终态块收到非终态 status → 被丢弃
  it('终态(success)块收到 status:streaming 的 updateOneBlock → 状态仍是 success', () => {
    const block = makeBlock('b1', MessageBlockStatus.SUCCESS);
    const state = stateWithBlock(block);

    const next = reducer(state, updateOneBlock({
      id: 'b1',
      changes: { status: MessageBlockStatus.STREAMING },
    }));

    expect(next.entities['b1']!.status).toBe(MessageBlockStatus.SUCCESS);
  });

  // 2. 终态→终态合法（success→error）
  it('终态(success)块收到 status:error 的 update → 状态变 error', () => {
    const block = makeBlock('b1', MessageBlockStatus.SUCCESS);
    const state = stateWithBlock(block);

    const next = reducer(state, updateOneBlock({
      id: 'b1',
      changes: { status: MessageBlockStatus.ERROR },
    }));

    expect(next.entities['b1']!.status).toBe(MessageBlockStatus.ERROR);
  });

  // 3. 非终态→非终态合法
  it('非终态(streaming)块收到 status:streaming 的 update → 正常应用', () => {
    const block = makeBlock('b1', MessageBlockStatus.STREAMING);
    const state = stateWithBlock(block);

    const next = reducer(state, updateOneBlock({
      id: 'b1',
      changes: { status: MessageBlockStatus.STREAMING, content: 'updated' } as Partial<MessageBlock>,
    }));

    expect(next.entities['b1']!.status).toBe(MessageBlockStatus.STREAMING);
    expect((next.entities['b1'] as any).content).toBe('updated');
  });

  // 4. 非终态→终态合法（正常收尾）
  it('非终态(streaming)块收到 status:success 的 update → 变 success', () => {
    const block = makeBlock('b1', MessageBlockStatus.STREAMING);
    const state = stateWithBlock(block);

    const next = reducer(state, updateOneBlock({
      id: 'b1',
      changes: { status: MessageBlockStatus.SUCCESS },
    }));

    expect(next.entities['b1']!.status).toBe(MessageBlockStatus.SUCCESS);
  });

  // 5. updateManyBlocks 混合合法+非法 → 只应用合法那条
  it('updateManyBlocks 混合一条合法+一条非法回退 → 只应用合法那条', () => {
    const b1 = makeBlock('b1', MessageBlockStatus.SUCCESS);
    const b2 = makeBlock('b2', MessageBlockStatus.STREAMING);
    let state = stateWithBlock(b1);
    state = reducer(state, addOneBlock(b2));

    const next = reducer(state, updateManyBlocks([
      { id: 'b1', changes: { status: MessageBlockStatus.STREAMING } },   // 非法：终态→非终态
      { id: 'b2', changes: { status: MessageBlockStatus.SUCCESS } },     // 合法：非终态→终态
    ]));

    expect(next.entities['b1']!.status).toBe(MessageBlockStatus.SUCCESS);   // 未被改动
    expect(next.entities['b2']!.status).toBe(MessageBlockStatus.SUCCESS);   // 正常应用
  });

  // 6. update 不含 status（只改 content）→ 正常应用
  it('update 不含 status 字段（只改 content）→ 正常应用', () => {
    const block = makeBlock('b1', MessageBlockStatus.SUCCESS);
    const state = stateWithBlock(block);

    const next = reducer(state, updateOneBlock({
      id: 'b1',
      changes: { content: 'new content' } as Partial<MessageBlock>,
    }));

    expect(next.entities['b1']!.status).toBe(MessageBlockStatus.SUCCESS);
    expect((next.entities['b1'] as any).content).toBe('new content');
  });
});
