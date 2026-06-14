/**
 * 知识库任务队列服务
 * 
 * 参考 Cherry Studio 的工作负载感知调度器设计，适配移动端：
 * - 受控并发（默认 3 个任务并行）
 * - 工作负载限制（默认 20MB）
 * - 递归调度（任务完成后自动填充空闲槽位）
 * - 任务生命周期管理（PENDING → PROCESSING → DONE | FAILED | CANCELLED）
 * - 事件驱动的进度通知
 */
import { v4 as uuid } from 'uuid';
import { EventEmitter, EVENT_NAMES } from '../infra/EventService';
import { MobileKnowledgeService } from './MobileKnowledgeService';
import { fileParserService } from './FileParserService';
import store from '../../store';
import type { PreprocessProviderConfig } from './preprocess/types';
import type {
  TaskItem,
  TaskType,
  TaskStage,
  QueueConfig,
  QueueStatus,
} from '../../types/KnowledgeBase';
import { createLogger } from '../infra/logger';

const logger = createLogger('KnowledgeTaskQueue');

// 默认队列配置（移动端保守值）
const DEFAULT_QUEUE_CONFIG: QueueConfig = {
  maxConcurrent: 3,                    // 最大 3 个并发（Cherry Studio: 30）
  maxWorkload: 20 * 1024 * 1024,       // 20MB（Cherry Studio: 80MB）
  maxRetries: 3,
  retryDelay: 2000,                    // 2 秒后重试
};

// 二进制文件扩展名
const BINARY_EXTENSIONS = new Set([
  '.pdf', '.docx', '.doc', '.xlsx', '.xls',
  '.pptx', '.ppt', '.epub', '.rtf', '.odt',
]);

/**
 * 评估任务的工作负载（字节数）
 */
function evaluateWorkload(task: TaskItem): number {
  switch (task.type) {
    case 'file':
      return task.fileSize;
    case 'url':
      return 2 * 1024 * 1024; // URL 默认估算 2MB
    case 'note':
      return new Blob([task.content]).size;
    case 'refresh':
      return task.content.length;
    default:
      return task.fileSize || 0;
  }
}

/**
 * 检查是否为二进制文件
 */
function isBinaryFile(fileName: string): boolean {
  const ext = '.' + (fileName.split('.').pop()?.toLowerCase() || '');
  return BINARY_EXTENSIONS.has(ext);
}

// 事件回调类型
type TaskEventCallback = (task: TaskItem) => void;
type QueueEventCallback = () => void;

type EventMap = {
  'task:queued': TaskEventCallback;
  'task:started': TaskEventCallback;
  'task:progress': TaskEventCallback;
  'task:completed': TaskEventCallback;
  'task:failed': TaskEventCallback;
  'queue:drained': QueueEventCallback;
};

export class KnowledgeTaskQueue {
  private static instance: KnowledgeTaskQueue;
  private config: QueueConfig;

  // 队列状态
  private pendingQueue: TaskItem[] = [];
  private processingMap: Map<string, TaskItem> = new Map();
  private completedCount = 0;
  private failedCount = 0;
  private currentWorkload = 0;

  // 本地事件监听器
  private listeners: Map<string, Set<Function>> = new Map();

  // 取消控制器映射
  private abortControllers: Map<string, AbortController> = new Map();

  private constructor(config?: Partial<QueueConfig>) {
    this.config = { ...DEFAULT_QUEUE_CONFIG, ...config };
  }

  static getInstance(config?: Partial<QueueConfig>): KnowledgeTaskQueue {
    if (!KnowledgeTaskQueue.instance) {
      KnowledgeTaskQueue.instance = new KnowledgeTaskQueue(config);
    }
    return KnowledgeTaskQueue.instance;
  }

  /**
   * 更新队列配置
   */
  updateConfig(config: Partial<QueueConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * 从 Redux 设置中读取 PDF 云端预处理配置，注入到 FileParserService
   */
  private injectCloudPreprocessConfig(): void {
    try {
      const pdfPreprocess = store.getState().pdfPreprocess;
      const activeId = pdfPreprocess.activeProviderId;

      if (activeId && pdfPreprocess.providers[activeId]) {
        const p = pdfPreprocess.providers[activeId];
        const config: PreprocessProviderConfig = {
          id: p.id as PreprocessProviderConfig['id'],
          name: p.name,
          apiKey: p.apiKey,
          apiHost: p.apiHost,
          model: p.model,
        };
        fileParserService.setCloudPreprocessConfig(config);
      } else {
        fileParserService.setCloudPreprocessConfig(null);
      }

      // 注入 PDF 解析模式
      fileParserService.setPdfParseMode(pdfPreprocess.parseMode || 'auto');
    } catch (err) {
      logger.warn('读取云端预处理配置失败:', err);
    }
  }

  // ============ 事件系统 ============

  /**
   * 注册事件监听器，返回取消函数
   */
  on<K extends keyof EventMap>(event: K, callback: EventMap[K]): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
    return () => {
      this.listeners.get(event)?.delete(callback);
    };
  }

  private emit<K extends keyof EventMap>(event: K, ...args: Parameters<EventMap[K]>): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      for (const cb of callbacks) {
        try {
          (cb as Function)(...args);
        } catch (err) {
          logger.error(`事件处理器错误 (${event}):`, err);
        }
      }
    }

    // 同时发射到全局 EventEmitter（供非直接引用的组件使用）
    const globalEventMap: Record<string, string> = {
      'task:queued': EVENT_NAMES.KNOWLEDGE_TASK_QUEUED,
      'task:started': EVENT_NAMES.KNOWLEDGE_TASK_STARTED,
      'task:progress': EVENT_NAMES.KNOWLEDGE_TASK_PROGRESS,
      'task:completed': EVENT_NAMES.KNOWLEDGE_TASK_COMPLETED,
      'task:failed': EVENT_NAMES.KNOWLEDGE_TASK_FAILED,
      'queue:drained': EVENT_NAMES.KNOWLEDGE_QUEUE_DRAINED,
    };
    const globalEvent = globalEventMap[event];
    if (globalEvent) {
      EventEmitter.emit(globalEvent, args[0] ?? {});
    }
  }

  // ============ 任务创建 ============

  /**
   * 创建任务项（不入队）
   */
  createTask(params: {
    type: TaskType;
    knowledgeBaseId: string;
    fileName: string;
    content: string;
    fileSize: number;
    arrayBuffer?: ArrayBuffer;
  }): TaskItem {
    return {
      id: uuid(),
      type: params.type,
      state: 'pending',
      knowledgeBaseId: params.knowledgeBaseId,
      fileName: params.fileName,
      content: params.content,
      arrayBuffer: params.arrayBuffer,
      fileSize: params.fileSize,
      progress: 0,
      retryCount: 0,
      maxRetries: this.config.maxRetries,
      createdAt: Date.now(),
    };
  }

  // ============ 任务提交 ============

  /**
   * 提交单个任务到队列
   * 返回 Promise，在任务完成/失败/取消时 resolve
   */
  addTask(task: TaskItem): Promise<TaskItem> {
    return new Promise((resolve) => {
      task.state = 'pending';

      // 创建取消控制器
      const abortController = new AbortController();
      this.abortControllers.set(task.id, abortController);

      // 注册完成回调
      const onSettled = (settledTask: TaskItem) => {
        if (settledTask.id === task.id) {
          this.off('task:completed', onSettled);
          this.off('task:failed', onSettled);
          this.off('task:cancelled', onSettled);
          resolve(settledTask);
        }
      };
      this.on('task:completed', onSettled);
      this.on('task:failed', onSettled);

      // 入队
      this.pendingQueue.push(task);
      this.emit('task:queued', task);

      logger.debug(
        `任务入队: ${task.fileName} ` +
        `(${this.formatBytes(task.fileSize)}, 队列: ${this.pendingQueue.length})`
      );

      // 触发调度
      this.processQueue();
    });
  }

  /**
   * 批量提交任务
   */
  addTasks(tasks: TaskItem[]): Promise<TaskItem[]> {
    return Promise.all(tasks.map(task => this.addTask(task)));
  }

  // ============ 核心调度器 ============

  /**
   * 队列调度核心 — 贪心填充 + 递归触发
   */
  private processQueue(): void {
    const tasksToStart: TaskItem[] = [];

    // 遍历等待队列，尝试填充空闲槽位
    const remaining: TaskItem[] = [];
    for (const task of this.pendingQueue) {
      if (this.isAtCapacity()) {
        remaining.push(task);
        continue;
      }

      const workload = evaluateWorkload(task);

      // 如果添加这个任务会超过工作负载限制，且已有任务在处理
      // 跳过这个大任务，尝试更小的（贪心策略）
      if (this.currentWorkload + workload > this.config.maxWorkload
          && this.processingMap.size > 0) {
        remaining.push(task);
        continue;
      }

      // 标记为处理中
      task.state = 'processing';
      task.startedAt = Date.now();
      this.currentWorkload += workload;
      this.processingMap.set(task.id, task);
      tasksToStart.push(task);
    }

    // 更新等待队列（移除已开始的任务）
    this.pendingQueue = remaining;

    // 并行启动所有选中的任务
    for (const task of tasksToStart) {
      this.emit('task:started', task);

      logger.debug(
        `任务开始: ${task.fileName} ` +
        `(并发: ${this.processingMap.size}/${this.config.maxConcurrent}, ` +
        `负载: ${this.formatBytes(this.currentWorkload)}/${this.formatBytes(this.config.maxWorkload)})`
      );

      this.executeTask(task)
        .then(() => {
          task.state = 'done';
          task.progress = 100;
          task.completedAt = Date.now();
          this.completedCount++;
          this.emit('task:completed', task);

          logger.debug(
            `任务完成: ${task.fileName} ` +
            `(耗时: ${Date.now() - (task.startedAt || Date.now())}ms)`
          );
        })
        .catch((error: Error) => {
          if (task.state === 'cancelled') return;

          task.state = 'failed';
          task.error = error.message;
          task.completedAt = Date.now();
          this.failedCount++;
          this.emit('task:failed', task);

          logger.error(
            `任务失败: ${task.fileName}:`,
            error.message
          );

          // 自动重试
          if (task.retryCount < task.maxRetries) {
            logger.debug(
              `将在 ${this.config.retryDelay}ms 后重试 ` +
              `(${task.retryCount + 1}/${task.maxRetries}): ${task.fileName}`
            );
            setTimeout(() => {
              this.retryTask(task.id);
            }, this.config.retryDelay);
          }
        })
        .finally(() => {
          // 释放工作负载
          const workload = evaluateWorkload(task);
          this.currentWorkload -= workload;
          this.processingMap.delete(task.id);

          // 释放内存：清除 arrayBuffer 引用
          task.arrayBuffer = undefined;

          // 清理取消控制器
          this.abortControllers.delete(task.id);

          // ★ 递归调度 — 任务完成后自动填充空闲槽位
          this.processQueue();

          // 检查队列是否完全清空
          if (this.processingMap.size === 0 && this.pendingQueue.length === 0) {
            this.emit('queue:drained');
            logger.debug(
              `队列清空 — ` +
              `完成: ${this.completedCount}, 失败: ${this.failedCount}`
            );
          }
        });
    }
  }

  // ============ 任务执行 ============

  /**
   * 执行单个任务：解析 → 分块 → 嵌入 → 存储
   */
  private async executeTask(task: TaskItem): Promise<void> {
    const knowledgeService = MobileKnowledgeService.getInstance();

    // 检查取消
    const abortController = this.abortControllers.get(task.id);
    if (abortController?.signal.aborted) {
      throw new Error('任务已取消');
    }

    let contentToProcess = task.content;

    // 阶段1: 读取 (0-10%)
    this.updateTaskProgress(task, 5, 'reading');
    await this.yieldToUI();

    this.updateTaskProgress(task, 10, 'reading');

    // 阶段2: 解析二进制文件 (10-30%)
    if (isBinaryFile(task.fileName)) {
      this.updateTaskProgress(task, 15, 'parsing');

      // 注入云端 PDF 预处理配置（从 Redux 设置读取）
      this.injectCloudPreprocessConfig();

      try {
        const arrayBuffer = task.arrayBuffer ||
          (task.content ? Uint8Array.from(atob(task.content), c => c.charCodeAt(0)).buffer : null);

        if (arrayBuffer) {
          const parsed = await fileParserService.parseFile(arrayBuffer, task.fileName);
          contentToProcess = parsed.content;
        }
      } catch (parseErr) {
        logger.warn(`文件解析失败: ${task.fileName}`, parseErr);
        contentToProcess = `[${task.fileName}]\n\n此文件格式需要额外依赖才能解析。\n\n${parseErr instanceof Error ? parseErr.message : '解析失败'}`;
      }

      this.updateTaskProgress(task, 30, 'parsing');
    } else {
      this.updateTaskProgress(task, 30, 'chunking');
    }

    // 检查取消
    if (abortController?.signal.aborted) {
      throw new Error('任务已取消');
    }

    // 阶段3: 分块 (30-50%)
    this.updateTaskProgress(task, 40, 'chunking');
    await this.yieldToUI();
    this.updateTaskProgress(task, 50, 'chunking');

    // 阶段4: 嵌入 (50-85%)
    this.updateTaskProgress(task, 60, 'embedding');

    await knowledgeService.addDocument({
      knowledgeBaseId: task.knowledgeBaseId,
      content: contentToProcess,
      metadata: {
        source: task.fileName,
        fileName: task.fileName,
      },
    });

    this.updateTaskProgress(task, 85, 'embedding');

    // 检查取消
    if (abortController?.signal.aborted) {
      throw new Error('任务已取消');
    }

    // 阶段5: 保存完成 (85-100%)
    this.updateTaskProgress(task, 95, 'saving');
    await this.yieldToUI();
    this.updateTaskProgress(task, 100, 'saving');
  }

  /**
   * 更新任务进度并发射事件
   */
  private updateTaskProgress(task: TaskItem, progress: number, stage: TaskStage): void {
    task.progress = progress;
    task.stage = stage;
    this.emit('task:progress', task);
  }

  /**
   * 让出主线程给 UI 渲染
   */
  private yieldToUI(): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, 0));
  }

  // ============ 任务控制 ============

  /**
   * 取消单个任务
   */
  cancelTask(taskId: string): boolean {
    // 如果在等待队列中，直接移除
    const pendingIndex = this.pendingQueue.findIndex(t => t.id === taskId);
    if (pendingIndex !== -1) {
      const task = this.pendingQueue[pendingIndex];
      task.state = 'cancelled';
      this.pendingQueue.splice(pendingIndex, 1);
      this.abortControllers.delete(taskId);
      logger.debug(`任务取消(等待中): ${task.fileName}`);
      return true;
    }

    // 如果正在处理中，触发 abort
    const processingTask = this.processingMap.get(taskId);
    if (processingTask) {
      processingTask.state = 'cancelled';
      const controller = this.abortControllers.get(taskId);
      controller?.abort();
      logger.debug(`任务取消(处理中): ${processingTask.fileName}`);
      return true;
    }

    return false;
  }

  /**
   * 取消所有任务
   */
  cancelAll(): void {
    // 取消等待中的
    for (const task of this.pendingQueue) {
      task.state = 'cancelled';
    }
    this.pendingQueue = [];

    // 取消处理中的
    for (const [id, task] of this.processingMap) {
      task.state = 'cancelled';
      const controller = this.abortControllers.get(id);
      controller?.abort();
    }

    // 清理
    this.abortControllers.clear();
    logger.debug('所有任务已取消');
  }

  /**
   * 重试失败的任务
   */
  retryTask(taskId: string): boolean {
    // 从 processingMap 中查找（失败的任务可能还在 map 中）
    let task = this.processingMap.get(taskId);

    // 如果不在 processingMap，可能已经被清理，需要外部传入
    if (!task) {
      return false;
    }

    if (task.retryCount >= task.maxRetries) {
      logger.warn(`任务已达最大重试次数: ${task.fileName}`);
      return false;
    }

    // 重置状态
    task.state = 'pending';
    task.progress = 0;
    task.stage = undefined;
    task.error = undefined;
    task.retryCount++;

    // 重新创建取消控制器
    this.abortControllers.set(task.id, new AbortController());

    // 从 processingMap 移回 pendingQueue
    this.processingMap.delete(task.id);

    this.pendingQueue.push(task);
    this.emit('task:queued', task);

    // 触发调度
    this.processQueue();
    return true;
  }

  // ============ 状态查询 ============

  /**
   * 容量检查
   */
  private isAtCapacity(): boolean {
    return (
      this.processingMap.size >= this.config.maxConcurrent ||
      this.currentWorkload >= this.config.maxWorkload
    );
  }

  /**
   * 获取队列状态快照
   */
  getStatus(): QueueStatus {
    return {
      pending: this.pendingQueue.length,
      processing: this.processingMap.size,
      completed: this.completedCount,
      failed: this.failedCount,
      totalWorkload: this.currentWorkload,
      maxWorkload: this.config.maxWorkload,
      isAtCapacity: this.isAtCapacity(),
    };
  }

  /**
   * 获取指定任务
   */
  getTask(taskId: string): TaskItem | undefined {
    return this.processingMap.get(taskId)
      || this.pendingQueue.find(t => t.id === taskId);
  }

  /**
   * 获取所有活跃任务（pending + processing）
   */
  getActiveTasks(): TaskItem[] {
    return [
      ...this.pendingQueue,
      ...Array.from(this.processingMap.values()),
    ];
  }

  /**
   * 队列是否空闲
   */
  isIdle(): boolean {
    return this.pendingQueue.length === 0 && this.processingMap.size === 0;
  }

  /**
   * 重置计数器
   */
  resetCounters(): void {
    this.completedCount = 0;
    this.failedCount = 0;
  }

  // ============ 工具方法 ============

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  /**
   * 内部移除事件监听
   */
  private off(event: string, callback: Function): void {
    this.listeners.get(event)?.delete(callback);
  }
}
