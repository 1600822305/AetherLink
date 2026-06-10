/**
 * ChatScrollController - 聊天消息列表「自动下滑」状态机
 *
 * 设计目标：把原先分散在 React 层与 SolidJS 层的多套自动滚动逻辑，
 * 收敛成单一「贴底（stick-to-bottom）」状态机。
 *
 * 核心模型：
 * - `stick` 是唯一真相，表示「是否跟随底部」。唯一翻转它的入口是用户滚动：
 *   用户上滑离底超过阈值 → stick=false；滑回底部阈值内 → stick=true。
 * - 内容增高（流式文本/思考/工具/图片异步加载/代码/公式等）由 ResizeObserver
 *   统一驱动，只在 `stick` 为真且开关启用时贴底，无需监听任何业务事件。
 * - `programmatic` 守卫确保「自己触发的滚动」不会被误判成「用户滚动」。
 *
 * 该类不直接依赖 DOM / 浏览器全局，所有外部依赖均可注入，便于在 node 环境单测。
 */

/** 滚动容器需要满足的最小接口（HTMLElement 天然兼容） */
export interface ScrollContainer {
  scrollTop: number;
  readonly scrollHeight: number;
  readonly clientHeight: number;
  scrollTo: (options: { top: number; behavior?: ScrollBehavior }) => void;
  addEventListener: (type: 'scroll', listener: () => void, options?: unknown) => void;
  removeEventListener: (type: 'scroll', listener: () => void, options?: unknown) => void;
}

/** ResizeObserver 的最小接口（便于测试注入） */
export interface ResizeObserverLike {
  observe: (target: Element) => void;
  disconnect: () => void;
}

export interface ChatScrollControllerOptions {
  /** 距底部多少像素内视为「贴底」，默认 80 */
  threshold?: number;
  /** 被动跟随是否启用（读 settings.autoScrollToBottom） */
  isEnabled: () => boolean;
  /** 注入 ResizeObserver 工厂，默认使用全局 ResizeObserver */
  createResizeObserver?: (callback: () => void) => ResizeObserverLike;
  /** 注入 requestAnimationFrame，默认 window.requestAnimationFrame */
  raf?: (callback: () => void) => void;
  /** 注入时钟，默认 Date.now（便于测试） */
  now?: () => number;
  /** 贴底承诺窗口时长（ms），默认 500 */
  pinWindowMs?: number;
}

const DEFAULT_THRESHOLD = 80;
const DEFAULT_PIN_WINDOW_MS = 500;

export class ChatScrollController {
  private readonly container: ScrollContainer;
  private readonly content: Element;
  private readonly threshold: number;
  private readonly isEnabled: () => boolean;
  private readonly raf: (cb: () => void) => void;
  private readonly now: () => number;
  private readonly pinWindowMs: number;
  private readonly resizeObserver: ResizeObserverLike;

  /** 唯一真相：是否跟随底部 */
  private stick = true;
  /** 程序化滚动期间为 true，避免把自身滚动误判成用户滚动 */
  private programmatic = false;
  /** 贴底承诺截止时刻：窗口内内容增高无条件跟随，覆盖显式置底后的异步渲染 */
  private pinnedUntil = 0;
  /** 上次 scroll 事件的 scrollTop，用于判断滚动方向 */
  private lastScrollTop = 0;
  private disposed = false;

  constructor(container: ScrollContainer, content: Element, options: ChatScrollControllerOptions) {
    this.container = container;
    this.content = content;
    this.threshold = options.threshold ?? DEFAULT_THRESHOLD;
    this.isEnabled = options.isEnabled;
    this.now = options.now ?? (() => Date.now());
    this.pinWindowMs = options.pinWindowMs ?? DEFAULT_PIN_WINDOW_MS;
    this.raf = options.raf ?? ((cb) => {
      if (typeof requestAnimationFrame === 'function') {
        requestAnimationFrame(cb);
      } else {
        cb();
      }
    });

    const createResizeObserver = options.createResizeObserver
      ?? ((cb) => new ResizeObserver(cb));

    this.lastScrollTop = container.scrollTop;
    this.container.addEventListener('scroll', this.handleScroll, { passive: true });
    this.resizeObserver = createResizeObserver(this.handleContentResize);
    this.resizeObserver.observe(this.content);
  }

  private distanceFromBottom(): number {
    return this.container.scrollHeight - this.container.scrollTop - this.container.clientHeight;
  }

  /**
   * 用户滚动是唯一翻转 stick 的入口，且基于方向判定：
   * - 回到底部阈值内 → 恢复跟随
   * - 明确向上滚动 → 解除跟随并取消贴底承诺
   * - 其余（布局变化/平滑滚动中间帧等噪声）不改变状态，
   *   避免内容增高途中的瞬时离底误判为用户离开
   */
  private handleScroll = (): void => {
    const top = this.container.scrollTop;
    const scrolledUp = top < this.lastScrollTop;
    this.lastScrollTop = top;
    if (this.programmatic) return;
    if (this.distanceFromBottom() <= this.threshold) {
      this.stick = true;
    } else if (scrolledUp) {
      this.stick = false;
      this.pinnedUntil = 0;
    }
  };

  /** 内容增高时被动跟随；贴底承诺窗口内越过开关无条件跟随 */
  private handleContentResize = (): void => {
    if (this.disposed) return;
    const pinned = this.now() < this.pinnedUntil;
    if (this.stick && (pinned || this.isEnabled())) {
      this.scrollToBottom('auto');
    }
  };

  /** 执行滚动，并用 programmatic 守卫包裹，避免触发的 scroll 事件翻转 stick */
  private scrollToBottom(behavior: ScrollBehavior = 'auto'): void {
    this.programmatic = true;
    this.container.scrollTo({ top: this.container.scrollHeight, behavior });
    this.lastScrollTop = this.container.scrollTop;
    // 两帧后解除守卫：确保本次（含异步触发的）scroll 事件不会翻转 stick
    this.raf(() => this.raf(() => { this.programmatic = false; }));
  }

  /**
   * 显式置底意图（用户发送 / 点击 FAB / 切换话题 / 键盘弹出）。
   * 越过 stick 与开关：无条件置底并恢复跟随。
   */
  pinToBottom(behavior: ScrollBehavior = 'auto'): void {
    if (this.disposed) return;
    this.stick = true;
    // 贴底承诺：窗口内后续渲染出的内容由 ResizeObserver 持续保证贴底
    this.pinnedUntil = this.now() + this.pinWindowMs;
    this.scrollToBottom(behavior);
  }

  /** 当前是否处于贴底跟随状态（供调试/测试） */
  isSticking(): boolean {
    return this.stick;
  }

  destroy(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.container.removeEventListener('scroll', this.handleScroll);
    this.resizeObserver.disconnect();
  }
}
