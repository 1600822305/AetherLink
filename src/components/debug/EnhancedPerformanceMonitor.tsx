import React, { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { 
  Box, 
  Typography, 
  Chip, 
  Paper, 
  IconButton
} from '@mui/material';
import { 
  Activity, 
  ChevronUp, 
  ChevronDown, 
  GripVertical
} from 'lucide-react';
import { useAppSelector } from '../../shared/store';
import { createLogger } from '../../shared/services/infra/logger';

const logger = createLogger('EnhancedPerformanceMonitor');

interface PerformanceMetrics {
  fps: number;
  renderTime: number;
  memoryUsage?: number;
  jsHeapSize?: number;
  totalJSHeapSize?: number;
}


interface EnhancedPerformanceMonitorProps {
  enabled?: boolean;
  forceShow?: boolean;
}

/**
 * 增强版全局性能监控组件
 * 监控FPS、帧时间、内存使用等核心性能指标
 */
const EnhancedPerformanceMonitor: React.FC<EnhancedPerformanceMonitorProps> = ({
  enabled = process.env.NODE_ENV === 'development',
  forceShow = false
}) => {
  // 从Redux获取性能监控显示设置
  const showPerformanceMonitor = useAppSelector((state) => state.settings.showPerformanceMonitor);

  // 决定是否显示
  const shouldShow = showPerformanceMonitor !== undefined
    ? showPerformanceMonitor
    : (enabled || forceShow);

  // UI状态
  const [isExpanded, setIsExpanded] = useState(false);

  // 拖拽状态
  const [position, setPosition] = useState(() => {
    try {
      const saved = localStorage.getItem('enhancedPerformanceMonitorPosition');
      return saved ? JSON.parse(saved) : { x: 16, y: 80 };
    } catch {
      return { x: 16, y: 80 };
    }
  });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const dragRef = useRef<HTMLDivElement>(null);
  const currentPositionRef = useRef(position);
  const savePositionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const rafRef = useRef<number | null>(null);

  // 性能指标
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    fps: 0,
    renderTime: 0,
    memoryUsage: 0,
    jsHeapSize: 0,
    totalJSHeapSize: 0
  });

  // 监控引用
  const frameCountRef = useRef(0);
  const lastTimeRef = useRef(performance.now());

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
        localStorage.setItem('enhancedPerformanceMonitorPosition', JSON.stringify(finalPosition));
      } catch (error) {
        logger.warn('无法保存性能监控位置:', error);
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

  // 性能监控主逻辑
  useEffect(() => {
    if (!shouldShow) return;

    let animationId: number;

    // FPS监控
    const measureFPS = () => {
      frameCountRef.current++;
      const now = performance.now();
      const delta = now - lastTimeRef.current;

      if (delta >= 1000) {
        const fps = Math.round((frameCountRef.current * 1000) / delta);
        const frameTime = delta / frameCountRef.current;

        // 获取内存信息
        let memoryUsage = 0;
        let jsHeapSize = 0;
        let totalJSHeapSize = 0;
        
        if ('memory' in performance) {
          const memory = (performance as any).memory;
          memoryUsage = Math.round(memory.usedJSHeapSize / 1024 / 1024);
          jsHeapSize = Math.round(memory.usedJSHeapSize / 1024 / 1024);
          totalJSHeapSize = Math.round(memory.totalJSHeapSize / 1024 / 1024);
        }

        setMetrics(prev => ({
          ...prev,
          fps,
          renderTime: frameTime,
          memoryUsage,
          jsHeapSize,
          totalJSHeapSize
        }));

        frameCountRef.current = 0;
        lastTimeRef.current = now;
      }

      animationId = requestAnimationFrame(measureFPS);
    };

    // 开始监控
    animationId = requestAnimationFrame(measureFPS);

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [shouldShow]);

  const toggleExpanded = () => {
    setIsExpanded(!isExpanded);
  };

  const getFPSColor = (fps: number) => {
    if (fps >= 55) return 'success';
    if (fps >= 30) return 'warning';
    return 'error';
  };

  const getMemoryColor = (usage: number) => {
    if (usage < 100) return 'success';
    if (usage < 200) return 'warning';
    return 'error';
  };

  if (!shouldShow) return null;

  const performanceMonitor = (
    <Paper
      ref={dragRef}
      elevation={3}
      sx={{
        position: 'fixed',
        left: position.x,
        top: position.y,
        zIndex: 10000,
        minWidth: isExpanded ? 320 : 'auto',
        maxWidth: isExpanded ? 400 : 'auto',
        width: isExpanded ? 'auto' : 'fit-content',
        backgroundColor: 'rgba(0, 0, 0, 0.9)',
        color: 'white',
        borderRadius: isExpanded ? 2 : 1.5,
        backdropFilter: 'blur(10px)',
        userSelect: 'none',
        fontSize: { xs: '0.8rem', sm: '0.9rem' },
        cursor: isDragging ? 'grabbing' : 'default',
        transition: isDragging ? 'none' : 'all 0.3s ease',
        pointerEvents: 'auto',
        border: '1px solid rgba(255, 255, 255, 0.1)'
      }}
    >
      {/* 标题栏 */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          p: isExpanded ? 1.5 : 0.75,
          cursor: 'grab',
          '&:active': { cursor: 'grabbing' },
          borderBottom: isExpanded ? '1px solid rgba(255, 255, 255, 0.1)' : 'none',
          touchAction: 'none',
          userSelect: 'none',
          background: 'linear-gradient(135deg, rgba(76, 175, 80, 0.2), rgba(33, 150, 243, 0.2))',
          borderRadius: isExpanded ? 0 : 1.5
        }}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: isExpanded ? 1 : 0.5 }}>
          <GripVertical size={isExpanded ? 14 : 12} style={{ opacity: 0.7 }} />
          <Activity size={isExpanded ? 18 : 14} />
          {isExpanded && (
            <Typography variant="h6" sx={{ fontSize: '0.95rem', fontWeight: 600 }}>
              性能监控
            </Typography>
          )}
        </Box>
        <IconButton
          size="small"
          onClick={toggleExpanded}
          sx={{ color: 'white', p: isExpanded ? 0.5 : 0.25 }}
        >
          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={14} />}
        </IconButton>
      </Box>

      {/* 性能指标内容 */}
      {isExpanded && (
        <Box sx={{ p: 2 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="body2" sx={{ fontSize: '0.85rem' }}>FPS:</Typography>
              <Chip
                label={metrics.fps}
                size="small"
                color={getFPSColor(metrics.fps)}
                sx={{ minWidth: 50, fontWeight: 600 }}
              />
            </Box>

            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="body2" sx={{ fontSize: '0.85rem' }}>帧时间:</Typography>
              <Chip
                label={`${metrics.renderTime.toFixed(1)}ms`}
                size="small"
                color={metrics.renderTime < 16 ? 'success' : 'warning'}
                sx={{ minWidth: 50 }}
              />
            </Box>

            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="body2" sx={{ fontSize: '0.85rem' }}>内存:</Typography>
              <Chip
                label={`${metrics.memoryUsage}MB`}
                size="small"
                color={getMemoryColor(metrics.memoryUsage || 0)}
                sx={{ minWidth: 50 }}
              />
            </Box>

            {metrics.totalJSHeapSize && (
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="body2" sx={{ fontSize: '0.85rem' }}>堆使用率:</Typography>
                <Chip
                  label={`${((metrics.jsHeapSize! / metrics.totalJSHeapSize) * 100).toFixed(1)}%`}
                  size="small"
                  color="info"
                  sx={{ minWidth: 50 }}
                />
              </Box>
            )}
          </Box>
        </Box>
      )}
    </Paper>
  );

  return createPortal(performanceMonitor, document.body);
};

export default EnhancedPerformanceMonitor;

