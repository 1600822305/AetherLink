/**
 * 统一日志系统 — 核心 Logger
 * 负责：级别阈值短路、命名空间、脱敏、向各 Transport 分发。
 */
import {
  LogLevel,
  type LazyMessage,
  type LogEntry,
  type Platform,
  type Redactor,
  type Transport,
} from './types';

/** 多个 logger 实例（根 + withContext 子实例）共享同一份可变核心状态 */
export interface LoggerCore {
  level: LogLevel;
  transports: Transport[];
  redact?: Redactor;
  platform: Platform;
}

export class Logger {
  private readonly core: LoggerCore;
  private readonly context?: string;

  constructor(core: LoggerCore, context?: string) {
    this.core = core;
    this.context = context;
  }

  /** 派生带命名空间的子 logger，与父级共享级别/通道配置 */
  withContext(context: string): Logger {
    return new Logger(this.core, context);
  }

  setLevel(level: LogLevel): void {
    this.core.level = level;
  }

  getLevel(): LogLevel {
    return this.core.level;
  }

  isLevelEnabled(level: LogLevel): boolean {
    return level !== LogLevel.SILENT && level <= this.core.level;
  }

  addTransport(transport: Transport): void {
    if (!this.core.transports.some((t) => t.name === transport.name)) {
      this.core.transports.push(transport);
    }
  }

  removeTransport(name: string): void {
    this.core.transports = this.core.transports.filter((t) => t.name !== name);
  }

  setRedactor(redact: Redactor | undefined): void {
    this.core.redact = redact;
  }

  error(message: LazyMessage, ...args: unknown[]): void {
    this.emit(LogLevel.ERROR, message, args);
  }

  warn(message: LazyMessage, ...args: unknown[]): void {
    this.emit(LogLevel.WARN, message, args);
  }

  info(message: LazyMessage, ...args: unknown[]): void {
    this.emit(LogLevel.INFO, message, args);
  }

  debug(message: LazyMessage, ...args: unknown[]): void {
    this.emit(LogLevel.DEBUG, message, args);
  }

  trace(message: LazyMessage, ...args: unknown[]): void {
    this.emit(LogLevel.TRACE, message, args);
  }

  /** 以指定级别记录（兼容垫片转发旧 API 时使用） */
  logAt(level: LogLevel, message: LazyMessage, ...args: unknown[]): void {
    this.emit(level, message, args);
  }

  logApiRequest(endpoint: string, level: LogLevel, data: unknown): void {
    this.emit(level, `API请求 [${endpoint}]`, [data]);
  }

  logApiResponse(endpoint: string, statusCode: number, data: unknown): void {
    const level = statusCode >= 400 ? LogLevel.ERROR : LogLevel.INFO;
    this.emit(level, `API响应 [${endpoint}] 状态码: ${statusCode}`, [data]);
  }

  private emit(level: LogLevel, message: LazyMessage, args: unknown[]): void {
    // 阈值短路：未达阈值直接返回，惰性消息不会被求值
    if (!this.isLevelEnabled(level)) return;

    const text = typeof message === 'function' ? message() : message;
    let entry: LogEntry = {
      timestamp: Date.now(),
      level,
      context: this.context,
      message: text,
      args,
      platform: this.core.platform,
    };

    if (this.core.redact) {
      try {
        entry = this.core.redact(entry);
      } catch {
        /* 脱敏失败不应阻断日志 */
      }
    }

    for (const transport of this.core.transports) {
      if (transport.level !== undefined && level > transport.level) continue;
      try {
        transport.write(entry);
      } catch {
        /* 单个 Transport 失败不应拖垮应用或其他通道 */
      }
    }
  }
}
