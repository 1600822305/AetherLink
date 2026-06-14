/**
 * 性能设置工具函数
 * 用于管理流式输出等性能相关设置
 */
import { createLogger } from '../services/infra/logger';
const logger = createLogger('PerformanceSettings');

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
    logger.error('获取节流强度失败:', error);
    return 'medium';
  }
}

/**
 * 设置节流强度
 */
export function setThrottleLevel(level: ThrottleLevel): void {
  try {
    localStorage.setItem('highPerformanceThrottleLevel', level);
    logger.debug(`节流强度已更新: ${level}`);
  } catch (error) {
    logger.error('保存节流强度失败:', error);
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

