/**
 * 统一日志系统入口。
 *
 * 用法：
 *   import { logger, createLogger } from '@/shared/services/infra/logger';
 *   const log = createLogger('MCP');
 *   log.info('连接成功', { server });
 *   log.debug(() => `耗时 ${expensiveCompute()}ms`); // 惰性，未达阈值不求值
 *
 * 阶段6 起同时注册 ConsoleTransport 与 MemoryTransport：前者输出到原生控制台，
 * 后者维护内存环形缓冲，供应用内日志查看器（DevTools/ConsolePanel）读取，
 * 取代旧 EnhancedConsoleService 的环形缓冲。
 */
import { Logger, type LoggerCore } from './Logger';
import { ConsoleTransport } from './transports/ConsoleTransport';
import { MemoryTransport } from './transports/MemoryTransport';
import { getDefaultLevel, resolvePlatform, writeDebugFlag } from './config';
import { defaultRedact } from './redact';

/** 应用内日志查看器的数据源：500 条环形缓冲 */
export const memoryTransport = new MemoryTransport(500);

const core: LoggerCore = {
  level: getDefaultLevel(),
  transports: [new ConsoleTransport(), memoryTransport],
  redact: defaultRedact,
  platform: resolvePlatform(),
};

export const logger = new Logger(core);

/** 创建带命名空间的 logger（推荐业务代码使用） */
export function createLogger(context: string): Logger {
  return logger.withContext(context);
}

/**
 * 切换调试模式：持久化运行时调试开关（localStorage）并立即应用日志级别。
 * 开启后即便生产构建（默认阈值 WARN）也会记录 debug/info，供应用内查看器查看；
 * 关闭后回到环境默认阈值（开发 DEBUG / 生产 WARN）。
 */
export function setDebugMode(enabled: boolean): void {
  writeDebugFlag(enabled);
  logger.setLevel(getDefaultLevel());
}

export { readDebugFlag } from './config';
export { Logger } from './Logger';
export { ConsoleTransport } from './transports/ConsoleTransport';
export { MemoryTransport } from './transports/MemoryTransport';
export { defaultRedact } from './redact';
export * from './types';
