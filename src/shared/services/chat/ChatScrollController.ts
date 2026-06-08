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
}

const DEFAULT_THRESHOLD = 80;

export class ChatScrollController {
  private readonly container: ScrollContainer;
  private readonly content: Element;
  private readonly threshold: number;
  private readonly isEnabled: () => boolean;
  private readonly raf: (cb: () => void) => void;
  private readonly resizeObserver: ResizeObserverLike;

  /** 唯一真相：是否跟随底部 */
  private stick = true;
  /** 程序化滚动期间为 true，避免把自身滚动误判成用户滚动 */
  private programmatic = false;
  private disposed = false;

  constructor(container: ScrollContainer, content: Element, options: ChatScrollControllerOptions) {
    this.container = container;
    this.content = content;
    this.threshold = options.threshold ?? DEFAULT_THRESHOLD;
    this.isEnabled = options.isEnabled;
    this.raf = options.raf ?? ((cb) => {
      if (typeof requestAnimationFrame === 'function') {
        requestAnimationFrame(cb);
      } else {
        cb();
      }
    });

    const createResizeObserver = options.createResizeObserver
      ?? ((cb) => new ResizeObserver(cb));

    this.container.addEventListener('scroll', this.handleScroll, { passive: true });
    this.resizeObserver = createResizeObserver(this.handleContentResize);
    this.resizeObserver.observe(this.content);
  }

  private distanceFromBottom(): number {
    return this.container.scrollHeight - this.container.scrollTop - this.container.clientHeight;
  }

  /** 用户滚动是唯一翻转 stick 的入口 */
  private handleScroll = (): void => {
    if (this.programmatic) return;
    this.stick = this.distanceFromBottom() <= this.threshold;
  };

  /** 内容增高时被动跟随 */
  private handleContentResize = (): void => {
    if (this.disposed) return;
    if (this.isEnabled() && this.stick) {
      this.scrollToBottom('auto');
    }
  };

  /** 执行滚动，并用 programmatic 守卫包裹，避免触发的 scroll 事件翻转 stick */
  private scrollToBottom(behavior: ScrollBehavior = 'auto'): void {
    this.programmatic = true;
    this.container.scrollTo({ top: this.container.scrollHeight, behavior });
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
