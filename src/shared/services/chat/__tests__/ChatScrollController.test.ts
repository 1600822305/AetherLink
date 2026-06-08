import { describe, it, expect, beforeEach } from 'vitest';
import { ChatScrollController, type ResizeObserverLike } from '../ChatScrollController';

/** 可控的假滚动容器，模拟浏览器在 scrollTo 后异步派发 scroll 事件 */
class FakeContainer {
  scrollTop = 0;
  scrollHeight = 1000;
  clientHeight = 500;
  private listeners: Array<() => void> = [];

  scrollTo(opts: { top: number }) {
    this.scrollTop = opts.top;
    // 浏览器对程序化滚动也会派发 scroll 事件（这里同步派发以便测试守卫）
    this.emitScroll();
  }
  addEventListener(_type: 'scroll', listener: () => void) {
    this.listeners.push(listener);
  }
  removeEventListener(_type: 'scroll', listener: () => void) {
    this.listeners = this.listeners.filter((l) => l !== listener);
  }
  /** 模拟用户手动滚动到某位置 */
  userScrollTo(top: number) {
    this.scrollTop = top;
    this.emitScroll();
  }
  private emitScroll() {
    this.listeners.forEach((l) => l());
  }
}

/** 可手动触发的假 ResizeObserver */
class FakeResizeObserver implements ResizeObserverLike {
  callback: () => void;
  observed = false;
  constructor(cb: () => void) {
    this.callback = cb;
  }
  observe() {
    this.observed = true;
  }
  disconnect() {
    this.observed = false;
  }
  /** 模拟内容尺寸变化 */
  trigger() {
    this.callback();
  }
}

const fakeContent = {} as unknown as Element;

describe('ChatScrollController', () => {
  let container: FakeContainer;
  let ro: FakeResizeObserver;
  let enabled: boolean;
  let rafQueue: Array<() => void>;

  const syncRaf = (cb: () => void) => cb();
  const queuedRaf = (cb: () => void) => {
    rafQueue.push(cb);
  };
  const flushRaf = () => {
    while (rafQueue.length) {
      const cb = rafQueue.shift()!;
      cb();
    }
  };

  const makeController = (raf: (cb: () => void) => void = syncRaf) =>
    new ChatScrollController(container, fakeContent, {
      threshold: 80,
      isEnabled: () => enabled,
      createResizeObserver: (cb) => {
        ro = new FakeResizeObserver(cb);
        return ro;
      },
      raf,
    });

  beforeEach(() => {
    container = new FakeContainer();
    enabled = true;
    rafQueue = [];
  });

  it('默认贴底：内容增高时自动滚到底部', () => {
    const c = makeController();
    container.scrollHeight = 2000;
    ro.trigger();
    expect(container.scrollTop).toBe(2000);
    expect(c.isSticking()).toBe(true);
  });

  it('用户上滑离底超过阈值后不再自动跟随', () => {
    const c = makeController();
    container.userScrollTo(0); // distance = 1000-0-500 = 500 > 80
    expect(c.isSticking()).toBe(false);

    container.scrollHeight = 2000;
    ro.trigger();
    expect(container.scrollTop).toBe(0); // 未被拉到底
  });

  it('用户滑回底部阈值内后恢复跟随', () => {
    const c = makeController();
    container.userScrollTo(0);
    expect(c.isSticking()).toBe(false);

    // distance = 1000 - 430 - 500 = 70 <= 80
    container.userScrollTo(430);
    expect(c.isSticking()).toBe(true);

    container.scrollHeight = 1500;
    ro.trigger();
    expect(container.scrollTop).toBe(1500);
  });

  it('程序化滚动期间的 scroll 事件不翻转 stick', () => {
    const c = makeController(queuedRaf);
    expect(c.isSticking()).toBe(true);

    container.scrollHeight = 3000;
    ro.trigger(); // 触发 scrollToBottom：programmatic=true，scrollTo 派发 scroll 事件

    // 守卫期内模拟一次「位于顶部」的 scroll 事件，不应翻转 stick
    container.userScrollTo(0);
    expect(c.isSticking()).toBe(true);

    flushRaf(); // 两帧后解除守卫
    container.userScrollTo(0);
    expect(c.isSticking()).toBe(false);
  });

  it('开关关闭时不被动跟随，但 pinToBottom 仍可强制置底', () => {
    enabled = false;
    const c = makeController();

    container.scrollHeight = 2000;
    ro.trigger();
    expect(container.scrollTop).toBe(0); // 被动跟随被禁用

    c.pinToBottom();
    expect(container.scrollTop).toBe(2000); // 显式意图越过开关
  });

  it('pinToBottom 把 stick 恢复为 true', () => {
    const c = makeController();
    container.userScrollTo(0);
    expect(c.isSticking()).toBe(false);

    container.scrollHeight = 2500;
    c.pinToBottom();
    expect(c.isSticking()).toBe(true);
    expect(container.scrollTop).toBe(2500);
  });

  it('destroy 后停止观察且不再响应', () => {
    const c = makeController();
    c.destroy();
    expect(ro.observed).toBe(false);

    container.scrollHeight = 2000;
    ro.trigger();
    expect(container.scrollTop).toBe(0);
  });
});
