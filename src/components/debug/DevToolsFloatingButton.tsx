import React, { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  Paper
} from '@mui/material';
import {
  Terminal
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAppSelector } from '../../shared/store';
import { createLogger } from '../../shared/services/infra/logger';

const logger = createLogger('DevToolsFloatingButton');

interface DevToolsFloatingButtonProps {
  enabled?: boolean;
  forceShow?: boolean;
}

/**
 * 开发者工具悬浮按钮组件
 * 采用与性能监控相同的拖拽逻辑和UI设计
 */
const DevToolsFloatingButton: React.FC<DevToolsFloatingButtonProps> = ({
  enabled = process.env.NODE_ENV === 'development',
  forceShow = false
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  
  // 从Redux获取显示设置
  const showDevToolsFloatingButton = useAppSelector((state) => state.settings.showDevToolsFloatingButton);

  // 决定是否显示
  const shouldShow = showDevToolsFloatingButton !== undefined
    ? showDevToolsFloatingButton
    : (enabled || forceShow);

  // 拖拽状态
  const [position, setPosition] = useState(() => {
    try {
      const saved = localStorage.getItem('devToolsFloatingButtonPosition');
      return saved ? JSON.parse(saved) : { x: 16, y: 140 };
    } catch {
      return { x: 16, y: 140 };
    }
  });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const dragRef = useRef<HTMLDivElement>(null);
  const currentPositionRef = useRef(position);
  const savePositionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const rafRef = useRef<number | null>(null);
  const previousPageRef = useRef<string>('/');

  // 记录进入开发者工具前的页面
  useEffect(() => {
    if (location.pathname !== '/devtools') {
      previousPageRef.current = location.pathname;
    }
  }, [location.pathname]);

  // 拖拽处理
  const startDrag = useCallback((clientX: number, clientY: number) => {
    setIsDragging(true);
    setDragStart({
      x: clientX - position.x,
      y: clientY - position.y
    });
  }, [position]);

  const updateDragPosition = useCallback((clientX: number, clientY: number) => {
    if (!isDragging) return;

    const newX = clientX - dragStart.x;
    const newY = clientY - dragStart.y;

    const newPosition = {
      x: newX,
      y: newY
    };

    currentPositionRef.current = newPosition;

    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
    }

    rafRef.current = requestAnimationFrame(() => {
      if (dragRef.current) {
        dragRef.current.style.left = `${newPosition.x}px`;
        dragRef.current.style.top = `${newPosition.y}px`;
      }
    });
  }, [isDragging, dragStart]);

  const endDrag = useCallback(() => {
    setIsDragging(false);
    const finalPosition = currentPositionRef.current;
    setPosition(finalPosition);

    if (savePositionTimeoutRef.current) {
      clearTimeout(savePositionTimeoutRef.current);
    }
    savePositionTimeoutRef.current = setTimeout(() => {
      try {
        localStorage.setItem('devToolsFloatingButtonPosition', JSON.stringify(finalPosition));
      } catch (error) {
        logger.warn('无法保存开发者工具按钮位置:', error);
      }
    }, 500);

    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    startDrag(e.clientX, e.clientY);
  }, [startDrag]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    updateDragPosition(e.clientX, e.clientY);
  }, [updateDragPosition]);

  const handleMouseUp = useCallback(() => {
    endDrag();
  }, [endDrag]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    const touch = e.touches[0];
    startDrag(touch.clientX, touch.clientY);
  }, [startDrag]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    e.preventDefault();
    const touch = e.touches[0];
    updateDragPosition(touch.clientX, touch.clientY);
  }, [updateDragPosition]);

  const handleTouchEnd = useCallback(() => {
    endDrag();
  }, [endDrag]);

  useEffect(() => {
    currentPositionRef.current = position;
  }, [position]);

  // 拖拽事件监听
  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.addEventListener('touchmove', handleTouchMove, { passive: false });
      document.addEventListener('touchend', handleTouchEnd);
      document.addEventListener('touchcancel', handleTouchEnd);

      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.removeEventListener('touchmove', handleTouchMove);
        document.removeEventListener('touchend', handleTouchEnd);
        document.removeEventListener('touchcancel', handleTouchEnd);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp, handleTouchMove, handleTouchEnd]);

  // 清理
  useEffect(() => {
    return () => {
      if (savePositionTimeoutRef.current) {
        clearTimeout(savePositionTimeoutRef.current);
      }
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  const handleClick = () => {
    // 如果当前在开发者工具页面，返回之前的页面
    if (location.pathname === '/devtools') {
      navigate(previousPageRef.current || '/');
    } else {
      // 否则打开开发者工具
      navigate('/devtools');
    }
  };

  if (!shouldShow) return null;

  const isOnDevToolsPage = location.pathname === '/devtools';

  const floatingButton = (
    <Paper
      ref={dragRef}
      elevation={3}
      onClick={handleClick}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
      sx={{
        position: 'fixed',
        left: position.x,
        top: position.y,
        zIndex: 10000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 48,
        height: 48,
        backgroundColor: isOnDevToolsPage
          ? 'rgba(76, 175, 80, 0.9)'
          : 'rgba(33, 150, 243, 0.9)',
        color: 'white',
        borderRadius: '50%',
        backdropFilter: 'blur(10px)',
        userSelect: 'none',
        cursor: isDragging ? 'grabbing' : 'pointer',
        transition: isDragging ? 'none' : 'all 0.3s ease',
        pointerEvents: 'auto',
        border: '1px solid rgba(255, 255, 255, 0.2)',
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        '&:hover': {
          backgroundColor: isOnDevToolsPage
            ? 'rgba(76, 175, 80, 1)'
            : 'rgba(33, 150, 243, 1)',
          transform: isDragging ? 'none' : 'scale(1.1)',
          boxShadow: '0 6px 16px rgba(0,0,0,0.25)',
        },
        '&:active': {
          transform: isDragging ? 'none' : 'scale(0.95)',
        }
      }}
    >
      <Terminal size={24} />
    </Paper>
  );

  return createPortal(floatingButton, document.body);
};

export default DevToolsFloatingButton;
