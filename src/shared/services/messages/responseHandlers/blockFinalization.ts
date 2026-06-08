import store from '../../../store';
import { dexieStorage } from '../../storage/DexieStorageService';
import { updateOneBlock } from '../../../store/slices/messageBlocksSlice';
import {
  MessageBlockStatus,
  MessageBlockType,
  isTerminalBlockStatus
} from '../../../types/newMessage';
import type { MessageBlock, ThinkingMessageBlock } from '../../../types/newMessage';

/**
 * 响应收尾的「单一不变量出口」。
 *
 * 不论响应以何种方式结束（成功 / 中断 / 出错），都必须保证：
 *   收尾后，该消息的每个块都处于终态（success / error / paused）。
 *
 * 历史上 complete / 中断 / 出错 三条路径各自只收尾了一部分块（典型：中断与
 * 出错只动主块，漏掉思考块 → 思考块停留 streaming → 计时永不停）。本函数把
 * 「把所有非终态块推进到终态」收口成唯一实现，三条路径共用。
 *
 * 设计要点：
 * - 幂等：已是终态的块跳过，可安全重复调用（停止与流自然结束的竞态下不会重复写）。
 * - 原子一致：同一份遍历同时写 Redux 与 Dexie，避免内存/DB 子集分叉。
 * - 类型自描述：思考块在收尾时盖最终 thinking_millsec（按时间戳派生）。
 */
export interface FinalizeOptions {
  /** 终止时刻（ISO 字符串） */
  now: string;
  /** 思考耗时兜底值（毫秒）；优先用块上已有值，其次此值，最后按时间戳算 */
  thinkingDurationMs?: number;
  /** 跳过的块ID（其终态已由调用方单独写入，如主文本块/错误块） */
  skipBlockIds?: Iterable<string>;
}

/**
 * 把指定消息所有「非终态」块推进到 SUCCESS，思考块补最终时长。
 * @returns 实际被收尾的块数量（用于断言/埋点）
 */
export async function finalizeNonTerminalBlocks(
  messageId: string,
  options: FinalizeOptions
): Promise<number> {
  const { now, thinkingDurationMs } = options;
  const skip = new Set(options.skipBlockIds ?? []);

  const message = store.getState().messages.entities[messageId];
  const blockIds = message?.blocks ?? [];

  const dbOps: Promise<unknown>[] = [];
  let finalized = 0;

  for (const id of blockIds) {
    if (skip.has(id)) continue;

    const block = store.getState().messageBlocks.entities[id];
    if (!block || isTerminalBlockStatus(block.status)) continue;

    const changes: Partial<MessageBlock> = {
      status: MessageBlockStatus.SUCCESS,
      updatedAt: now
    };

    if (block.type === MessageBlockType.THINKING) {
      changes.thinking_millsec = resolveThinkingMillis(block, thinkingDurationMs, now);
    }

    // 同一份遍历：Redux 与 Dexie 一起写，保证一致
    store.dispatch(updateOneBlock({ id, changes }));
    dbOps.push(dexieStorage.updateMessageBlock(id, changes));
    finalized++;
  }

  if (dbOps.length > 0) {
    await Promise.all(dbOps);
  }

  if (finalized > 0) {
    console.log(`[blockFinalization] 收尾非终态块 ${finalized} 个 - 消息ID: ${messageId}`);
  }

  return finalized;
}

/**
 * 思考时长 = 「结束时刻 − 起始时刻」，时间戳派生。
 * 优先级：块上已有的有效值 > 调用方兜底值 > 按 thinkingStartTime/createdAt 推算。
 */
function resolveThinkingMillis(
  block: ThinkingMessageBlock,
  thinkingDurationMs: number | undefined,
  now: string
): number {
  if (typeof block.thinking_millsec === 'number' && block.thinking_millsec > 0) {
    return block.thinking_millsec;
  }
  if (typeof thinkingDurationMs === 'number' && thinkingDurationMs > 0) {
    return thinkingDurationMs;
  }
  const start = block.thinkingStartTime ?? Date.parse(block.createdAt);
  const end = Date.parse(now);
  if (!Number.isNaN(start) && !Number.isNaN(end)) {
    return Math.max(0, end - start);
  }
  return 0;
}
