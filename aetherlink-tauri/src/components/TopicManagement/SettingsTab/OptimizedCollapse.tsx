import React, { useState, useEffect } from 'react';
import { Box } from '@mui/material';
import type { SxProps, Theme } from '@mui/material';

interface OptimizedCollapseProps {
  /** 是否展开 */
  in: boolean;
  /** 子组件 */
  children: React.ReactNode;
  /** 动画时长（毫秒） */
  timeout?: number;
  /** 退出时卸载 */
  unmountOnExit?: boolean;
  /** 自定义样式 */
  sx?: SxProps<Theme>;
  /** 动画完成回调 */
  onEntered?: () => void;
  onExited?: () => void;
}

/**
 * 高性能折叠组件 - 简单有效
 * 使用 clip-path 实现折叠效果，性能好且兼容性强
 */
export default function OptimizedCollapse({
  in: isOpen,
  children,
  timeout = 150,
  unmountOnExit = false,
  sx,
  onEntered,
  onExited
}: OptimizedCollapseProps) {
  const [shouldRender, setShouldRender] = useState(isOpen || !unmountOnExit);

  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
      if (onEntered) {
        const timer = setTimeout(onEntered, timeout);
        return () => clearTimeout(timer);
      }
    } else {
      if (onExited) {
        const timer = setTimeout(onExited, timeout);
        return () => clearTimeout(timer);
      }
      if (unmountOnExit) {
        const timer = setTimeout(() => setShouldRender(false), timeout);
        return () => clearTimeout(timer);
      }
    }
  }, [isOpen, timeout, unmountOnExit, onEntered, onExited]);

  if (!shouldRender) {
    return null;
  }

  return (
    <Box
      sx={{
        clipPath: isOpen ? 'inset(0 0 0 0)' : 'inset(0 0 100% 0)',
        transition: `clip-path ${timeout}ms cubic-bezier(0.25, 0.46, 0.45, 0.94)`,
        contain: 'layout style paint',
        ...sx
      }}
    >
      {children}
    </Box>
  );
}


