/**
 * Agentic File Tracker
 * 跟踪 Agentic 模式下的文件修改操作
 * 
 * 使用事件发布/订阅模式将文件修改通知给 Redux store
 * 避免循环依赖问题
 */

import type { FileOperationType } from '../../store/slices/agenticFilesSlice';
import { createLogger } from '../infra/logger';

const logger = createLogger('AgenticFileTracker');


/** 文件修改事件数据 */
export interface FileChangeEvent {
  path: string;
  operation: FileOperationType;
  originalContent?: string;
  newContent?: string;
  newPath?: string;
  diffStats?: {
    added: number;
    removed: number;
  };
  backupPath?: string;
  isNewFile?: boolean;
  messageId?: string;
  topicId?: string;
}

/** 文件修改事件监听器类型 */
type FileChangeListener = (change: Omit<FileChangeEvent, 'messageId' | 'topicId'> & { messageId?: string; topicId?: string }) => void;
type AgenticModeListener = (enabled: boolean, topicId?: string | null) => void;

/**
 * Agentic 文件跟踪器
 * 单例模式，用于在文件编辑操作时记录修改
 * 使用事件发布/订阅模式避免循环依赖
 */
class AgenticFileTracker {
  private static instance: AgenticFileTracker;
  private currentTopicId: string | null = null;
  private currentMessageId: string | null = null;
  private isEnabled: boolean = false;
  
  // 事件监听器
  private fileChangeListeners: Set<FileChangeListener> = new Set();
  private agenticModeListeners: Set<AgenticModeListener> = new Set();

  private constructor() {}

  public static getInstance(): AgenticFileTracker {
    if (!AgenticFileTracker.instance) {
      AgenticFileTracker.instance = new AgenticFileTracker();
    }
    return AgenticFileTracker.instance;
  }

  /**
   * 订阅文件修改事件
   */
  public onFileChange(listener: FileChangeListener): () => void {
    this.fileChangeListeners.add(listener);
    return () => this.fileChangeListeners.delete(listener);
  }

  /**
   * 订阅 Agentic 模式变化事件
   */
  public onAgenticModeChange(listener: AgenticModeListener): () => void {
    this.agenticModeListeners.add(listener);
    return () => this.agenticModeListeners.delete(listener);
  }

  /**
   * 启用文件跟踪 (进入 Agentic 模式时调用)
   */
  public enable(topicId: string): void {
    this.isEnabled = true;
    this.currentTopicId = topicId;
    
    // 通知所有监听器
    this.agenticModeListeners.forEach(listener => {
      try {
        listener(true, topicId);
      } catch (e) {
        logger.error('监听器错误:', e);
      }
    });
    
    logger.debug('已启用，topicId:', topicId);
  }

  /**
   * 禁用文件跟踪 (退出 Agentic 模式时调用)
   */
  public disable(): void {
    this.isEnabled = false;
    
    // 通知所有监听器
    this.agenticModeListeners.forEach(listener => {
      try {
        listener(false, null);
      } catch (e) {
        logger.error('监听器错误:', e);
      }
    });
    
    logger.debug('已禁用');
  }

  /**
   * 设置当前消息 ID
   */
  public setCurrentMessageId(messageId: string | null): void {
    this.currentMessageId = messageId;
  }

  /**
   * 记录文件修改
   * 注意：即使未启用 Agentic 模式，也记录文件修改，以便用户查看
   */
  public trackFileChange(event: FileChangeEvent): void {
    // 即使未启用也记录，让用户可以看到所有文件修改
    // if (!this.isEnabled) {
    //   logger.debug('未启用，跳过记录');
    //   return;
    // }

    const change = {
      path: event.path,
      operation: event.operation,
      originalContent: event.originalContent,
      newContent: event.newContent,
      newPath: event.newPath,
      diffStats: event.diffStats,
      backupPath: event.backupPath,
      isNewFile: event.isNewFile,
      messageId: event.messageId || this.currentMessageId || undefined,
      topicId: event.topicId || this.currentTopicId || undefined,
    };

    // 通知所有监听器
    this.fileChangeListeners.forEach(listener => {
      try {
        listener(change);
      } catch (e) {
        logger.error('监听器错误:', e);
      }
    });
    
    logger.debug('记录文件修改:', event.path, event.operation);
  }

  /**
   * 记录文件创建
   */
  public trackFileCreate(path: string, content: string, backupPath?: string): void {
    this.trackFileChange({
      path,
      operation: 'create',
      newContent: content,
      isNewFile: true,
      backupPath,
      diffStats: {
        added: content.split('\n').length,
        removed: 0,
      },
    });
  }

  /**
   * 记录文件修改
   */
  public trackFileModify(
    path: string, 
    originalContent: string, 
    newContent: string,
    diffStats?: { added: number; removed: number },
    backupPath?: string
  ): void {
    this.trackFileChange({
      path,
      operation: 'modify',
      originalContent,
      newContent,
      diffStats,
      backupPath,
    });
  }

  /**
   * 记录文件删除
   */
  public trackFileDelete(path: string, originalContent?: string): void {
    this.trackFileChange({
      path,
      operation: 'delete',
      originalContent,
      diffStats: originalContent ? {
        added: 0,
        removed: originalContent.split('\n').length,
      } : undefined,
    });
  }

  /**
   * 记录文件重命名
   */
  public trackFileRename(oldPath: string, newPath: string): void {
    this.trackFileChange({
      path: oldPath,
      operation: 'rename',
      newPath,
    });
  }

  /**
   * 记录文件移动
   */
  public trackFileMove(oldPath: string, newPath: string): void {
    this.trackFileChange({
      path: oldPath,
      operation: 'move',
      newPath,
    });
  }

  /**
   * 检查是否已启用
   */
  public isTracking(): boolean {
    return this.isEnabled;
  }

  /**
   * 获取当前 Topic ID
   */
  public getCurrentTopicId(): string | null {
    return this.currentTopicId;
  }
}

// 导出单例实例
export const agenticFileTracker = AgenticFileTracker.getInstance();
