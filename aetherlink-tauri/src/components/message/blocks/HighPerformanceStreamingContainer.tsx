import React, { useRef, useEffect, useState, useMemo } from 'react';
import { throttle } from 'lodash';
import {
  shouldUseHighPerformanceMode,
  getHighPerformanceUpdateInterval,
  getHighPerformanceRenderMode
} from '../../../shared/utils/performanceSettings';

interface Props {
  content: string;
  isStreaming: boolean;
  onComplete?: () => void;
}

/**
 * 虚拟化渲染容器
 * 只渲染可见区域，大幅提升性能
 */
const VirtualizedRenderer: React.FC<{ content: string }> = ({ content }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [visibleContent, setVisibleContent] = useState('');

  // 计算可见内容（简化版虚拟滚动）
  useEffect(() => {
    if (!containerRef.current) return;

    // 估算可见行数（基于容器高度）
    const containerHeight = containerRef.current.clientHeight || 400;
    const lineHeight = 20; // 估算行高
    const visibleLines = Math.ceil(containerHeight / lineHeight) + 5; // 多渲染5行缓冲

    // 只显示最后的可见行数 - 增强安全检查
    try {
      if (content && typeof content === 'string') {
        const lines = (content || '').split('\n');
        const startIndex = Math.max(0, lines.length - visibleLines);
        const visibleLines_actual = lines.slice(startIndex);

        setVisibleContent(visibleLines_actual.join('\n'));
      } else {
        setVisibleContent('');
      }
    } catch (error) {
      console.error('[VirtualizedRenderer] 处理内容时出错:', error);
      setVisibleContent('');
    }
  }, [content]);

  return (
    <div
      ref={containerRef}
      style={{
        minHeight: '100px',    // 设置最小高度
        overflow: 'hidden',
        whiteSpace: 'pre-wrap',
        fontFamily: 'inherit', // 继承父元素字体
        fontSize: 'inherit',   // 继承父元素字体大小
        lineHeight: 'inherit', // 继承父元素行高
        color: 'inherit',      // 继承父元素颜色
        // 性能优化
        contain: 'layout style paint',
        willChange: 'contents'
      }}
    >
      {visibleContent}
    </div>
  );
};

/**
 * Canvas 渲染容器
 * 使用 Canvas 绘制文本，避免 DOM 操作
 */
const CanvasRenderer: React.FC<{ content: string }> = ({ content }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 获取容器的计算样式
    const computedStyle = window.getComputedStyle(container);
    const fontSize = computedStyle.fontSize || '14px';
    const fontFamily = computedStyle.fontFamily || 'inherit';
    const color = computedStyle.color || '#333';
    const lineHeight = parseFloat(computedStyle.lineHeight) || parseFloat(fontSize) * 1.4;

    // 设置 Canvas 尺寸
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * window.devicePixelRatio;
    canvas.height = rect.height * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    // 清空画布
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 设置文本样式（使用继承的样式）
    ctx.font = `${fontSize} ${fontFamily}`;
    ctx.fillStyle = color;
    ctx.textBaseline = 'top';

    // 绘制文本（只绘制最后几行）- 增强安全检查
    try {
      if (!content || typeof content !== 'string') return;

      const lines = (content || '').split('\n');
      const maxLines = Math.floor(rect.height / lineHeight);
      const visibleLines = lines.slice(-maxLines);

      visibleLines.forEach((line, index) => {
        ctx.fillText(line, 10, index * lineHeight + 10);
      });
    } catch (error) {
      console.error('[CanvasRenderer] 绘制文本时出错:', error);
    }
  }, [content]);

  return (
    <div ref={containerRef} style={{
      width: '100%',
      minHeight: '100px',
      position: 'relative',
      fontFamily: 'inherit',
      fontSize: 'inherit',
      color: 'inherit'
    }}>
      <canvas
        ref={canvasRef}
        style={{
          width: '100%',
          height: '100%',
          display: 'block'
        }}
      />
    </div>
  );
};

/**
 * 最小化渲染容器
 * 使用最简单的 DOM 结构
 */
const MinimalRenderer: React.FC<{ content: string }> = ({ content }) => {
  // 只显示最后1000个字符，避免DOM过大
  const displayContent = useMemo(() => {
    if (content.length <= 1000) return content;
    return '...' + content.slice(-1000);
  }, [content]);

  return (
    <pre style={{
      margin: 0,
      padding: 0,
      whiteSpace: 'pre-wrap',
      wordBreak: 'break-word',
      fontFamily: 'inherit',
      fontSize: 'inherit',
      // 性能优化
      contain: 'layout style',
      willChange: 'contents'
    }}>
      {displayContent}
    </pre>
  );
};

/**
 * 超高性能流式渲染容器
 * 根据设置选择不同的渲染策略
 */
const HighPerformanceStreamingContainer: React.FC<Props> = ({ content, isStreaming, onComplete }) => {
  const [throttledContent, setThrottledContent] = useState(content);
  const contentRef = useRef(content);
  const renderMode = getHighPerformanceRenderMode();
  const useHighPerformance = shouldUseHighPerformanceMode(isStreaming);

  // 节流更新内容
  const throttledUpdate = useMemo(() => {
    if (!useHighPerformance || !isStreaming) return null;

    return throttle(() => {
      setThrottledContent(contentRef.current);
    }, getHighPerformanceUpdateInterval());
  }, [useHighPerformance, isStreaming]);

  // 更新内容
  useEffect(() => {
    contentRef.current = content;

    if (throttledUpdate) {
      throttledUpdate();
    } else {
      setThrottledContent(content);
    }
  }, [content, throttledUpdate]);

  // 清理
  useEffect(() => {
    return () => throttledUpdate?.cancel();
  }, [throttledUpdate]);

  // 监听流式完成
  useEffect(() => {
    if (!isStreaming && onComplete) {
      // 延迟调用，确保最后的内容更新完成
      const timer = setTimeout(onComplete, 100);
      return () => clearTimeout(timer);
    }
  }, [isStreaming, onComplete]);

  const displayContent = useHighPerformance && isStreaming ? throttledContent : content;

  // 根据渲染模式选择渲染器
  if (useHighPerformance && isStreaming) {
    switch (renderMode) {
      case 'virtual':
        return <VirtualizedRenderer content={displayContent} />;
      case 'canvas':
        return <CanvasRenderer content={displayContent} />;
      case 'minimal':
        return <MinimalRenderer content={displayContent} />;
      default:
        return <MinimalRenderer content={displayContent} />;
    }
  }

  // 非高性能模式或已完成，返回 null（由父组件处理）
  return null;
};

export default HighPerformanceStreamingContainer;
