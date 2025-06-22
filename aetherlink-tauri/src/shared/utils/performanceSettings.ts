/**
 * 性能设置工具函数
 * 用于管理高性能流式输出等性能相关设置
 */

// 高性能流式输出设置的 localStorage 键
const HIGH_PERFORMANCE_STREAMING_KEY = 'highPerformanceStreaming';

/**
 * 获取高性能流式输出设置
 * @returns 是否启用高性能流式输出
 */
export function getHighPerformanceStreamingSetting(): boolean {
  try {
    const saved = localStorage.getItem(HIGH_PERFORMANCE_STREAMING_KEY);
    if (saved !== null) {
      return JSON.parse(saved);
    }
    // 默认启用高性能流式输出
    return true;
  } catch (error) {
    console.error('[performanceSettings] 获取高性能流式输出设置失败:', error);
    return true; // 默认启用
  }
}

/**
 * 设置高性能流式输出
 * @param enabled 是否启用高性能流式输出
 */
export function setHighPerformanceStreamingSetting(enabled: boolean): void {
  try {
    localStorage.setItem(HIGH_PERFORMANCE_STREAMING_KEY, JSON.stringify(enabled));
    console.log(`[performanceSettings] 高性能流式输出设置已更新: ${enabled}`);
  } catch (error) {
    console.error('[performanceSettings] 保存高性能流式输出设置失败:', error);
  }
}

/**
 * 判断是否应该使用高性能渲染模式
 * @param isStreaming 是否正在流式输出
 * @returns 是否使用高性能渲染模式
 */
export function shouldUseHighPerformanceMode(isStreaming: boolean): boolean {
  if (!isStreaming) {
    return false; // 非流式时始终使用完整渲染
  }

  return getHighPerformanceStreamingSetting();
}

/**
 * 节流强度级别
 */
export type ThrottleLevel = 'light' | 'medium' | 'heavy' | 'extreme';

/**
 * 获取节流强度设置
 */
export function getThrottleLevel(): ThrottleLevel {
  try {
    const saved = localStorage.getItem('highPerformanceThrottleLevel');
    if (saved) {
      return saved as ThrottleLevel;
    }
    return 'medium'; // 默认中等节流
  } catch (error) {
    console.error('[performanceSettings] 获取节流强度失败:', error);
    return 'medium';
  }
}

/**
 * 设置节流强度
 */
export function setThrottleLevel(level: ThrottleLevel): void {
  try {
    localStorage.setItem('highPerformanceThrottleLevel', level);
    console.log(`[performanceSettings] 节流强度已更新: ${level}`);
  } catch (error) {
    console.error('[performanceSettings] 保存节流强度失败:', error);
  }
}

/**
 * 获取高性能模式的更新频率设置
 * @returns 更新间隔（毫秒）
 */
export function getHighPerformanceUpdateInterval(): number {
  const level = getThrottleLevel();

  switch (level) {
    case 'light':
      return 200;  // 轻度节流：200ms（约 5fps）
    case 'medium':
      return 500;  // 中度节流：500ms（约 2fps）
    case 'heavy':
      return 800;  // 重度节流：800ms（约 1.25fps）
    case 'extreme':
      return 1200; // 极度节流：1200ms（约 0.8fps）
    default:
      return 500;
  }
}

/**
 * 获取高性能模式的滚动节流设置
 * @returns 滚动节流间隔（毫秒）
 */
export function getHighPerformanceScrollThrottle(): number {
  const level = getThrottleLevel();

  switch (level) {
    case 'light':
      return 300;  // 轻度节流：300ms
    case 'medium':
      return 600;  // 中度节流：600ms
    case 'heavy':
      return 1000; // 重度节流：1000ms
    case 'extreme':
      return 1500; // 极度节流：1500ms
    default:
      return 600;
  }
}

/**
 * 获取高性能渲染模式类型
 */
export type HighPerformanceRenderMode = 'virtual' | 'canvas' | 'minimal' | 'normal';

/**
 * 获取高性能渲染模式设置
 * @returns 渲染模式
 */
export function getHighPerformanceRenderMode(): HighPerformanceRenderMode {
  try {
    const saved = localStorage.getItem('highPerformanceRenderMode');
    if (saved) {
      return saved as HighPerformanceRenderMode;
    }
    return 'virtual'; // 默认使用虚拟化渲染
  } catch (error) {
    console.error('[performanceSettings] 获取渲染模式失败:', error);
    return 'virtual';
  }
}

/**
 * 设置高性能渲染模式
 * @param mode 渲染模式
 */
export function setHighPerformanceRenderMode(mode: HighPerformanceRenderMode): void {
  try {
    localStorage.setItem('highPerformanceRenderMode', mode);
    console.log(`[performanceSettings] 渲染模式已更新: ${mode}`);
  } catch (error) {
    console.error('[performanceSettings] 保存渲染模式失败:', error);
  }
}
