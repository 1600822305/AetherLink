/**
 * 移动端滚动优化工具函数和样式配置
 */

import type { SxProps } from '@mui/system';
import type { Theme } from '@mui/material/styles';

/**
 * 移动端滚动容器优化样式
 */
export const mobileScrollOptimization: SxProps<Theme> = {
  // iOS 平滑滚动
  WebkitOverflowScrolling: 'touch',
  // 平滑滚动行为
  scrollBehavior: 'smooth',
  // 性能优化 - 移除willChange，避免持续GPU占用
  transform: 'translateZ(0)', // 启用硬件加速
  // 滚动条样式优化 - 调整为6px提升可用性
  scrollbarWidth: 'thin', // Firefox 细滚动条
  '&::-webkit-scrollbar': {
    width: '6px',
    height: '6px',
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
  // 防止过度滚动
  overscrollBehavior: 'contain',
};

/**
 * 触摸优化样式
 */
export const touchOptimization: SxProps<Theme> = {
  // 优化触摸响应
  touchAction: 'manipulation',
  // 防止文本选择干扰滚动
  userSelect: 'none',
  // 移动端点击反馈
  '@media (hover: none)': {
    '&:active': {
      backgroundColor: 'rgba(0, 0, 0, 0.04)',
      transform: 'scale(0.98)',
      transition: 'all 0.1s ease-out',
    },
  },
  // 桌面端悬停效果
  '@media (hover: hover)': {
    '&:hover': {
      backgroundColor: 'rgba(0, 0, 0, 0.02)',
    },
  },
};

/**
 * 渲染性能优化样式
 */
export const renderOptimization: SxProps<Theme> = {
  // 优化渲染性能 - 移除paint避免裁剪问题
  contain: 'layout style',
  // 防止不必要的重绘
  backfaceVisibility: 'hidden',
  // 启用硬件加速
  transform: 'translateZ(0)',
};

/**
 * 动画性能优化配置
 */
export const animationOptimization = {
  // 减少动画时间，提升响应速度
  timeout: { enter: 200, exit: 150 },
  // 使用更流畅的缓动函数
  easing: {
    enter: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
    exit: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
  },
  // 动画容器优化样式
  sx: {
    '& .MuiCollapse-wrapper': {
      // 移除willChange，避免持续GPU占用
      transform: 'translateZ(0)',
    },
    '& .MuiCollapse-wrapperInner': {
      // 移除paint避免裁剪问题
      contain: 'layout style',
    },
  } as SxProps<Theme>,
};

/**
 * 动态willChange管理工具函数
 */
export const enableAnimationAcceleration = (element: HTMLElement) => {
  element.style.willChange = 'height, opacity';
};

export const disableAnimationAcceleration = (element: HTMLElement) => {
  element.style.willChange = 'auto';
};

/**
 * 防止事件冲突的点击处理器
 */
export const createOptimizedClickHandler = (
  originalHandler: () => void
) => {
  return (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation(); // 防止事件冒泡
    originalHandler();
  };
};

/**
 * 查找最近的可滚动祖先容器
 */
const getScrollContainer = (el: HTMLElement): HTMLElement | null => {
  let parent = el.parentElement;
  while (parent) {
    const { overflowY } = window.getComputedStyle(parent);
    if ((overflowY === 'auto' || overflowY === 'scroll') && parent.scrollHeight > parent.clientHeight) {
      return parent;
    }
    parent = parent.parentElement;
  }
  return null;
};

/**
 * 展开折叠项后，将标题平滑滚动到容器顶部附近
 */
export const scrollToExpandedHeader = (headerEl: HTMLElement | null, delay = 220) => {
  if (!headerEl) return;
  setTimeout(() => {
    const container = getScrollContainer(headerEl);
    if (!container) {
      headerEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    const headerRect = headerEl.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    const targetTop = container.scrollTop + headerRect.top - containerRect.top - 8;
    container.scrollTo({
      top: Math.max(0, targetTop),
      behavior: 'smooth'
    });
  }, delay);
};

/**
 * 折叠分组标题的点击处理器：切换展开状态，展开时自动滚动到标题
 */
export const createExpandToggleHandler = (
  expanded: boolean,
  setExpanded: (value: boolean) => void
) => {
  return (e: React.MouseEvent<HTMLElement>) => {
    e.stopPropagation();
    const next = !expanded;
    setExpanded(next);
    if (next) scrollToExpandedHeader(e.currentTarget);
  };
};

/**
 * 防止滚动时意外触发的开关处理器
 */
export const createOptimizedSwitchHandler = (
  originalHandler: (checked: boolean) => void
) => {
  return (e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation(); // 防止事件冒泡
    originalHandler(e.target.checked);
  };
};

/**
 * 可折叠分组标题栏样式 - 展开时变色
 */
export const collapsibleHeaderStyle = (expanded: boolean): SxProps<Theme> => ({
  px: 2,
  py: 0.5,
  cursor: 'pointer',
  position: 'relative',
  zIndex: 1,
  // 禁用点击蓝色高亮
  WebkitTapHighlightColor: 'transparent',
  outline: 'none',
  // 展开时的背景色
  backgroundColor: expanded ? 'rgba(25, 118, 210, 0.06)' : 'transparent',
  borderLeft: expanded ? '3px solid #1976d2' : '3px solid transparent',
  transition: 'background-color 0.2s ease, border-left 0.2s ease',
  // 优化触摸响应
  touchAction: 'manipulation',
  userSelect: 'none',
  // 移动端优化
  '@media (hover: none)': {
    '&:active': {
      backgroundColor: 'rgba(0, 0, 0, 0.04)',
      transform: 'scale(0.98)',
      transition: 'all 0.1s ease-out'
    }
  },
  // 桌面端优化
  '@media (hover: hover)': {
    '&:hover': {
      backgroundColor: expanded ? 'rgba(25, 118, 210, 0.08)' : 'rgba(0, 0, 0, 0.02)',
      transform: 'none !important',
      boxShadow: 'none !important'
    },
    '&:focus': {
      backgroundColor: expanded ? 'rgba(25, 118, 210, 0.06)' : 'transparent !important'
    },
    '&:active': {
      backgroundColor: 'rgba(0, 0, 0, 0.04)'
    }
  },
  '& *': {
    pointerEvents: 'none',
    '&:hover': {
      backgroundColor: 'transparent !important',
      transform: 'none !important'
    }
  }
});

/**
 * 列表项优化样式
 */
export const listItemOptimization: SxProps<Theme> = {
  ...touchOptimization,
  // 防止滚动时的意外交互
  '& .MuiSwitch-root': {
    touchAction: 'manipulation',
  },
  '& .MuiIconButton-root': {
    touchAction: 'manipulation',
  },
};

/**
 * 开关组件优化样式
 */
export const switchOptimization: SxProps<Theme> = {
  // 优化开关的触摸区域
  '& .MuiSwitch-switchBase': {
    padding: '6px',
  },
  '& .MuiSwitch-thumb': {
    transition: 'all 0.2s ease-in-out',
  },
};

/**
 * 应用所有滚动优化的组合样式
 */
export const fullScrollOptimization: SxProps<Theme> = {
  ...mobileScrollOptimization,
  ...renderOptimization,
  // 列表项优化
  '& .MuiListItem-root': {
    ...listItemOptimization,
  },
  // 开关优化
  '& .MuiSwitch-root': {
    ...switchOptimization,
  },
};
