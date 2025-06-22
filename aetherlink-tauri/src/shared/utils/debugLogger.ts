/**
 * 调试日志工具
 * 提供条件日志记录，只在开发环境或启用调试时输出日志
 */

// 检查是否启用调试模式
const isDebugEnabled = (): boolean => {
  return (
    process.env.NODE_ENV === 'development' ||
    localStorage.getItem('debug_mode') === 'true' ||
    (window as any).__DEBUG__ === true
  );
};

// 日志级别
export type LogLevel = 'log' | 'info' | 'warn' | 'error';

/**
 * 条件日志记录函数
 * 只在调试模式下输出日志
 */
export const debugLog = {
  log: (message: string, ...args: any[]) => {
    if (isDebugEnabled()) {
      console.log(`[DEBUG] ${message}`, ...args);
    }
  },
  
  info: (message: string, ...args: any[]) => {
    if (isDebugEnabled()) {
      console.info(`[INFO] ${message}`, ...args);
    }
  },
  
  warn: (message: string, ...args: any[]) => {
    if (isDebugEnabled()) {
      console.warn(`[WARN] ${message}`, ...args);
    }
  },
  
  error: (message: string, ...args: any[]) => {
    // 错误日志始终输出
    console.error(`[ERROR] ${message}`, ...args);
  },
  
  // 组件特定的日志记录
  component: (componentName: string, action: string, data?: any) => {
    if (isDebugEnabled()) {
      console.log(`[${componentName}] ${action}`, data || '');
    }
  }
};

/**
 * 启用/禁用调试模式
 */
export const setDebugMode = (enabled: boolean): void => {
  if (enabled) {
    localStorage.setItem('debug_mode', 'true');
    console.log('🛠️ 调试模式已启用');
  } else {
    localStorage.removeItem('debug_mode');
    console.log('🛠️ 调试模式已禁用');
  }
};

/**
 * 检查调试模式状态
 */
export const getDebugMode = (): boolean => {
  return isDebugEnabled();
};
