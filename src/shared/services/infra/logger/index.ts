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
import { getDefaultLevel, resolvePlatform } from './config';
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

export { Logger } from './Logger';
export { ConsoleTransport } from './transports/ConsoleTransport';
export { MemoryTransport } from './transports/MemoryTransport';
export { defaultRedact } from './redact';
export * from './types';
