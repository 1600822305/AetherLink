/**
 * SidebarResizeHandle - 侧边栏宽度拖动调整组件
 * 桌面端通过鼠标拖动边框自由调整侧边栏宽度
 */
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Box } from '@mui/material';
import { SIDEBAR_WIDTH_MIN, getSafeMaxSidebarWidth } from './sidebarOptimization';

interface SidebarResizeHandleProps {
  currentWidth: number;
  onWidthChange: (width: number) => void;
  onWidthChangeEnd?: (width: number) => void;
}

const SidebarResizeHandle: React.FC<SidebarResizeHandleProps> = ({
  currentWidth,
  onWidthChange,
  onWidthChangeEnd,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);

  // 开始拖动
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
    startXRef.current = e.clientX;
    startWidthRef.current = currentWidth;
    
    // 添加全局样式防止选中文本
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [currentWidth]);

  // 拖动中
  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - startXRef.current;
      const newWidth = Math.min(
        getSafeMaxSidebarWidth(),
        Math.max(SIDEBAR_WIDTH_MIN, startWidthRef.current + deltaX)
      );
      onWidthChange(newWidth);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      
      // 通知拖动结束，保存宽度
      if (onWidthChangeEnd) {
        const finalWidth = Math.min(
          getSafeMaxSidebarWidth(),
          Math.max(SIDEBAR_WIDTH_MIN, startWidthRef.current + (window.event as MouseEvent)?.clientX - startXRef.current || 0)
        );
        onWidthChangeEnd(finalWidth);
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, onWidthChange, onWidthChangeEnd]);

  return (
    <Box
      onMouseDown={handleMouseDown}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => !isDragging && setIsHovering(false)}
      sx={{
        position: 'absolute',
        top: 0,
        right: -4,
        width: 8,
        height: '100%',
        cursor: 'col-resize',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        // 拖动指示器
        '&::after': {
          content: '""',
          position: 'absolute',
          top: '50%',
          transform: 'translateY(-50%)',
          width: isDragging || isHovering ? 4 : 2,
          height: isDragging || isHovering ? 60 : 40,
          borderRadius: 2,
          backgroundColor: isDragging 
            ? 'primary.main' 
            : isHovering 
              ? 'rgba(0, 0, 0, 0.3)' 
              : 'rgba(0, 0, 0, 0.1)',
          transition: isDragging ? 'none' : 'all 0.2s ease',
        },
        // 悬停时扩大点击区域的视觉反馈
        '&:hover::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.02)',
        },
      }}
    />
  );
};

export default SidebarResizeHandle;
