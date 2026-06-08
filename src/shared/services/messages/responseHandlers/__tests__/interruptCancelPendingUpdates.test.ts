import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createResponseChunkProcessor } from '../ResponseChunkProcessor';
import { ChunkType } from '../../../../types/chunk';
import { MessageBlockStatus } from '../../../../types/newMessage';

// 回归测试：中断收尾的「死灰复燃」竞态。
//
// 流式思考块通过 lodash throttle + requestAnimationFrame 异步写 Redux。中断时
// 没有 THINKING_COMPLETE chunk，最后一帧 thinking 更新（status=streaming）可能
// 仍挂在 throttle/RAF 队列里，在 finalize 把块置 SUCCESS 之后才触发，把块重新
// 写回 streaming → ThinkingBlock 的 isThinking 又变 true → 计时器继续走。
//
// 修复：completeWithInterruption 收尾前调用 chunkProcessor.cancelPendingUpdates()，
// 取消所有挂起的 throttle/RAF。本测试钉死「取消后迟到的一帧不再写 streaming」。

describe('中断收尾 — cancelPendingUpdates 阻止迟到的 streaming 写回', () => {
  let rafCallbacks: Map<number, FrameRequestCallback>;
  let nextRafId: number;

  beforeEach(() => {
    rafCallbacks = new Map();
    nextRafId = 0;
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      const id = ++nextRafId;
      rafCallbacks.set(id, cb);
      return id;
    });
    vi.stubGlobal('cancelAnimationFrame', (id: number) => {
      rafCallbacks.delete(id);
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const flushRaf = () => {
    const cbs = [...rafCallbacks.values()];
    rafCallbacks.clear();
    cbs.forEach((cb) => cb(0));
  };

  const setup = () => {
    const dispatched: Array<{ type: string; payload: any }> = [];
    const store = {
      dispatch: (action: { type: string; payload: any }) => dispatched.push(action),
      getState: () => ({})
    };
    const storage = {
      updateMessageBlock: vi.fn().mockResolvedValue(undefined),
      saveMessageBlock: vi.fn().mockResolvedValue(undefined)
    };
    const actions = {
      updateOneBlock: (payload: any) => ({ type: 'updateOneBlock', payload }),
      addOneBlock: (payload: any) => ({ type: 'addOneBlock', payload }),
      upsertBlockReference: (payload: any) => ({ type: 'upsertBlockReference', payload })
    };
    const proc = createResponseChunkProcessor('msg-1', 'block-1', store, storage, actions, 100);
    return { proc, dispatched };
  };

  const streamingWrites = (dispatched: Array<{ type: string; payload: any }>) =>
    dispatched.filter(
      (a) => a.type === 'updateOneBlock' && a.payload?.changes?.status === MessageBlockStatus.STREAMING
    );

  it('取消挂起更新后，迟到的 RAF 不再把块写回 streaming', () => {
    const { proc, dispatched } = setup();

    // 两次思考增量：第一次建块，第二次走节流更新 → 安排一帧 RAF 写 streaming
    proc.handleChunk({ type: ChunkType.THINKING_DELTA, text: '想一', thinking_millsec: 1000 } as any);
    proc.handleChunk({ type: ChunkType.THINKING_DELTA, text: '想一想二', thinking_millsec: 2000 } as any);

    // 此刻应有一帧挂起的 RAF（尚未真正 dispatch streaming 更新）
    expect(rafCallbacks.size).toBeGreaterThan(0);

    // 中断收尾：取消所有挂起的 throttle/RAF
    proc.cancelPendingUpdates();

    // 模拟「中断之后迟到的一帧」
    flushRaf();

    // 关键断言：取消后不应再有任何把块写成 streaming 的 dispatch
    expect(streamingWrites(dispatched)).toHaveLength(0);
  });

  it('未取消时迟到的 RAF 会写回 streaming（证明竞态真实存在）', () => {
    const { proc, dispatched } = setup();

    proc.handleChunk({ type: ChunkType.THINKING_DELTA, text: '想一', thinking_millsec: 1000 } as any);
    proc.handleChunk({ type: ChunkType.THINKING_DELTA, text: '想一想二', thinking_millsec: 2000 } as any);

    // 不取消，直接放行迟到的一帧
    flushRaf();

    expect(streamingWrites(dispatched).length).toBeGreaterThan(0);
  });
});
