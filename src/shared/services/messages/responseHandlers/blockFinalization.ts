import { messageBlockRepository } from '../MessageBlockRepository';

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
  return messageBlockRepository.finalizeMessageBlocks(messageId, options);
}
