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
  // 性能优化
  willChange: 'scroll-position',
  transform: 'translateZ(0)', // 启用硬件加速
  // 滚动条样式优化
  scrollbarWidth: 'thin', // Firefox 细滚动条
  '&::-webkit-scrollbar': {
    width: '4px',
    height: '4px',
  },
  '&::-webkit-scrollbar-track': {
    background: 'transparent',
  },
  '&::-webkit-scrollbar-thumb': {
    background: 'rgba(0, 0, 0, 0.2)',
    borderRadius: '2px',
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
  // 优化渲染性能
  contain: 'layout style paint',
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
      willChange: 'height',
      transform: 'translateZ(0)',
    },
    '& .MuiCollapse-wrapperInner': {
      contain: 'layout style paint',
    },
  } as SxProps<Theme>,
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
