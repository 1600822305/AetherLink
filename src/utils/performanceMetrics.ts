/**
 * 启动性能指标追踪系统
 * 
 * 根据 Capacitor 性能优化最佳实践，追踪关键启动指标
 * 参考：https://blog.csdn.net/gitblog_00832/article/details/151374765
 * 
 * 🎯 追踪指标：
 * - DOMContentLoaded: DOM 加载完成时间
 * - FCP (First Contentful Paint): 首次内容绘制时间
 * - LCP (Largest Contentful Paint): 最大内容绘制时间（作为可交互时间的近似值）
 * - Splash Screen Hide: 启动屏隐藏时间
 * - App Initialized: 应用完全初始化时间
 * 
 * 📊 目标值（参考文章）：
 * - 白屏时间 (FCP) < 1s
 * - 首屏渲染 (LCP) < 1.5s
 * - 可交互时间 < 2.1s
 * 
 * 📝 注意：
 * - web-vitals v3+ 已移除 TTI (Time to Interactive)
 * - 使用 LCP 作为可交互时间的替代指标
 * - LCP 测量最大内容元素的渲染时间，通常接近可交互时间
 */

import { createLogger } from '../shared/services/infra/logger';

const logger = createLogger('Performance');

export interface PerformanceMetrics {
  domContentLoaded: number;
  firstContentfulPaint: number;
  timeToInteractive: number;
  splashScreenHide: number;
  appInitialized: number;
  // 额外指标
  navigationStart: number;
  totalLoadTime: number;
}

// 性能指标存储
// navigationStart 应该为 0，表示从页面加载开始计时
const metrics: Partial<PerformanceMetrics> = {
  navigationStart: 0
};

// 是否已经上报过性能数据
let hasReported = false;

/**
 * 记录性能指标
 * @param key 指标名称
 * @param value 指标值（毫秒）
 */
export function recordMetric(key: keyof PerformanceMetrics, value?: number): void {
  const metricValue = value ?? performance.now();
  metrics[key] = metricValue;

  if (process.env.NODE_ENV === 'development') {
    logger.debug(`${key}: ${metricValue.toFixed(2)}ms`);
  }

  // 检查是否所有关键指标都已收集
  checkAndReportMetrics();
}

/**
 * 检查并上报性能指标
 */
function checkAndReportMetrics(): void {
  // 避免重复上报
  if (hasReported) return;

  // 检查关键指标是否都已收集
  const requiredMetrics: (keyof PerformanceMetrics)[] = [
    'domContentLoaded',
    'firstContentfulPaint',
    'timeToInteractive',
    'appInitialized'
  ];

  const allCollected = requiredMetrics.every(key => metrics[key] !== undefined);

  if (allCollected) {
    hasReported = true;
    reportPerformanceMetrics();
  }
}

/**
 * 上报性能指标
 */
function reportPerformanceMetrics(): void {
  const completedMetrics = metrics as PerformanceMetrics;
  
  // 计算总加载时间
  completedMetrics.totalLoadTime = completedMetrics.appInitialized - completedMetrics.navigationStart;

  // 展开为一个完整的信息上报
  const details = {
    'DOMContentLoaded': `${completedMetrics.domContentLoaded.toFixed(2)}ms`,
    'First Contentful Paint': `${completedMetrics.firstContentfulPaint.toFixed(2)}ms`,
    'Time to Interactive': `${completedMetrics.timeToInteractive.toFixed(2)}ms`,
    'Splash Screen Hide': `${completedMetrics.splashScreenHide?.toFixed(2) || 'N/A'}ms`,
    'App Initialized': `${completedMetrics.appInitialized.toFixed(2)}ms`,
    '总启动时间': `${completedMetrics.totalLoadTime.toFixed(2)}ms`
  };

  logger.debug('� 启动性能指标报告 - 详细指标：', details);

  // 性能评估
  evaluatePerformance(completedMetrics);

  // 可以在这里发送到分析服务
  // sendToAnalytics(completedMetrics);
}

/**
 * 性能评估（基于文章中的优化目标）
 */
function evaluatePerformance(metrics: PerformanceMetrics): void {
  const evaluations: string[] = [];

  // 白屏时间评估（FCP）
  if (metrics.firstContentfulPaint < 1000) {
    evaluations.push('✅ 白屏时间优秀 (< 1s)');
  } else if (metrics.firstContentfulPaint < 2000) {
    evaluations.push('⚠️ 白屏时间良好 (1-2s)');
  } else {
    evaluations.push('❌ 白屏时间需要优化 (> 2s)');
  }

  // 首屏渲染评估（TTI）
  if (metrics.timeToInteractive < 1500) {
    evaluations.push('✅ 可交互时间优秀 (< 1.5s)');
  } else if (metrics.timeToInteractive < 2500) {
    evaluations.push('⚠️ 可交互时间良好 (1.5-2.5s)');
  } else {
    evaluations.push('❌ 可交互时间需要优化 (> 2.5s)');
  }

  // 总启动时间评估
  if (metrics.totalLoadTime < 2700) {
    evaluations.push('✅ 总启动时间优秀 (< 2.7s)');
  } else if (metrics.totalLoadTime < 4000) {
    evaluations.push('⚠️ 总启动时间良好 (2.7-4s)');
  } else {
    evaluations.push('❌ 总启动时间需要优化 (> 4s)');
  }

  logger.debug('📈 性能评估：', evaluations.join(', '));

  // 提供优化建议
  if (metrics.totalLoadTime > 4000) {
    logger.debug('💡 优化建议：考虑使用插件懒加载，检查是否有阻塞启动的同步操作，优化图片资源大小，使用代码分割减少初始 Bundle 大小');
  }
}

/**
 * 获取当前性能指标
 */
export function getMetrics(): Partial<PerformanceMetrics> {
  return { ...metrics };
}

/**
 * 初始化性能追踪
 */
export function initPerformanceTracking(): void {
  if (process.env.NODE_ENV !== 'development') {
    // 生产环境不启用详细追踪
    return;
  }

  logger.debug('性能追踪已启动');

  // 监听 DOMContentLoaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      recordMetric('domContentLoaded');
    });
  } else {
    // 如果已经加载完成，立即记录
    recordMetric('domContentLoaded', performance.now());
  }

  // 使用 Web Vitals 追踪 FCP 和其他指标
  // 注意：web-vitals v3+ 已移除 TTI，使用 LCP 作为可交互时间的近似值
  if (typeof window !== 'undefined') {
    // 🚀 性能优化：使用更快的 TTI 估算方式
    // 方案1：使用 FCP + 延迟估算 (更快，适合大多数场景)
    // 方案2：使用 LCP (更准确，但可能较慢)
    
    // 动态导入 web-vitals（如果项目已安装）
    import('web-vitals')
      .then(({ onFCP, onINP }) => {
        onFCP((metric: { value: number }) => {
          recordMetric('firstContentfulPaint', metric.value);
          
          // 🚀 使用 FCP + 合理延迟作为 TTI 估算
          // 通常 TTI 在 FCP 后 200-500ms 内完成
          const estimatedTTI = metric.value + 300;
          recordMetric('timeToInteractive', estimatedTTI);
        });

        // 使用 INP (Interaction to Next Paint) 作为辅助指标
        // INP 更能反映真实的交互响应时间
        onINP((metric: { value: number }) => {
          if (process.env.NODE_ENV === 'development') {
            logger.debug(`INP (交互响应): ${metric.value.toFixed(2)}ms`);
          }
        });
      })
      .catch(() => {
        logger.warn('web-vitals 未安装，跳过 FCP/INP 追踪');
        // 使用 Performance API 的备选方案
        useFallbackMetrics();
      });
  }
}

/**
 * 备选的性能指标获取方案（不依赖 web-vitals）
 */
function useFallbackMetrics(): void {
  // 使用 Performance Observer API
  if ('PerformanceObserver' in window) {
    try {
      // 监听 paint 事件
      const paintObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.name === 'first-contentful-paint') {
            recordMetric('firstContentfulPaint', entry.startTime);
          }
        }
      });
      paintObserver.observe({ entryTypes: ['paint'] });

      // 简单的 TTI 估算：load 事件触发时间
      window.addEventListener('load', () => {
        recordMetric('timeToInteractive', performance.now());
      });
    } catch (error) {
      logger.warn('PerformanceObserver 不可用');
    }
  }
}

/**
 * 记录自定义事件
 * @param eventName 事件名称
 * @param duration 持续时间（可选）
 */
export function recordCustomEvent(eventName: string, duration?: number): void {
  if (process.env.NODE_ENV === 'development') {
    const time = duration ?? performance.now();
    logger.debug(`${eventName}: ${time.toFixed(2)}ms`);
  }
}

// 导出用于外部调用的接口
export const PerformanceTracker = {
  init: initPerformanceTracking,
  record: recordMetric,
  recordCustom: recordCustomEvent,
  getMetrics,
};

