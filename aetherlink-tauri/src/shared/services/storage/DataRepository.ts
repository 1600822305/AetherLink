/**
 * 统一数据仓库服务 - 参考最佳实例架构
 * 提供统一的数据访问接口，减少重复的数据库操作代码
 */
import { dexieStorage } from './DexieStorageService';
import type { ChatTopic, Message, MessageBlock } from '../../types';
import type { Assistant } from '../../types/Assistant';
import { handleError } from '../../utils/error';

/**
 * 数据仓库服务 - 统一数据访问层
 * 参考最佳实例的简洁设计，提供高级数据操作接口
 */
export class DataRepository {
  /**
   * 话题相关操作
   */
  static readonly topics = {
    /**
     * 获取所有话题
     */
    async getAll(): Promise<ChatTopic[]> {
      try {
        return await dexieStorage.getAllTopics();
      } catch (error) {
        handleError(error, 'DataRepository.topics.getAll');
        return [];
      }
    },

    /**
     * 根据ID获取话题
     */
    async getById(id: string): Promise<ChatTopic | null> {
      try {
        return await dexieStorage.getTopic(id);
      } catch (error) {
        handleError(error, 'DataRepository.topics.getById', {
          additionalData: { topicId: id }
        });
        return null;
      }
    },

    /**
     * 保存话题
     */
    async save(topic: ChatTopic): Promise<void> {
      try {
        await dexieStorage.saveTopic(topic);
      } catch (error) {
        handleError(error, 'DataRepository.topics.save', {
          additionalData: { topicId: topic.id },
          rethrow: true
        });
        throw error;
      }
    },

    /**
     * 删除话题
     */
    async delete(id: string): Promise<void> {
      try {
        await dexieStorage.deleteTopic(id);
      } catch (error) {
        handleError(error, 'DataRepository.topics.delete', {
          additionalData: { topicId: id },
          rethrow: true
        });
        throw error;
      }
    },

    /**
     * 批量保存话题
     */
    async saveBatch(topics: ChatTopic[]): Promise<void> {
      try {
        await dexieStorage.transaction('rw', [dexieStorage.topics], async () => {
          for (const topic of topics) {
            await dexieStorage.saveTopic(topic);
          }
        });
      } catch (error) {
        handleError(error, 'DataRepository.topics.saveBatch', {
          additionalData: { count: topics.length },
          rethrow: true
        });
        throw error;
      }
    }
  };

  /**
   * 消息相关操作
   */
  static readonly messages = {
    /**
     * 根据ID获取消息
     */
    async getById(id: string): Promise<Message | null> {
      try {
        return await dexieStorage.getMessage(id);
      } catch (error) {
        handleError(error, 'DataRepository.messages.getById', {
          additionalData: { messageId: id }
        });
        return null;
      }
    },

    /**
     * 根据话题ID获取消息列表
     */
    async getByTopicId(topicId: string): Promise<Message[]> {
      try {
        return await dexieStorage.getMessagesByTopicId(topicId);
      } catch (error) {
        handleError(error, 'DataRepository.messages.getByTopicId', {
          additionalData: { topicId }
        });
        return [];
      }
    },

    /**
     * 保存消息
     */
    async save(message: Message): Promise<void> {
      try {
        await dexieStorage.saveMessage(message);
      } catch (error) {
        handleError(error, 'DataRepository.messages.save', {
          additionalData: { messageId: message.id },
          rethrow: true
        });
        throw error;
      }
    },

    /**
     * 更新消息
     */
    async update(id: string, changes: Partial<Message>): Promise<void> {
      try {
        await dexieStorage.updateMessage(id, changes);
      } catch (error) {
        handleError(error, 'DataRepository.messages.update', {
          additionalData: { messageId: id, changes },
          rethrow: true
        });
        throw error;
      }
    },

    /**
     * 删除消息
     */
    async delete(id: string): Promise<void> {
      try {
        await dexieStorage.deleteMessage(id);
      } catch (error) {
        handleError(error, 'DataRepository.messages.delete', {
          additionalData: { messageId: id },
          rethrow: true
        });
        throw error;
      }
    }
  };

  /**
   * 消息块相关操作
   */
  static readonly blocks = {
    /**
     * 根据ID获取消息块
     */
    async getById(id: string): Promise<MessageBlock | null> {
      try {
        return await dexieStorage.getMessageBlock(id);
      } catch (error) {
        handleError(error, 'DataRepository.blocks.getById', {
          additionalData: { blockId: id }
        });
        return null;
      }
    },

    /**
     * 根据消息ID获取消息块列表
     */
    async getByMessageId(messageId: string): Promise<MessageBlock[]> {
      try {
        return await dexieStorage.getMessageBlocksByMessageId(messageId);
      } catch (error) {
        handleError(error, 'DataRepository.blocks.getByMessageId', {
          additionalData: { messageId }
        });
        return [];
      }
    },

    /**
     * 保存消息块
     */
    async save(block: MessageBlock): Promise<void> {
      try {
        await dexieStorage.saveMessageBlock(block);
      } catch (error) {
        handleError(error, 'DataRepository.blocks.save', {
          additionalData: { blockId: block.id },
          rethrow: true
        });
        throw error;
      }
    },

    /**
     * 批量保存消息块
     */
    async saveBatch(blocks: MessageBlock[]): Promise<void> {
      try {
        await dexieStorage.bulkSaveMessageBlocks(blocks);
      } catch (error) {
        handleError(error, 'DataRepository.blocks.saveBatch', {
          additionalData: { count: blocks.length },
          rethrow: true
        });
        throw error;
      }
    },

    /**
     * 更新消息块
     */
    async update(id: string, changes: Partial<MessageBlock>): Promise<void> {
      try {
        await dexieStorage.updateMessageBlock(id, changes);
      } catch (error) {
        handleError(error, 'DataRepository.blocks.update', {
          additionalData: { blockId: id, changes },
          rethrow: true
        });
        throw error;
      }
    },

    /**
     * 删除消息块
     */
    async delete(id: string): Promise<void> {
      try {
        await dexieStorage.deleteMessageBlock(id);
      } catch (error) {
        handleError(error, 'DataRepository.blocks.delete', {
          additionalData: { blockId: id },
          rethrow: true
        });
        throw error;
      }
    },

    /**
     * 批量删除消息块
     */
    async deleteBatch(ids: string[]): Promise<void> {
      try {
        await dexieStorage.deleteMessageBlocksByIds(ids);
      } catch (error) {
        handleError(error, 'DataRepository.blocks.deleteBatch', {
          additionalData: { blockIds: ids },
          rethrow: true
        });
        throw error;
      }
    }
  };

  /**
   * 助手相关操作
   */
  static readonly assistants = {
    /**
     * 获取所有助手
     */
    async getAll(): Promise<Assistant[]> {
      try {
        return await dexieStorage.getAllAssistants();
      } catch (error) {
        handleError(error, 'DataRepository.assistants.getAll');
        return [];
      }
    },

    /**
     * 根据ID获取助手
     */
    async getById(id: string): Promise<Assistant | null> {
      try {
        return await dexieStorage.getAssistant(id);
      } catch (error) {
        handleError(error, 'DataRepository.assistants.getById', {
          additionalData: { assistantId: id }
        });
        return null;
      }
    },

    /**
     * 保存助手
     */
    async save(assistant: Assistant): Promise<void> {
      try {
        await dexieStorage.saveAssistant(assistant);
      } catch (error) {
        handleError(error, 'DataRepository.assistants.save', {
          additionalData: { assistantId: assistant.id },
          rethrow: true
        });
        throw error;
      }
    },

    /**
     * 删除助手
     */
    async delete(id: string): Promise<void> {
      try {
        await dexieStorage.deleteAssistant(id);
      } catch (error) {
        handleError(error, 'DataRepository.assistants.delete', {
          additionalData: { assistantId: id },
          rethrow: true
        });
        throw error;
      }
    }
  };

  /**
   * 事务操作 - 参考最佳实例的事务处理
   */
  static readonly transaction = {
    /**
     * 执行读写事务
     */
    async readWrite<T>(
      tables: string[],
      operation: () => Promise<T>
    ): Promise<T> {
      try {
        const tableObjects = tables.map(tableName => {
          switch (tableName) {
            case 'topics': return dexieStorage.topics;
            case 'messages': return dexieStorage.messages;
            case 'message_blocks': return dexieStorage.message_blocks;
            case 'assistants': return dexieStorage.assistants;
            case 'settings': return dexieStorage.settings;
            default: throw new Error(`Unknown table: ${tableName}`);
          }
        });

        return await dexieStorage.transaction('rw', tableObjects, operation);
      } catch (error) {
        handleError(error, 'DataRepository.transaction.readWrite', {
          additionalData: { tables },
          rethrow: true
        });
        throw error;
      }
    }
  };
}
