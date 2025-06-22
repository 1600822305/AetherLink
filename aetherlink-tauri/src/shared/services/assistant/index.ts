export * from './AssistantManager';
export * from './TopicManager';
export * from './Factory';
export * from './types';

// 导出统一的助手服务
import { AssistantManager } from './AssistantManager';
import { TopicManager } from './TopicManager';
import { AssistantFactory } from './Factory';
import type { Assistant, ChatTopic } from '../../types/Assistant';
import { dexieStorage } from '../storage/DexieStorageService';
import { uuid } from '../../utils';
import { getDefaultTopic } from './types';
import { DEFAULT_SYSTEM_PROMPT } from '../../config/prompts';

// 移除DataService引用
// import { DataService } from '../DataService';
// const dataService = DataService.getInstance();

/**
 * 统一的助手服务类 - 提供所有助手相关的功能
 * 这是应用程序中应该使用的主要接口
 */
export class AssistantService {
  // 核心助手管理
  static getUserAssistants = AssistantManager.getUserAssistants;
  static getCurrentAssistant = AssistantManager.getCurrentAssistant;
  static setCurrentAssistant = AssistantManager.setCurrentAssistant;
  static addAssistant = AssistantManager.addAssistant;
  static updateAssistant = AssistantManager.updateAssistant;
  static deleteAssistant = AssistantManager.deleteAssistant;

  // 话题关联管理
  static addTopicToAssistant = TopicManager.addTopicToAssistant;
  static removeTopicFromAssistant = TopicManager.removeTopicFromAssistant;
  static getAssistantTopics = TopicManager.getAssistantTopics;
  static clearAssistantTopics = TopicManager.clearAssistantTopics;
  static ensureAssistantHasTopic = TopicManager.ensureAssistantHasTopic;
  static getDefaultTopic = TopicManager.getDefaultTopic;
  static validateAndFixAssistantTopicReferences = TopicManager.validateAndFixAssistantTopicReferences;
  static validateAndFixAllAssistantsTopicReferences = TopicManager.validateAndFixAllAssistantsTopicReferences;

  // 助手工厂
  static initializeDefaultAssistants = AssistantFactory.initializeDefaultAssistants;
  static createAssistant = AssistantFactory.createAssistant;

  /**
   * 创建新助手并完成所有相关设置
   * 该方法是创建助手的统一入口点，所有组件应该使用此方法
   * @param assistantData 助手基本数据
   * @returns 创建的助手对象，如果创建失败则返回null
   */
  static async createNewAssistant(
    assistantData: Partial<Assistant>
  ): Promise<Assistant | null> {
    try {
      console.log('AssistantService: 开始创建新助手', assistantData.name);

      // 创建助手ID
      const assistantId = uuid();

      // 创建默认话题
      const topic = getDefaultTopic(assistantId);

      // 创建助手对象
      const newAssistant: Assistant = {
        ...assistantData,
        id: assistantId,
        name: assistantData.name || '新助手',
        emoji: assistantData.emoji || '😀',
        topicIds: [topic.id], // 只使用新的消息系统
        topics: [], // 添加空的topics数组
        type: 'assistant',
        isSystem: false,
        systemPrompt: assistantData.systemPrompt || DEFAULT_SYSTEM_PROMPT
      };

      // 保存话题到数据库
      await dexieStorage.saveTopic(topic);

      // 保存助手到数据库
      const success = await AssistantManager.addAssistant(newAssistant);
      if (!success) {
        console.error('AssistantService: 保存助手失败');
        return null;
      }

      // 添加助手消息到话题
      await TopicManager.addAssistantMessagesToTopic({ assistant: newAssistant, topic });

      // 派发助手创建事件
      const event = new CustomEvent('assistantCreated', {
        detail: { assistant: newAssistant }
      });
      window.dispatchEvent(event);

      return newAssistant;
    } catch (error) {
      const errorMessage = error instanceof Error
        ? `${error.name}: ${error.message}`
        : String(error);
      console.error(`AssistantService: 创建助手时出错: ${errorMessage}`);
      return null;
    }
  }

  /**
   * 订阅助手事件
   * @param eventType 事件类型
   * @param callback 回调函数
   */
  static subscribeToAssistantEvents(eventType: string, callback: EventListener): () => void {
    return AssistantManager.subscribeToAssistantEvents(eventType, callback);
  }

  /**
   * 向话题添加助手的初始消息
   */
  static async addAssistantMessagesToTopic({ assistant, topic }: { assistant: Assistant; topic: ChatTopic }): Promise<void> {
    return TopicManager.addAssistantMessagesToTopic({ assistant, topic });
  }
}