/**
 * 队列系统类型定义
 * 参考 Cherry Studio p-queue 设计
 */

/**
 * 队列任务
 */
export interface QueueTask<T = any> {
  /** 任务 ID */
  id: string;
  /** 任务执行函数 */
  execute: () => Promise<T>;
  /** 优先级（数字越小优先级越高）*/
  priority?: number;
  /** 创建时间 */
  createdAt: number;
}

/**
 * 队列配置
 */
export interface QueueConfig {
  /** 并发数 */
  concurrency: number;
  /** 超时时间（毫秒）*/
  timeout?: number;
  /** 任务失败重试次数 */
  retries?: number;
}

/**
 * 队列状态
 */
export interface QueueStatus {
  /** 排队中的任务数 */
  pending: number;
  /** 正在执行的任务数 */
  running: number;
  /** 队列是否暂停 */
  isPaused: boolean;
  /** 队列是否空闲 */
  isIdle: boolean;
}

/**
 * 任务添加选项
 */
export interface TaskAddOptions {
  /** 任务 ID */
  id?: string;
  /** 优先级 */
  priority?: number;
}
