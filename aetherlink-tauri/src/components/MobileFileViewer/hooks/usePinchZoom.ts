import { useState, useCallback } from 'react';
import { usePinch } from '@use-gesture/react';

interface UsePinchZoomOptions {
  minScale?: number;
  maxScale?: number;
  initialScale?: number;
  scaleStep?: number;
  onScaleChange?: (scale: number) => void;
}

interface PinchZoomReturn {
  scale: number;
  zoomIn: () => void;
  zoomOut: () => void;
  resetZoom: () => void;
  bindGestures: () => any;
  canZoomIn: boolean;
  canZoomOut: boolean;
}

export const usePinchZoom = (options: UsePinchZoomOptions = {}): PinchZoomReturn => {
  const {
    minScale = 0.5,
    maxScale = 3.0,
    initialScale = 1.0,
    scaleStep = 0.1,
    onScaleChange
  } = options;

  const [scale, setScale] = useState(initialScale);

  // 更新缩放比例的通用函数
  const updateScale = useCallback((newScale: number) => {
    const clampedScale = Math.min(Math.max(newScale, minScale), maxScale);
    setScale(clampedScale);
    onScaleChange?.(clampedScale);
    return clampedScale;
  }, [minScale, maxScale, onScaleChange]);

  // 使用 @use-gesture/react 的 usePinch Hook - 仅支持缩放，不支持平移
  const bind = usePinch(
    ({ offset: [scaleOffset], memo = initialScale }) => {
      // scaleOffset 是缩放的偏移量，从1开始
      const newScale = memo * scaleOffset;
      updateScale(newScale);
      return memo;
    },
    {
      // 手势配置 - MT管理器风格
      scaleBounds: { min: minScale / initialScale, max: maxScale / initialScale },
      rubberband: true, // 启用橡皮筋效果
      preventDefault: true, // 阻止默认行为
      pointer: { touch: true }, // 启用触摸支持
      from: () => [scale / initialScale, 0], // 设置起始值
      filterTaps: true, // 过滤点击事件，避免误触
      threshold: 0.01, // 设置最小手势阈值
      // 限制只能双指操作
      eventOptions: { passive: false },
    }
  );

  // 手动缩放控制函数
  const zoomIn = useCallback(() => {
    updateScale(scale + scaleStep);
  }, [scale, scaleStep, updateScale]);

  const zoomOut = useCallback(() => {
    updateScale(scale - scaleStep);
  }, [scale, scaleStep, updateScale]);

  const resetZoom = useCallback(() => {
    updateScale(initialScale);
  }, [initialScale, updateScale]);

  // 返回手势绑定函数
  const bindGestures = useCallback(() => {
    return bind();
  }, [bind]);

  return {
    scale,
    zoomIn,
    zoomOut,
    resetZoom,
    bindGestures,
    canZoomIn: scale < maxScale,
    canZoomOut: scale > minScale
  };
};
