/**
 * 数据库迁移相关类型定义
 */

/**
 * 迁移函数类型
 */
export type MigrationFunction = (db: any) => Promise<void>;

/**
 * 迁移定义接口
 */
export interface Migration {
  /** 版本号 */
  version: number;
  /** 迁移描述 */
  description: string;
  /** 迁移函数 */
  migrate: MigrationFunction;
  /** 回滚函数（可选） */
  rollback?: MigrationFunction;
  /** 验证函数（可选） */
  validate?: (db: any) => Promise<boolean>;
  /** 迁移前的数据表结构定义 */
  stores?: Record<string, string>;
}

/**
 * 迁移状态
 */
export interface MigrationStatus {
  /** 版本号 */
  version: number;
  /** 是否已执行 */
  executed: boolean;
  /** 执行时间 */
  executedAt?: string;
  /** 执行结果 */
  success?: boolean;
  /** 错误信息 */
  error?: string;
  /** 执行耗时（毫秒） */
  duration?: number;
}

/**
 * 迁移结果
 */
export interface MigrationResult {
  /** 是否成功 */
  success: boolean;
  /** 执行的版本号 */
  version: number;
  /** 错误信息 */
  error?: string;
  /** 执行耗时（毫秒） */
  duration: number;
  /** 迁移的数据量统计 */
  stats?: {
    topicsProcessed?: number;
    messagesProcessed?: number;
    blocksProcessed?: number;
    [key: string]: number | undefined;
  };
}

/**
 * 迁移管理器配置
 */
export interface MigrationManagerConfig {
  /** 数据库名称 */
  dbName: string;
  /** 当前版本 */
  currentVersion: number;
  /** 是否启用详细日志 */
  verbose?: boolean;
  /** 迁移超时时间（毫秒） */
  timeout?: number;
}

/**
 * 迁移上下文
 */
export interface MigrationContext {
  /** 数据库实例 */
  db: any;
  /** 当前版本 */
  fromVersion: number;
  /** 目标版本 */
  toVersion: number;
  /** 开始时间 */
  startTime: number;
  /** 日志函数 */
  log: (message: string, level?: 'info' | 'warn' | 'error') => void;
}
