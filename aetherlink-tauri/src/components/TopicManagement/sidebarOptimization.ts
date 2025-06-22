/**
 * 侧边栏性能优化配置
 * 
 * 这个文件包含了侧边栏动画和性能优化的所有配置
 */

// 动画时长配置
export const ANIMATION_DURATION = {
  FAST: 150,      // 快速动画 - 用于按钮点击等
  NORMAL: 200,    // 正常动画 - 用于侧边栏展开/收起
  SLOW: 300,      // 慢速动画 - 用于复杂动画
} as const;

// 缓动函数配置
export const EASING = {
  // 标准缓动 - 适合大多数场景
  STANDARD: 'cubic-bezier(0.4, 0, 0.2, 1)',
  // 快速进入 - 适合展开动画
  EASE_OUT: 'cubic-bezier(0.0, 0, 0.2, 1)',
  // 快速退出 - 适合收起动画
  EASE_IN: 'cubic-bezier(0.4, 0, 1, 1)',
  // 弹性效果 - 适合交互反馈
  BOUNCE: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
} as const;

// 性能优化的CSS属性
export const PERFORMANCE_CSS = {
  // 硬件加速
  HARDWARE_ACCELERATION: {
    willChange: 'transform',
    transform: 'translateZ(0)',
    backfaceVisibility: 'hidden' as const,
  },
  
  // 渲染优化
  RENDER_OPTIMIZATION: {
    contain: 'layout style paint' as const,
    isolation: 'isolate' as const,
  },
  
  // 滚动优化
  SCROLL_OPTIMIZATION: {
    WebkitOverflowScrolling: 'touch' as const,
    scrollBehavior: 'smooth' as const,
    overscrollBehavior: 'contain' as const,
  },
} as const;

// 移动端抽屉样式（简化版，不干扰SwipeableDrawer）
export const getMobileDrawerStyles = (drawerWidth: number) => ({
  display: { xs: 'block', sm: 'none' },
  '& .MuiDrawer-paper': {
    boxSizing: 'border-box',
    width: drawerWidth,
    borderRadius: '0 16px 16px 0',
  },
});

// 桌面端优化的抽屉样式
export const getDesktopDrawerStyles = (drawerWidth: number, isOpen: boolean) => ({
  display: { xs: 'none', sm: 'block' },
  width: isOpen ? drawerWidth : 0,
  flexShrink: 0,
  // 关键优化：平滑的宽度变化
  transition: `width ${ANIMATION_DURATION.NORMAL}ms ${EASING.STANDARD}`,
  '& .MuiDrawer-paper': {
    boxSizing: 'border-box',
    width: drawerWidth,
    position: 'relative',
    height: '100%',
    border: 'none',
    // 性能优化
    ...PERFORMANCE_CSS.HARDWARE_ACCELERATION,
    ...PERFORMANCE_CSS.RENDER_OPTIMIZATION,
    // 当关闭时隐藏内容，避免渲染
    overflow: isOpen ? 'visible' : 'hidden',
    // 优化过渡动画和隐藏逻辑
    visibility: isOpen ? 'visible' : 'hidden',
    opacity: isOpen ? 1 : 0,
    transition: [
      `all ${ANIMATION_DURATION.NORMAL}ms ${EASING.STANDARD}`,
      `opacity ${ANIMATION_DURATION.NORMAL}ms ${EASING.STANDARD}`,
      `visibility ${ANIMATION_DURATION.NORMAL}ms ${EASING.STANDARD}`
    ].join(', '),
  },
});

// 抽屉内容容器样式
export const getDrawerContentStyles = () => ({
  height: '100%',
  display: 'flex',
  flexDirection: 'column' as const,
  // 添加统一的滚动条在最外层容器
  overflow: 'auto',
  // 自定义滚动条样式，避免宽度变化
  '&::-webkit-scrollbar': {
    width: '1px', /* 尝试更细的宽度，以确认样式是否生效 */
  },
  '&::-webkit-scrollbar-track': {
    background: 'transparent',
  },
  '&::-webkit-scrollbar-thumb': {
    background: 'rgba(0, 0, 0, 0.2)',
    borderRadius: '3px',
    '&:hover': {
      background: 'rgba(0, 0, 0, 0.3)',
    },
  },
  // Firefox 滚动条样式
  scrollbarWidth: 'thin',
  scrollbarColor: 'rgba(0, 0, 0, 0.2) transparent',
  // 性能优化
  ...PERFORMANCE_CSS.HARDWARE_ACCELERATION,
  ...PERFORMANCE_CSS.RENDER_OPTIMIZATION,
});

// 关闭按钮样式
export const getCloseButtonStyles = () => ({
  display: 'flex',
  justifyContent: 'flex-end',
  p: 1,
  // 优化按钮区域
  minHeight: 48,
  alignItems: 'center',
});

// 关闭按钮交互样式
export const getCloseButtonInteractionStyles = () => ({
  // 优化点击响应
  transition: `all ${ANIMATION_DURATION.FAST}ms ${EASING.STANDARD}`,
  '&:hover': {
    backgroundColor: 'rgba(0, 0, 0, 0.04)',
    transform: 'scale(1.05)',
  },
  '&:active': {
    transform: 'scale(0.95)',
  },
  // 移动端优化
  '@media (hover: none)': {
    '&:hover': {
      backgroundColor: 'transparent',
      transform: 'none',
    },
    '&:active': {
      backgroundColor: 'rgba(0, 0, 0, 0.08)',
      transform: 'scale(0.95)',
    },
  },
});

// 防抖配置
export const DEBOUNCE_CONFIG = {
  TOGGLE_DELAY: 50,     // 切换防抖延迟
  ANIMATION_DELAY: 16,  // 动画帧延迟 (约60fps)
} as const;

// 创建优化的切换处理函数
export const createOptimizedToggleHandler = (
  callback: () => void,
  isTogglingRef: React.MutableRefObject<boolean>,
  animationFrameRef: React.MutableRefObject<number | undefined>
) => {
  return () => {
    // 防止快速连续点击
    if (isTogglingRef.current) return;
    
    isTogglingRef.current = true;
    
    // 使用 requestAnimationFrame 确保在下一帧执行，避免阻塞UI
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    
    animationFrameRef.current = requestAnimationFrame(() => {
      callback();
      
      // 重置防抖标志
      setTimeout(() => {
        isTogglingRef.current = false;
      }, DEBOUNCE_CONFIG.TOGGLE_DELAY);
    });
  };
};

// 模态框优化配置（SwipeableDrawer专用）
export const MODAL_OPTIMIZATION = {
  keepMounted: true, // 保持DOM挂载，提升性能
  disablePortal: false,
  disableScrollLock: true, // 避免滚动锁定
  // 减少重绘和焦点管理开销
  disableEnforceFocus: true,
  disableAutoFocus: true,
  // SwipeableDrawer专用优化
  disableRestoreFocus: true, // 避免焦点恢复开销
} as const;

// SwipeableDrawer专用配置
export const SWIPEABLE_DRAWER_CONFIG = {
  // 滑动手势配置
  hysteresis: 0.52, // 滑动阻力，推荐值
  minFlingVelocity: 450, // 最小滑动速度 (px/s)
  // 性能优化
  disableBackdropTransition: false, // 保持背景过渡
  disableDiscovery: false, // 保持边缘发现
  // 边缘滑动区域
  swipeAreaWidth: 20, // 边缘滑动区域宽度
} as const;

// 预加载优化
export const PRELOAD_CONFIG = {
  // 预渲染内容以减少首次打开延迟
  PRERENDER_CONTENT: true,
  // 保持DOM结构以加快后续打开速度
  KEEP_MOUNTED: true,
} as const;
