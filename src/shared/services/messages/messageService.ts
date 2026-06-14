import type { Message, ChatTopic, Model } from '../../types';
import { saveTopicToDB, getAllTopicsFromDB } from '../storage/storageService';
import store from '../../store';
import { newMessagesActions } from '../../store/slices/newMessagesSlice';
import { sendMessage as sendMessageThunk } from '../../store/thunks/messageThunk';
import { ApiProviderRegistry } from './ApiProvider';
import { getMainTextContent } from '../../utils/blockUtils';
import { estimateTokens } from '../../utils';
import { createLogger } from '../infra/logger';
import { parameterSyncService } from '../assistant/ParameterSyncService';
const logger = createLogger('messageService');

// 类似 Roo Code 的 TOKEN_BUFFER_PERCENTAGE
const TOKEN_BUFFER_PERCENTAGE = 0.1;

/**
 * 估算消息列表的 Token 数
 */
export function estimateMessagesTokenCount(messages: Message[]): number {
  let totalTokens = 0;
  for (const message of messages) {
    const content = getMainTextContent(message);
    if (content) {
      totalTokens += estimateTokens(content);
    }
  }
  return totalTokens;
}

/**
 * 滑动窗口截断（类似 Roo Code 的 truncateConversation）
 * 保留第一条消息，删除一定比例的中间消息
 * @param messages 消息列表
 * @param fracToRemove 要删除的消息比例（0-1）
 */
export function truncateConversation(messages: Message[], fracToRemove: number = 0.5): Message[] {
  if (messages.length <= 2) return messages;
  
  const firstMessage = messages[0];
  const rawMessagesToRemove = Math.floor((messages.length - 1) * fracToRemove);
  // 确保删除偶数条消息（保持对话成对）
  const messagesToRemove = rawMessagesToRemove - (rawMessagesToRemove % 2);
  const remainingMessages = messages.slice(messagesToRemove + 1);
  
  logger.debug(`滑动窗口截断: 删除 ${messagesToRemove} 条消息，保留 ${remainingMessages.length + 1} 条`);
  
  return [firstMessage, ...remainingMessages];
}

/**
 * 应用上下文限制到消息列表（类似 Roo Code 的 manageContext）
 * @param messages 消息列表
 * @param contextCount 上下文消息数量（轮数）
 * @param contextWindowSize 上下文窗口大小（Token 数），0 表示不限制
 * @param maxOutputTokens 保留给输出的 Token 数
 */
export function applyContextLimits(
  messages: Message[], 
  contextCount: number, 
  contextWindowSize: number = 0,
  maxOutputTokens: number = 8192
): Message[] {
  // 1. 首先应用消息轮数限制
  let limitedMessages = [...messages].slice(-contextCount);

  // 2. 查找最后一个clear类型的消息，只保留之后的消息
  let clearIndex = -1;
  for (let i = limitedMessages.length - 1; i >= 0; i--) {
    if (limitedMessages[i].type === 'clear') {
      clearIndex = i;
      break;
    }
  }
  if (clearIndex !== -1) {
    limitedMessages = limitedMessages.slice(clearIndex + 1);
  }

  // 3. 如果设置了上下文窗口大小，应用 Token 限制（类似 Roo Code）
  if (contextWindowSize > 0) {
    // 确保 maxOutputTokens 不超过窗口的 50%（类似 Roo Code 的限制）
    const effectiveMaxOutput = Math.min(maxOutputTokens, contextWindowSize * 0.5);
    const allowedTokens = contextWindowSize * (1 - TOKEN_BUFFER_PERCENTAGE) - effectiveMaxOutput;
    
    // 只有当 allowedTokens 为正数时才进行限制
    if (allowedTokens > 0) {
      let currentTokens = estimateMessagesTokenCount(limitedMessages);
      logger.debug(`Token 检查: ${currentTokens}/${allowedTokens} (窗口: ${contextWindowSize})`);
      
      // 如果超出限制，进行滑动窗口截断（最多尝试 10 次，避免无限循环）
      let attempts = 0;
      const maxAttempts = 10;
      while (currentTokens > allowedTokens && limitedMessages.length > 2 && attempts < maxAttempts) {
        const prevLength = limitedMessages.length;
        limitedMessages = truncateConversation(limitedMessages, 0.3);
        
        // 如果消息数没有减少，退出循环
        if (limitedMessages.length >= prevLength) {
          break;
        }
        
        currentTokens = estimateMessagesTokenCount(limitedMessages);
        logger.debug(`截断后 Token: ${currentTokens}/${allowedTokens}, 消息数: ${limitedMessages.length}`);
        attempts++;
      }
    }
  }

  return limitedMessages;
}

/**
 * 获取上下文设置
 */
export async function getContextSettings(): Promise<{ 
  contextCount: number; 
  contextWindowSize: number;
  maxOutputTokens: number;
}> {
  let contextCount = 20;        // 默认上下文数量，设置为20轮
  let contextWindowSize = 100000; // 默认上下文窗口大小，设置为10万 Token
  let maxOutputTokens = 8192;   // 默认最大输出 Token 数

  try {
    // 上下文窗口/消息数仅此一处存储，从 localStorage 读取即可（不存在多源分叉）
    const appSettingsJSON = localStorage.getItem('appSettings');
    if (appSettingsJSON) {
      const appSettings = JSON.parse(appSettingsJSON);
      if (appSettings.contextCount !== undefined) contextCount = appSettings.contextCount;
      if (appSettings.contextWindowSize !== undefined) contextWindowSize = appSettings.contextWindowSize;
    }
    // maxOutputTokens 必须与实际 API 请求同源（parameterSyncService），
    // 否则截断预留的输出空间与真正发送的 max_tokens 会不一致。
    await parameterSyncService.ensureInitialized();
    maxOutputTokens = parameterSyncService.getParameter('maxOutputTokens', 8192);
  } catch (error) {
    logger.error('读取上下文设置失败:', error);
  }

  // 最佳实例逻辑：如果contextCount为100，则视为无限制（100000）
  if (contextCount === 100) {
    contextCount = 100000;
  }

  return { contextCount, contextWindowSize, maxOutputTokens };
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
    logger.error('从数据库加载话题失败:', error);
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
    logger.error('保存话题到数据库失败:', error);
    return topics;
  }
}

// 创建统一的消息处理服务
export class MessageService {
  // 为向后兼容添加handleChatRequest方法
  static async handleChatRequest({
    messages,
    model
  }: {
    messages: Message[];
    model: Model;
  }): Promise<any> {
    try {
      // 获取上下文设置
      const { contextCount, contextWindowSize, maxOutputTokens } = await getContextSettings();

      // 应用上下文限制（同时考虑消息轮数和 Token 限制）
      const limitedMessages = applyContextLimits(messages, contextCount, contextWindowSize, maxOutputTokens);

      logger.debug(`消息数: ${limitedMessages.length}, 模型: ${model.id}, 窗口: ${contextWindowSize || '模型默认'}`);

      // 获取API提供商
      const apiProvider = ApiProviderRegistry.get(model);

      if (!apiProvider) {
        throw new Error(`无法获取API提供商: ${model.provider}`);
      }

      // handleChatRequest 是向后兼容方法，不需要流式更新
      const response = await apiProvider.sendChatMessage(limitedMessages, {});
      logger.debug(`API请求成功返回`);
      return response;
    } catch (error) {
      logger.error(`API请求失败:`, error);
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
      logger.error('发送消息失败:', errorMessage);

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