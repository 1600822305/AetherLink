/**
 * 跳转到指定消息:切换话题后消息列表是异步渲染的,这里轮询等待对应 DOM 出现,
 * 滚动到该消息并短暂高亮,作为搜索结果的深链定位。
 */
const MAX_WAIT_MS = 3000;
const POLL_INTERVAL_MS = 100;

export function scrollToMessage(messageId: string): void {
  if (!messageId) return;
  const elementId = `message-${messageId}`;
  const startedAt = Date.now();

  const tryScroll = () => {
    const el = document.getElementById(elementId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      flashHighlight(el);
      return;
    }
    if (Date.now() - startedAt < MAX_WAIT_MS) {
      setTimeout(tryScroll, POLL_INTERVAL_MS);
    }
  };

  // 给话题切换后的首次渲染留一帧
  setTimeout(tryScroll, POLL_INTERVAL_MS);
}

function flashHighlight(el: HTMLElement): void {
  try {
    el.animate(
      [
        { backgroundColor: 'rgba(25, 118, 210, 0.25)' },
        { backgroundColor: 'rgba(25, 118, 210, 0.25)', offset: 0.6 },
        { backgroundColor: 'transparent' },
      ],
      { duration: 1600, easing: 'ease-out' }
    );
  } catch {
    /* 不支持 Web Animations API 时静默跳过 */
  }
}
