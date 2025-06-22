/**
 * 数据库迁移管理器
 * 统一管理所有数据库版本迁移逻辑
 */

import type { MigrationResult } from './types';
import { v4 as uuid } from 'uuid';

/**
 * 数据库迁移管理器
 */
export class DatabaseMigrationManager {
  private static instance: DatabaseMigrationManager;

  /**
   * 获取单例实例
   */
  public static getInstance(): DatabaseMigrationManager {
    if (!DatabaseMigrationManager.instance) {
      DatabaseMigrationManager.instance = new DatabaseMigrationManager();
    }
    return DatabaseMigrationManager.instance;
  }

  /**
   * 执行数据库迁移
   * @param db 数据库实例
   * @param fromVersion 当前版本
   * @param toVersion 目标版本
   */
  async executeMigrations(db: any, fromVersion: number, toVersion: number): Promise<MigrationResult[]> {
    const results: MigrationResult[] = [];

    if (fromVersion >= toVersion) {
      this.log(`无需迁移：当前版本 ${fromVersion}，目标版本 ${toVersion}`);
      return results;
    }

    this.log(`开始数据库迁移：从版本 ${fromVersion} 到版本 ${toVersion}`);

    // 按版本顺序执行迁移
    for (let version = fromVersion + 1; version <= toVersion; version++) {
      const result = await this.executeSingleMigration(db, version);
      results.push(result);

      if (!result.success) {
        this.log(`迁移版本 ${version} 失败，停止后续迁移`, 'error');
        break;
      }
    }

    return results;
  }

  /**
   * 执行单个版本的迁移
   */
  async executeSingleMigration(db: any, version: number): Promise<MigrationResult> {
    const startTime = Date.now();

    try {
      this.log(`开始执行版本 ${version} 迁移`);

      switch (version) {
        case 4:
          await this.migrateToV4(db);
          break;
        case 5:
          await this.migrateToV5(db);
          break;
        case 6:
          await this.migrateToV6(db);
          break;
        case 7:
          await this.migrateToV7(db);
          break;
        default:
          throw new Error(`未找到版本 ${version} 的迁移逻辑`);
      }

      const duration = Date.now() - startTime;
      this.log(`版本 ${version} 迁移完成，耗时 ${duration}ms`);

      return {
        success: true,
        version,
        duration
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      this.log(`版本 ${version} 迁移失败: ${errorMessage}`, 'error');

      return {
        success: false,
        version,
        error: errorMessage,
        duration
      };
    }
  }

  /**
   * 迁移到版本4：规范化消息存储
   * 将消息从topics.messages数组移动到独立的messages表
   */
  private async migrateToV4(db: any): Promise<void> {
    this.log('开始升级到数据库版本4: 规范化消息存储...');

    try {
      // 获取所有话题
      const topics = await db.topics.toArray();
      this.log(`找到 ${topics.length} 个话题需要迁移`);

      let totalMessagesProcessed = 0;

      // 逐个处理话题中的消息
      for (const topic of topics) {
        // 跳过没有messages数组的话题
        if (!topic.messages || !Array.isArray(topic.messages) || topic.messages.length === 0) {
          this.log(`话题 ${topic.id} 没有消息，跳过`);
          // 初始化空的messageIds数组
          topic.messageIds = [];
          await db.topics.put(topic);
          continue;
        }

        this.log(`开始处理话题 ${topic.id} 的 ${topic.messages.length} 条消息`);

        // 初始化messageIds数组
        topic.messageIds = [];

        // 处理每条消息
        for (const message of topic.messages) {
          try {
            // 确保消息有ID
            if (!message.id) {
              message.id = uuid();
            }

            // 确保消息有topicId
            message.topicId = topic.id;

            // 确保消息有assistantId（从topic获取）
            if (!message.assistantId && topic.assistantId) {
              message.assistantId = topic.assistantId;
            }

            // 确保消息有创建时间
            if (!message.createdAt) {
              message.createdAt = new Date().toISOString();
            }

            // 保存消息到messages表
            await db.messages.put(message);

            // 将消息ID添加到topic的messageIds数组
            topic.messageIds.push(message.id);

            totalMessagesProcessed++;

          } catch (error) {
            this.log(`保存消息 ${message.id} 失败: ${error}`, 'error');
          }
        }

        // 清除topic中的messages数组（已迁移到messages表）
        delete topic.messages;

        // 保存更新后的话题
        await db.topics.put(topic);
        this.log(`话题 ${topic.id} 处理完成，迁移了 ${topic.messageIds.length} 条消息`);
      }

      this.log(`数据库迁移完成: 共处理 ${totalMessagesProcessed} 条消息`);

    } catch (error) {
      this.log(`数据库升级失败: ${error}`, 'error');
      throw error;
    }

    this.log('数据库升级到版本4完成');
  }

  /**
   * 迁移到版本5：将消息直接存储在topics表中
   * 从独立的messages表回到topics.messages数组
   */
  private async migrateToV5(db: any): Promise<void> {
    this.log('开始升级到数据库版本5: 将消息直接存储在topics表中...');

    try {
      // 获取所有话题
      const topics = await db.topics.toArray();
      this.log(`找到 ${topics.length} 个话题需要迁移`);

      let totalMessagesProcessed = 0;

      // 逐个处理话题
      for (const topic of topics) {
        // 初始化messages数组（如果不存在）
        if (!topic.messages) {
          topic.messages = [];
        }

        // 从messageIds加载消息
        if (topic.messageIds && Array.isArray(topic.messageIds)) {
          this.log(`处理话题 ${topic.id} 的 ${topic.messageIds.length} 条消息`);

          // 清空现有的messages数组
          topic.messages = [];

          // 加载所有消息
          for (const messageId of topic.messageIds) {
            const message = await db.messages.get(messageId);
            if (message) {
              // 将消息添加到topic.messages数组
              topic.messages.push(message);
              totalMessagesProcessed++;
            } else {
              this.log(`消息 ${messageId} 在messages表中不存在`, 'warn');
            }
          }

          // 清除messageIds字段（不再需要）
          delete topic.messageIds;

          // 保存更新后的话题
          await db.topics.put(topic);
          this.log(`话题 ${topic.id} 处理完成，共迁移 ${topic.messages.length} 条消息`);
        } else {
          this.log(`话题 ${topic.id} 没有messageIds数组，跳过`);
          // 确保有空的messages数组
          if (!topic.messages) {
            topic.messages = [];
            await db.topics.put(topic);
          }
        }
      }

      this.log(`数据库迁移完成: 共处理 ${totalMessagesProcessed} 条消息，所有消息已存储在topics表中`);

    } catch (error) {
      this.log(`数据库升级失败: ${error}`, 'error');
      throw error;
    }

    this.log('数据库升级到版本5完成');
  }

  /**
   * 迁移到版本6：添加文件存储表、知识库相关表和快捷短语表
   */
  private async migrateToV6(_db: any): Promise<void> {
    this.log('开始升级到数据库版本6: 添加文件存储表、知识库相关表和快捷短语表...');

    // 文件表、知识库表和快捷短语表会自动创建，无需特殊处理
    // 这里可以添加一些初始化数据或验证逻辑

    this.log('数据库升级到版本6完成');
  }

  /**
   * 迁移到版本7：添加memories表用于存储知识图谱数据
   */
  private async migrateToV7(_db: any): Promise<void> {
    this.log('开始升级到数据库版本7: 添加memories表用于存储知识图谱数据...');

    try {
      // memories表会自动创建，无需特殊处理
      // 这里可以添加一些初始化数据或验证逻辑

      this.log('数据库升级到版本7完成');
    } catch (error) {
      this.log(`版本7迁移失败: ${error}`, 'error');
      throw error;
    }
  }

  /**
   * 日志记录
   */
  private log(message: string, level: 'info' | 'warn' | 'error' = 'info'): void {
    const prefix = '[DatabaseMigration]';
    switch (level) {
      case 'warn':
        console.warn(`${prefix} ${message}`);
        break;
      case 'error':
        console.error(`${prefix} ${message}`);
        break;
      default:
        console.log(`${prefix} ${message}`);
    }
  }
}

// 导出单例实例
export const databaseMigrationManager = DatabaseMigrationManager.getInstance();
