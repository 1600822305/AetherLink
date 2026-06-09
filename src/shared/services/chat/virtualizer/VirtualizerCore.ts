/**
 * VirtualizerCore - 框架无关的消息列表虚拟化核心（纯 TS，可单测）
 *
 * 职责：仅做「几何计算」，不碰 DOM、不依赖 React/Solid。
 * - 维护每条 item 的高度（实测优先，未测回退估高）
 * - O(log n) 查询任意 index 的偏移与总高度
 * - 根据 scrollTop/视口算出应渲染的 index 区间 + 上下 spacer 高度
 * - 提供 scroll anchor 的捕获/解析，用于「测量抖动 / prepend 历史」时锁定视口不跳
 *
 * 复杂度说明：当前用「带脏标记的前缀和数组」（重建 O(n)，查询 O(log n)）。
 * 聊天场景 itemCount 量级有限，且重建只在尺寸/数量变化后惰性触发；
 * 若后续 profiling 显示为热点，可在不改动公开 API 的前提下换成树状数组（Fenwick）。
 */

export interface VirtualRange {
  /** 应渲染的起始 index（含） */
  startIndex: number;
  /** 应渲染的结束 index（含）；空列表时为 -1 */
  endIndex: number;
  /** 顶部占位高度（startIndex 之前所有 item 的总高） */
  padTop: number;
  /** 底部占位高度（endIndex 之后所有 item 的总高） */
  padBottom: number;
}

/**
 * 滚动锚点：锚定「视口顶部正在显示的那条 item」及其内部偏移。
 * 在「实测高度更新 / prepend 历史消息」等会改变上方总高的操作前后，
 * 用 captureAnchor → (执行变更) → resolveScrollTop 即可保持视口内容不跳。
 */
export interface ScrollAnchor {
  index: number;
  /** 该 item 顶部到视口顶部的距离（>=0） */
  offset: number;
}

export interface VirtualizerOptions {
  /** item 数量 */
  count: number;
  /** 估高函数：未实测时使用 */
  estimateSize: (index: number) => number;
  /** 可视区上下额外预渲染的像素（默认 600） */
  overscanPx?: number;
}

const DEFAULT_OVERSCAN_PX = 600;

export class VirtualizerCore {
  private count: number;
  private estimateSize: (index: number) => number;
  private overscanPx: number;

  /** index -> 实测高度；未命中回退 estimateSize */
  private measured = new Map<number, number>();
  /** 前缀和：prefix[i] = 前 i 条的总高度，长度 count+1 */
  private prefix: number[] = [];
  private dirty = true;

  constructor(options: VirtualizerOptions) {
    this.count = Math.max(0, Math.floor(options.count));
    this.estimateSize = options.estimateSize;
    this.overscanPx = options.overscanPx ?? DEFAULT_OVERSCAN_PX;
  }

  // ==================== 配置 ====================

  getCount(): number {
    return this.count;
  }

  setOverscanPx(px: number): void {
    this.overscanPx = Math.max(0, px);
  }

  setEstimateSize(fn: (index: number) => number): void {
    this.estimateSize = fn;
    this.dirty = true;
  }

  // ==================== 数量变更 ====================

  /**
   * 设置 item 总数（仅用于「尾部增减」场景，如普通追加消息）。
   * 注意：measured 以 index 为键，因此该方法不会重映射既有实测值，
   * 适用于在尾部增删（前部 index 不变）。前部插入请用 prepend()。
   */
  setCount(count: number): void {
    const next = Math.max(0, Math.floor(count));
    if (next === this.count) return;
    // 收缩时清掉越界的实测值，避免脏缓存
    if (next < this.count) {
      for (const key of this.measured.keys()) {
        if (key >= next) this.measured.delete(key);
      }
    }
    this.count = next;
    this.dirty = true;
  }

  /** 在头部插入 k 条（加载历史）：把既有实测值整体后移 k，再增加数量 */
  prepend(k: number): void {
    const shift = Math.max(0, Math.floor(k));
    if (shift === 0) return;
    if (this.measured.size > 0) {
      const remapped = new Map<number, number>();
      for (const [index, size] of this.measured) {
        remapped.set(index + shift, size);
      }
      this.measured = remapped;
    }
    this.count += shift;
    this.dirty = true;
  }

  /** 在尾部追加 k 条 */
  append(k: number): void {
    const add = Math.max(0, Math.floor(k));
    if (add === 0) return;
    this.count += add;
    this.dirty = true;
  }

  // ==================== 测量 ====================

  /** 写入某条的实测高度；返回是否真的发生变化（用于决定是否需要 anchor 补偿） */
  setMeasured(index: number, size: number): boolean {
    if (index < 0 || index >= this.count) return false;
    const normalized = Math.max(0, size);
    if (this.measured.get(index) === normalized) return false;
    this.measured.set(index, normalized);
    this.dirty = true;
    return true;
  }

  /** 失效某条的实测值（编辑/重生成/版本切换后），下次回退估高并待重测 */
  invalidate(index: number): void {
    if (this.measured.delete(index)) this.dirty = true;
  }

  /** 清空所有实测值（切话题时） */
  clearMeasurements(): void {
    if (this.measured.size === 0) return;
    this.measured.clear();
    this.dirty = true;
  }

  /** 某条当前采用的高度（实测优先，否则估高） */
  sizeOf(index: number): number {
    const m = this.measured.get(index);
    if (m !== undefined) return m;
    return Math.max(0, this.estimateSize(index));
  }

  // ==================== 几何查询 ====================

  /** 某条顶部相对列表顶部的偏移；index 取值 [0, count]，getOffset(count)=总高度 */
  getOffset(index: number): number {
    this.ensureBuilt();
    const i = this.clampIndexInclusive(index);
    return this.prefix[i];
  }

  /** 列表总高度 */
  totalSize(): number {
    this.ensureBuilt();
    return this.prefix[this.count];
  }

  /**
   * 根据滚动位置算出应渲染区间 + 上下占位高度。
   * @param scrollTop 容器 scrollTop
   * @param viewportHeight 容器可视高度（clientHeight）
   */
  getRange(scrollTop: number, viewportHeight: number): VirtualRange {
    if (this.count === 0) {
      return { startIndex: 0, endIndex: -1, padTop: 0, padBottom: 0 };
    }
    this.ensureBuilt();

    const top = Math.max(0, scrollTop - this.overscanPx);
    const bottom = scrollTop + Math.max(0, viewportHeight) + this.overscanPx;

    const startIndex = this.findIndexAtOffset(top);
    const endIndex = this.findIndexAtOffset(bottom);

    const padTop = this.prefix[startIndex];
    const padBottom = this.prefix[this.count] - this.prefix[endIndex + 1];

    return {
      startIndex,
      endIndex,
      padTop,
      padBottom: Math.max(0, padBottom),
    };
  }

  // ==================== 滚动锚点 ====================

  /** 捕获当前视口顶部锚点（用于变更前快照） */
  captureAnchor(scrollTop: number): ScrollAnchor {
    if (this.count === 0) return { index: 0, offset: 0 };
    this.ensureBuilt();
    const clampedTop = Math.max(0, scrollTop);
    const index = this.findIndexAtOffset(clampedTop);
    return { index, offset: clampedTop - this.prefix[index] };
  }

  /** 由锚点解析出变更后应当恢复的 scrollTop */
  resolveScrollTop(anchor: ScrollAnchor): number {
    this.ensureBuilt();
    const index = Math.min(Math.max(0, anchor.index), this.count);
    return this.prefix[index] + Math.max(0, anchor.offset);
  }

  // ==================== 内部 ====================

  private clampIndexInclusive(index: number): number {
    if (index < 0) return 0;
    if (index > this.count) return this.count;
    return Math.floor(index);
  }

  /** 找到 offset 落入的 item index：最大的 i 使 prefix[i] <= offset，范围 [0, count-1] */
  private findIndexAtOffset(offset: number): number {
    // 二分：prefix 单调递增，找 prefix[i] <= offset 的最大 i（i 限定在 [0, count-1]）
    let lo = 0;
    let hi = this.count - 1;
    if (offset <= 0) return 0;
    if (offset >= this.prefix[this.count]) return this.count - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (this.prefix[mid] <= offset) lo = mid;
      else hi = mid - 1;
    }
    return lo;
  }

  private ensureBuilt(): void {
    if (!this.dirty) return;
    const prefix = new Array<number>(this.count + 1);
    prefix[0] = 0;
    for (let i = 0; i < this.count; i++) {
      prefix[i + 1] = prefix[i] + this.sizeOf(i);
    }
    this.prefix = prefix;
    this.dirty = false;
  }
}
