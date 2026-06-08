import { v4 as uuid } from 'uuid';
import type { ChatTopic } from '../../types';
import type { Message, MessageBlock } from '../../types/newMessage.ts';
import { throttle } from 'lodash';
import { AssistantService } from '../index';
import store from '../../store';
import { addTopic, updateTopic } from '../../store/slices/assistantsSlice';
import { updateOneBlock, upsertManyBlocks } from '../../store/slices/messageBlocksSlice';
import { formatDateForTopicTitle } from '../../utils';
import { DEFAULT_TOPIC_PROMPT } from '../../config/prompts';
import { dexieStorage } from '../storage/DexieStorageService';
import { EventEmitter, EVENT_NAMES } from '../infra/EventService';
import { createUserMessage } from '../../utils/messageUtils';
import { newMessagesActions } from '../../store/slices/newMessagesSlice';
// 导入助手类型模块，避免动态导入
import { getDefaultTopic } from '../assistant/types';
import { handleError } from '../../utils/error';

/**
 * 话题服务 - 集中处理话题的创建、关联和管理
 */
export class TopicService {
  /**
   * 获取所有话题
   */
  static async getAllTopics(): Promise<ChatTopic[]> {
    try {
      const topics = await dexieStorage.getAllTopics();
      return topics;
    } catch (error) {
      handleError(error, 'TopicService.getAllTopics', {
        logLevel: 'ERROR'
      });
      return [];
    }
  }

  /**
   * 通过ID获取话题
   */
  static async getTopicById(id: string): Promise<ChatTopic | null> {
    try {
      const topic = await dexieStorage.getTopic(id);
      return topic || null;
    } catch (error) {
      handleError(error, 'TopicService.getTopicById', {
        logLevel: 'ERROR',
        additionalData: { topicId: id }
      });
      return null;
    }
  }

  /**
   * 创建新话题并关联到当前助手
   * 优化版本：使用EventService进行通知
   */
  static async createNewTopic(): Promise<ChatTopic | null> {
    try {
      console.log('[TopicService] 开始创建新话题');

      const currentAssistantId = await this.getCurrentAssistantId();
      if (!currentAssistantId) {
        return null;
      }

      // 获取当前助手
      const assistant = await AssistantService.getCurrentAssistant();
      if (!assistant) {
        return null;
      }

      // 创建话题对象
      const topic = getDefaultTopic(currentAssistantId);

      // 立即添加话题到Redux store
      store.dispatch(addTopic({ assistantId: currentAssistantId, topic }));

      // 立即发送事件通知其他组件
      EventEmitter.emit(EVENT_NAMES.TOPIC_CREATED, {
        topic,
        assistantId: currentAssistantId,
        type: 'create'
      });

      // 后台异步保存到数据库
      Promise.resolve().then(async () => {
        try {
          await dexieStorage.saveTopic(topic);
          await AssistantService.addAssistantMessagesToTopic({ assistant, topic });
        } catch (error) {
          console.error('[TopicService] 后台保存话题失败:', error);
          // 发送错误事件，让UI知道保存失败
          EventEmitter.emit(EVENT_NAMES.SERVICE_ERROR, {
            serviceName: 'TopicService',
            error,
            message: `后台保存话题 ${topic.id} 失败`,
            topicId: topic.id
          });
          // 可以考虑回滚Redux状态或重试
        }
      });

      return topic;
    } catch (error) {
      handleError(error, 'TopicService.createNewTopic', {
        logLevel: 'ERROR'
      });
      return null;
    }
  }

  /**
   * 获取当前助手ID (尝试多种方式)
   */
  private static async getCurrentAssistantId(): Promise<string | null> {
    try {
      const currentAssistant = await AssistantService.getCurrentAssistant();
      if (currentAssistant && currentAssistant.id) return currentAssistant.id;
    } catch (error) {
      // console.warn('[TopicService] 从AssistantService获取当前助手失败');
    }
    try {
      const storedId = await dexieStorage.getSetting('currentAssistant');
      if (storedId) return storedId;
    } catch (error) {
      // console.warn('[TopicService] 从IndexedDB获取当前助手ID失败', error);
    }
    try {
      const assistants = await AssistantService.getUserAssistants();
      if (assistants && assistants.length > 0) {
        const firstAssistant = assistants[0];
        await AssistantService.setCurrentAssistant(firstAssistant.id);
        await dexieStorage.saveSetting('currentAssistant', firstAssistant.id);
        return firstAssistant.id;
      }
    } catch (error) {
      console.error('[TopicService] 获取助手列表失败，无法确定当前助手ID');
    }
    return null;
  }

  /**
   * 清空当前话题内容
   * 完整清理所有关联数据：消息、消息块、图片、文件等
   */
  static async clearTopicContent(topicId: string): Promise<boolean> {
    if (!topicId) return false;
    try {
      // 获取话题
      const topic = await dexieStorage.getTopic(topicId);
      if (!topic) {
        console.warn(`[TopicService] 清空话题内容失败: 话题 ${topicId} 不存在`);
        return false;
      }

      // 使用事务保证原子性，包含所有相关表
      await dexieStorage.transaction('rw', [
        dexieStorage.topics,
        dexieStorage.messages,
        dexieStorage.message_blocks,
        dexieStorage.images,
        dexieStorage.imageMetadata,
        dexieStorage.files
      ], async () => {
        // 1. 清理图片数据（images + imageMetadata）
        console.log(`[TopicService] 开始清理话题 ${topicId} 的图片数据`);
        const imageMetadataList = await dexieStorage.getImageMetadataByTopicId(topicId);
        if (imageMetadataList.length > 0) {
          console.log(`[TopicService] 找到 ${imageMetadataList.length} 个图片，开始删除`);
          for (const metadata of imageMetadataList) {
            await dexieStorage.deleteImage(metadata.id); // 同时删除images和imageMetadata
          }
          console.log(`[TopicService] 已删除 ${imageMetadataList.length} 个图片`);
        }

        // 2. 获取所有消息
        const messages = await dexieStorage.getMessagesByTopicId(topicId);
        console.log(`[TopicService] 找到 ${messages.length} 条消息`);

        // 3. 清理消息块和关联文件
        let totalBlocksDeleted = 0;
        let totalFilesDeleted = 0;
        
        for (const message of messages) {
          // 3.1 收集所有块ID（包括当前版本和历史版本）
          const allBlockIds: string[] = [...(message.blocks || [])];
          
          // 添加历史版本的块ID
          if (message.versions && message.versions.length > 0) {
            for (const version of message.versions) {
              if (version.blocks && version.blocks.length > 0) {
                allBlockIds.push(...version.blocks);
              }
            }
          }
          
          // 3.2 清理块中的文件引用
          if (allBlockIds.length > 0) {
            const blocks = await dexieStorage.message_blocks
              .where('id')
              .anyOf(allBlockIds)
              .toArray();
            
            // 删除块中引用的文件
            for (const block of blocks) {
              // 检查不同类型的块是否包含文件引用
              if ('file' in block && block.file && typeof block.file === 'object' && 'id' in block.file) {
                try {
                  await dexieStorage.files.delete(block.file.id);
                  totalFilesDeleted++;
                  console.log(`[TopicService] 已删除文件: ${block.file.id}`);
                } catch (fileError) {
                  console.warn(`[TopicService] 删除文件失败: ${block.file.id}`, fileError);
                }
              }
            }
            
            // 3.3 删除所有块
            await dexieStorage.deleteMessageBlocksByIds(allBlockIds);
            totalBlocksDeleted += allBlockIds.length;
          }
        }

        console.log(`[TopicService] 已删除 ${totalBlocksDeleted} 个消息块，${totalFilesDeleted} 个文件`);

        // 4. 从数据库中删除主题的所有消息
        await dexieStorage.messages.where('topicId').equals(topicId).delete();
        console.log(`[TopicService] 已删除 ${messages.length} 条消息`);

        // 5. 清空话题的messageIds数组
        const updatedTopic = {
          ...topic,
          messageIds: []
        };
        await dexieStorage.topics.put(updatedTopic);
        console.log(`[TopicService] 已清空话题的messageIds数组`);
      });

      console.log(`[TopicService] ✅ 已完整清空话题 ${topicId} 的所有消息和关联数据`);

      // 6. 统一使用新的Redux状态管理
      store.dispatch(newMessagesActions.clearTopicMessages(topicId));

      // 7. 发送事件通知
      EventEmitter.emit(EVENT_NAMES.CLEAR_MESSAGES, { topicId });

      return true;
    } catch (error) {
      console.error('[TopicService] 清空话题内容失败:', error);
      EventEmitter.emit(EVENT_NAMES.SERVICE_ERROR, {
        serviceName: 'TopicService',
        error,
        message: `Failed to clear content for topic ${topicId}`
      });
      return false;
    }
  }

  /**
   * 创建话题
   */
  static async createTopic(title: string, initialMessage?: string, assistantId?: string): Promise<ChatTopic> {
    try {
      const now = new Date().toISOString();
      const messages: Message[] = [];
      const blocks: MessageBlock[] = [];

      if (initialMessage) {
        // 使用新的消息创建工具
        const { message, blocks: messageBlocks } = createUserMessage({
          content: initialMessage,
          assistantId: '', // 临时值，后面会被正确设置
          topicId: '', // 临时值，后面会被正确设置
        });
        messages.push(message);
        blocks.push(...messageBlocks);
      }
      const topicId = uuid();
      // 修复Date类型错误，传入Date对象而非字符串
      const formattedDate = formatDateForTopicTitle(new Date(now));

      // 尝试获取当前助手ID
      const resolvedAssistantId = assistantId ?? await this.getCurrentAssistantId();
      if (!resolvedAssistantId) {
        throw new Error('[TopicService.createTopic] 无法确定助手 ID，创建话题失败');
      }

      // 使用事务确保数据一致性
      let newTopic: ChatTopic;
      await dexieStorage.transaction('rw', [
        dexieStorage.topics,
        dexieStorage.messages,
        dexieStorage.message_blocks
      ], async () => {
        // 创建新的主题对象
        newTopic = {
          id: topicId,
          assistantId: resolvedAssistantId,
          name: title || `新的对话 ${formattedDate}`,
          title: title || `新的对话 ${formattedDate}`,
          createdAt: now,
          updatedAt: now,
          lastMessageTime: now,
          prompt: DEFAULT_TOPIC_PROMPT,
          isNameManuallyEdited: false,
          messageIds: [] // 初始化为空数组
        };

        // 保存话题
        await dexieStorage.topics.put(newTopic);

        // 如果有初始消息，保存消息和块
        if (messages.length > 0) {
          for (const msg of messages) {
            msg.topicId = topicId;
            msg.assistantId = resolvedAssistantId;
            await dexieStorage.messages.put(msg);
          }

          // 保存消息块
          for (const block of blocks) {
            await dexieStorage.message_blocks.put(block);
          }

          // 更新话题的消息引用
          newTopic.messageIds = messages.map(m => m.id);
        }
      });

      return newTopic!;
    } catch (error) {
      console.error('[TopicService] 创建独立话题失败:', error);
      throw error;
    }
  }

  /**
   * 为指定助手创建一个默认话题，确保持久化并同步Redux状态
   */
  static async createDefaultTopicForAssistant(assistantId: string, options?: { previousTopicId?: string }): Promise<ChatTopic | null> {
    if (!assistantId) {
      console.error('[TopicService.createDefaultTopicForAssistant] 助手ID不能为空');
      return null;
    }

    try {
      const assistant = await dexieStorage.getAssistant(assistantId);
      if (!assistant) {
        console.warn(`[TopicService.createDefaultTopicForAssistant] 未找到助手 ${assistantId}`);
        return null;
      }

      const topic = getDefaultTopic(assistantId);

      await dexieStorage.saveTopic(topic);
      await AssistantService.addTopicToAssistant(assistantId, topic.id);

      store.dispatch(addTopic({ assistantId, topic }));

      const state = store.getState();
      const currentAssistantId = state.assistants.currentAssistant?.id;
      const currentTopicId = state.messages?.currentTopicId ?? null;

      const shouldSwitch =
        currentAssistantId === assistantId &&
        (!currentTopicId || currentTopicId === options?.previousTopicId);

      if (shouldSwitch) {
        store.dispatch(newMessagesActions.setCurrentTopicId(topic.id));
      }

      EventEmitter.emit(EVENT_NAMES.TOPIC_CREATED, {
        topic,
        assistantId,
        type: 'auto-default'
      });

      return topic;
    } catch (error) {
      console.error('[TopicService.createDefaultTopicForAssistant] 创建默认话题失败:', error);
      return null;
    }
  }

  /**
   * 保存话题
   */
  static async saveTopic(topic: ChatTopic): Promise<void> {
    try {
      // 保存到数据库
      await dexieStorage.saveTopic(topic);

      // 如果话题有关联的助手ID，更新 Redux store 中的话题
      if (topic.assistantId) {
        store.dispatch(updateTopic({
          assistantId: topic.assistantId,
          topic
        }));
      }
    } catch (error) {
      console.error(`[TopicService] 保存话题 ${topic.id} 失败:`, error);
      EventEmitter.emit(EVENT_NAMES.SERVICE_ERROR, { serviceName: 'TopicService', error, message: `Failed to save topic ${topic.id}` });
      throw error;
    }
  }

  /**
   * 删除话题 - Cherry Studio优化版本
   */
  static async deleteTopic(id: string): Promise<void> {
    try {
      console.log(`[TopicService] 开始删除话题数据: ${id}`);

      // 🚀 优化：不再立即更新Redux store，由调用方处理乐观更新
      // 获取话题信息用于事件发送
      const topic = await this.getTopicById(id);
      const assistantId = topic?.assistantId;

      // 发送删除话题事件
      EventEmitter.emit(EVENT_NAMES.TOPIC_DELETED, { topicId: id, assistantId });

      // 🔥 优化：简化数据库操作，使用DexieStorageService的deleteTopic方法
      await dexieStorage.deleteTopic(id);

      // 🔄 异步更新助手的topicIds，不阻塞主流程
      if (assistantId) {
        Promise.resolve().then(async () => {
          try {
            const assistant = await dexieStorage.assistants.get(assistantId);
            if (assistant) {
              const remainingTopicIds = (assistant.topicIds || []).filter(topicId => topicId !== id);
              assistant.topicIds = remainingTopicIds;

              if (assistant.topics) {
                assistant.topics = assistant.topics.filter(topicItem => topicItem.id !== id);
              }

              await dexieStorage.assistants.put(assistant);
              console.log(`[TopicService] 助手 ${assistantId} 的topicIds已更新`);

              if (remainingTopicIds.length === 0) {
                console.log(`[TopicService] 助手 ${assistantId} 没有话题了，自动创建默认话题`);
                await TopicService.createDefaultTopicForAssistant(assistantId, { previousTopicId: id });
              }
            }
          } catch (error) {
            console.error(`[TopicService] 更新助手topicIds失败:`, error);
          }
        });
      }

      console.log(`[TopicService] 话题删除完成: ${id}`);
    } catch (error) {
      console.error(`[TopicService] 删除话题失败: ${id}`, error);
      EventEmitter.emit(EVENT_NAMES.SERVICE_ERROR, { serviceName: 'TopicService', error, message: `Failed to delete topic ${id}` });
      throw error;
    }
  }

  /**
   * 保存新消息和关联的块
   * 使用完全规范化的存储方式
   */
  /**
   * 保存新消息和关联的块
   * 使用最佳实例原版的存储方式：将消息直接存储在topics表中，并使用事务确保数据一致性
   */
  static async saveMessageAndBlocks(message: Message, blocks: MessageBlock[]): Promise<void> {
    try {
      // 使用事务保证原子性
      await dexieStorage.transaction('rw', [
        dexieStorage.topics,
        dexieStorage.messages,
        dexieStorage.message_blocks
      ], async () => {
        // 批量保存消息块
        if (blocks.length > 0) {
          await dexieStorage.bulkSaveMessageBlocks(blocks);
        }

        // 获取话题
        const topic = await dexieStorage.topics.get(message.topicId);
        if (!topic) {
          throw new Error(`Topic ${message.topicId} not found`);
        }

        // 更新messageIds数组
        if (!topic.messageIds) {
          topic.messageIds = [];
        }

        if (!topic.messageIds.includes(message.id)) {
          topic.messageIds.push(message.id);
        }

        // 更新话题的lastMessageTime和updatedAt
        topic.updatedAt = new Date().toISOString();
        topic.lastMessageTime = topic.updatedAt;

        // 保存话题
        await dexieStorage.topics.put(topic);

        // 保存消息到messages表（保持兼容性）
        await dexieStorage.messages.put(message);
      });

      // 更新Redux状态
      store.dispatch(newMessagesActions.addMessage({
        topicId: message.topicId,
        message
      }));

      if (blocks.length > 0) {
        store.dispatch(upsertManyBlocks(blocks));
      }

      console.log(`[TopicService] 已保存消息 ${message.id} 和 ${blocks.length} 个块到话题 ${message.topicId}`);
    } catch (error) {
      console.error(`[TopicService] 保存消息和块失败:`, error);
      throw error;
    }
  }

  /**
   * 加载主题的所有消息
   */
  /**
   * 加载主题的所有消息
   * 使用最佳实例原版的方式：直接从topics表中获取消息
   */
  static async loadTopicMessages(topicId: string): Promise<Message[]> {
    try {

      // 获取话题
      const topic = await dexieStorage.topics.get(topicId);
      if (!topic) {
        console.warn(`[TopicService] 话题 ${topicId} 不存在`);
        return [];
      }

      // 直接从messages表中获取消息
      let messages: Message[] = [];

      // 从messageIds加载消息
      if (topic.messageIds && Array.isArray(topic.messageIds) && topic.messageIds.length > 0) {
        console.log(`[TopicService] 从messageIds加载 ${topic.messageIds.length} 条消息`);

        // 从messages表加载消息
        for (const messageId of topic.messageIds) {
          const message = await dexieStorage.messages.get(messageId);
          if (message) messages.push(message);
        }
      } else {
        console.warn(`[TopicService] 话题 ${topicId} 没有消息`);
        return [];
      }

      // 检查消息是否有效
      if (messages.length === 0) {
        console.warn(`[TopicService] 话题 ${topicId} 没有有效消息`);
        return [];
      }

      console.log(`[TopicService] 从数据库加载了 ${messages.length} 条消息`);

      // 检查每条消息的状态并修复
      for (const msg of messages) {
        // 确保消息状态正确
        if (msg.role === 'assistant' && msg.status !== 'success' && msg.status !== 'error') {
          console.log(`[TopicService] 修正助手消息状态: ${msg.id}`);
          msg.status = 'success';
        }

        // 调试：打印每条消息的详细信息
        console.log(`[TopicService] 消息详情:`, {
          id: msg.id,
          role: msg.role,
          hasBlocks: !!(msg.blocks && msg.blocks.length > 0),
          blocksCount: msg.blocks ? msg.blocks.length : 0,
          blocks: msg.blocks
        });
      }

      // 收集所有块ID
      const blocksToLoad: string[] = [];
      for (const msg of messages) {
        if (msg.blocks && msg.blocks.length > 0) {
          blocksToLoad.push(...msg.blocks);
        }
      }

      console.log(`[TopicService] 需要加载 ${blocksToLoad.length} 个块:`, blocksToLoad);

      // 批量加载所有消息块 - 性能优化：并行加载
      let blocks: MessageBlock[] = [];
      if (blocksToLoad.length > 0) {
        // 并行加载所有块，而不是串行
        const blockPromises = blocksToLoad.map(blockId => dexieStorage.getMessageBlock(blockId));
        const blockResults = await Promise.all(blockPromises);
        blocks = blockResults.filter(block => block !== null) as MessageBlock[];
      }

        // 批量修复块状态
        const blocksToUpdate: { id: string; updates: Partial<MessageBlock> }[] = [];

        for (const block of blocks) {
          let needsUpdate = false;
          const updates: Partial<MessageBlock> = {};

          //  修复：处理块状态恢复，考虑多个工具的情况
          if (!block.status || (typeof block.status !== 'string')) {
            // 状态无效，修复为 success
            updates.status = 'success';
            needsUpdate = true;
          } else if (block.status === 'processing' || block.status === 'streaming' || block.status === 'pending') {
            //  关键修复（兜底）：任意类型的块在重启后若仍停留在非终态，应收尾为已完成，
            //  避免历史脏数据导致思考块计时不停 / 块卡在流式态。
            updates.status = 'success';
            needsUpdate = true;
          }

          if (needsUpdate) {
            blocksToUpdate.push({ id: block.id, updates });
            // 立即更新本地对象
            Object.assign(block, updates);
          }
        }

        // 批量更新需要修复的块
        if (blocksToUpdate.length > 0) {
          await Promise.all(
            blocksToUpdate.map(({ id, updates }) =>
              dexieStorage.updateMessageBlock(id, updates)
            )
          );
        }

      console.log(`[TopicService] 从数据库加载了 ${blocks.length} 个块`);

      // 更新Redux状态
      store.dispatch(newMessagesActions.messagesReceived({
        topicId,
        messages
      }));

      // 统一使用新的Redux状态管理，移除旧的状态更新

      if (blocks.length > 0) {
        store.dispatch(upsertManyBlocks(blocks));
      }

      console.log(`[TopicService] 已加载话题 ${topicId} 的 ${messages.length} 条消息和 ${blocks.length} 个块`);

      return messages;
    } catch (error) {
      console.error(`[TopicService] 加载主题消息失败:`, error);
      return [];
    }
  }

  // 节流更新块内容 - 添加清理机制
  private static throttledBlockUpdate = throttle(async (id: string, blockUpdate: Partial<MessageBlock>) => {
    store.dispatch(updateOneBlock({ id, changes: blockUpdate }));
    await dexieStorage.message_blocks.update(id, blockUpdate);
  }, 150);

  // 清理节流函数，防止内存泄漏
  static cleanup(): void {
    if (this.throttledBlockUpdate && typeof this.throttledBlockUpdate.cancel === 'function') {
      this.throttledBlockUpdate.cancel();
    }
  }

  /**
   * 更新消息块内容（优化版本）
   */
  static async updateMessageBlock(block: MessageBlock): Promise<void> {
    try {
      const { id, ...blockUpdate } = block;
      // 使用节流函数更新块内容
      await this.throttledBlockUpdate(id, blockUpdate);
    } catch (error) {
      console.error(`[TopicService] 更新消息块失败:`, error);
      throw error;
    }
  }

  /**
   * 更新消息块字段
   * 统一封装块部分字段更新逻辑，替代直接调用 dexieStorage.updateMessageBlock
   */
  /**
   * 更新消息块字段
   * 使用事务确保数据一致性
   */
  static async updateMessageBlockFields(blockId: string, updates: Partial<MessageBlock>): Promise<void> {
    try {
      // 确保有更新时间戳
      if (!updates.updatedAt) {
        updates.updatedAt = new Date().toISOString();
      }

      // 获取块信息
      const block = await dexieStorage.getMessageBlock(blockId);
      if (!block) {
        throw new Error(`Block ${blockId} not found`);
      }

      // 使用事务保证原子性
      await dexieStorage.transaction('rw', [
        dexieStorage.topics,
        dexieStorage.messages,
        dexieStorage.message_blocks
      ], async () => {
        // 更新数据库中的块
        await dexieStorage.updateMessageBlock(blockId, updates);

        // 如果块状态发生变化，可能需要更新消息状态
        if (updates.status && block.status !== updates.status) {
          const message = await dexieStorage.getMessage(block.messageId);
          if (message && message.role === 'assistant') {
            // 如果块状态为ERROR，则消息状态也设为ERROR
            if (updates.status === 'error') {
              await dexieStorage.updateMessage(message.id, {
                status: 'error',
                updatedAt: new Date().toISOString()
              });

              // 更新Redux状态
              store.dispatch({
                type: 'normalizedMessages/updateMessageStatus',
                payload: {
                  topicId: message.topicId,
                  messageId: message.id,
                  status: 'error'
                }
              });
            }
          }
        }
      });

      // 更新Redux状态
      store.dispatch(updateOneBlock({
        id: blockId,
        changes: updates
      }));

      console.log(`[TopicService] 已更新消息块 ${blockId} 字段:`, updates);
    } catch (error) {
      console.error(`[TopicService] 更新消息块字段失败:`, error);
      throw error;
    }
  }

  /**
   * 获取消息的所有块
   */
  static async getMessageBlocks(messageId: string): Promise<MessageBlock[]> {
    try {
      return await dexieStorage.getMessageBlocksByMessageId(messageId);
    } catch (error) {
      console.error(`[TopicService] 获取消息的块失败:`, error);
      return [];
    }
  }

  /**
   * 删除消息及其所有块
   */
  static async deleteMessageWithBlocks(messageId: string, topicId: string): Promise<void> {
    try {
      // 获取话题
      const topic = await this.getTopicById(topicId);
      if (!topic) {
        throw new Error(`Topic ${topicId} not found`);
      }

      // 删除消息块
      await dexieStorage.deleteMessageBlocksByMessageId(messageId);

      // 删除消息ID
      if (topic.messageIds) {
        topic.messageIds = topic.messageIds.filter(id => id !== messageId);
      }

      // 更新话题
      await dexieStorage.saveTopic(topic);

      // 更新Redux状态
      if (topic.assistantId) {
        store.dispatch(updateTopic({
          assistantId: topic.assistantId,
          topic
        }));
      }
    } catch (error) {
      console.error(`[TopicService] 删除消息及块失败:`, error);
      throw error;
    }
  }

  /**
   * 获取所有消息
   */
  static async getAllMessages(): Promise<{[topicId: string]: Message[]}> {
    const result: {[topicId: string]: Message[]} = {};
    try {
      const topics = await this.getAllTopics();
      for (const topic of topics) {
        // 使用新的消息加载方法
        const messages = await this.loadTopicMessages(topic.id);
        result[topic.id] = messages;
      }
      return result;
    } catch (error) {
      console.error('[TopicService] 获取所有消息失败:', error);
      return result;
    }
  }

  /**
   * 处理消息中的图片数据
   */
  static async processMessageImageData(message: Message): Promise<Message> {
    // 此方法保持不变，处理旧消息格式中的图片数据
    return message;
  }



  /**
   * 创建主题分支
   * 从当前主题的指定消息创建一个新的分支主题
   * @param sourceTopicId 源主题ID
   * @param branchPointMessageId 分支点消息ID
   * @returns 创建的新主题，如果失败则返回null
   */
  static async createTopicBranch(sourceTopicId: string, branchPointMessageId: string): Promise<ChatTopic | null> {
    try {
      console.log(`[TopicService] 开始创建主题分支，源主题: ${sourceTopicId}, 分支点消息: ${branchPointMessageId}`);

      // 获取源主题信息
      const sourceTopic = await this.getTopicById(sourceTopicId);
      if (!sourceTopic) {
        console.error(`[TopicService] 找不到源主题: ${sourceTopicId}`);
        return null;
      }

      if (!sourceTopic.assistantId) {
        console.error(`[TopicService] 源主题 ${sourceTopicId} 缺少助手ID，无法创建分支`);
        return null;
      }

      // 创建新主题
      const newTopic = await this.createTopic(`${sourceTopic.name} (分支)`, undefined, sourceTopic.assistantId);
      if (!newTopic) {
        console.error('[TopicService] 创建分支主题失败');
        return null;
      }

      // 获取源主题的所有消息
      const sourceMessages = await dexieStorage.getMessagesByTopicId(sourceTopicId);
      if (!sourceMessages || sourceMessages.length === 0) {
        console.warn(`[TopicService] 源主题 ${sourceTopicId} 没有消息可克隆`);
        return newTopic; // 返回空主题
      }

      // 找到分支点消息的索引
      const branchPointIndex = sourceMessages.findIndex(msg => msg.id === branchPointMessageId);
      if (branchPointIndex === -1) {
        console.error(`[TopicService] 找不到分支点消息 ${branchPointMessageId}`);
        return newTopic; // 返回空主题
      }

      // 获取需要克隆的消息（包括分支点消息）
      const messagesToClone = sourceMessages.slice(0, branchPointIndex + 1);
      console.log(`[TopicService] 将克隆 ${messagesToClone.length} 条消息`);

      // 克隆每条消息及其块
      const clonedMessages: Message[] = [];
      const allClonedBlocks: MessageBlock[] = [];

      for (const originalMessage of messagesToClone) {
        // 获取原始消息的块
        const originalBlocks = await dexieStorage.getMessageBlocksByMessageId(originalMessage.id);

        // 创建新消息ID
        const newMessageId = uuid();

        // 克隆消息
        const clonedMessage: Message = {
          ...originalMessage,
          id: newMessageId,
          topicId: newTopic.id,
          blocks: [], // 先清空块列表，后面会重新添加
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        // 克隆块并关联到新消息
        const clonedBlocks: MessageBlock[] = [];

        for (const originalBlock of originalBlocks) {
          const newBlockId = uuid();

          const clonedBlock: MessageBlock = {
            ...originalBlock,
            id: newBlockId,
            messageId: newMessageId,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };

          clonedBlocks.push(clonedBlock);
          clonedMessage.blocks.push(newBlockId);
        }

        // 添加到集合中
        clonedMessages.push(clonedMessage);
        allClonedBlocks.push(...clonedBlocks);
      }

      // 保存克隆的消息和块到数据库
      await dexieStorage.transaction('rw', [
        dexieStorage.topics,
        dexieStorage.messages,
        dexieStorage.message_blocks
      ], async () => {
        // 保存消息块
        if (allClonedBlocks.length > 0) {
          await dexieStorage.bulkSaveMessageBlocks(allClonedBlocks);
        }

        // 保存消息
        for (const message of clonedMessages) {
          await dexieStorage.messages.put(message);
        }

        // 更新主题
        newTopic.messageIds = clonedMessages.map(m => m.id);

        // 更新lastMessageTime
        if (clonedMessages.length > 0) {
          const lastMessage = clonedMessages[clonedMessages.length - 1];
          newTopic.lastMessageTime = lastMessage.createdAt || lastMessage.updatedAt || new Date().toISOString();
        }

        // 保存更新后的主题
        await dexieStorage.saveTopic(newTopic);
      });

      // 更新Redux状态
      // 添加消息到Redux
      for (const message of clonedMessages) {
        store.dispatch(newMessagesActions.addMessage({
          topicId: newTopic.id,
          message
        }));
      }

      // 添加块到Redux
      if (allClonedBlocks.length > 0) {
        store.dispatch(upsertManyBlocks(allClonedBlocks));
      }

      console.log(`[TopicService] 成功克隆 ${clonedMessages.length} 条消息和 ${allClonedBlocks.length} 个块到新主题 ${newTopic.id}`);

      // 设置当前主题为新创建的分支主题
      store.dispatch(newMessagesActions.setCurrentTopicId(newTopic.id));

      return newTopic;
    } catch (error) {
      console.error('[TopicService] 创建主题分支失败:', error);
      return null;
    }
  }
}