/**
 * 统一日志系统入口。
 *
 * 用法：
 *   import { logger, createLogger } from '@/shared/services/infra/logger';
 *   const log = createLogger('MCP');
 *   log.info('连接成功', { server });
 *   log.debug(() => `耗时 ${expensiveCompute()}ms`); // 惰性，未达阈值不求值
 *
 * 首批（阶段1）按设计方案 §3.3 的 B 方案，仅注册 ConsoleTransport，
 * 避免与现有 EnhancedConsoleService 形成双缓冲；阶段6 再启用 MemoryTransport
 * 并让 DevTools/ConsolePanel 改读它。
 */
import { Logger, type LoggerCore } from './Logger';
import { ConsoleTransport } from './transports/ConsoleTransport';
import { getDefaultLevel, resolvePlatform } from './config';
import { defaultRedact } from './redact';

const core: LoggerCore = {
  level: getDefaultLevel(),
  transports: [new ConsoleTransport()],
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
