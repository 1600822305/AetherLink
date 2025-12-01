/**
 * Topic 消息队列
 * 确保同一话题的消息按顺序处理
 * 
 * 参考 Cherry Studio p-queue 设计
 */

import type { QueueConfig, QueueTask, QueueStatus, TaskAddOptions } from './types';

/**
 * Topic 消息队列类
 */
export class TopicQueue {
  private queue: QueueTask[] = [];
  private running: Set<string> = new Set();
  private config: Required<QueueConfig>;
  private isPaused = false;
  private idlePromise: Promise<void> | null = null;
  private idleResolve: (() => void) | null = null;

  constructor(config: Partial<QueueConfig> = {}) {
    this.config = {
      concurrency: 1,
      timeout: 120000, // 2分钟默认超时
      retries: 0,
      ...config
    };
  }

  /**
   * 添加任务到队列
   */
  async add<T>(
    execute: () => Promise<T>,
    options?: TaskAddOptions
  ): Promise<T> {
    const taskId = options?.id || `task_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    
    return new Promise((resolve, reject) => {
      const wrappedExecute = async () => {
        try {
          const result = await this.executeWithTimeout(execute);
          resolve(result);
          return result;
        } catch (error) {
          reject(error);
          throw error;
        }
      };

      const task: QueueTask = {
        id: taskId,
        execute: wrappedExecute,
        priority: options?.priority ?? 0,
        createdAt: Date.now()
      };

      this.queue.push(task);
      this.sortQueue();
      this.processNext();
    });
  }

  /**
   * 按优先级排序队列
   */
  private sortQueue(): void {
    this.queue.sort((a, b) => {
      // 优先级数字越小越优先
      if (a.priority !== b.priority) {
        return (a.priority ?? 0) - (b.priority ?? 0);
      }
      // 同优先级按创建时间排序
      return a.createdAt - b.createdAt;
    });
  }

  /**
   * 处理下一个任务
   */
  private async processNext(): Promise<void> {
    if (this.isPaused) return;
    if (this.running.size >= this.config.concurrency) return;
    if (this.queue.length === 0) {
      this.checkIdle();
      return;
    }

    const task = this.queue.shift()!;
    this.running.add(task.id);

    try {
      await task.execute();
    } catch (error) {
      console.error(`[TopicQueue] 任务 ${task.id} 执行失败:`, error);
    } finally {
      this.running.delete(task.id);
      this.processNext();
    }
  }

  /**
   * 带超时的任务执行
   */
  private async executeWithTimeout<T>(execute: () => Promise<T>): Promise<T> {
    if (!this.config.timeout) {
      return execute();
    }

    return Promise.race([
      execute(),
      new Promise<T>((_, reject) => {
        setTimeout(
          () => reject(new Error(`Task timeout after ${this.config.timeout}ms`)), 
          this.config.timeout
        );
      })
    ]);
  }

  /**
   * 检查是否空闲并解决等待
   */
  private checkIdle(): void {
    if (this.queue.length === 0 && this.running.size === 0 && this.idleResolve) {
      this.idleResolve();
      this.idlePromise = null;
      this.idleResolve = null;
    }
  }

  /**
   * 等待队列空闲
   */
  async onIdle(): Promise<void> {
    if (this.queue.length === 0 && this.running.size === 0) {
      return;
    }

    if (!this.idlePromise) {
      this.idlePromise = new Promise(resolve => {
        this.idleResolve = resolve;
      });
    }

    return this.idlePromise;
  }

  /**
   * 暂停队列
   */
  pause(): void {
    this.isPaused = true;
  }

  /**
   * 恢复队列
   */
  resume(): void {
    this.isPaused = false;
    this.processNext();
  }

  /**
   * 清空队列（不影响正在运行的任务）
   */
  clear(): void {
    this.queue = [];
    this.checkIdle();
  }

  /**
   * 移除指定任务
   */
  remove(taskId: string): boolean {
    const index = this.queue.findIndex(t => t.id === taskId);
    if (index !== -1) {
      this.queue.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * 获取队列状态
   */
  getStatus(): QueueStatus {
    return {
      pending: this.queue.length,
      running: this.running.size,
      isPaused: this.isPaused,
      isIdle: this.queue.length === 0 && this.running.size === 0
    };
  }

  /**
   * 获取排队中的任务数
   */
  get size(): number {
    return this.queue.length;
  }

  /**
   * 获取正在执行的任务数
   */
  get pending(): number {
    return this.running.size;
  }

  /**
   * 队列是否为空
   */
  get isEmpty(): boolean {
    return this.queue.length === 0 && this.running.size === 0;
  }
}
