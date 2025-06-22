import React, { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Box, Typography, Chip, Paper, IconButton } from '@mui/material';
import { Activity, ChevronUp, ChevronDown, GripVertical } from 'lucide-react';
import { useAppSelector } from '../../shared/store';

interface ScrollPerformanceMonitorProps {
  enabled?: boolean;
  targetId?: string;
  forceShow?: boolean; // 🚀 强制显示选项
}

interface PerformanceMetrics {
  fps: number;
  scrollEvents: number;
  renderTime: number;
  memoryUsage?: number;
  scrollEventsPerSecond: number; // 新增：每秒滚动事件数
}

/**
 * 滚动性能监控组件
 * 用于调试和监控滚动性能
 */
const ScrollPerformanceMonitor: React.FC<ScrollPerformanceMonitorProps> = ({
  enabled = process.env.NODE_ENV === 'development',
  targetId = 'messageList',
  forceShow = false
}) => {
  // 从Redux获取性能监控显示设置
  const showPerformanceMonitor = useAppSelector((state) => state.settings.showPerformanceMonitor);

  // 🚀 根据设置决定是否显示
  // 如果用户明确设置了showPerformanceMonitor，则以用户设置为准
  // 如果用户没有设置（undefined），则在开发环境中默认显示
  const shouldShow = showPerformanceMonitor !== undefined
    ? showPerformanceMonitor
    : (enabled || forceShow);

  // 悬浮窗展开/收起状态
  const [isExpanded, setIsExpanded] = useState(true); // 默认展开

  // 拖拽相关状态
  const [position, setPosition] = useState(() => {
    // 从localStorage恢复位置
    try {
      const saved = localStorage.getItem('performanceMonitorPosition');
      return saved ? JSON.parse(saved) : { x: 16, y: 80 };
    } catch {
      return { x: 16, y: 80 };
    }
  });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const dragRef = useRef<HTMLDivElement>(null);

  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    fps: 0,
    scrollEvents: 0,
    renderTime: 0,
    memoryUsage: 0,
    scrollEventsPerSecond: 0
  });

  const frameCountRef = useRef(0);
  const lastTimeRef = useRef(performance.now());
  const scrollEventsCountRef = useRef(0);
  const scrollEventsStartTimeRef = useRef(performance.now());

  // 拖拽事件处理 - 统一处理鼠标和触摸事件
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

    // 限制在屏幕范围内
    const maxX = window.innerWidth - 200; // 减去组件宽度
    const maxY = window.innerHeight - 300; // 减去组件高度

    setPosition({
      x: Math.max(0, Math.min(newX, maxX)),
      y: Math.max(0, Math.min(newY, maxY))
    });
  }, [isDragging, dragStart]);

  const endDrag = useCallback(() => {
    setIsDragging(false);
  }, []);

  // 鼠标事件处理
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

  // 触摸事件处理
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

  // 保存位置到localStorage
  useEffect(() => {
    try {
      localStorage.setItem('performanceMonitorPosition', JSON.stringify(position));
    } catch (error) {
      console.warn('无法保存性能监控位置:', error);
    }
  }, [position]);

  // 添加全局鼠标和触摸事件监听
  useEffect(() => {
    if (isDragging) {
      // 鼠标事件
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);

      // 触摸事件
      document.addEventListener('touchmove', handleTouchMove, { passive: false });
      document.addEventListener('touchend', handleTouchEnd);
      document.addEventListener('touchcancel', handleTouchEnd);

      return () => {
        // 清理鼠标事件
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);

        // 清理触摸事件
        document.removeEventListener('touchmove', handleTouchMove);
        document.removeEventListener('touchend', handleTouchEnd);
        document.removeEventListener('touchcancel', handleTouchEnd);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp, handleTouchMove, handleTouchEnd]);

  useEffect(() => {
    if (!shouldShow) return;

    let animationId: number;

    // FPS 监控
    const measureFPS = () => {
      frameCountRef.current++;
      const now = performance.now();
      const delta = now - lastTimeRef.current;

      if (delta >= 1000) {
        const fps = Math.round((frameCountRef.current * 1000) / delta);

        // 计算单帧渲染时间（毫秒）
        const frameTime = delta / frameCountRef.current;

        setMetrics(prev => ({
          ...prev,
          fps,
          renderTime: frameTime
        }));

        frameCountRef.current = 0;
        lastTimeRef.current = now;
      }

      animationId = requestAnimationFrame(measureFPS);
    };

    // 滚动事件监控 - 优化高频事件处理
    const handleScroll = () => {
      scrollEventsCountRef.current++;
      const now = performance.now();
      const timeDelta = now - scrollEventsStartTimeRef.current;

      // 每秒更新一次滚动事件统计
      if (timeDelta >= 1000) {
        const eventsPerSecond = Math.round((scrollEventsCountRef.current * 1000) / timeDelta);

        setMetrics(prev => ({
          ...prev,
          scrollEvents: scrollEventsCountRef.current,
          scrollEventsPerSecond: eventsPerSecond
        }));

        // 重置计数器
        scrollEventsCountRef.current = 0;
        scrollEventsStartTimeRef.current = now;
      }
    };

    // 内存使用监控
    const measureMemory = () => {
      if ('memory' in performance) {
        const memory = (performance as any).memory;
        setMetrics(prev => ({
          ...prev,
          memoryUsage: Math.round(memory.usedJSHeapSize / 1024 / 1024)
        }));
      }
    };

    // 开始监控
    animationId = requestAnimationFrame(measureFPS);

    // 监听滚动事件
    const targetElement = document.getElementById(targetId);
    if (targetElement) {
      targetElement.addEventListener('scroll', handleScroll, { passive: true });
    }

    // 定期测量内存
    const memoryInterval = setInterval(measureMemory, 2000);

    return () => {
      cancelAnimationFrame(animationId);
      clearInterval(memoryInterval);

      if (targetElement) {
        targetElement.removeEventListener('scroll', handleScroll);
      }
    };
  }, [shouldShow, targetId]);

  if (!shouldShow) return null;

  const getFPSColor = (fps: number) => {
    if (fps >= 55) return 'success';
    if (fps >= 30) return 'warning';
    return 'error';
  };

  const getScrollColor = (events: number) => {
    // 移动设备触摸滚动会产生更多事件，调整阈值
    if (events <= 50) return 'success';   // 正常范围
    if (events <= 100) return 'warning';  // 中等频率
    return 'error';                       // 过高频率
  };

  // 切换展开/收起状态
  const toggleExpanded = () => {
    setIsExpanded(!isExpanded);
  };

  // 使用Portal将组件渲染到body下，避免被聊天界面容器限制
  if (!shouldShow) return null;

  const performanceMonitor = (
    <Paper
      ref={dragRef}
      elevation={3}
      sx={{
        position: 'fixed',
        left: position.x,
        top: position.y,
        zIndex: 10000, // 提高z-index确保在最顶层
        minWidth: { xs: 180, sm: 200 },
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        color: 'white',
        borderRadius: 2,
        backdropFilter: 'blur(8px)',
        userSelect: 'none',
        fontSize: { xs: '0.8rem', sm: '1rem' },
        cursor: isDragging ? 'grabbing' : 'default',
        transition: isDragging ? 'none' : 'all 0.2s ease',
        // 确保不被父容器的overflow影响
        pointerEvents: 'auto',
      }}
    >
      {/* 可拖拽的标题栏 */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          p: 1,
          cursor: 'grab',
          '&:active': { cursor: 'grabbing' },
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          // 移动端触摸优化
          touchAction: 'none',
          userSelect: 'none'
        }}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <GripVertical size={14} style={{ opacity: 0.7 }} />
          <Activity size={16} />
          <Typography variant="h6" sx={{ fontSize: { xs: '0.8rem', sm: '0.9rem' } }}>
            性能监控
          </Typography>
        </Box>
        <IconButton
          size="small"
          onClick={toggleExpanded}
          sx={{ color: 'white', p: 0.5 }}
        >
          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </IconButton>
      </Box>

      {/* 性能指标内容 */}
      {isExpanded && (
        <Box sx={{ p: 2 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="body2">FPS:</Typography>
              <Chip
                label={metrics.fps}
                size="small"
                color={getFPSColor(metrics.fps)}
                sx={{ minWidth: 50 }}
              />
            </Box>

            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="body2" title="移动设备触摸滚动通常产生高频事件">
                滚动/秒:
              </Typography>
              <Chip
                label={metrics.scrollEventsPerSecond}
                size="small"
                color={getScrollColor(metrics.scrollEventsPerSecond)}
                sx={{ minWidth: 50 }}
              />
            </Box>

            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="body2">渲染:</Typography>
              <Chip
                label={`${metrics.renderTime.toFixed(1)}ms`}
                size="small"
                color={metrics.renderTime < 16 ? 'success' : 'warning'}
                sx={{ minWidth: 50 }}
              />
            </Box>

            {metrics.memoryUsage !== undefined && (
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="body2">内存:</Typography>
                <Chip
                  label={`${metrics.memoryUsage}MB`}
                  size="small"
                  color={metrics.memoryUsage < 100 ? 'success' : 'warning'}
                  sx={{ minWidth: 50 }}
                />
              </Box>
            )}
          </Box>

          <Typography variant="caption" sx={{ mt: 1, display: 'block', opacity: 0.7 }}>
            目标: {targetId}
          </Typography>
        </Box>
      )}
    </Paper>
  );

  // 使用Portal将组件渲染到document.body，确保不受父容器限制
  return createPortal(performanceMonitor, document.body);
};

export default ScrollPerformanceMonitor;
