/**
 * 滚动性能优化配置
 * 集中管理所有与滚动性能相关的CSS属性和配置
 */

import { createLogger } from '../services/infra/logger';

const logger = createLogger('ScrollOptimization');

// ✅ 滚动容器优化样式 - 只对滚动容器本身应用
export const scrollContainerStyles = {
  // iOS 滚动优化
  WebkitOverflowScrolling: 'touch',
  
  // 禁用平滑滚动以提升性能
  scrollBehavior: 'auto' as const,
  
  // 限制过度滚动
  overscrollBehavior: 'contain' as const,
} as const;

// ✅ 消息项样式 - 最小化，让浏览器自己优化
export const messageItemStyles = {
  // 基本布局
  position: 'relative' as const,
} as const;

// ✅ 气泡样式 - 简化
export const bubbleStyles = {
  position: 'relative' as const,
  borderRadius: '8px',
} as const;

// ✅ 滚动条优化样式
export const scrollbarStyles = (isDark: boolean) => ({
  scrollbarWidth: 'thin' as const,
  scrollbarGutter: 'stable' as const, // 防止滚动条出现/消失时布局跳动
  scrollbarColor: `${isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)'} transparent`,
  
  '&::-webkit-scrollbar': {
    width: '3px', // 更细的滚动条
  },
  
  '&::-webkit-scrollbar-track': {
    background: 'transparent',
  },
  
  '&::-webkit-scrollbar-thumb': {
    backgroundColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)',
    borderRadius: '2px', // 减少圆角计算
  },
  
  '&::-webkit-scrollbar-thumb:hover': {
    backgroundColor: isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.25)',
  },
});

// 🚀 性能监控配置
export const performanceConfig = {
  // ✅ 使用 rAF 自适应，不再使用固定 throttle
  useRAF: true,
  
  // resize 事件可以用较长的 debounce（用户不会一直 resize）
  resizeDebounce: 150,
  
  // 虚拟滚动配置
  virtualScrollThreshold: 50, // 超过50个项目启用虚拟滚动
  
  // overscan 根据帧率动态调整
  getOverscanCount: (fps: number) => {
    if (fps >= 120) return 8;  // 高刷需要更多预渲染
    if (fps >= 90) return 5;
    return 3;
  },
  
  // 内存管理
  maxCachedItems: 100, // 最大缓存项目数
} as const;

// ✅ 检测设备性能等级 - 只基于硬件，不用网络类型
export const getDevicePerformanceLevel = (): 'low' | 'medium' | 'high' => {
  // 检测硬件并发数
  const cores = navigator.hardwareConcurrency || 4;
  
  // 检测内存（如果可用）
  const memory = (navigator as any).deviceMemory || 4;
  
  // ✅ 只基于硬件判断，网络类型与设备性能无关
  if (cores >= 8 && memory >= 8) {
    return 'high';
  } else if (cores >= 4 && memory >= 4) {
    return 'medium';
  } else {
    return 'low';
  }
};

// 🚀 检测设备实际刷新率
export const getRefreshRate = (): number => {
  // 方法1: 使用实验性 API（部分浏览器支持）
  if ('screen' in window && 'refreshRate' in (screen as any)) {
    return (screen as any).refreshRate;
  }
  
  // 方法2: 回退默认值
  return 60;
};

// 🚀 动态计算帧时间
export const getFrameTime = (): number => {
  const refreshRate = getRefreshRate();
  return Math.floor(1000 / refreshRate);
};

// 🚀 运行时测量实际帧率
export const measureActualFrameRate = (): Promise<number> => {
  return new Promise((resolve) => {
    let frameCount = 0;
    const startTime = performance.now();
    
    const countFrame = () => {
      frameCount++;
      if (performance.now() - startTime < 1000) {
        requestAnimationFrame(countFrame);
      } else {
        resolve(frameCount);
      }
    };
    
    requestAnimationFrame(countFrame);
  });
};

// 🚀 根据设备性能调整配置
export const getOptimizedConfig = () => {
  const performanceLevel = getDevicePerformanceLevel();
  
  switch (performanceLevel) {
    case 'high':
      return {
        ...performanceConfig,
        virtualScrollThreshold: 100,
      };
    
    case 'medium':
      return {
        ...performanceConfig,
        virtualScrollThreshold: 50,
      };
    
    case 'low':
      return {
        ...performanceConfig,
        virtualScrollThreshold: 20,
      };
    
    default:
      return performanceConfig;
  }
};

// ✅ 调试工具
export const debugScrollPerformance = () => {
  const config = getOptimizedConfig();
  const level = getDevicePerformanceLevel();
  
  logger.debug('滚动性能配置:', {
    设备性能等级: level,
    硬件并发数: navigator.hardwareConcurrency,
    设备内存: (navigator as any).deviceMemory,
    优化配置: config,
  });
  
  return { level, config };
};
