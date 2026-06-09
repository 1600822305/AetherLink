/**
 * AppSidebar - 使用 Solid UI 的侧边栏组件
 * 🚀 性能优化版：使用 requestAnimationFrame 节流 + 直接 DOM 操作
 */
import { createSignal, createEffect, onCleanup, batch } from 'solid-js';
import { Portal } from 'solid-js/web';

export interface AppSidebarProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children?: any;
  width?: number;
  themeMode?: 'light' | 'dark';
  enableSwipeGesture?: boolean; // 是否启用滑动手势（移动端）
  isDesktop?: boolean; // 是否是桌面端
}

export function AppSidebar(props: AppSidebarProps) {
  const width = () => props.width ?? 350;
  // 响应式访问 open 状态
  const isOpen = () => props.open;
  
  // DOM 引用 - 用于直接操作样式（绕过响应式系统，提升性能）
  let sidebarRef: HTMLDivElement | undefined;
  let maskRef: HTMLDivElement | undefined;
  
  // 🚀 性能优化：使用普通变量存储拖拽状态，避免频繁触发响应式更新
  let touchStartX = 0;
  let touchStartY = 0;
  let currentDragOffset = 0;
  let rafId: number | null = null;
  let pendingOpenFromGesture: boolean | null = null;
  
  // 只用 signal 存储需要触发 UI 更新的状态
  const [isDragging, setIsDragging] = createSignal(false);
  const [isValidSwipe, setIsValidSwipe] = createSignal(false);
  
  const edgeThreshold = 30; // 边缘触发区域
  const swipeThreshold = 0.3; // 滑动触发阈值
  
  // 🚀 直接更新 DOM 样式（绕过 SolidJS 响应式，60fps 流畅）
  const updateDragStyles = (offset: number) => {
    if (!sidebarRef || !maskRef) return;
    
    const w = width();
    const baseOffset = isOpen() ? 0 : -w;
    const finalOffset = Math.min(0, Math.max(-w, baseOffset + offset));
    
    // 直接设置 transform（GPU 加速）
    sidebarRef.style.transform = `translateX(${finalOffset}px) translateZ(0)`;
    
    // 计算遮罩透明度
    const progress = isOpen()
      ? 1 - Math.abs(offset) / w
      : offset / w;
    const opacity = Math.max(0, Math.min(0.5, progress * 0.5));
    maskRef.style.backgroundColor = `rgba(0, 0, 0, ${opacity})`;
  };
  
  const handleTouchStart = (e: TouchEvent) => {
    const touch = e.touches[0];
    const target = e.target as HTMLElement;
    
    // 检查触摸目标是否是需要排除手势捕获的元素
    const shouldExclude = target.closest(
      '[data-gesture-exclude], ' +
      '.MuiSlider-root, .MuiSlider-thumb, .MuiSlider-track, .MuiSlider-rail, ' +
      '.MuiDialog-root, .MuiDialog-container, .MuiDialog-paper, ' +
      '.MuiModal-root, .MuiBackdrop-root, ' +
      '[role="dialog"], [role="presentation"]'
    );
    if (shouldExclude) {
      setIsValidSwipe(false);
      return;
    }
    
    touchStartX = touch.clientX;
    touchStartY = touch.clientY;
    currentDragOffset = 0;
    setIsValidSwipe(false);
    setIsDragging(false);
    
    // 检查是否从边缘开始
    if (!isOpen() && touch.clientX <= edgeThreshold) {
      setIsValidSwipe(true);
    } else if (isOpen()) {
      setIsValidSwipe(true);
    }
  };
  
  const handleTouchMove = (e: TouchEvent) => {
    if (!isValidSwipe()) return;
    
    const touch = e.touches[0];
    const deltaX = touch.clientX - touchStartX;
    const deltaY = touch.clientY - touchStartY;
    
    // 如果垂直滑动大于水平滑动，取消手势
    if (!isDragging() && Math.abs(deltaY) > Math.abs(deltaX)) {
      setIsValidSwipe(false);
      return;
    }
    
    // 开始拖拽
    if (!isDragging() && Math.abs(deltaX) > 10) {
      setIsDragging(true);
      // 🚀 拖动开始时，禁用侧边栏的 CSS transition
      if (sidebarRef) {
        sidebarRef.style.transition = 'none';
      }
    }
    
    if (isDragging()) {
      // 计算偏移量
      if (isOpen()) {
        currentDragOffset = Math.min(0, deltaX);
      } else {
        currentDragOffset = Math.max(0, deltaX);
      }
      
      // 🚀 使用 requestAnimationFrame 节流，确保每帧只更新一次
      if (rafId === null) {
        rafId = requestAnimationFrame(() => {
          updateDragStyles(currentDragOffset);
          rafId = null;
        });
      }
      
      if (e.cancelable) {
        e.preventDefault();
      }
    }
  };
  
  const handleTouchEnd = () => {
    // 取消未执行的 RAF
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    
    if (!isDragging()) {
      setIsValidSwipe(false);
      return;
    }
    
    const offset = currentDragOffset;
    const threshold = width() * swipeThreshold;
    const wasOpen = isOpen();
    currentDragOffset = 0;
    
    // 🚀 恢复 CSS transition
    if (sidebarRef) {
      sidebarRef.style.transition = 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
    }
    
    // 1) 先手动把 DOM 设置到动画目标位置
    let nextOpen = wasOpen;
    if (wasOpen) {
      if (Math.abs(offset) > threshold) {
        if (sidebarRef) sidebarRef.style.transform = `translateX(-${width()}px) translateZ(0)`;
        if (maskRef) maskRef.style.backgroundColor = 'rgba(0, 0, 0, 0)';
        nextOpen = false;
      } else {
        if (sidebarRef) sidebarRef.style.transform = 'translateX(0) translateZ(0)';
        if (maskRef) maskRef.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
      }
    } else {
      if (offset > threshold) {
        if (sidebarRef) sidebarRef.style.transform = 'translateX(0) translateZ(0)';
        if (maskRef) maskRef.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
        nextOpen = true;
      } else {
        if (sidebarRef) sidebarRef.style.transform = `translateX(-${width()}px) translateZ(0)`;
        if (maskRef) maskRef.style.backgroundColor = 'rgba(0, 0, 0, 0)';
      }
    }
    
    // 2) 设置 pending 标志，必须在重置信号之前：
    //    batch 结束会同步触发 createEffect，此时 props.open 还是旧值，
    //    pending 守卫可阻止 effect 用旧值覆盖已设置好的 transform
    if (nextOpen !== wasOpen) {
      pendingOpenFromGesture = nextOpen;
    }

    // 3) 批量重置信号状态
    batch(() => {
      setIsDragging(false);
      setIsValidSwipe(false);
    });

    // 4) 最后通知 React 更新 open 状态
    if (nextOpen !== wasOpen) {
      props.onOpenChange(nextOpen);
    }
  };
  
  // 绑定全局触摸事件（仅在启用手势时）
  createEffect(() => {
    if (props.enableSwipeGesture === false) return;
    
    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd, { passive: true });
    document.addEventListener('touchcancel', handleTouchEnd, { passive: true });
    
    onCleanup(() => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
      document.removeEventListener('touchcancel', handleTouchEnd);
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
    });
  });
  
  // 🚀 标记是否是首次渲染（用于跳过初始动画）
  let isFirstRender = true;
  
  // 🚀 当 open 状态变化时（通过按钮点击），更新 DOM 样式
  createEffect(() => {
    const open = isOpen();
    const dragging = isDragging();
    
    // 手势刚结束、等待 React 回传新 open 值期间：
    // DOM 已手动设置到目标位置，跳过本次同步，直到 props.open 追上
    if (pendingOpenFromGesture !== null) {
      if (open === pendingOpenFromGesture) {
        pendingOpenFromGesture = null; // React 已确认，恢复正常同步
      }
      return;
    }
    
    // 只在非拖动状态下响应 props.open 变化
    if (!dragging) {
      if (sidebarRef) {
        // 首次渲染不要动画，直接设置位置
        if (isFirstRender) {
          sidebarRef.style.transition = 'none';
          sidebarRef.style.transform = open ? 'translateX(0) translateZ(0)' : `translateX(-${width()}px) translateZ(0)`;
          // 强制重绘后恢复 transition
          requestAnimationFrame(() => {
            if (sidebarRef) {
              sidebarRef.style.transition = 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
            }
          });
          isFirstRender = false;
        } else {
          sidebarRef.style.transition = 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
          sidebarRef.style.transform = open ? 'translateX(0) translateZ(0)' : `translateX(-${width()}px) translateZ(0)`;
        }
      }
      if (maskRef) {
        maskRef.style.backgroundColor = open ? 'rgba(0, 0, 0, 0.5)' : 'rgba(0, 0, 0, 0)';
      }
    }
  });
  
  const shouldShow = () => isOpen() || isDragging();
  
  const isDesktop = () => props.isDesktop ?? false;
  
  // 🚀 标记侧边栏状态，供其他组件（如呼吸灯）检查是否应该捕获手势
  createEffect(() => {
    const show = shouldShow();
    if (show) {
      document.body.setAttribute('data-sidebar-open', 'true');
    } else {
      document.body.removeAttribute('data-sidebar-open');
    }
  });
  
  // 清理 data attribute
  onCleanup(() => {
    document.body.removeAttribute('data-sidebar-open');
  });

  return (
    <Portal>
      {/* 遮罩层 - 仅移动端显示 */}
      {!isDesktop() && (
        <div
          ref={maskRef}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            "z-index": 1200,
            // 🚀 使用静态初始值，由 createEffect 在挂载后设置正确的值
            "background-color": 'rgba(0, 0, 0, 0)',
            opacity: shouldShow() ? 1 : 0,
            "pointer-events": shouldShow() ? 'auto' : 'none',
            // 🚀 只对 opacity 使用 transition，background-color 由 JS 直接控制
            transition: 'opacity 0.3s',
            "will-change": 'opacity',
          }}
          onClick={() => props.onOpenChange(false)}
        />
      )}
      
      {/* 侧边栏 */}
      <div
        ref={sidebarRef}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          bottom: 0,
          width: `${width()}px`,
          "z-index": isDesktop() ? 10 : 1201,
          "background-color": props.themeMode === 'dark' ? '#1a1a1a' : '#ffffff',
          "background-image": 'none',
          opacity: 1,
          "border-right": '1px solid rgba(0,0,0,0.1)',
          "border-radius": isDesktop() ? '0' : '0 16px 16px 0',
          "box-shadow": isDesktop() ? 'none' : '4px 0 20px rgba(0,0,0,0.15)',
          // 根据 props.open 设置初始位置，避免路由切换时的白屏闪烁
          transform: isOpen() ? 'translateX(0) translateZ(0)' : `translateX(-${width()}px) translateZ(0)`,
          // 初始无 transition，由 createEffect 设置
          transition: 'none',
          display: 'flex',
          "flex-direction": 'column',
          overflow: 'hidden',
          isolation: 'isolate',
          "will-change": 'transform',
          "backface-visibility": 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 内容区域 - React 通过 Portal 渲染内容到这里 */}
        <div style={{ flex: 1, overflow: 'hidden' }} id="solid-sidebar-content">
          {props.children}
        </div>
      </div>
    </Portal>
  );
}

export default AppSidebar;
