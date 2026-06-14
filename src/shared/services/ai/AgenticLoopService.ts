/**
 * AgenticLoopService - Agentic 模式循环管理服务
 * 
 * 参考 Roo-Code 的设计，实现工具调用的自动循环：
 * - 管理迭代次数和限制
 * - 跟踪连续错误
 * - 检测任务完成信号
 * - 提供循环状态
 */

import { createLogger } from '../infra/logger';

const logger = createLogger('AgenticLoop');
const eventLogger = createLogger('EventEmitter');


// ==================== 浏览器兼容的事件系统 ====================

type EventHandler = (...args: any[]) => void;

/**
 * 简单的事件发射器（浏览器兼容）
 */
class SimpleEventEmitter {
  private events: Map<string, EventHandler[]> = new Map();

  on(event: string, handler: EventHandler): void {
    if (!this.events.has(event)) {
      this.events.set(event, []);
    }
    this.events.get(event)!.push(handler);
  }

  off(event: string, handler: EventHandler): void {
    const handlers = this.events.get(event);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

  emit(event: string, ...args: any[]): void {
    const handlers = this.events.get(event);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(...args);
        } catch (error) {
          eventLogger.error(`Error in handler for event "${event}":`, error);
        }
      });
    }
  }

  removeAllListeners(event?: string): void {
    if (event) {
      this.events.delete(event);
    } else {
      this.events.clear();
    }
  }
}

// ==================== 类型定义 ====================

/**
 * Agentic 循环配置
 */
export interface AgenticLoopConfig {
  /** 最大迭代次数，默认 25 */
  maxIterations: number;
  /** 连续错误限制，默认 3 */
  consecutiveMistakeLimit: number;
  /** 启用 Agentic 模式的 MCP 服务器列表 */
  enabledMCPServers: string[];
}

/**
 * 循环状态
 */
export interface AgenticLoopState {
  /** 是否处于 Agentic 模式 */
  isAgenticMode: boolean;
  /** 当前迭代次数 */
  currentIteration: number;
  /** 连续错误次数 */
  consecutiveMistakeCount: number;
  /** 是否已完成 */
  isComplete: boolean;
  /** 完成原因 */
  completionReason?: AgenticCompletionReason;
  /** 完成结果（来自 attempt_completion） */
  completionResult?: string;
  /** 建议执行的命令 */
  suggestedCommand?: string;
  /** 开始时间 */
  startTime?: number;
  /** 结束时间 */
  endTime?: number;
}

/**
 * 完成原因
 */
export type AgenticCompletionReason = 
  | 'attempt_completion'      // AI 主动完成
  | 'max_iterations_reached'  // 达到最大迭代次数
  | 'consecutive_mistakes'    // 连续错误过多
  | 'user_cancelled'          // 用户取消
  | 'error';                  // 发生错误

/**
 * 工具调用结果
 */
export interface ToolCallResult {
  /** 工具名称 */
  toolName: string;
  /** 是否成功 */
  success: boolean;
  /** 是否是完成信号 */
  isCompletion: boolean;
  /** 结果内容 */
  content: any;
  /** 错误信息 */
  error?: string;
}

/**
 * Agentic 事件
 */
export interface AgenticEvents {
  'iteration:start': (iteration: number) => void;
  'iteration:end': (iteration: number, result: ToolCallResult) => void;
  'complete': (state: AgenticLoopState) => void;
  'error': (error: Error, state: AgenticLoopState) => void;
  'mistake': (count: number, limit: number) => void;
}

// ==================== 默认配置 ====================

const DEFAULT_CONFIG: AgenticLoopConfig = {
  maxIterations: 25,
  consecutiveMistakeLimit: 3,
  enabledMCPServers: ['@aether/file-editor', '@aether/dex-editor']
};

// ==================== AgenticLoopService 类 ====================

/**
 * Agentic 循环管理服务
 * 
 * 使用方式：
 * 1. 调用 startLoop() 开始新的 Agentic 循环
 * 2. 每次工具调用后调用 processToolResult() 处理结果
 * 3. 检查 shouldContinue() 决定是否继续循环
 * 4. 循环结束后调用 endLoop() 清理状态
 */
export class AgenticLoopService extends SimpleEventEmitter {
  private config: AgenticLoopConfig;
  private state: AgenticLoopState;
  private activeTopicId: string | null = null;

  constructor(config: Partial<AgenticLoopConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.state = this.createInitialState();
  }

  /**
   * 创建初始状态
   */
  private createInitialState(): AgenticLoopState {
    return {
      isAgenticMode: false,
      currentIteration: 0,
      consecutiveMistakeCount: 0,
      isComplete: false,
      completionReason: undefined,
      completionResult: undefined,
      suggestedCommand: undefined,
      startTime: undefined,
      endTime: undefined
    };
  }

  /**
   * 检查是否应该启用 Agentic 模式
   * 基于当前启用的 MCP 服务器判断
   */
  shouldEnableAgenticMode(enabledServers: string[]): boolean {
    return this.config.enabledMCPServers.some(server => 
      enabledServers.includes(server)
    );
  }

  /**
   * 开始新的 Agentic 循环
   */
  startLoop(topicId: string): void {
    // 如果已有活跃循环，先结束它
    if (this.state.isAgenticMode && !this.state.isComplete) {
      logger.warn(`覆盖已有的活跃循环 - 旧 topicId: ${this.activeTopicId}, 新 topicId: ${topicId}`);
      this.state.isComplete = true;
      this.state.completionReason = 'user_cancelled';
      this.state.endTime = Date.now();
      this.emit('complete', this.state);
    }
    
    this.activeTopicId = topicId;
    this.state = this.createInitialState();
    this.state.isAgenticMode = true;
    this.state.startTime = Date.now();
    
    logger.debug(`开始 Agentic 循环 - topicId: ${topicId}`);
  }

  /**
   * 开始新的迭代
   */
  startIteration(): number {
    this.state.currentIteration++;
    this.emit('iteration:start', this.state.currentIteration);
    
    logger.debug(`迭代 ${this.state.currentIteration}/${this.config.maxIterations}`);
    
    return this.state.currentIteration;
  }

  /**
   * 处理工具调用结果
   */
  processToolResult(result: ToolCallResult): void {
    logger.debug(`处理工具结果: ${result.toolName}, 成功: ${result.success}, 完成: ${result.isCompletion}`);

    // 检查是否是完成信号
    if (result.isCompletion) {
      this.handleCompletion(result);
      return;
    }

    // 处理错误
    if (!result.success) {
      this.handleMistake(result.error);
      // 如果因连续错误已完成，直接返回
      if (this.state.isComplete) {
        this.emit('iteration:end', this.state.currentIteration, result);
        return;
      }
    } else {
      // 成功时重置连续错误计数
      this.state.consecutiveMistakeCount = 0;
    }

    // 检查是否达到最大迭代次数
    if (this.state.currentIteration >= this.config.maxIterations) {
      this.handleMaxIterationsReached();
    }

    this.emit('iteration:end', this.state.currentIteration, result);
  }

  /**
   * 处理 attempt_completion 完成信号
   */
  private handleCompletion(result: ToolCallResult): void {
    this.state.isComplete = true;
    this.state.completionReason = 'attempt_completion';
    this.state.endTime = Date.now();

    // 解析完成结果
    if (result.content) {
      try {
        const content = typeof result.content === 'string'
          ? JSON.parse(result.content)
          : result.content;
        
        // 确保 result 字段存在，否则使用整个 content 作为结果
        this.state.completionResult = content.result ?? (typeof content === 'object' ? JSON.stringify(content) : String(content));
        this.state.suggestedCommand = content.command;
      } catch {
        this.state.completionResult = String(result.content);
      }
    }

    logger.debug(`任务完成 - 迭代次数: ${this.state.currentIteration}`);
    this.emit('complete', this.state);
  }

  /**
   * 处理错误/失误
   */
  private handleMistake(error?: string): void {
    this.state.consecutiveMistakeCount++;
    
    logger.warn(`连续错误: ${this.state.consecutiveMistakeCount}/${this.config.consecutiveMistakeLimit}`, error);
    
    this.emit('mistake', this.state.consecutiveMistakeCount, this.config.consecutiveMistakeLimit);

    // 检查是否超过连续错误限制
    if (this.state.consecutiveMistakeCount >= this.config.consecutiveMistakeLimit) {
      this.handleConsecutiveMistakesReached();
    }
  }

  /**
   * 处理达到最大迭代次数
   */
  private handleMaxIterationsReached(): void {
    this.state.isComplete = true;
    this.state.completionReason = 'max_iterations_reached';
    this.state.endTime = Date.now();

    logger.warn(`达到最大迭代次数: ${this.config.maxIterations}`);
    this.emit('complete', this.state);
  }

  /**
   * 处理连续错误过多
   */
  private handleConsecutiveMistakesReached(): void {
    this.state.isComplete = true;
    this.state.completionReason = 'consecutive_mistakes';
    this.state.endTime = Date.now();

    logger.error(`连续错误过多，停止循环`);
    this.emit('complete', this.state);
  }

  /**
   * 用户取消
   */
  cancel(): void {
    if (!this.state.isComplete) {
      this.state.isComplete = true;
      this.state.completionReason = 'user_cancelled';
      this.state.endTime = Date.now();

      logger.debug(`用户取消`);
      this.emit('complete', this.state);
    }
  }

  /**
   * 检查是否应该继续循环
   */
  shouldContinue(): boolean {
    if (!this.state.isAgenticMode) {
      return false;
    }

    if (this.state.isComplete) {
      return false;
    }

    if (this.state.currentIteration >= this.config.maxIterations) {
      return false;
    }

    if (this.state.consecutiveMistakeCount >= this.config.consecutiveMistakeLimit) {
      return false;
    }

    return true;
  }

  /**
   * 检测工具结果是否包含完成信号
   */
  isCompletionSignal(toolResult: any): boolean {
    if (!toolResult) return false;

    // 检查工具名称是否是 attempt_completion（支持带前缀的名称）
    const toolName = toolResult.toolName || '';
    if (toolName === 'attempt_completion' || toolName.endsWith('-attempt_completion')) {
      logger.debug(`检测到 attempt_completion 工具调用: ${toolName}`);
      return true;
    }

    // 检查 _meta 标记
    if (toolResult._meta?.isCompletion) {
      return true;
    }

    // 检查内容中的 __agentic_completion__ 标记
    // 支持多种内容格式
    try {
      let contentStr: string | null = null;
      
      // 格式1: content 是数组 (MCP 原始格式)
      if (Array.isArray(toolResult.content)) {
        contentStr = toolResult.content?.[0]?.text;
      }
      // 格式2: content 是字符串 (Redux block 格式)
      else if (typeof toolResult.content === 'string') {
        contentStr = toolResult.content;
      }
      // 格式3: content 是对象
      else if (typeof toolResult.content === 'object' && toolResult.content !== null) {
        contentStr = JSON.stringify(toolResult.content);
      }
      
      if (contentStr) {
        // 尝试解析 JSON
        try {
          const parsed = JSON.parse(contentStr);
          if (parsed.__agentic_completion__) {
            logger.debug('检测到 __agentic_completion__ 标记');
            return true;
          }
        } catch {
          // 不是 JSON，检查是否包含标记字符串
          if (contentStr.includes('__agentic_completion__')) {
            logger.debug('在内容中检测到 __agentic_completion__ 字符串');
            return true;
          }
        }
      }
    } catch (error) {
      logger.warn('检测完成信号时出错:', error);
    }

    return false;
  }

  /**
   * 从工具结果中提取完成信息
   * 支持多种内容格式，与 isCompletionSignal 保持一致
   */
  extractCompletionInfo(toolResult: any): { result: string; command?: string } | null {
    try {
      let contentStr: string | null = null;
      
      // 格式1: content 是数组 (MCP 原始格式)
      if (Array.isArray(toolResult.content)) {
        contentStr = toolResult.content?.[0]?.text;
      }
      // 格式2: content 是字符串 (Redux block 格式)
      else if (typeof toolResult.content === 'string') {
        contentStr = toolResult.content;
      }
      // 格式3: content 是对象
      else if (typeof toolResult.content === 'object' && toolResult.content !== null) {
        // 如果对象直接包含 __agentic_completion__ 标记
        if (toolResult.content.__agentic_completion__) {
          return {
            result: toolResult.content.result,
            command: toolResult.content.command
          };
        }
        contentStr = JSON.stringify(toolResult.content);
      }
      
      if (contentStr) {
        const parsed = JSON.parse(contentStr);
        if (parsed.__agentic_completion__) {
          return {
            result: parsed.result,
            command: parsed.command
          };
        }
      }
    } catch {
      // 解析失败
    }
    return null;
  }

  /**
   * 结束循环
   */
  endLoop(): AgenticLoopState {
    const finalState = { ...this.state };
    
    if (!this.state.endTime) {
      this.state.endTime = Date.now();
    }

    logger.debug(`循环结束 - 总迭代: ${this.state.currentIteration}, 原因: ${this.state.completionReason}`);
    
    // 重置状态
    this.activeTopicId = null;
    this.state = this.createInitialState();
    
    return finalState;
  }

  /**
   * 获取当前状态
   */
  getState(): AgenticLoopState {
    return { ...this.state };
  }

  /**
   * 获取当前配置
   */
  getConfig(): AgenticLoopConfig {
    return { ...this.config };
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<AgenticLoopConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * 获取活动的 Topic ID
   */
  getActiveTopicId(): string | null {
    return this.activeTopicId;
  }

  /**
   * 获取循环统计信息
   */
  getStats(): {
    iterations: number;
    mistakes: number;
    duration: number | null;
    isComplete: boolean;
    completionReason?: AgenticCompletionReason;
  } {
    const duration = this.state.startTime && this.state.endTime
      ? this.state.endTime - this.state.startTime
      : this.state.startTime
        ? Date.now() - this.state.startTime
        : null;

    return {
      iterations: this.state.currentIteration,
      mistakes: this.state.consecutiveMistakeCount,
      duration,
      isComplete: this.state.isComplete,
      completionReason: this.state.completionReason
    };
  }
}

// ==================== 单例导出 ====================

/** 全局 Agentic 循环服务实例 */
export const agenticLoopService = new AgenticLoopService();

export default agenticLoopService;
