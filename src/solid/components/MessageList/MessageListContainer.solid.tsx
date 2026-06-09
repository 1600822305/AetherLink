/**
 * MessageListContainer - 使用 SolidJS 的消息列表容器组件
 * 外壳用 SolidJS 实现滚动优化，内容由 React 通过 Portal 渲染
 */
import { onCleanup } from 'solid-js';

export interface MessageListContainerProps {
  children?: any;
  themeMode?: 'light' | 'dark';
  onScrollToTop?: () => void;
  chatBackground?: {
    enabled: boolean;
  };
}

// 注：自动下滑（贴底跟随）已统一收敛到 React 侧的 ChatScrollController，
// 这里仅负责滚动 DOM 本体与「接近顶部加载更多」检测。
export function MessageListContainer(props: MessageListContainerProps) {
  let containerRef: HTMLDivElement | undefined;

  // 顶部加载更多阈值
  const TOP_THRESHOLD = 100;
  
  // ✅ 使用 rAF 自适应设备刷新率，不再使用固定 throttle
  let rafId: number | null = null;
  let lastScrollTop = 0;
  
  // 处理滚动事件 - 使用 requestAnimationFrame 自动适配 60/120/144Hz
  const handleScroll = () => {
    // 取消之前的帧，确保每帧只执行一次
    if (rafId) {
      cancelAnimationFrame(rafId);
    }
    
    rafId = requestAnimationFrame(() => {
      rafId = null;
      
      if (!containerRef) return;
      
      const st = containerRef.scrollTop;
      
      // 检查是否真的滚动了（避免无意义的更新）
      if (st === lastScrollTop) return;
      lastScrollTop = st;
      
      // 接近顶部时触发加载更多
      if (st < TOP_THRESHOLD) {
        props.onScrollToTop?.();
      }
    });
  };
  
  // 清理
  onCleanup(() => {
    if (rafId) {
      cancelAnimationFrame(rafId);
    }
  });
  
  // 获取背景样式
  const getBackgroundStyle = () => {
    if (props.chatBackground?.enabled) {
      return {};
    }
    return {
      'background-color': `var(--theme-bg-default, ${props.themeMode === 'dark' ? '#121212' : '#ffffff'})`
    };
  };
  
  // 获取滚动条样式 - 与原始 MessageList 保持一致（3px 细滚动条）
  // 🚀 使用 scrollbar-gutter: stable 防止滚动条出现/消失时布局跳动
  const getScrollbarStyle = () => {
    const isDark = props.themeMode === 'dark';
    return `
      .solid-message-list-container {
        scrollbar-width: thin;
        scrollbar-color: ${isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)'} transparent;
        scrollbar-gutter: stable;
      }
      .solid-message-list-container::-webkit-scrollbar {
        width: 3px;
      }
      .solid-message-list-container::-webkit-scrollbar-track {
        background: transparent;
      }
      .solid-message-list-container::-webkit-scrollbar-thumb {
        background: ${isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)'};
        border-radius: 2px;
      }
      .solid-message-list-container::-webkit-scrollbar-thumb:hover {
        background: ${isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.25)'};
      }
    `;
  };

  return (
    <>
      <style>{getScrollbarStyle()}</style>
      <div
        ref={containerRef}
        class="solid-message-list-container"
        id="messageList"
        style={{
          display: 'flex',
          'flex-direction': 'column',
          'flex-grow': 1,
          'overflow-y': 'auto',
          'overflow-x': 'hidden',
          width: '100%',
          'max-width': '100%',
          'padding-left': 0,
          'padding-right': 0,
          'padding-top': 0,
          'padding-bottom': '8px',
          // 滚动优化
          'will-change': 'scroll-position',
          'scroll-behavior': 'auto',
          '-webkit-overflow-scrolling': 'touch',
          'overscroll-behavior': 'contain',
          'touch-action': 'pan-y', // 🚀 性能优化：明确告知浏览器只处理纵向滑动，防止横向滑动与侧边栏冲突导致掉帧
          // 背景
          ...getBackgroundStyle()
        }}
        onScroll={handleScroll}
      >
        {props.children}
      </div>
    </>
  );
}

export default MessageListContainer;
