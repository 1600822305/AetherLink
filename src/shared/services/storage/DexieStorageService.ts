import Dexie from 'dexie';
import { v4 as uuid } from 'uuid';
import type { Assistant } from '../../types/Assistant';
import type { ChatTopic, QuickPhrase } from '../../types';
import type { MessageBlock } from '../../types';
import type { Message } from '../../types/newMessage.ts';
import { DB_CONFIG, VERSION_CONFIGS, type Memory } from '../../database/config';
import { databaseMigrationManager } from '../../database/migrations';
import { throttle } from 'lodash';
import { makeSerializable, diagnoseSerializationIssues } from '../../utils/serialization';
import { DataRepairService } from '../DataRepairService';


/**
 * 基于Dexie.js的统一存储服务
 * 升级版本
 */
export class DexieStorageService extends Dexie {
  assistants!: Dexie.Table<Assistant, string>;
  topics!: Dexie.Table<ChatTopic & { _lastMessageTimeNum?: number }, string>;
  settings!: Dexie.Table<any, string>;
  images!: Dexie.Table<{ id: string; blob: Blob }, string>;
  imageMetadata!: Dexie.Table<any, string>;
  metadata!: Dexie.Table<any, string>;
  message_blocks!: Dexie.Table<MessageBlock, string>;
  messages!: Dexie.Table<Message, string>;
  files!: Dexie.Table<any, string>;
  knowledge_bases!: Dexie.Table<any, string>;
  knowledge_documents!: Dexie.Table<any, string>;
  quick_phrases!: Dexie.Table<QuickPhrase, string>;
  memories!: Dexie.Table<Memory, string>;


  private static instance: DexieStorageService;

  constructor() {
    super(DB_CONFIG.NAME);

    // 使用配置文件中的版本定义和新的迁移系统
    this.version(4).stores(VERSION_CONFIGS[4].stores)
      .upgrade(async () => {
        const result = await databaseMigrationManager.executeSingleMigration(this, 4);
        if (!result.success) {
          throw new Error(`版本4迁移失败: ${result.error}`);
        }
      });

    this.version(5).stores(VERSION_CONFIGS[5].stores)
      .upgrade(async () => {
        const result = await databaseMigrationManager.executeSingleMigration(this, 5);
        if (!result.success) {
          throw new Error(`版本5迁移失败: ${result.error}`);
        }
      });

    this.version(6).stores(VERSION_CONFIGS[6].stores)
      .upgrade(async () => {
        const result = await databaseMigrationManager.executeSingleMigration(this, 6);
        if (!result.success) {
          throw new Error(`版本6迁移失败: ${result.error}`);
        }
      });

    this.version(7).stores(VERSION_CONFIGS[7].stores)
      .upgrade(async () => {
        const result = await databaseMigrationManager.executeSingleMigration(this, 7);
        if (!result.success) {
          throw new Error(`版本7迁移失败: ${result.error}`);
        }
      });
  }



  // 旧的迁移方法已移动到 src/shared/database/migrations/index.ts
  // 现在使用统一的迁移管理器



  public static getInstance(): DexieStorageService {
    if (!DexieStorageService.instance) {
      DexieStorageService.instance = new DexieStorageService();
    }
    return DexieStorageService.instance;
  }

  async getAllAssistants(): Promise<Assistant[]> {
    return this.assistants.toArray();
  }

  async getSystemAssistants(): Promise<Assistant[]> {
    return this.assistants.where('isSystem').equals(1).toArray();
  }

  async getUserAssistants(): Promise<Assistant[]> {
    return this.assistants.filter(assistant => !assistant.isSystem).toArray();
  }

  async getAssistant(id: string): Promise<Assistant | null> {
    const assistant = await this.assistants.get(id);
    if (assistant) {
      console.log(`[DexieStorageService.getAssistant] 从数据库读取助手 ${id} (${assistant.name})，emoji: "${assistant.emoji}"`);
    }
    return assistant || null;
  }

  async saveAssistant(assistant: Assistant): Promise<void> {
    try {
      if (!assistant.id) {
        assistant.id = uuid();
      }

      const assistantToSave = { ...assistant };

      // 调试日志：记录保存前的emoji值
      console.log(`[DexieStorageService.saveAssistant] 保存助手 ${assistant.id} (${assistant.name})，emoji: "${assistant.emoji}"`);

      if (assistantToSave.icon && typeof assistantToSave.icon === 'object') {
        assistantToSave.icon = null;
      }

      if (assistantToSave.topics) {
        assistantToSave.topics = assistantToSave.topics.map(topic => ({
          ...topic,
          icon: null
        }));
      }

      // 调试日志：记录保存到数据库的emoji值
      console.log(`[DexieStorageService.saveAssistant] 即将保存到数据库的emoji: "${assistantToSave.emoji}"`);

      await this.assistants.put(assistantToSave);

      // 验证保存结果
      const savedAssistant = await this.assistants.get(assistant.id);
      console.log(`[DexieStorageService.saveAssistant] 保存后验证，数据库中的emoji: "${savedAssistant?.emoji}"`);

    } catch (error) {
      const errorMessage = error instanceof Error
        ? `${error.name}: ${error.message}`
        : String(error);
      console.error(`保存助手 ${assistant.id} 失败: ${errorMessage}`);
      throw error;
    }
  }

  async updateAssistant(id: string, updates: Partial<Assistant>): Promise<void> {
    try {
      const existingAssistant = await this.getAssistant(id);
      if (!existingAssistant) {
        throw new Error(`助手 ${id} 不存在`);
      }

      const updatedAssistant = {
        ...existingAssistant,
        ...updates,
        updatedAt: new Date().toISOString()
      };

      // 处理icon字段
      if (updatedAssistant.icon && typeof updatedAssistant.icon === 'object') {
        updatedAssistant.icon = null;
      }

      if (updatedAssistant.topics) {
        updatedAssistant.topics = updatedAssistant.topics.map(topic => ({
          ...topic,
          icon: null
        }));
      }

      await this.assistants.put(updatedAssistant);
      console.log(`[DexieStorageService] 已更新助手 ${id}:`, updates);
    } catch (error) {
      const errorMessage = error instanceof Error
        ? `${error.name}: ${error.message}`
        : String(error);
      console.error(`更新助手 ${id} 失败: ${errorMessage}`);
      throw error;
    }
  }

  async deleteAssistant(id: string): Promise<void> {
    const assistant = await this.getAssistant(id);
    if (assistant && assistant.topicIds && assistant.topicIds.length > 0) {
      for (const topicId of assistant.topicIds) {
        await this.deleteTopic(topicId);
      }
    }
    await this.assistants.delete(id);
  }

  async getAllTopics(): Promise<ChatTopic[]> {
    const topicsFromDb = await this.topics.toArray();
    return topicsFromDb.map(t => { const { _lastMessageTimeNum, ...topic } = t; return topic as ChatTopic; });
  }

  async getTopic(id: string): Promise<ChatTopic | null> {
    const topic = await this.topics.get(id);
    if (!topic) return null;
    const { _lastMessageTimeNum, ...restOfTopic } = topic;
    return restOfTopic as ChatTopic;
  }

  async saveTopic(topic: ChatTopic): Promise<void> {
    try {
      if (!topic.id) {
        topic.id = uuid();
      }

      // 确保topic有messageIds字段
      if (!topic.messageIds) {
        topic.messageIds = [];
      }

      // 兼容性处理：如果有messages字段，保存消息到messages表
      if (topic.messages && Array.isArray(topic.messages) && topic.messages.length > 0) {
        console.log(`[DexieStorageService] 保存话题 ${topic.id} 的 ${topic.messages.length} 条消息...`);
        
        for (const message of topic.messages) {
          if (message.id) {
            const messageBlocks = (message as any).blocks;
            const blockIds: string[] = [];
            
            // 保存消息块（如果blocks是完整对象数组）
            if (messageBlocks && Array.isArray(messageBlocks)) {
              console.log(`[DexieStorageService] 保存消息 ${message.id} 的 ${messageBlocks.length} 个块...`);
              
              for (const block of messageBlocks) {
                // 检查是否是完整的block对象（有content等字段）
                if (block && typeof block === 'object' && 'type' in block) {
                  // 确保block有id
                  if (!block.id) {
                    block.id = uuid();
                  }
                  // 保存block到message_blocks表
                  await this.saveMessageBlock(block);
                  blockIds.push(block.id);
                } else if (typeof block === 'string') {
                  // 如果已经是ID字符串，直接使用
                  blockIds.push(block);
                }
              }
            }
            
            // 创建消息副本，将blocks转换为ID数组
            const messageToSave = {
              ...message,
              blocks: blockIds
            };
            
            // 保存消息到messages表
            await this.saveMessage(messageToSave as Message);
            
            // 更新messageIds数组
            if (!topic.messageIds.includes(message.id)) {
              topic.messageIds.push(message.id);
            }
          }
        }
        
        console.log(`[DexieStorageService] 话题 ${topic.id} 的消息和块保存完成`);
      }

      // 设置lastMessageTime字段
      const lastMessageTime = topic.lastMessageTime || topic.updatedAt || new Date().toISOString();

      // 创建一个克隆用于存储，避免修改原始对象
      const topicToStore = {
        ...topic,
        _lastMessageTimeNum: new Date(lastMessageTime).getTime()
      };

      // 删除旧的messages字段，避免数据冗余存储
      delete (topicToStore as any).messages;

      await this.topics.put(topicToStore);
    } catch (error) {
      console.error(`[DexieStorageService] 保存话题失败: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  async deleteTopic(id: string): Promise<void> {
    try {
      // 删除关联的消息和消息块
      await this.deleteMessagesByTopicId(id);

      // 删除主题
      await this.topics.delete(id);
    } catch (error) {
      console.error(`[DexieStorageService] 删除话题失败: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  async getRecentTopics(limit: number = 10): Promise<ChatTopic[]> {
    const topicsFromDb = await this.topics
      .orderBy('_lastMessageTimeNum')
      .reverse()
      .limit(limit)
      .toArray();
    return topicsFromDb.map(t => { const { _lastMessageTimeNum, ...topic } = t; return topic as ChatTopic; });
  }

  async getTopicsByAssistantId(assistantId: string): Promise<ChatTopic[]> {
    const topicsFromDb = await this.topics
      .filter(topic => topic.assistantId === assistantId)
      .toArray();
    return topicsFromDb.map(t => { const { _lastMessageTimeNum, ...topic } = t; return topic as ChatTopic; });
  }

  async updateMessageInTopic(topicId: string, messageId: string, updatedMessage: Message): Promise<void> {
    try {
      // 直接更新消息表中的消息
      await this.updateMessage(messageId, updatedMessage);

      // 获取话题并更新兼容字段
      const topic = await this.getTopic(topicId);
      if (!topic) return;

      // 更新消息数组（如果存在）
      if (topic.messages) {
        const messageIndex = topic.messages.findIndex(m => m.id === messageId);
        if (messageIndex !== -1) {
          topic.messages[messageIndex] = updatedMessage;
        }
      }

      await this.saveTopic(topic);
    } catch (error) {
      console.error(`[DexieStorageService] 更新话题消息失败: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  async deleteMessageFromTopic(topicId: string, messageId: string): Promise<void> {
    try {
      // 删除消息及其关联的块
      await this.deleteMessage(messageId);

      // 更新主题的messageIds数组
      const topic = await this.getTopic(topicId);
      if (!topic) return;

      // 更新messageIds数组
      if (topic.messageIds) {
        topic.messageIds = topic.messageIds.filter(id => id !== messageId);
      }

      // 为了兼容性，同时更新messages数组
      if (topic.messages) {
        topic.messages = topic.messages.filter(m => m.id !== messageId);
      }

      // 更新lastMessageTime
      if (topic.messageIds && topic.messageIds.length > 0) {
        const lastMessageId = topic.messageIds[topic.messageIds.length - 1];
        const lastMessage = await this.getMessage(lastMessageId);
        if (lastMessage) {
          topic.lastMessageTime = lastMessage.createdAt || lastMessage.updatedAt || new Date().toISOString();
        }
      } else {
        topic.lastMessageTime = new Date().toISOString();
      }

      await this.saveTopic(topic);
    } catch (error) {
      console.error(`[DexieStorageService] 从话题中删除消息失败: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  async addMessageToTopic(topicId: string, message: Message): Promise<void> {
    try {
      // 保存消息到messages表
      await this.saveMessage(message);

      // 更新主题的messageIds数组
      const topic = await this.getTopic(topicId);
      if (!topic) return;

      if (!topic.messageIds) {
        topic.messageIds = [];
      }

      if (!topic.messageIds.includes(message.id)) {
        topic.messageIds.push(message.id);
      }

      // 为了兼容性，同时更新messages数组
      const messages = topic.messages || [];

      const messageIndex = messages.findIndex(m => m.id === message.id);
      if (messageIndex >= 0) {
        messages[messageIndex] = message;
      } else {
        messages.push(message);
      }

      // 更新topic.messages
      topic.messages = messages;

      topic.lastMessageTime = message.createdAt || message.updatedAt || new Date().toISOString();
      await this.saveTopic(topic);
    } catch (error) {
      console.error(`[DexieStorageService] 添加消息到话题失败: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  async saveMessageBlock(block: MessageBlock): Promise<void> {
    if (!block.id) {
      block.id = uuid();
    }

    // 🔧 修复：对比分析块的特殊处理
    if ('subType' in block && (block as any).subType === 'comparison') {
      console.log(`[DexieStorageService] 保存对比分析块: ${block.id}`);
      // 确保 comboResult 被正确序列化
      const comparisonBlock = block as any;
      if (comparisonBlock.comboResult) {
        // 深拷贝确保数据完整性
        const blockToSave = {
          ...block,
          comboResult: JSON.parse(JSON.stringify(comparisonBlock.comboResult))
        };
        await this.message_blocks.put(blockToSave);
        return;
      }
    }

    // 🔧 修复：多模型块的特殊处理
    if (block.type === 'multi_model' && 'responses' in block) {
      const multiModelBlock = block as any;
      if (multiModelBlock.responses && Array.isArray(multiModelBlock.responses)) {
        // 深拷贝确保 responses 数组被正确序列化
        const blockToSave = {
          ...block,
          responses: JSON.parse(JSON.stringify(multiModelBlock.responses)),
          displayStyle: multiModelBlock.displayStyle || 'horizontal'
        };
        await this.message_blocks.put(blockToSave);
        return;
      }
    }

    await this.message_blocks.put(block);
  }

  async getMessageBlock(id: string): Promise<MessageBlock | null> {
    const block = await this.message_blocks.get(id);
    if (!block) return null;

    // 🔧 修复：多模型块的特殊处理
    if (block.type === 'multi_model' && 'responses' in block) {
      const multiModelBlock = block as any;

      // 确保 responses 数组存在且格式正确
      if (!multiModelBlock.responses || !Array.isArray(multiModelBlock.responses)) {
        multiModelBlock.responses = [];
      }

      // 确保每个 response 都有必要的字段
      multiModelBlock.responses = multiModelBlock.responses.map((response: any) => ({
        modelId: response.modelId || '',
        modelName: response.modelName || response.modelId || '',
        content: response.content || '',
        status: response.status || 'pending'
      }));
    }

    // 🔧 修复：对比分析块的特殊处理
    if ('subType' in block && (block as any).subType === 'comparison') {
      console.log(`[DexieStorageService] 加载对比分析块: ${id}`);
      const comparisonBlock = block as any;

      // 验证 comboResult 数据完整性
      if (comparisonBlock.comboResult) {
        // 确保 comboResult 具有正确的结构
        if (!comparisonBlock.comboResult.modelResults || !Array.isArray(comparisonBlock.comboResult.modelResults)) {
          console.error(`[DexieStorageService] 对比分析块数据损坏: ${id}`);
          return null;
        }

        console.log(`[DexieStorageService] 对比分析块加载成功，模型数量: ${comparisonBlock.comboResult.modelResults.length}`);
      } else {
        console.error(`[DexieStorageService] 对比分析块缺少 comboResult: ${id}`);
        return null;
      }
    }

    return block;
  }

  async getMessageBlocksByMessageId(messageId: string): Promise<MessageBlock[]> {
    return await this.message_blocks.where('messageId').equals(messageId).toArray();
  }

  // 批量获取多个消息的块，优化性能
  async getMessageBlocksByMessageIds(messageIds: string[]): Promise<MessageBlock[]> {
    if (messageIds.length === 0) return [];

    // 使用 anyOf 进行批量查询，比多次单独查询更高效
    return await this.message_blocks.where('messageId').anyOf(messageIds).toArray();
  }

  async deleteMessageBlock(id: string): Promise<void> {
    await this.message_blocks.delete(id);
  }

  async deleteMessageBlocksByMessageId(messageId: string): Promise<void> {
    const blocks = await this.getMessageBlocksByMessageId(messageId);
    await Promise.all(blocks.map(block => this.deleteMessageBlock(block.id)));
  }

  async bulkSaveMessageBlocks(blocks: MessageBlock[]): Promise<void> {
    for (const block of blocks) {
      if (!block.id) {
        block.id = uuid();
      }
    }
    await this.message_blocks.bulkPut(blocks);
  }

  async updateMessageBlock(blockId: string, updates: Partial<MessageBlock>): Promise<void> {
    const existingBlock = await this.getMessageBlock(blockId);
    if (!existingBlock) return;

    const updatedBlock = {
      ...existingBlock,
      ...updates,
      updatedAt: new Date().toISOString()
    };

    await this.message_blocks.update(blockId, updatedBlock);
  }

  /**
   * 保存设置到数据库
   * 自动处理序列化问题，确保数据可以安全地存储
   * @param key 设置键名
   * @param value 设置值
   */
  async saveSetting(key: string, value: any): Promise<void> {
    try {
      console.log(`[DexieStorageService] 开始保存设置: ${key}`);

      // 检查数据是否存在序列化问题
      const { hasCircularRefs, nonSerializableProps } = diagnoseSerializationIssues(value);

      if (hasCircularRefs || nonSerializableProps.length > 0) {
        console.warn(`[DexieStorageService] 设置 ${key} 存在序列化问题，将尝试修复:`, {
          hasCircularRefs,
          nonSerializableProps: nonSerializableProps.slice(0, 10) // 只显示前10个问题，避免日志过长
        });

        // 使用makeSerializable处理数据，确保可序列化
        const serializableValue = makeSerializable(value);
        await this.settings.put({ id: key, value: serializableValue });
        console.log(`[DexieStorageService] 设置 ${key} 已修复并保存成功`);
      } else {
        // 数据没有序列化问题，直接保存
        await this.settings.put({ id: key, value });
        console.log(`[DexieStorageService] 设置 ${key} 保存成功`);
      }
    } catch (error) {
      console.error(`[DexieStorageService] 保存设置 ${key} 失败:`, error);

      // 记录更详细的错误信息
      if (error instanceof Error) {
        console.error('错误类型:', error.name);
        console.error('错误消息:', error.message);
        console.error('错误堆栈:', error.stack);
      }

      // 尝试使用JSON序列化再保存
      try {
        console.log(`[DexieStorageService] 尝试使用JSON序列化再保存设置 ${key}`);
        const jsonString = JSON.stringify(value);
        await this.settings.put({ id: key, value: { _isJsonString: true, data: jsonString } });
        console.log(`[DexieStorageService] 设置 ${key} 使用JSON序列化保存成功`);
      } catch (jsonError) {
        console.error(`[DexieStorageService] JSON序列化保存设置 ${key} 也失败:`, jsonError);
        throw error; // 抛出原始错误
      }
    }
  }

  /**
   * 从数据库获取设置
   * 自动处理反序列化
   * @param key 设置键名
   * @returns 设置值
   */
  async getSetting(key: string): Promise<any> {
    try {
      const setting = await this.settings.get(key);

      if (!setting) {
        return null;
      }

      // 检查是否是JSON序列化的数据
      if (setting.value && typeof setting.value === 'object' && setting.value._isJsonString) {
        try {
          return JSON.parse(setting.value.data);
        } catch (e) {
          console.error(`[DexieStorageService] 解析JSON序列化的设置 ${key} 失败:`, e);
          return null;
        }
      }

      return setting.value;
    } catch (error) {
      console.error(`[DexieStorageService] 获取设置 ${key} 失败:`, error);
      return null;
    }
  }

  async deleteSetting(key: string): Promise<void> {
    await this.settings.delete(key);
  }

  async saveImage(blob: Blob, metadata: any): Promise<string> {
    const id = metadata.id || uuid();
    await this.images.put({ id, blob });
    await this.imageMetadata.put({ ...metadata, id });
    return id;
  }

  async getImageBlob(id: string): Promise<Blob | undefined> {
    const imageRecord = await this.images.get(id);
    return imageRecord?.blob;
  }

  async getImageMetadata(id: string): Promise<any> {
    return this.imageMetadata.get(id);
  }

  async getImageMetadataByTopicId(topicId: string): Promise<any[]> {
    return this.imageMetadata.where('topicId').equals(topicId).toArray();
  }

  async getRecentImageMetadata(limit: number = 20): Promise<any[]> {
    return this.imageMetadata.orderBy('created').reverse().limit(limit).toArray();
  }

  async deleteImage(id: string): Promise<void> {
    await this.images.delete(id);
    await this.imageMetadata.delete(id);
  }

  async saveBase64Image(base64Data: string, metadata: any = {}): Promise<string> {
    try {
      // 生成唯一ID
      const id = metadata.id || uuid();

      // 将base64转换为Blob
      const blob = this.base64ToBlob(base64Data);

      // 保存Blob到images表 - 修复：images表存储包含id和blob的对象
      await this.images.put({ id, blob });

      // 保存元数据到imageMetadata表
      const imageMetadata = {
        ...metadata,
        id,
        created: new Date().toISOString(),
        size: blob.size,
        type: blob.type
      };
      await this.imageMetadata.put(imageMetadata);

      return id;
    } catch (error) {
      console.error('保存base64图片失败:', error);
      throw error;
    }
  }

  /**
   * 将base64字符串转换为Blob
   */
  private base64ToBlob(base64Data: string): Blob {
    // 处理data URL格式 (data:image/png;base64,...)
    let base64String = base64Data;
    let mimeType = 'image/png'; // 默认类型

    if (base64Data.startsWith('data:')) {
      const [header, data] = base64Data.split(',');
      base64String = data;

      // 提取MIME类型
      const mimeMatch = header.match(/data:([^;]+)/);
      if (mimeMatch) {
        mimeType = mimeMatch[1];
      }
    }

    // 将base64转换为二进制数据
    const binaryString = atob(base64String);
    const bytes = new Uint8Array(binaryString.length);

    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    return new Blob([bytes], { type: mimeType });
  }

  async saveMetadata(key: string, value: any): Promise<void> {
    await this.metadata.put({ id: key, value });
  }

  async getMetadata(key: string): Promise<any> {
    const metadata = await this.metadata.get(key);
    return metadata ? metadata.value : null;
  }

  async deleteMetadata(key: string): Promise<void> {
    await this.metadata.delete(key);
  }

  /**
   * 获取模型配置
   * @param modelId 模型ID
   * @returns 模型配置对象，如果不存在则返回null
   */
  async getModel(modelId: string): Promise<any | null> {
    try {
      // 从元数据中获取模型配置
      const modelKey = `model_${modelId}`;
      return await this.getMetadata(modelKey);
    } catch (error) {
      console.error(`[DexieStorageService] 获取模型配置失败: ${modelId}`, error);
      return null;
    }
  }

  /**
   * 保存模型配置
   * @param modelId 模型ID
   * @param modelConfig 模型配置对象
   */
  async saveModel(modelId: string, modelConfig: any): Promise<void> {
    try {
      // 保存模型配置到元数据
      const modelKey = `model_${modelId}`;
      await this.saveMetadata(modelKey, modelConfig);
    } catch (error) {
      console.error(`[DexieStorageService] 保存模型配置失败: ${modelId}`, error);
      throw error;
    }
  }

  async deleteAllMessages(): Promise<void> {
    await this.message_blocks.clear();

    const topics = await this.getAllTopics();

    for (const topic of topics) {
      topic.messages = [];
      await this.saveTopic(topic);
    }
  }

  async deleteAllTopics(): Promise<void> {
    await this.message_blocks.clear();

    await this.topics.clear();

    const assistants = await this.getAllAssistants();
    for (const assistant of assistants) {
      assistant.topicIds = [];
      await this.saveAssistant(assistant);
    }
  }

  async createMessageBlocksTable(): Promise<void> {
    if (!this.message_blocks) {
      console.log('创建消息块表...');
      this.version(DB_CONFIG.VERSION).stores({
        [DB_CONFIG.STORES.MESSAGE_BLOCKS]: 'id, messageId'
      });
      console.log('消息块表创建完成');
    } else {
      console.log('消息块表已存在');
    }
  }

  async clearDatabase(): Promise<void> {
    await this.message_blocks.clear();
    await this.topics.clear();
    await this.assistants.clear();
    await this.settings.clear();
    await this.images.clear();
    await this.imageMetadata.clear();
    await this.metadata.clear();
  }

  /**
   * 获取话题的所有消息
   * 🔧 改造：优先从 topics.messages 读取（主存储）
   * 如果 topics.messages 为空，尝试从旧的 messages 表读取（兼容旧数据）
   */
  async getTopicMessages(topicId: string): Promise<Message[]> {
    try {
      const topic = await this.topics.get(topicId);
      if (!topic) return [];

      // 1. 优先从 topics.messages 读取（Cherry Studio 设计）
      if (topic.messages && Array.isArray(topic.messages) && topic.messages.length > 0) {
        return topic.messages;
      }

      // 2. 兼容旧数据：从 messageIds + messages 表读取
      if (topic.messageIds && Array.isArray(topic.messageIds) && topic.messageIds.length > 0) {
        console.log(`[DexieStorageService] 兼容模式：从 messages 表加载 ${topic.messageIds.length} 条旧消息`);
        const messages: Message[] = [];
        for (const messageId of topic.messageIds) {
          const message = await this.messages.get(messageId);
          if (message) messages.push(message);
        }
        
        // 🔧 自动迁移：将旧数据写入 topics.messages
        if (messages.length > 0) {
          console.log(`[DexieStorageService] 自动迁移 ${messages.length} 条消息到 topics.messages`);
          await this.topics.update(topicId, { messages });
        }
        
        return messages;
      }

      return [];
    } catch (error) {
      console.error(`[DexieStorageService] 获取话题消息失败: ${error instanceof Error ? error.message : String(error)}`);
      return [];
    }
  }

  /**
   * 保存消息
   * 🔧 改造：只写入 topics.messages（主存储），不再写入 messages 表
   */
  async saveMessage(message: Message): Promise<void> {
    if (!message.id) {
      message.id = uuid();
    }

    try {
      await this.transaction('rw', [this.topics], async () => {
        const topic = await this.topics.get(message.topicId);
        if (topic) {
          if (!topic.messages) {
            topic.messages = [];
          }

          const messageIndex = topic.messages.findIndex(m => m.id === message.id);
          if (messageIndex >= 0) {
            topic.messages[messageIndex] = message;
          } else {
            topic.messages.push(message);
          }

          await this.topics.put(topic);
        }
      });
    } catch (error) {
      console.error(`[DexieStorageService] 保存消息失败: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * 🔧 改造：批量保存消息到 topics.messages
   */
  async bulkSaveMessages(messages: Message[]): Promise<void> {
    // 按 topicId 分组
    const messagesByTopic = new Map<string, Message[]>();
    for (const message of messages) {
      if (!message.id) message.id = uuid();
      const existing = messagesByTopic.get(message.topicId) || [];
      existing.push(message);
      messagesByTopic.set(message.topicId, existing);
    }

    // 批量更新每个 topic
    for (const [topicId, topicMessages] of messagesByTopic) {
      const topic = await this.topics.get(topicId);
      if (topic) {
        if (!topic.messages) topic.messages = [];
        for (const msg of topicMessages) {
          const idx = topic.messages.findIndex(m => m.id === msg.id);
          if (idx >= 0) {
            topic.messages[idx] = msg;
          } else {
            topic.messages.push(msg);
          }
        }
        await this.topics.put(topic);
      }
    }
  }

  /**
   * 🔧 改造：优先从 topics.messages 获取，兼容从 messages 表读取
   */
  async getMessage(id: string): Promise<Message | null> {
    // 优先从 topics.messages 查找
    const allTopics = await this.topics.toArray();
    for (const topic of allTopics) {
      const message = topic.messages?.find(m => m.id === id);
      if (message) return message;
    }
    // 兼容：从 messages 表读取
    return await this.messages.get(id) || null;
  }

  /**
   * � 改造：优先从 topics.messages 获取
   */
  async getMessagesByIds(messageIds: string[]): Promise<Message[]> {
    if (messageIds.length === 0) return [];

    const result: Message[] = [];
    const idSet = new Set(messageIds);
    
    // 优先从 topics.messages 查找
    const allTopics = await this.topics.toArray();
    for (const topic of allTopics) {
      if (topic.messages) {
        for (const msg of topic.messages) {
          if (idSet.has(msg.id)) {
            result.push(msg);
            idSet.delete(msg.id);
          }
        }
      }
    }
    
    // 兼容：从 messages 表读取未找到的
    if (idSet.size > 0) {
      const remainingMessages = await this.messages.bulkGet([...idSet]);
      result.push(...remainingMessages.filter(m => m !== undefined) as Message[]);
    }
    
    return result;
  }

  /**
   * 🔧 改造：优先从 topics.messages 获取
   */
  async getMessagesByTopicId(topicId: string): Promise<Message[]> {
    const topic = await this.topics.get(topicId);
    if (topic?.messages && topic.messages.length > 0) {
      return topic.messages;
    }
    // 兼容：从 messages 表读取
    return await this.messages.where('topicId').equals(topicId).toArray();
  }

  /**
   * 🔧 改造：从 topics.messages 获取所有消息
   */
  async getAllMessages(): Promise<Message[]> {
    try {
      const allTopics = await this.topics.toArray();
      const allMessages: Message[] = [];
      for (const topic of allTopics) {
        if (topic.messages) {
          allMessages.push(...topic.messages);
        }
      }
      return allMessages;
    } catch (error) {
      console.error(`[DexieStorageService] 获取所有消息失败: ${error instanceof Error ? error.message : String(error)}`);
      return [];
    }
  }

  /**
   * 🔧 改造：从 topics.messages 删除消息
   */
  async deleteMessage(id: string): Promise<void> {
    // 从 topics.messages 查找并删除
    const allTopics = await this.topics.toArray();
    for (const topic of allTopics) {
      if (topic.messages) {
        const messageIndex = topic.messages.findIndex(m => m.id === id);
        if (messageIndex !== -1) {
          const message = topic.messages[messageIndex];
          // 删除关联的块
          if (message.blocks && message.blocks.length > 0) {
            await this.deleteMessageBlocksByIds(message.blocks);
          }
          // 从数组中移除
          topic.messages.splice(messageIndex, 1);
          await this.topics.put(topic);
          return;
        }
      }
    }
    
    // 兼容：从 messages 表删除旧数据
    const message = await this.messages.get(id);
    if (message) {
      if (message.blocks && message.blocks.length > 0) {
        await this.deleteMessageBlocksByIds(message.blocks);
      }
      await this.messages.delete(id);
    }
  }

  /**
   * 🔧 改造：从 topics.messages 删除消息
   */
  async deleteMessagesByTopicId(topicId: string): Promise<void> {
    const topic = await this.topics.get(topicId);
    if (topic?.messages) {
      // 删除所有关联的块
      for (const message of topic.messages) {
        if (message.blocks && message.blocks.length > 0) {
          await this.deleteMessageBlocksByIds(message.blocks);
        }
      }
      // 清空消息数组
      topic.messages = [];
      await this.topics.put(topic);
    }
    
    // 兼容：删除 messages 表中的旧数据
    const oldMessages = await this.messages.where('topicId').equals(topicId).toArray();
    for (const message of oldMessages) {
      if (message.blocks && message.blocks.length > 0) {
        await this.deleteMessageBlocksByIds(message.blocks);
      }
    }
    await this.messages.where('topicId').equals(topicId).delete();
  }

  /**
   * 🔧 改造：只更新 topics.messages，不再写入 messages 表
   */
  async updateMessage(id: string, updates: Partial<Message>): Promise<void> {
    // 从 topics.messages 中查找消息的 topicId
    const allTopics = await this.topics.toArray();
    let topicId: string | null = null;
    
    for (const topic of allTopics) {
      if (topic.messages?.some(m => m.id === id)) {
        topicId = topic.id;
        break;
      }
    }
    
    // 兼容：如果 topics.messages 中没找到，尝试从 messages 表获取 topicId
    if (!topicId) {
      const message = await this.messages.get(id);
      if (message) topicId = message.topicId;
    }
    
    if (!topicId) return;

    const updatedAt = new Date().toISOString();

    await this.topics
      .where('id')
      .equals(topicId)
      .modify((topic) => {
        if (!topic || !topic.messages) return;
        const messageIndex = topic.messages.findIndex((m: Message) => m.id === id);
        if (messageIndex !== -1) {
          Object.assign(topic.messages[messageIndex], updates);
          topic.messages[messageIndex].updatedAt = updatedAt;
        }
      });
  }

  /**
   * 🔧 统一的消息和块更新方法
   * 参考 Cherry Studio 的 updateMessageAndBlocks 设计
   * 在单个事务中同时更新消息和块，保证数据一致性
   * 
   * 🔧 改造：只写入 topics.messages，不再写入 messages 表
   */
  async updateMessageAndBlocks(
    topicId: string,
    messageUpdates: Partial<Message> & { id: string },
    blocksToUpdate: MessageBlock[]
  ): Promise<void> {
    try {
      await this.transaction('rw', [this.topics, this.message_blocks], async () => {
        // 1. 更新块（使用 bulkPut 进行 upsert）
        if (blocksToUpdate.length > 0) {
          await this.message_blocks.bulkPut(blocksToUpdate);
        }

        // 2. 更新消息（如果有除 id 和 topicId 之外的更新）
        const keysToUpdate = Object.keys(messageUpdates).filter(
          key => key !== 'id' && key !== 'topicId'
        );

        if (keysToUpdate.length > 0) {
          // 只更新 topics.messages 数组（主存储）
          await this.topics
            .where('id')
            .equals(topicId)
            .modify((topic) => {
              if (!topic || !topic.messages) return;
              const messageIndex = topic.messages.findIndex((m: Message) => m.id === messageUpdates.id);
              if (messageIndex !== -1 && topic.messages) {
                keysToUpdate.forEach(key => {
                  (topic.messages![messageIndex] as any)[key] = (messageUpdates as any)[key];
                });
                topic.messages![messageIndex].updatedAt = new Date().toISOString();
              }
            });
        }
      });

      console.log(`[DexieStorageService] updateMessageAndBlocks 完成: 消息=${messageUpdates.id}, 块数量=${blocksToUpdate.length}`);
    } catch (error) {
      console.error(`[DexieStorageService] updateMessageAndBlocks 失败:`, error);
      throw error;
    }
  }

  /**
   * 🔧 批量更新块（upsert 操作）
   * 参考 Cherry Studio 的 updateBlocks
   */
  async upsertMessageBlocks(blocks: MessageBlock[]): Promise<void> {
    if (blocks.length === 0) return;
    await this.message_blocks.bulkPut(blocks);
  }

  /**
   * 🔧 更新单个块的字段（仅更新已存在的块）
   * 用于节流更新场景，效率更高
   */
  async updateMessageBlockFields(blockId: string, updates: Partial<MessageBlock>): Promise<void> {
    await this.message_blocks.update(blockId, {
      ...updates,
      updatedAt: new Date().toISOString()
    });
  }

  async deleteMessageBlocksByIds(blockIds: string[]): Promise<void> {
    await Promise.all(blockIds.map((id: string) => this.deleteMessageBlock(id)));
  }

  /**
   * 获取消息版本的块
   * @param versionId 版本ID
   * @returns 版本对应的块列表
   */
  async getMessageBlocksByVersionId(versionId: string): Promise<MessageBlock[]> {
    try {
      // 查找所有metadata.versionId等于指定versionId的块
      const blocks = await this.message_blocks.toArray();
      return blocks.filter(block =>
        block.metadata &&
        typeof block.metadata === 'object' &&
        'versionId' in block.metadata &&
        block.metadata.versionId === versionId
      );
    } catch (error) {
      console.error(`[DexieStorageService] 获取版本块失败: ${error instanceof Error ? error.message : String(error)}`);
      return [];
    }
  }

  // 迁移主题消息数据
  async migrateTopicMessages(topicId: string): Promise<void> {
    try {
      const topic = await this.topics.get(topicId);
      if (!topic) return;

      // 如果存在旧的messages数组，迁移到独立的messages表
      if ((topic as any).messages && Array.isArray((topic as any).messages)) {
        const messages = (topic as any).messages;
        const messageIds: string[] = [];

        // 保存消息到messages表
        for (const message of messages) {
          if (message.id) {
            await this.saveMessage(message);
            messageIds.push(message.id);
          }
        }

        // 更新topic，使用messageIds替代messages
        topic.messageIds = messageIds;
        delete (topic as any).messages;

        // 保存更新后的topic
        await this.topics.put(topic);
      }
    } catch (error) {
      console.error(`[DexieStorageService] 迁移话题消息数据失败: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  // 批量迁移所有主题消息数据
  async migrateAllTopicMessages(): Promise<{ migrated: number, total: number }> {
    try {
      const topics = await this.topics.toArray();
      let migratedCount = 0;

      for (const topic of topics) {
        // 检查是否需要迁移
        if ((topic as any).messages && Array.isArray((topic as any).messages)) {
          await this.migrateTopicMessages(topic.id);
          migratedCount++;
        }
      }

      return { migrated: migratedCount, total: topics.length };
    } catch (error) {
      console.error(`[DexieStorageService] 批量迁移话题消息数据失败: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * 修复消息数据，确保所有消息都正确保存到 messages 表
   * @deprecated 请使用 DataRepairService.repairMessagesData() 方法
   */
  async repairMessagesData(): Promise<void> {
    console.log('[DexieStorageService] repairMessagesData 已废弃，请使用 DataRepairService.repairMessagesData()');

    try {
      await DataRepairService.repairMessagesData();
    } catch (error) {
      console.error('[DexieStorageService] 委托修复消息数据失败:', error);
      throw error;
    }
  }

  // 添加节流更新方法
  throttledUpdateBlock = throttle(
    async (blockId: string, changes: any) => {
      return this.updateMessageBlock(blockId, changes);
    },
    300 // 增加到300ms节流时间，减少数据库写入频率
  );

  /**
   * 模型组合相关方法
   */

  // 获取所有模型组合
  async getAllModelCombos(): Promise<any[]> {
    try {
      const combosData = await this.getMetadata('model_combos');
      return combosData || [];
    } catch (error) {
      console.error('[DexieStorageService] 获取模型组合失败:', error);
      return [];
    }
  }

  // 获取单个模型组合
  async getModelCombo(id: string): Promise<any | null> {
    try {
      const combos = await this.getAllModelCombos();
      return combos.find(combo => combo.id === id) || null;
    } catch (error) {
      console.error('[DexieStorageService] 获取模型组合失败:', error);
      return null;
    }
  }

  // 保存模型组合
  async saveModelCombo(combo: any): Promise<void> {
    try {
      const combos = await this.getAllModelCombos();
      const existingIndex = combos.findIndex(c => c.id === combo.id);

      if (existingIndex >= 0) {
        combos[existingIndex] = combo;
      } else {
        combos.push(combo);
      }

      await this.saveMetadata('model_combos', combos);
    } catch (error) {
      console.error('[DexieStorageService] 保存模型组合失败:', error);
      throw error;
    }
  }

  // 删除模型组合
  async deleteModelCombo(id: string): Promise<void> {
    try {
      const combos = await this.getAllModelCombos();
      const filteredCombos = combos.filter(combo => combo.id !== id);
      await this.saveMetadata('model_combos', filteredCombos);
    } catch (error) {
      console.error('[DexieStorageService] 删除模型组合失败:', error);
      throw error;
    }
  }

  /**
   * 快捷短语相关方法
   */

  // 获取所有快捷短语
  async getAllQuickPhrases(): Promise<QuickPhrase[]> {
    try {
      const phrases = await this.quick_phrases.toArray();
      return phrases.sort((a, b) => (b.order ?? 0) - (a.order ?? 0));
    } catch (error) {
      console.error('[DexieStorageService] 获取快捷短语失败:', error);
      return [];
    }
  }

  // 获取单个快捷短语
  async getQuickPhrase(id: string): Promise<QuickPhrase | null> {
    try {
      return await this.quick_phrases.get(id) || null;
    } catch (error) {
      console.error('[DexieStorageService] 获取快捷短语失败:', error);
      return null;
    }
  }

  // 添加快捷短语
  async addQuickPhrase(data: Pick<QuickPhrase, 'title' | 'content'>): Promise<QuickPhrase> {
    try {
      const now = Date.now();
      const phrases = await this.getAllQuickPhrases();

      // 更新现有短语的顺序
      await Promise.all(
        phrases.map((phrase) =>
          this.quick_phrases.update(phrase.id, {
            order: (phrase.order ?? 0) + 1
          })
        )
      );

      const phrase: QuickPhrase = {
        id: uuid(),
        title: data.title,
        content: data.content,
        createdAt: now,
        updatedAt: now,
        order: 0
      };

      await this.quick_phrases.add(phrase);
      return phrase;
    } catch (error) {
      console.error('[DexieStorageService] 添加快捷短语失败:', error);
      throw error;
    }
  }

  // 更新快捷短语
  async updateQuickPhrase(id: string, data: Pick<QuickPhrase, 'title' | 'content'>): Promise<void> {
    try {
      await this.quick_phrases.update(id, {
        ...data,
        updatedAt: Date.now()
      });
    } catch (error) {
      console.error('[DexieStorageService] 更新快捷短语失败:', error);
      throw error;
    }
  }

  // 删除快捷短语
  async deleteQuickPhrase(id: string): Promise<void> {
    try {
      await this.quick_phrases.delete(id);
      const phrases = await this.getAllQuickPhrases();

      // 重新排序剩余的短语
      await Promise.all(
        phrases.map((phrase, index) =>
          this.quick_phrases.update(phrase.id, {
            order: phrases.length - 1 - index
          })
        )
      );
    } catch (error) {
      console.error('[DexieStorageService] 删除快捷短语失败:', error);
      throw error;
    }
  }

  // 更新快捷短语顺序
  async updateQuickPhrasesOrder(phrases: QuickPhrase[]): Promise<void> {
    try {
      const now = Date.now();
      await Promise.all(
        phrases.map((phrase, index) =>
          this.quick_phrases.update(phrase.id, {
            order: phrases.length - 1 - index,
            updatedAt: now
          })
        )
      );
    } catch (error) {
      console.error('[DexieStorageService] 更新快捷短语顺序失败:', error);
      throw error;
    }
  }

  // === Memories 相关方法 ===

  async saveMemory(memory: Memory): Promise<void> {
    try {
      if (!memory.id) {
        memory.id = uuid();
      }

      if (!memory.createdAt) {
        memory.createdAt = new Date().toISOString();
      }

      memory.updatedAt = new Date().toISOString();

      await this.memories.put(memory);
      console.log(`[DexieStorageService] 已保存记忆: ${memory.id}`);
    } catch (error) {
      console.error(`[DexieStorageService] 保存记忆失败: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  async getMemory(id: string): Promise<Memory | null> {
    try {
      const memory = await this.memories.get(id);
      return memory || null;
    } catch (error) {
      console.error(`[DexieStorageService] 获取记忆失败: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  }

  async getAllMemories(): Promise<Memory[]> {
    try {
      return await this.memories.toArray();
    } catch (error) {
      console.error(`[DexieStorageService] 获取所有记忆失败: ${error instanceof Error ? error.message : String(error)}`);
      return [];
    }
  }

  async getMemoriesByType(type: 'entity' | 'relation'): Promise<Memory[]> {
    try {
      return await this.memories.where('type').equals(type).toArray();
    } catch (error) {
      console.error(`[DexieStorageService] 按类型获取记忆失败: ${error instanceof Error ? error.message : String(error)}`);
      return [];
    }
  }

  async deleteMemory(id: string): Promise<void> {
    try {
      await this.memories.delete(id);
      console.log(`[DexieStorageService] 已删除记忆: ${id}`);
    } catch (error) {
      console.error(`[DexieStorageService] 删除记忆失败: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }


}

export const dexieStorage = DexieStorageService.getInstance();