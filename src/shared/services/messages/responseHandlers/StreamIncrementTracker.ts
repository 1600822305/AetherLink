/**
 * 流式增量归一器（StreamIncrementTracker）
 *
 * 作用：把上游供应商的文本/思考流统一归一成「增量」语义，作为 API 与信息块系统之间的归一化边界。
 *
 * 背景（为什么需要它）：
 * 信息块系统原本散落着一条隐性铁律——「每个 TEXT_DELTA 携带的是累积全文」，并靠
 * `lastProcessedTextLength` 切增量、靠「累积长度变短 = 新一轮」来猜测。这条假设只对
 * 发送累积全文的供应商（官方 OpenAI SDK）成立；一旦切到发送增量片段的供应商
 * （Vercel AI SDK 的 text-delta/reasoning-delta），长度忽长忽短就会误判「新一轮」、
 * 重复切块，表现为「重复渲染」。
 *
 * 归一规则（集中到这一处，块层不再猜测）：
 * - 若 chunk 提供 `delta`（增量语义）：直接采用 delta；`isFirstChunk` 作为「新一轮」显式信号。
 * - 否则 `text` 视为累积全文（累积语义）：
 *   - 单调增长 → 增量 = text.slice(prevLen)；
 *   - 长度变短 → 判定为新一轮，增量 = 整个 text，并返回 newRound=true。
 *
 * 该类对文本与思考通用，各自持有一个实例（互不干扰）。
 */
export interface IncrementInput {
  /** 累积全文（累积语义，未提供 delta 时使用） */
  text?: string;
  /** 增量片段（增量语义，提供时为权威） */
  delta?: string;
  /** 增量语义下「新一轮响应开始」的显式信号 */
  isFirstChunk?: boolean;
}

export interface IncrementResult {
  /** 归一后的增量片段（始终是「本次新增」的内容） */
  increment: string;
  /** 是否为新一轮响应的开始（调用方据此完成当前块并重置状态） */
  newRound: boolean;
}

export class StreamIncrementTracker {
  /** 已处理的累积长度（仅用于累积语义下的差分） */
  private prevLen = 0;

  /**
   * 将一个上游 chunk 归一成增量。
   */
  next(input: IncrementInput): IncrementResult {
    // —— 增量语义：供应商已发增量片段 ——
    if (typeof input.delta === 'string') {
      const delta = input.delta;
      // 显式新一轮：仅当此前已处理过内容时才算「新一轮」（避免首片误判）
      if (input.isFirstChunk && this.prevLen > 0) {
        this.prevLen = delta.length;
        return { increment: delta, newRound: true };
      }
      this.prevLen += delta.length;
      return { increment: delta, newRound: false };
    }

    // —— 累积语义：供应商发累积全文，差分出增量 ——
    const text = input.text ?? '';
    if (text.length >= this.prevLen) {
      const increment = text.slice(this.prevLen);
      this.prevLen = text.length;
      return { increment, newRound: false };
    }

    // 累积长度变短 → 新一轮响应（agentic 多轮，文本从头开始）
    this.prevLen = text.length;
    return { increment: text, newRound: true };
  }

  /**
   * 重置已处理长度（在「新一轮」完成、或工具调用切块后调用）。
   */
  reset(): void {
    this.prevLen = 0;
  }
}
