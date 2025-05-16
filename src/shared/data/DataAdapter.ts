import { 
  getAllTopicsFromDB, 
  saveTopicToDB, 
  getTopicFromDB, 
  deleteTopicFromDB,
  getAllAssistantsFromDB,
  saveAssistantToDB,
  getAssistantFromDB,
  deleteAssistantFromDB
} from '../services/storageService';
import type { ChatTopic } from '../types';
import type { Message } from '../types';
import type { Assistant } from '../types/Assistant';

/**
 * 数据适配器类
 * 提供统一的数据访问接口，隔离底层存储实现
 */
export class DataAdapter {
  private debug: boolean = false;

  /**
   * 构造函数
   * @param enableDebug 是否启用调试日志
   */
  constructor(enableDebug: boolean = false) {
    this.debug = enableDebug;
  }

  /**
   * 设置是否启用调试日志
   * @param enable 是否启用
   */
  public setDebug(enable: boolean): void {
    this.debug = enable;
  }

  /**
   * 输出调试日志
   * @param message 日志消息
   * @param data 日志数据
   */
  private log(message: string, data?: any): void {
    if (this.debug) {
      console.log(`[DataAdapter] ${message}`, data ? data : '');
    }
  }

  /**
   * 获取所有话题
   * @returns 话题列表
   */
  public async getAllTopics(): Promise<ChatTopic[]> {
    this.log('获取所有话题');
    const topics = await getAllTopicsFromDB();
    this.log(`获取到 ${topics.length} 个话题`);
    return topics;
  }

  /**
   * 根据ID获取话题
   * @param id 话题ID
   * @returns 话题对象
   */
  public async getTopic(id: string): Promise<ChatTopic | null> {
    this.log(`获取话题: ${id}`);
    const topic = await getTopicFromDB(id);
    this.log('获取话题结果', topic);
    return topic || null;
  }

  /**
   * 保存话题
   * @param topic 话题对象
   * @returns 是否保存成功
   */
  public async saveTopic(topic: ChatTopic): Promise<boolean> {
    this.log('保存话题', topic);
    try {
      await saveTopicToDB(topic);
      this.log('话题保存成功');
      return true;
    } catch (error) {
      this.log('话题保存失败', error);
      return false;
    }
  }

  /**
   * 删除话题
   * @param id 话题ID
   * @returns 是否删除成功
   */
  public async deleteTopic(id: string): Promise<boolean> {
    this.log(`删除话题: ${id}`);
    try {
      await deleteTopicFromDB(id);
      this.log('话题删除成功');
      return true;
    } catch (error) {
      this.log('话题删除失败', error);
      return false;
    }
  }

  /**
   * 获取所有助手
   * @returns 助手列表
   */
  public async getAllAssistants(): Promise<Assistant[]> {
    this.log('获取所有助手');
    const assistants = await getAllAssistantsFromDB();
    this.log(`获取到 ${assistants.length} 个助手`);
    return assistants;
  }

  /**
   * 根据ID获取助手
   * @param id 助手ID
   * @returns 助手对象
   */
  public async getAssistant(id: string): Promise<Assistant | null> {
    this.log(`获取助手: ${id}`);
    const assistant = await getAssistantFromDB(id);
    this.log('获取助手结果', assistant);
    return assistant || null;
  }

  /**
   * 保存助手
   * @param assistant 助手对象
   * @returns 是否保存成功
   */
  public async saveAssistant(assistant: Assistant): Promise<boolean> {
    this.log('保存助手', assistant);
    try {
      await saveAssistantToDB(assistant);
      this.log('助手保存成功');
      return true;
    } catch (error) {
      this.log('助手保存失败', error);
      return false;
    }
  }

  /**
   * 删除助手
   * @param id 助手ID
   * @returns 是否删除成功
   */
  public async deleteAssistant(id: string): Promise<boolean> {
    this.log(`删除助手: ${id}`);
    try {
      await deleteAssistantFromDB(id);
      this.log('助手删除成功');
      return true;
    } catch (error) {
      this.log('助手删除失败', error);
      return false;
    }
  }

  /**
   * 查找并修复重复消息问题
   * @param topicId 话题ID（可选，如果不提供则检查所有话题）
   * @returns 修复结果：{fixed: 修复的消息数, total: 总消息数}
   */
  public async fixDuplicateMessages(topicId?: string): Promise<{fixed: number, total: number}> {
    this.log(`修复重复消息 ${topicId ? `话题ID: ${topicId}` : '所有话题'}`);
    
    let fixed = 0;
    let total = 0;
    
    try {
      // 获取需要处理的话题
      const topics = topicId 
        ? [await this.getTopic(topicId)].filter(Boolean) as ChatTopic[]
        : await this.getAllTopics();
      
      this.log(`开始处理 ${topics.length} 个话题`);
      
      // 遍历话题修复重复消息
      for (const topic of topics) {
        if (!topic.messages || !Array.isArray(topic.messages)) {
          topic.messages = [];
          await this.saveTopic(topic);
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
            message.id = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            hasChanges = true;
            fixed++;
          }
          
          // 如果ID已存在，生成一个新ID
          else if (messageIds.has(message.id)) {
            const originalId = message.id;
            message.id = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            this.log(`修复重复消息ID: ${originalId} -> ${message.id}`);
            hasChanges = true;
            fixed++;
          }
          
          messageIds.add(message.id);
          uniqueMessages.push(message);
        }
        
        // 如果有修改，保存话题
        if (hasChanges) {
          topic.messages = uniqueMessages;
          await this.saveTopic(topic);
          this.log(`话题 ${topic.id} 修复了 ${fixed} 条消息`);
        }
      }
      
      this.log(`修复完成: 总计 ${fixed} 条消息被修复，共 ${total} 条消息`);
      return { fixed, total };
      
    } catch (error) {
      this.log('修复重复消息失败', error);
      throw error;
    }
  }
} 