/**
 * 统一日志系统 — 类型定义
 * 见设计方案 plans/logging-system-design.md
 */

// 数值级别：越小越重要，便于阈值短路比较
export const LogLevel = {
  SILENT: 0,
  ERROR: 1,
  WARN: 2,
  INFO: 3,
  DEBUG: 4,
  TRACE: 5,
} as const;

export type LogLevel = (typeof LogLevel)[keyof typeof LogLevel];
export type LogLevelName = keyof typeof LogLevel;

export type Platform = 'web' | 'tauri' | 'capacitor';

export interface LogEntry {
  timestamp: number;
  level: LogLevel;
  context?: string;
  message: string;
  args: unknown[];
  platform: Platform;
}

/** 输出通道：控制台 / 内存 / 持久化 / 远程，互相解耦 */
export interface Transport {
  readonly name: string;
  /** 通道自身的级别阈值（可选，未设则跟随 logger 全局阈值） */
  level?: LogLevel;
  write(entry: LogEntry): void;
}

/** 惰性消息：未达阈值时不会被调用，避免无谓的字符串拼接 */
export type LazyMessage = string | (() => string);

/** 脱敏处理器：在写入任何 Transport 之前统一过滤敏感字段 */
export type Redactor = (entry: LogEntry) => LogEntry;
