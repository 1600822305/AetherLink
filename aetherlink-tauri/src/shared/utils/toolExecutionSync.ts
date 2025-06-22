/**
 * 工具执行同步机制 - 参考 Cline 的稳定性机制
 * 
 * 这个模块提供了类似 Cline 的 pWaitFor 机制，确保工具连续调用的稳定性
 */

/**
 * 等待条件满足的工具 - 参考 Cline 的 pWaitFor
 */
export async function pWaitFor(
  condition: () => boolean | Promise<boolean>,
  options: {
    interval?: number;
    timeout?: number;
  } = {}
): Promise<void> {
  const { interval = 100, timeout = 30000 } = options;
  
  const startTime = Date.now();
  
  while (true) {
    try {
      const result = await condition();
      if (result) {
        return;
      }
    } catch (error) {
      console.warn('[ToolExecutionSync] 条件检查失败:', error);
    }
    
    // 检查超时
    if (Date.now() - startTime > timeout) {
      throw new Error(`等待条件超时 (${timeout}ms)`);
    }
    
    // 等待间隔
    await new Promise(resolve => setTimeout(resolve, interval));
  }
}

/**
 * 工具执行状态跟踪器 - 参考 Cline 的工具状态管理
 */
export class ToolExecutionTracker {
  private executingTools = new Set<string>();
  private completedTools = new Set<string>();
  private failedTools = new Set<string>();
  
  /**
   * 标记工具开始执行
   */
  startTool(toolId: string): void {
    console.log(`[ToolExecutionTracker] 工具开始执行: ${toolId}`);
    this.executingTools.add(toolId);
    this.completedTools.delete(toolId);
    this.failedTools.delete(toolId);
  }
  
  /**
   * 标记工具执行完成
   */
  completeTool(toolId: string, success: boolean = true): void {
    console.log(`[ToolExecutionTracker] 工具执行完成: ${toolId}, 成功: ${success}`);
    this.executingTools.delete(toolId);
    
    if (success) {
      this.completedTools.add(toolId);
      this.failedTools.delete(toolId);
    } else {
      this.failedTools.add(toolId);
      this.completedTools.delete(toolId);
    }
  }
  
  /**
   * 检查是否有工具正在执行
   */
  hasExecutingTools(): boolean {
    return this.executingTools.size > 0;
  }
  
  /**
   * 检查特定工具是否正在执行
   */
  isToolExecuting(toolId: string): boolean {
    return this.executingTools.has(toolId);
  }
  
  /**
   * 检查特定工具是否已完成
   */
  isToolCompleted(toolId: string): boolean {
    return this.completedTools.has(toolId) || this.failedTools.has(toolId);
  }
  
  /**
   * 等待所有工具执行完成 - 参考 Cline 的等待机制
   */
  async waitForAllToolsComplete(timeout: number = 60000): Promise<void> {
    console.log(`[ToolExecutionTracker] 等待所有工具执行完成，当前执行中: ${this.executingTools.size}`);
    
    await pWaitFor(
      () => !this.hasExecutingTools(),
      { interval: 100, timeout }
    );
    
    console.log(`[ToolExecutionTracker] 所有工具执行完成`);
  }
  
  /**
   * 等待特定工具完成
   */
  async waitForToolComplete(toolId: string, timeout: number = 30000): Promise<boolean> {
    console.log(`[ToolExecutionTracker] 等待工具完成: ${toolId}`);
    
    await pWaitFor(
      () => this.isToolCompleted(toolId),
      { interval: 100, timeout }
    );
    
    const success = this.completedTools.has(toolId);
    console.log(`[ToolExecutionTracker] 工具完成: ${toolId}, 成功: ${success}`);
    return success;
  }
  
  /**
   * 获取执行状态统计
   */
  getStats() {
    return {
      executing: this.executingTools.size,
      completed: this.completedTools.size,
      failed: this.failedTools.size,
      executingTools: Array.from(this.executingTools),
      completedTools: Array.from(this.completedTools),
      failedTools: Array.from(this.failedTools)
    };
  }
  
  /**
   * 清理已完成的工具记录
   */
  cleanup(): void {
    console.log(`[ToolExecutionTracker] 清理工具记录 - 完成: ${this.completedTools.size}, 失败: ${this.failedTools.size}`);
    this.completedTools.clear();
    this.failedTools.clear();
  }
  
  /**
   * 重置所有状态
   */
  reset(): void {
    console.log(`[ToolExecutionTracker] 重置所有工具状态`);
    this.executingTools.clear();
    this.completedTools.clear();
    this.failedTools.clear();
  }
}

/**
 * 全局工具执行跟踪器实例
 */
export const globalToolTracker = new ToolExecutionTracker();

/**
 * 工具执行同步装饰器 - 参考 Cline 的工具执行模式
 */
export function withToolSync<T extends any[], R>(
  fn: (...args: T) => Promise<R>
): (...args: T) => Promise<R> {
  return async (...args: T): Promise<R> => {
    // 等待之前的工具执行完成
    await globalToolTracker.waitForAllToolsComplete();
    
    // 执行当前函数
    return await fn(...args);
  };
}

/**
 * 创建工具执行队列 - 参考 Cline 的顺序执行机制
 */
export class ToolExecutionQueue {
  private queue: Array<() => Promise<any>> = [];
  private isProcessing = false;
  
  /**
   * 添加工具到执行队列
   */
  async enqueue<T>(toolId: string, executor: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          globalToolTracker.startTool(toolId);
          const result = await executor();
          globalToolTracker.completeTool(toolId, true);
          resolve(result);
        } catch (error) {
          globalToolTracker.completeTool(toolId, false);
          reject(error);
        }
      });
      
      this.processQueue();
    });
  }
  
  /**
   * 处理队列
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.queue.length === 0) {
      return;
    }
    
    this.isProcessing = true;
    
    while (this.queue.length > 0) {
      const task = this.queue.shift();
      if (task) {
        try {
          await task();
        } catch (error) {
          console.error('[ToolExecutionQueue] 任务执行失败:', error);
        }
      }
    }
    
    this.isProcessing = false;
  }
  
  /**
   * 获取队列状态
   */
  getStatus() {
    return {
      queueLength: this.queue.length,
      isProcessing: this.isProcessing
    };
  }
}

/**
 * 全局工具执行队列实例
 */
export const globalToolQueue = new ToolExecutionQueue();
