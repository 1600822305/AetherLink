import { DataRepository } from './storage/DataRepository';
import type { ChatTopic, Message } from '../types';
import { generateMessageId } from '../utils';
import { handleError } from '../utils/error';

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
    console.log('[DataRepairService] 开始统一数据修复');

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

      console.log('[DataRepairService] 统一数据修复完成', result);
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
    console.log('[DataRepairService] 开始检查数据一致性');

    try {
      // 获取所有助手和话题
      const assistants = await DataRepository.assistants.getAll();
      const topics = await DataRepository.topics.getAll();

      console.log(`[DataRepairService] 找到 ${assistants.length} 个助手和 ${topics.length} 个话题`);

      // 检查助手的topicIds和话题的assistantId是否一致
      let inconsistencies = 0;

      // 检查每个话题
      for (const topic of topics) {
        if (!topic.assistantId) {
          console.log(`[DataRepairService] 话题 ${topic.id} 没有assistantId字段`);
          inconsistencies++;
          continue;
        }

        // 查找对应的助手
        const assistant = assistants.find(a => a.id === topic.assistantId);
        if (!assistant) {
          console.log(`[DataRepairService] 话题 ${topic.id} 的助手 ${topic.assistantId} 不存在`);
          inconsistencies++;
          continue;
        }

        // 检查助手的topicIds是否包含该话题
        if (!assistant.topicIds?.includes(topic.id)) {
          console.log(`[DataRepairService] 助手 ${assistant.id} 的topicIds不包含话题 ${topic.id}`);
          inconsistencies++;
        }
      }

      // 检查每个助手的topicIds
      for (const assistant of assistants) {
        if (!assistant.topicIds || !Array.isArray(assistant.topicIds)) {
          console.log(`[DataRepairService] 助手 ${assistant.id} 没有有效的topicIds数组`);
          inconsistencies++;
          continue;
        }

        // 检查每个topicId是否存在对应的话题
        for (const topicId of assistant.topicIds) {
          const topic = topics.find(t => t.id === topicId);
          if (!topic) {
            console.log(`[DataRepairService] 助手 ${assistant.id} 的topicId ${topicId} 对应的话题不存在`);
            inconsistencies++;
            continue;
          }

          // 检查话题的assistantId是否指向当前助手
          if (topic.assistantId !== assistant.id) {
            console.log(`[DataRepairService] 话题 ${topicId} 的assistantId (${topic.assistantId}) 与助手ID (${assistant.id}) 不一致`);
            inconsistencies++;
          }
        }
      }

      console.log(`[DataRepairService] 检查完成，发现 ${inconsistencies} 个数据一致性问题`);
      return inconsistencies > 0;
    } catch (error) {
      console.error('[DataRepairService] 检查数据一致性失败:', error);
      return true; // 如果发生错误，也认为需要修复
    }
  }

  /**
   * 修复重复消息 - 整合DataAdapter中的逻辑
   * @param topicId 话题ID（可选，如果不提供则检查所有话题）
   * @returns 修复结果
   */
  static async repairDuplicateMessages(topicId?: string): Promise<{fixed: number, total: number}> {
    console.log(`[DataRepairService] 修复重复消息 ${topicId ? `话题ID: ${topicId}` : '所有话题'}`);

    let fixed = 0;
    let total = 0;

    try {
      // 获取需要处理的话题
      const topics = topicId
        ? [await DataRepository.topics.getById(topicId)].filter(Boolean) as ChatTopic[]
        : await DataRepository.topics.getAll();

      console.log(`[DataRepairService] 开始处理 ${topics.length} 个话题`);

      // 遍历话题修复重复消息
      for (const topic of topics) {
        if (!topic.messages || !Array.isArray(topic.messages)) {
          topic.messages = [];
          await DataRepository.topics.save(topic);
          continue;
        }

        total += topic.messages.length;

        // 查找并修复重复消息ID
        const messageIds = new Set<string>();
        const uniqueMessages: Message[] = [];
        let hasChanges = false;

        for (const message of topic.messages) {
          // 如果消息没有ID，生成一个
          if (!message.id) {
            message.id = generateMessageId();
            hasChanges = true;
            fixed++;
          }
          // 如果ID已存在，生成一个新ID
          else if (messageIds.has(message.id)) {
            const originalId = message.id;
            message.id = generateMessageId();
            console.log(`[DataRepairService] 修复重复消息ID: ${originalId} -> ${message.id}`);
            hasChanges = true;
            fixed++;
          }

          messageIds.add(message.id);
          uniqueMessages.push(message);
        }

        // 如果有修改，保存话题
        if (hasChanges) {
          topic.messages = uniqueMessages;
          await DataRepository.topics.save(topic);
          console.log(`[DataRepairService] 话题 ${topic.id} 修复了消息`);
        }
      }

      console.log(`[DataRepairService] 修复完成: 总计 ${fixed} 条消息被修复，共 ${total} 条消息`);
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
    console.log('[DataRepairService] 开始修复消息数据...');

    let totalRepaired = 0;

    try {
      // 获取所有话题
      const topics = await DataRepository.topics.getAll();

      for (const topic of topics) {
        if (!topic.messages || !Array.isArray(topic.messages)) {
          continue;
        }

        // 确保messageIds数组存在
        if (!topic.messageIds || !Array.isArray(topic.messageIds)) {
          topic.messageIds = [];
        }

        // 逐个处理消息
        for (const message of topic.messages) {
          if (!message.id) {
            console.log('[DataRepairService] 跳过无效消息（没有ID）');
            continue;
          }

          // 检查消息是否已存在于messages表
          const existingMessage = await DataRepository.messages.getById(message.id);
          if (!existingMessage) {
            // 将消息保存到messages表
            await DataRepository.messages.save(message);
            console.log(`[DataRepairService] 修复：保存消息 ${message.id} 到messages表`);
            totalRepaired++;

            // 将消息ID添加到messageIds数组（如果不存在）
            if (!topic.messageIds.includes(message.id)) {
              topic.messageIds.push(message.id);
            }
          }
        }

        // 保存更新后的话题
        await DataRepository.topics.save(topic);
      }

      console.log(`[DataRepairService] 消息数据修复完成，共修复 ${totalRepaired} 条消息`);
      return { repaired: totalRepaired };
    } catch (error) {
      console.error('[DataRepairService] 修复消息数据失败:', error);
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
      console.log('[DataRepairService] 开始修复所有助手和话题的关联关系');

      // 获取所有助手和话题
      const assistants = await DataRepository.assistants.getAll();
      const topics = await DataRepository.topics.getAll();

      console.log(`[DataRepairService] 找到 ${assistants.length} 个助手和 ${topics.length} 个话题`);

      // 修复每个话题的assistantId
      for (const topic of topics) {
        // 如果话题没有assistantId，尝试从topicIds中找到对应的助手
        if (!topic.assistantId) {
          const assistant = assistants.find(a =>
            a.topicIds && a.topicIds.includes(topic.id)
          );

          if (assistant) {
            console.log(`[DataRepairService] 为话题 ${topic.id} 设置assistantId: ${assistant.id}`);
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

        console.log(`[DataRepairService] 更新助手 ${assistant.id} 的topicIds，数量: ${assistant.topicIds.length}`);

        await DataRepository.assistants.save(assistant);
      }

      // 自动清理虚空话题（引用了不存在的助手的话题）
      let orphanTopicsRemoved = 0;
      if (autoCleanOrphanTopics) {
        console.log('[DataRepairService] 开始清理虚空话题（引用了不存在的助手的话题）');

        // 找出所有虚空话题
        const orphanTopics = topics.filter(topic => {
          // 话题有assistantId但找不到对应的助手
          return topic.assistantId && !assistants.some(a => a.id === topic.assistantId);
        });

        if (orphanTopics.length > 0) {
          console.log(`[DataRepairService] 发现 ${orphanTopics.length} 个虚空话题，开始清理`);

          // 删除每个虚空话题
          for (const topic of orphanTopics) {
            try {
              await DataRepository.topics.delete(topic.id);
              console.log(`[DataRepairService] 已删除虚空话题: ${topic.id}，引用的不存在助手: ${topic.assistantId}`);
              orphanTopicsRemoved++;
            } catch (error) {
              console.error(`[DataRepairService] 删除虚空话题 ${topic.id} 失败:`, error);
            }
          }

          console.log(`[DataRepairService] 虚空话题清理完成，共删除 ${orphanTopicsRemoved} 个话题`);
        } else {
          console.log('[DataRepairService] 未发现虚空话题，无需清理');
        }
      }

      console.log('[DataRepairService] 修复完成');
      return {
        fixed: assistants.length, // 修复的助手数量
        orphanTopicsRemoved,
        totalTopics: topics.length - orphanTopicsRemoved
      };
    } catch (error) {
      console.error('[DataRepairService] 修复失败:', error);
      return {
        fixed: 0,
        orphanTopicsRemoved: 0,
        totalTopics: 0
      };
    }
  }

  /**
   * 向后兼容方法 - 保持原有API
   * @deprecated 请使用 repairAllData() 方法
   */
  static async repairAllAssistantsAndTopics(autoCleanOrphanTopics: boolean = true): Promise<{
    orphanTopicsRemoved: number;
    totalTopics: number;
  }> {
    const result = await this.repairAssistantTopicRelations(autoCleanOrphanTopics);
    return {
      orphanTopicsRemoved: result.orphanTopicsRemoved,
      totalTopics: result.totalTopics
    };
  }
}