import { DataRepository } from './DataRepository';
import type { ChatTopic } from '../../types';
import { generateMessageId } from '../../utils';
import { handleError } from '../../utils/error';
import { dexieStorage } from './DexieStorageService';
import { createLogger } from '../infra/logger';

const logger = createLogger('DataRepairService');

/**
 * 统一数据修复服务 - 整合所有数据修复功能
 * 参考最佳实例简洁架构，提供统一的数据修复入口
 */
export class DataRepairService {
  /**
   * 统一数据修复入口 - 执行所有必要的数据修复
   * @param options 修复选项
   * @returns 修复结果统计
   */
  static async repairAllData(options: {
    fixAssistantTopicRelations?: boolean;
    fixDuplicateMessages?: boolean;
    fixOrphanTopics?: boolean;
    migrateMessages?: boolean;
  } = {}): Promise<{
    assistantTopicFixed: number;
    duplicateMessagesFixed: number;
    orphanTopicsRemoved: number;
    messagesRepaired: number;
  }> {
    logger.debug('开始统一数据修复');

    const {
      fixAssistantTopicRelations = true,
      fixDuplicateMessages = true,
      fixOrphanTopics = true,
      migrateMessages = true
    } = options;

    const result = {
      assistantTopicFixed: 0,
      duplicateMessagesFixed: 0,
      orphanTopicsRemoved: 0,
      messagesRepaired: 0
    };

    try {
      // 1. 修复助手和话题关联关系
      if (fixAssistantTopicRelations) {
        const relationResult = await this.repairAssistantTopicRelations(fixOrphanTopics);
        result.assistantTopicFixed = relationResult.fixed;
        result.orphanTopicsRemoved = relationResult.orphanTopicsRemoved;
      }

      // 2. 修复重复消息
      if (fixDuplicateMessages) {
        const messageResult = await this.repairDuplicateMessages();
        result.duplicateMessagesFixed = messageResult.fixed;
      }

      // 3. 迁移和修复消息数据
      if (migrateMessages) {
        const migrateResult = await this.repairMessagesData();
        result.messagesRepaired = migrateResult.repaired;
      }

      logger.debug('统一数据修复完成', result);
      return result;
    } catch (error) {
      handleError(error, 'DataRepairService.repairAllData', {
        logLevel: 'ERROR',
        additionalData: { options },
        rethrow: true
      });
      throw error;
    }
  }

  /**
   * 检查数据一致性
   * 返回是否存在一致性问题
   */
  static async checkDataConsistency(): Promise<boolean> {
    logger.debug('开始检查数据一致性');

    try {
      // 获取所有助手和话题
      const assistants = await DataRepository.assistants.getAll();
      const topics = await DataRepository.topics.getAll();

      logger.debug(`找到 ${assistants.length} 个助手和 ${topics.length} 个话题`);

      // 检查助手的topicIds和话题的assistantId是否一致
      let inconsistencies = 0;

      // 检查每个话题
      for (const topic of topics) {
        if (!topic.assistantId) {
          logger.debug(`话题 ${topic.id} 没有assistantId字段`);
          inconsistencies++;
          continue;
        }

        // 查找对应的助手
        const assistant = assistants.find(a => a.id === topic.assistantId);
        if (!assistant) {
          logger.debug(`话题 ${topic.id} 的助手 ${topic.assistantId} 不存在`);
          inconsistencies++;
          continue;
        }

        // 检查助手的topicIds是否包含该话题
        if (!assistant.topicIds?.includes(topic.id)) {
          logger.debug(`助手 ${assistant.id} 的topicIds不包含话题 ${topic.id}`);
          inconsistencies++;
        }
      }

      // 检查每个助手的topicIds
      for (const assistant of assistants) {
        if (!assistant.topicIds || !Array.isArray(assistant.topicIds)) {
          logger.debug(`助手 ${assistant.id} 没有有效的topicIds数组`);
          inconsistencies++;
          continue;
        }

        // 检查每个topicId是否存在对应的话题
        for (const topicId of assistant.topicIds) {
          const topic = topics.find(t => t.id === topicId);
          if (!topic) {
            logger.debug(`助手 ${assistant.id} 的topicId ${topicId} 对应的话题不存在`);
            inconsistencies++;
            continue;
          }

          // 检查话题的assistantId是否指向当前助手
          if (topic.assistantId !== assistant.id) {
            logger.debug(`话题 ${topicId} 的assistantId (${topic.assistantId}) 与助手ID (${assistant.id}) 不一致`);
            inconsistencies++;
          }
        }
      }

      logger.debug(`检查完成，发现 ${inconsistencies} 个数据一致性问题`);
      return inconsistencies > 0;
    } catch (error) {
      logger.error('检查数据一致性失败:', error);
      return true; // 如果发生错误，也认为需要修复
    }
  }

  /**
   * 修复重复消息 - 整合DataAdapter中的逻辑
   * @param topicId 话题ID（可选，如果不提供则检查所有话题）
   * @returns 修复结果
   */
  static async repairDuplicateMessages(topicId?: string): Promise<{fixed: number, total: number}> {
    logger.debug(`修复重复消息 ${topicId ? `话题ID: ${topicId}` : '所有话题'}`);

    let fixed = 0;
    let total = 0;

    try {
      // 获取需要处理的话题
      const topics = topicId
        ? [await DataRepository.topics.getById(topicId)].filter(Boolean) as ChatTopic[]
        : await DataRepository.topics.getAll();

      logger.debug(`开始处理 ${topics.length} 个话题`);

      // 统一架构：遍历话题，从 messages 表修复重复消息
      for (const topic of topics) {
        // 从 messages 表加载消息
        const messages = await DataRepository.messages.getByTopicId(topic.id);
        if (!messages || messages.length === 0) {
          continue;
        }

        total += messages.length;

        // 查找并修复重复消息ID
        const seenIds = new Set<string>();
        let hasChanges = false;

        for (const message of messages) {
          // 如果消息没有ID，生成一个
          if (!message.id) {
            message.id = generateMessageId();
            await DataRepository.messages.save(message);
            hasChanges = true;
            fixed++;
          }
          // 如果ID已存在，生成一个新ID
          else if (seenIds.has(message.id)) {
            const originalId = message.id;
            message.id = generateMessageId();
            await DataRepository.messages.save(message);
            logger.debug(`修复重复消息ID: ${originalId} -> ${message.id}`);
            hasChanges = true;
            fixed++;
          }

          seenIds.add(message.id);
        }

        // 如果有修改，同步更新 topic 的 messageIds
        if (hasChanges) {
          topic.messageIds = messages.map(m => m.id);
          await DataRepository.topics.save(topic);
          logger.debug(`话题 ${topic.id} 修复了消息`);
        }
      }

      logger.debug(`修复完成: 总计 ${fixed} 条消息被修复，共 ${total} 条消息`);
      return { fixed, total };

    } catch (error) {
      handleError(error, 'DataRepairService.repairDuplicateMessages', {
        logLevel: 'ERROR',
        additionalData: { topicId },
        rethrow: true
      });
      throw error;
    }
  }

  /**
   * 修复消息数据 - 整合DexieStorageService中的逻辑
   * @returns 修复结果
   */
  static async repairMessagesData(): Promise<{repaired: number}> {
    logger.debug('开始修复消息数据...');

    let totalRepaired = 0;

    try {
      // 统一架构：确保所有话题的 messageIds 与 messages 表同步
      const topics = await DataRepository.topics.getAll();

      for (const topic of topics) {
        // 确保messageIds数组存在
        if (!topic.messageIds || !Array.isArray(topic.messageIds)) {
          topic.messageIds = [];
        }

        // 从 messages 表获取该话题的所有消息
        const messagesInTable = await DataRepository.messages.getByTopicId(topic.id);
        const messageIdsInTable = new Set(messagesInTable.map(m => m.id));

        // 检查 messageIds 中是否有不存在于 messages 表的 ID
        const validMessageIds = topic.messageIds.filter(id => messageIdsInTable.has(id));
        
        // 检查 messages 表中是否有不在 messageIds 中的消息
        const missingIds = messagesInTable
          .filter(m => !topic.messageIds.includes(m.id))
          .map(m => m.id);

        if (missingIds.length > 0 || validMessageIds.length !== topic.messageIds.length) {
          // 合并有效的 messageIds 和缺失的 IDs
          topic.messageIds = [...validMessageIds, ...missingIds];
          await DataRepository.topics.save(topic);
          totalRepaired += missingIds.length;
          logger.debug(`话题 ${topic.id} 同步了 ${missingIds.length} 条消息ID`);
        }
      }

      logger.debug(`消息数据修复完成，共修复 ${totalRepaired} 条消息`);
      return { repaired: totalRepaired };
    } catch (error) {
      logger.error('修复消息数据失败:', error);
      throw error;
    }
  }

  /**
   * 修复助手和话题关联关系 - 重命名原有方法
   * @param autoCleanOrphanTopics 是否自动清理无效话题（默认为true）
   * @returns 修复结果，包含清理的话题数量
   */
  static async repairAssistantTopicRelations(autoCleanOrphanTopics: boolean = true): Promise<{
    fixed: number;
    orphanTopicsRemoved: number;
    totalTopics: number;
  }> {
    try {
      logger.debug('开始修复所有助手和话题的关联关系');

      // 获取所有助手和话题
      const assistants = await DataRepository.assistants.getAll();
      const topics = await DataRepository.topics.getAll();

      logger.debug(`找到 ${assistants.length} 个助手和 ${topics.length} 个话题`);

      // 修复每个话题的assistantId
      for (const topic of topics) {
        // 如果话题没有assistantId，尝试从topicIds中找到对应的助手
        if (!topic.assistantId) {
          const assistant = assistants.find(a =>
            a.topicIds && a.topicIds.includes(topic.id)
          );

          if (assistant) {
            logger.debug(`为话题 ${topic.id} 设置assistantId: ${assistant.id}`);
            topic.assistantId = assistant.id;
            await DataRepository.topics.save(topic);
          }
        }
      }

      // 修复每个助手的topics数组和topicIds数组
      for (const assistant of assistants) {
        // 找出属于该助手的所有话题
        const assistantTopics = topics.filter(t => t.assistantId === assistant.id);

        // 更新助手的topicIds数组
        assistant.topicIds = assistantTopics.map(t => t.id);

        logger.debug(`更新助手 ${assistant.id} 的topicIds，数量: ${assistant.topicIds.length}`);

        await DataRepository.assistants.save(assistant);
      }

      // 自动清理虚空话题（引用了不存在的助手的话题）
      let orphanTopicsRemoved = 0;
      if (autoCleanOrphanTopics) {
        logger.debug('开始清理虚空话题（引用了不存在的助手的话题）');

        // 找出所有虚空话题
        const orphanTopics = topics.filter(topic => {
          // 话题有assistantId但找不到对应的助手
          return topic.assistantId && !assistants.some(a => a.id === topic.assistantId);
        });

        if (orphanTopics.length > 0) {
          logger.debug(`发现 ${orphanTopics.length} 个虚空话题，开始清理`);

          // 删除每个虚空话题
          for (const topic of orphanTopics) {
            try {
              await DataRepository.topics.delete(topic.id);
              logger.debug(`已删除虚空话题: ${topic.id}，引用的不存在助手: ${topic.assistantId}`);
              orphanTopicsRemoved++;
            } catch (error) {
              logger.error(`删除虚空话题 ${topic.id} 失败:`, error);
            }
          }

          logger.debug(`虚空话题清理完成，共删除 ${orphanTopicsRemoved} 个话题`);
        } else {
          logger.debug('未发现虚空话题，无需清理');
        }
      }

      logger.debug('修复完成');
      return {
        fixed: assistants.length, // 修复的助手数量
        orphanTopicsRemoved,
        totalTopics: topics.length - orphanTopicsRemoved
      };
    } catch (error) {
      logger.error('修复失败:', error);
      return {
        fixed: 0,
        orphanTopicsRemoved: 0,
        totalTopics: 0
      };
    }
  }

  /**
   * 检查并修复消息完整性
   * 重构后的新方法：检查 messages 表和 topic.messageIds 的一致性
   * @returns 修复结果
   */
  static async checkAndRepairMessageIntegrity(): Promise<{
    orphanMessages: number;
    missingMessages: number;
    repaired: number;
  }> {
    logger.debug('开始检查消息完整性...');
    
    const result = {
      orphanMessages: 0,  // 孤立消息（在messages表但不在任何topic.messageIds中）
      missingMessages: 0, // 缺失消息（在topic.messageIds中但不在messages表）
      repaired: 0
    };

    try {
      // 1. 获取所有话题和消息
      const topics = await dexieStorage.getAllTopics();
      const allMessages = await dexieStorage.messages.toArray();
      
      logger.debug(`找到 ${topics.length} 个话题, ${allMessages.length} 条消息`);
      
      // 2. 构建消息ID集合
      const messageIdsInTopics = new Set<string>();
      const messageIdsInTable = new Set(allMessages.map(m => m.id));
      
      for (const topic of topics) {
        if (topic.messageIds && Array.isArray(topic.messageIds)) {
          topic.messageIds.forEach(id => messageIdsInTopics.add(id));
        }
      }
      
      // 3. 检查孤立消息（在messages表但不在任何topic.messageIds中）
      for (const msgId of messageIdsInTable) {
        if (!messageIdsInTopics.has(msgId)) {
          result.orphanMessages++;
          logger.debug(`发现孤立消息: ${msgId}`);
        }
      }
      
      // 4. 检查缺失消息（在topic.messageIds中但不在messages表）
      for (const topic of topics) {
        if (!topic.messageIds || !Array.isArray(topic.messageIds)) continue;
        
        const validMessageIds: string[] = [];
        let hasInvalidIds = false;
        
        for (const msgId of topic.messageIds) {
          if (messageIdsInTable.has(msgId)) {
            validMessageIds.push(msgId);
          } else {
            result.missingMessages++;
            hasInvalidIds = true;
            logger.debug(`话题 ${topic.id} 引用了不存在的消息: ${msgId}`);
          }
        }
        
        // 5. 修复：移除无效的消息引用
        if (hasInvalidIds) {
          topic.messageIds = validMessageIds;
          await dexieStorage.saveTopic(topic);
          result.repaired++;
          logger.debug(`已修复话题 ${topic.id} 的消息引用`);
        }
      }
      
      logger.debug('消息完整性检查完成:', result);
      return result;
      
    } catch (error) {
      logger.error('消息完整性检查失败:', error);
      return result;
    }
  }
}