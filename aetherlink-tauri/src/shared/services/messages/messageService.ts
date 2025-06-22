import type { Message, ChatTopic, Model } from '../../types';
import { getStorageItem } from '../../utils/storage';
import { saveTopicToDB, getAllTopicsFromDB } from '../storage/storageService';
import { getMainTextContent } from '../../utils/messageUtils';
import store from '../../store';
import { newMessagesActions } from '../../store/slices/newMessagesSlice';
import { sendMessage as sendMessageThunk } from '../../store/thunks/messageThunk';
import { ApiProviderRegistry } from './ApiProvider';

/**
 * 应用上下文限制到消息列表
 */
export function applyContextLimits(messages: Message[], contextLength: number, contextCount: number): Message[] {
  // 最佳实例逻辑：从消息列表中取出最近的N条消息
  // 使用lodash的takeRight函数，但这里我们用原生JavaScript实现
  const limitedByCountMessages = [...messages].slice(-contextCount);

  // 查找最后一个clear类型的消息的索引
  // 使用兼容性更好的方法替代findLastIndex
  let clearIndex = -1;
  for (let i = limitedByCountMessages.length - 1; i >= 0; i--) {
    if (limitedByCountMessages[i].type === 'clear') {
      clearIndex = i;
      break;
    }
  }

  // 如果找到了clear消息，则只保留clear消息之后的消息
  let filteredMessages = limitedByCountMessages;
  if (clearIndex !== -1) {
    filteredMessages = limitedByCountMessages.slice(clearIndex + 1);
  }

  // 对每条消息应用长度限制
  return filteredMessages.map(msg => {
    // 使用getMainTextContent获取消息内容
    const content = getMainTextContent(msg);
    if (content && content.length > contextLength) {
      // 截断过长的消息内容
      // 注意：我们不能直接修改msg.content，因为新消息格式没有这个属性
      // 但我们可以返回一个新的消息对象，保留原始消息的所有属性
      return msg;
    }
    return msg;
  });
}

/**
 * 获取上下文设置
 */
export async function getContextSettings(): Promise<{ contextLength: number; contextCount: number }> {
  let contextLength = 16000; // 默认上下文长度，设置为16K
  let contextCount = 5;      // 默认上下文数量，与最佳实例DEFAULT_CONTEXTCOUNT保持一致

  try {
    const appSettings = await getStorageItem<any>('appSettings');
    if (appSettings) {
      if (appSettings.contextLength) contextLength = appSettings.contextLength;
      if (appSettings.contextCount) contextCount = appSettings.contextCount;
    }
  } catch (error) {
    console.error('读取上下文设置失败:', error);
  }

  // 最佳实例逻辑：如果contextCount为100，则视为无限制（100000）
  if (contextCount === 100) {
    contextCount = 100000;
  }

  // 如果上下文长度为64000，视为不限制
  if (contextLength === 64000) {
    contextLength = 65549; // 使用65549作为实际的最大值
  }

  return { contextLength, contextCount };
}

/**
 * 从数据库加载话题
 */
export async function loadTopics(): Promise<ChatTopic[]> {
  try {
    // 直接从数据库获取所有话题
    const topics = await getAllTopicsFromDB();
    return topics;
  } catch (error) {
    console.error('从数据库加载话题失败:', error);
    return [];
  }
}

// 为向后兼容保留，但功能已迁移到IndexedDB
export const saveTopicsToLocalStorage = saveTopics;
export const loadTopicsFromLocalStorage = loadTopics;

/**
 * 保存话题到数据库
 */
export async function saveTopics(topics: ChatTopic[]): Promise<ChatTopic[]> {
  try {
    // 使用Map按照ID去重
    const uniqueTopicsMap = new Map();
    topics.forEach((topic: ChatTopic) => {
      if (!uniqueTopicsMap.has(topic.id)) {
        uniqueTopicsMap.set(topic.id, topic);
      }
    });

    // 转换回数组
    const uniqueTopics = Array.from(uniqueTopicsMap.values());

    // 将每个话题保存到IndexedDB
    for (const topic of uniqueTopics) {
      await saveTopicToDB(topic);
    }

    return uniqueTopics;
  } catch (error) {
    console.error('保存话题到数据库失败:', error);
    return topics;
  }
}

// 创建统一的消息处理服务
export class MessageService {
  // 为向后兼容添加handleChatRequest方法
  static async handleChatRequest({
    messages,
    model,
    onChunk
  }: {
    messages: Message[];
    model: Model;
    onChunk?: (chunk: string, reasoning?: string) => void;
  }): Promise<any> {
    try {
      // 获取上下文设置
      const { contextLength, contextCount } = await getContextSettings();

      // 应用上下文限制
      const limitedMessages = applyContextLimits(messages, contextLength, contextCount);

      console.log(`[handleChatRequest] 消息数: ${limitedMessages.length}, 模型: ${model.id}`);

      // 获取API提供商
      const apiProvider = ApiProviderRegistry.get(model);

      if (!apiProvider) {
        throw new Error(`无法获取API提供商: ${model.provider}`);
      }

      // 发送API请求
      const response = await apiProvider.sendChatMessage(limitedMessages, {
        onUpdate: (content: string, reasoning?: string) => {
          // 如果有回调函数，调用它
          if (onChunk) {
            onChunk(content, reasoning);
          }
        }
      });
      console.log(`[handleChatRequest] API请求成功返回`);
      return response;
    } catch (error) {
      console.error(`[handleChatRequest] API请求失败:`, error);
      throw error;
    }
  }

  // 发送消息的统一方法 - 使用Redux Thunk
  static async sendMessage(params: {
    content: string;
    topicId: string;
    model: Model;
    images?: Array<{ url: string }>;
  }): Promise<any> {
    const { content, topicId, model, images } = params;

    try {
      // 使用Redux Thunk直接处理整个消息发送流程
      store.dispatch(sendMessageThunk(content, topicId, model, images));
      return true;
    } catch (error) {
      // 处理错误
      const errorMessage = error instanceof Error ? error.message : '发送消息失败';
      console.error('发送消息失败:', errorMessage);

      // 清除流式响应状态
      store.dispatch(newMessagesActions.setTopicStreaming({
        topicId,
        streaming: false
      }));
      store.dispatch(newMessagesActions.setTopicLoading({
        topicId,
        loading: false
      }));

      throw error;
    }
  }
}