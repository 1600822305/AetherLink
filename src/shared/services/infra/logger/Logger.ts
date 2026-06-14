/**
 * 统一日志系统 — 核心 Logger
 * 负责：级别阈值短路、命名空间、脱敏、向各 Transport 分发。
 */
import {
  LogLevel,
  type LazyMessage,
  type LogEntry,
  type LogQuerySink,
  type Platform,
  type Redactor,
  type StoredLogEntry,
  type Transport,
} from './types';
import { LEVEL_LABEL } from './config';
import { formatArg } from './logFormat';

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

  /** 定位可查询的内存通道（MemoryTransport），供查看器/导出读取最近日志 */
  private querySink(): (Transport & LogQuerySink) | undefined {
    return this.core.transports.find(
      (t): t is Transport & LogQuerySink => 'getEntries' in t && 'clear' in t,
    );
  }

  /** 读取最近 count 条日志（不传则全部）；无内存通道时返回空数组 */
  getRecentLogs(count?: number): readonly StoredLogEntry[] {
    const sink = this.querySink();
    if (!sink) return [];
    const entries = sink.getEntries();
    // 返回拷贝，避免调用方拿到内存通道内部缓冲的实时引用（后续写入会改变其内容/长度）
    if (count === undefined || count >= entries.length) return entries.slice();
    return entries.slice(entries.length - count);
  }

  /** 导出日志为 JSON 或纯文本 */
  exportLogs(format: 'json' | 'text' = 'text'): string {
    const entries = this.getRecentLogs();
    if (format === 'json') {
      return JSON.stringify(entries, null, 2);
    }
    return entries
      .map((e) => {
        const time = new Date(e.timestamp).toISOString();
        const label = LEVEL_LABEL[e.level] ?? 'LOG';
        const ctx = e.context ? ` [${e.context}]` : '';
        const extra = e.args.length
          ? ` ${e.args.map((a) => formatArg(a)).join(' ')}`
          : '';
        return `[${time}] [${label}]${ctx} ${e.message}${extra}`;
      })
      .join('\n');
  }

  /** 清空内存日志缓冲 */
  clearLogs(): void {
    this.querySink()?.clear();
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
