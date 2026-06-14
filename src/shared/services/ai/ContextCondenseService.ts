/**
 * 上下文压缩服务
 * 参考 Roo-Code 实现，用于将冗长的对话历史智能压缩成精简摘要
 */

import { v4 as uuid } from 'uuid';
import { dexieStorage } from '../storage/DexieStorageService';
import type { Message, ContextSummaryMessageBlock } from '../../types/newMessage';
import { MessageBlockType, MessageBlockStatus } from '../../types/newMessage';
import { getMainTextContent } from '../../utils/blockUtils';
import store from '../../store';
import type { Model } from '../../types';
import { findModelInProviders } from '../../utils/modelUtils';
import { ApiProviderRegistry } from '../messages/ApiProvider';
import { newMessagesActions } from '../../store/slices/newMessagesSlice';
import { upsertOneBlock } from '../../store/slices/messageBlocksSlice';

import { createLogger } from '../infra/logger';

const logger = createLogger('ContextCondenseService');


// 常量配置
export const N_MESSAGES_TO_KEEP = 3; // 保留最后3条消息
export const MIN_CONDENSE_THRESHOLD = 5; // 最小触发阈值 5%
export const MAX_CONDENSE_THRESHOLD = 100; // 最大触发阈值 100%
export const DEFAULT_CONDENSE_THRESHOLD = 80; // 默认触发阈值 80%

// 默认压缩提示词（适用于通用聊天场景）
export const DEFAULT_CONDENSE_PROMPT = `你的任务是创建一个详细的对话摘要，帮助我在后续对话中快速回忆之前讨论的内容。
这个摘要应该全面捕捉对话的要点、用户的需求和偏好、以及重要的结论和共识。

请按以下结构组织你的摘要：

## 1. 对话主题
简要概述这次对话讨论的主要话题和目的。

## 2. 用户需求与背景
- 用户提出的主要问题或需求
- 用户的个人背景、偏好或约束条件（如有提及）
- 用户关心的重点

## 3. 讨论要点
按时间顺序或逻辑顺序列出对话中的重要内容：
- 讨论过的主要观点
- 提供的建议或方案
- 分享的信息或资源

## 4. 结论与共识
- 达成的结论或决定
- 用户接受或认可的方案
- 解决了的问题

## 5. 待跟进事项
- 尚未完成的任务（如有）
- 需要后续讨论的话题
- 用户的下一步计划

**注意事项**：
- 保留对话中的关键细节，如具体的名称、数字、日期等
- 如果对话涉及情感支持，注意保留用户的情绪状态和关切
- 保持客观中立，如实反映对话内容
- 只输出摘要，不要添加任何额外的评论

请直接输出摘要内容。`;

// 压缩响应类型
export interface CondenseResponse {
  messages: Message[]; // 压缩后的消息
  summary: string; // 摘要文本；如果没有摘要则为空字符串
  cost: number; // 压缩操作的成本
  newContextTokens?: number; // 下一次API请求的上下文token数
  error?: string; // 如果操作失败则填充：显示给用户的错误消息
  originalTokens?: number; // 原始token数
  compressedTokens?: number; // 压缩后token数
}

// 压缩设置类型
export interface CondenseSettings {
  enabled: boolean; // 是否启用自动压缩
  threshold: number; // 触发阈值百分比
  modelId?: string; // 用于压缩的模型ID（可选，使用更便宜的模型）
  customPrompt?: string; // 自定义压缩提示词
  useCurrentTopicModel?: boolean; // 是否使用当前话题的模型（优先于 modelId）
}

// 默认压缩设置
export const DEFAULT_CONDENSE_SETTINGS: CondenseSettings = {
  enabled: false,
  threshold: DEFAULT_CONDENSE_THRESHOLD,
  modelId: undefined,
  customPrompt: undefined,
  useCurrentTopicModel: true // 默认使用当前话题的模型
};

/**
 * 检查消息是否包含摘要标记
 */
export function isSummaryMessage(message: Message): boolean {
  return (message.metadata as any)?.isSummary === true;
}

/**
 * 获取自上次摘要以来的消息
 * 返回自上次摘要消息以来的所有消息，包括摘要本身
 * 如果没有摘要，则返回所有消息
 */
export function getMessagesSinceLastSummary(messages: Message[]): Message[] {
  // 反向查找最后一个摘要消息的索引
  let lastSummaryIndexReverse = [...messages].reverse().findIndex(msg => isSummaryMessage(msg));

  if (lastSummaryIndexReverse === -1) {
    return messages;
  }

  const lastSummaryIndex = messages.length - lastSummaryIndexReverse - 1;
  const messagesSinceSummary = messages.slice(lastSummaryIndex);

  // 确保第一条消息是用户消息（某些API要求）
  if (messagesSinceSummary.length > 0 && messagesSinceSummary[0].role !== 'user') {
    // 获取原始第一条消息（应该是包含任务的用户消息）
    const originalFirstMessage = messages[0];
    if (originalFirstMessage && originalFirstMessage.role === 'user') {
      // 使用原始第一条消息保持完整上下文
      return [originalFirstMessage, ...messagesSinceSummary];
    } else {
      // 如果没有原始第一条消息则使用后备消息（不应该发生）
      const userMessage: Message = {
        id: `fallback-${Date.now()}`,
        role: 'user',
        assistantId: messages[0]?.assistantId || '',
        topicId: messages[0]?.topicId || '',
        createdAt: new Date(Date.now() - 1).toISOString(),
        status: 'success' as any,
        blocks: [],
        metadata: { content: '请从以下摘要继续：' }
      };
      return [userMessage, ...messagesSinceSummary];
    }
  }

  return messagesSinceSummary;
}

/**
 * 获取需要保留的消息和需要保留的工具使用块
 */
export function getKeepMessages(
  messages: Message[],
  keepCount: number
): { keepMessages: Message[]; messagesToSummarize: Message[] } {
  if (messages.length <= keepCount) {
    return { keepMessages: messages, messagesToSummarize: [] };
  }

  const startIndex = messages.length - keepCount;
  const keepMessages = messages.slice(startIndex);
  const messagesToSummarize = getMessagesSinceLastSummary(messages.slice(0, -keepCount));

  return { keepMessages, messagesToSummarize };
}

/**
 * 估算消息的token数量
 * 简单估算：每4个字符约等于1个token
 */
export function estimateTokens(content: string): number {
  if (!content) return 0;
  // 中文字符每个约1.5个token，英文每4个字符约1个token
  const chineseCount = (content.match(/[\u4e00-\u9fa5]/g) || []).length;
  const otherCount = content.length - chineseCount;
  return Math.ceil(chineseCount * 1.5 + otherCount / 4);
}

/**
 * 估算消息数组的总token数
 */
export function estimateMessagesTokens(messages: Message[]): number {
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
 * 上下文压缩服务类
 */
export class ContextCondenseService {
  private static instance: ContextCondenseService;

  private constructor() {}

  public static getInstance(): ContextCondenseService {
    if (!ContextCondenseService.instance) {
      ContextCondenseService.instance = new ContextCondenseService();
    }
    return ContextCondenseService.instance;
  }

  /**
   * 获取压缩设置
   */
  getSettings(): CondenseSettings {
    const state = store.getState();
    return (state.settings as any).contextCondense || DEFAULT_CONDENSE_SETTINGS;
  }

  /**
   * 获取用于压缩的模型
   */
  getCondenseModel(): Model | null {
    const settings = this.getSettings();
    const state = store.getState();
    const providers = state.settings.providers;

    // 如果启用"使用当前话题的模型"，优先使用当前模型
    if (settings.useCurrentTopicModel !== false) { // 默认为 true
      const currentModelId = state.settings.currentModelId || state.settings.defaultModelId;
      if (currentModelId) {
        const result = findModelInProviders(providers, currentModelId, { includeDisabled: false });
        if (result) {
          return result.model;
        }
      }
    }

    // 如果指定了压缩模型，使用指定的模型
    if (settings.modelId) {
      const result = findModelInProviders(providers, settings.modelId, { includeDisabled: false });
      if (result) {
        return result.model;
      }
    }

    // 最后的备用方案：使用默认模型
    const defaultModelId = state.settings.currentModelId || state.settings.defaultModelId;
    if (defaultModelId) {
      const result = findModelInProviders(providers, defaultModelId, { includeDisabled: false });
      if (result) {
        return result.model;
      }
    }

    return null;
  }

  /**
   * 检查是否需要压缩
   * 使用基于 Token 的阈值检查
   */
  async shouldCondense(topicId: string): Promise<boolean> {
    const settings = this.getSettings();
    if (!settings.enabled) {
      return false;
    }

    const messages = await dexieStorage.getTopicMessages(topicId);
    if (messages.length <= N_MESSAGES_TO_KEEP + 1) {
      return false;
    }

    // 检查是否最近已经压缩过
    const keepMessages = messages.slice(-N_MESSAGES_TO_KEEP);
    const recentSummaryExists = keepMessages.some(msg => isSummaryMessage(msg));
    if (recentSummaryExists) {
      return false;
    }

    // 基于 Token 的阈值检查
    const model = this.getCondenseModel();
    if (!model) {
      // 如果没有模型，使用消息数量作为后备
      return messages.length > N_MESSAGES_TO_KEEP * 3;
    }

    // 获取模型的上下文窗口大小
    const contextWindow = model.maxTokens || 4096;
    const thresholdPercent = settings.threshold || DEFAULT_CONDENSE_THRESHOLD;
    const thresholdTokens = Math.floor(contextWindow * (thresholdPercent / 100));

    // 估算当前消息的 Token 数
    const currentTokens = estimateMessagesTokens(messages);
    
    logger.debug(`Token 检查: ${currentTokens}/${thresholdTokens} (${thresholdPercent}% of ${contextWindow})`);
    
    return currentTokens >= thresholdTokens;
  }

  /**
   * 压缩对话历史
   */
  async condenseConversation(
    topicId: string,
    options?: {
      isAutomatic?: boolean;
      customPrompt?: string;
    }
  ): Promise<CondenseResponse> {
    const messages = await dexieStorage.getTopicMessages(topicId);
    const response: CondenseResponse = { 
      messages, 
      cost: 0, 
      summary: '',
      originalTokens: estimateMessagesTokens(messages)
    };

    // 验证消息数量
    if (messages.length <= N_MESSAGES_TO_KEEP + 1) {
      return {
        ...response,
        error: '消息数量不足，无法压缩。至少需要 ' + (N_MESSAGES_TO_KEEP + 2) + ' 条消息。'
      };
    }

    // 保留第一条消息（通常包含初始任务指令）
    const firstMessage = messages[0];

    // 获取需要保留的消息和需要压缩的消息
    const { keepMessages, messagesToSummarize } = getKeepMessages(messages, N_MESSAGES_TO_KEEP);

    if (messagesToSummarize.length <= 1) {
      return {
        ...response,
        error: messages.length <= N_MESSAGES_TO_KEEP + 1
          ? '消息数量不足，无法压缩'
          : '最近已经压缩过，请稍后再试'
      };
    }

    // 检查保留的消息中是否有最近的摘要
    const recentSummaryExists = keepMessages.some(msg => isSummaryMessage(msg));
    if (recentSummaryExists) {
      return {
        ...response,
        error: '最近已经压缩过，请稍后再试'
      };
    }

    // 获取压缩设置
    const settings = this.getSettings();
    const promptToUse = options?.customPrompt?.trim() || settings.customPrompt?.trim() || DEFAULT_CONDENSE_PROMPT;

    // 构建要压缩的消息内容
    const conversationText = messagesToSummarize
      .map(msg => {
        const content = getMainTextContent(msg);
        const role = msg.role === 'user' ? '用户' : 'AI助手';
        return `${role}: ${content || '(无内容)'}`;
      })
      .join('\n\n');

    // 获取压缩模型
    const condenseModel = this.getCondenseModel();
    if (!condenseModel) {
      return {
        ...response,
        error: '未找到可用的压缩模型，请在设置中配置'
      };
    }

    try {
      // 调用API进行压缩
      const summary = await this.callCondenseAPI(
        promptToUse,
        conversationText,
        condenseModel
      );

      if (!summary || summary.trim().length === 0) {
        return {
          ...response,
          error: '压缩失败：未能生成有效摘要'
        };
      }

      const originalTokens = response.originalTokens || estimateMessagesTokens(messages);
      const compressedTokens = estimateTokens(summary) + estimateMessagesTokens([firstMessage, ...keepMessages]);
      const tokensSaved = originalTokens - compressedTokens;

      // 计算成本（基于模型定价）
      const cost = this.calculateCost(conversationText.length, summary.length, condenseModel);

      // 创建摘要块
      const summaryBlockId = uuid();
      const summaryMessageId = `summary-${Date.now()}`;
      
      const summaryBlock: ContextSummaryMessageBlock = {
        id: summaryBlockId,
        messageId: summaryMessageId,
        type: MessageBlockType.CONTEXT_SUMMARY,
        createdAt: new Date().toISOString(),
        status: MessageBlockStatus.SUCCESS,
        content: summary,
        originalMessageCount: messagesToSummarize.length,
        originalTokens,
        compressedTokens,
        tokensSaved,
        cost,
        compressedAt: new Date().toISOString(),
        modelId: condenseModel.id
      };

      // 创建摘要消息（放到列表底部，使用当前时间）
      const summaryMessage: Message = {
        id: summaryMessageId,
        role: 'assistant',
        assistantId: firstMessage.assistantId,
        topicId: topicId,
        createdAt: new Date().toISOString(),
        status: 'success' as any,
        blocks: [summaryBlockId],
        metadata: {
          isSummary: true,
          originalMessageCount: messagesToSummarize.length,
          compressedAt: new Date().toISOString()
        }
      };

      // 保存到数据库
      await this.saveCondensedMessages(topicId, firstMessage, summaryMessage, summaryBlock, keepMessages, messagesToSummarize);

      // 重组消息: [第一条消息, 摘要消息, 最后N条消息]
      const newMessages = [firstMessage, summaryMessage, ...keepMessages];

      // 更新 Redux 状态以刷新 UI（只在底部添加摘要消息）
      this.updateReduxState(topicId, summaryMessage, summaryBlock);

      return {
        messages: newMessages,
        summary,
        cost,
        originalTokens,
        compressedTokens,
        newContextTokens: compressedTokens
      };
    } catch (error) {
      logger.error('压缩失败:', error);
      return {
        ...response,
        error: `压缩失败: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * 调用API进行压缩
   */
  private async callCondenseAPI(
    prompt: string,
    conversationText: string,
    model: Model
  ): Promise<string> {
    logger.debug('准备调用压缩API');
    logger.debug('使用模型:', model.id);
    logger.debug('提示词长度:', prompt.length);
    logger.debug('对话内容长度:', conversationText.length);

    try {
      // 构建用于压缩的消息
      // 注意：API Provider 从 message.content 读取内容，不是 metadata.content
      const systemMessage: Message = {
        id: `condense-system-${Date.now()}`,
        role: 'system',
        assistantId: '',
        topicId: '',
        createdAt: new Date().toISOString(),
        status: 'success' as any,
        blocks: [],
        content: prompt  // 直接设置 content 字段，API Provider 会读取这个字段
      } as Message & { content: string };

      const userMessage: Message = {
        id: `condense-user-${Date.now()}`,
        role: 'user',
        assistantId: '',
        topicId: '',
        createdAt: new Date().toISOString(),
        status: 'success' as any,
        blocks: [],
        content: `请对以下对话历史进行压缩总结：\n\n${conversationText}`  // 直接设置 content 字段
      } as Message & { content: string };

      // 获取API提供商
      const apiProvider = ApiProviderRegistry.get(model);
      
      // 收集响应内容
      let responseContent = '';
      
      const result = await apiProvider.sendChatMessage(
        [systemMessage, userMessage],
        {
          enableWebSearch: false,
          enableTools: false
        }
      );

      // 处理响应
      if (typeof result === 'string') {
        responseContent = result;
      } else if (result && typeof result === 'object' && 'content' in result) {
        responseContent = (result as any).content;
      }

      if (!responseContent || responseContent.trim().length === 0) {
        throw new Error('API返回空响应');
      }

      logger.debug('压缩完成，摘要长度:', responseContent.length);
      return responseContent;

    } catch (error) {
      logger.error('API调用失败:', error);
      throw error;
    }
  }

  /**
   * 保存压缩后的消息到数据库
   */
  private async saveCondensedMessages(
    topicId: string,
    firstMessage: Message,
    summaryMessage: Message,
    summaryBlock: ContextSummaryMessageBlock,
    keepMessages: Message[],
    messagesToRemove: Message[]
  ): Promise<void> {
    logger.debug(`开始保存压缩后的消息...`);
    
    try {
      // 1. 保存摘要块到数据库
      await dexieStorage.saveMessageBlock(summaryBlock);
      logger.debug(`已保存摘要块: ${summaryBlock.id}`);

      // 2. 保存摘要消息到数据库
      await dexieStorage.saveMessage(summaryMessage);
      logger.debug(`已保存摘要消息: ${summaryMessage.id}`);

      // 3. 删除被压缩的消息（不包括第一条消息）
      for (const msg of messagesToRemove) {
        if (msg.id !== firstMessage.id) {
          // 删除消息的块
          if (msg.blocks && msg.blocks.length > 0) {
            for (const blockId of msg.blocks) {
              await dexieStorage.deleteMessageBlock(blockId);
            }
          }
          // 删除消息
          await dexieStorage.deleteMessage(msg.id);
        }
      }
      logger.debug(`已删除 ${messagesToRemove.length - 1} 条被压缩的消息`);

      // 4. 更新 topic 的 messageIds
      const topic = await dexieStorage.getTopic(topicId);
      if (topic) {
        // 新的消息ID列表: [第一条消息, 摘要消息, 保留的消息...]
        const newMessageIds = [
          firstMessage.id,
          summaryMessage.id,
          ...keepMessages.map(m => m.id)
        ];
        
        topic.messageIds = newMessageIds;
        topic.lastMessageTime = new Date().toISOString();
        
        // 更新 topic.messages 字段（兼容旧格式）
        const allMessages = [firstMessage, summaryMessage, ...keepMessages];
        topic.messages = allMessages;
        
        await dexieStorage.saveTopic(topic);
        logger.debug(`已更新话题 ${topicId} 的消息列表`);
      }

      logger.debug(`压缩后消息保存完成`);
    } catch (error) {
      logger.error('保存压缩消息失败:', error);
      throw error;
    }
  }

  /**
   * 更新 Redux 状态以刷新 UI
   * 简化版：只在消息列表底部添加摘要消息
   */
  private updateReduxState(
    topicId: string,
    summaryMessage: Message,
    summaryBlock: ContextSummaryMessageBlock
  ): void {
    logger.debug(`更新 Redux 状态...`);
    
    try {
      // 1. 添加摘要块到 Redux
      store.dispatch(upsertOneBlock(summaryBlock));
      logger.debug(`已添加摘要块: ${summaryBlock.id}`);

      // 2. 添加摘要消息到消息列表底部
      store.dispatch(newMessagesActions.addMessage({
        topicId,
        message: summaryMessage
      }));
      logger.debug(`已添加摘要消息: ${summaryMessage.id}`);

      logger.debug(`Redux 状态更新完成`);
    } catch (error) {
      logger.error('更新 Redux 状态失败:', error);
    }
  }

  /**
   * 计算压缩成本
   * 基于输入输出 Token 数和模型定价
   */
  private calculateCost(inputLength: number, outputLength: number, model: Model): number {
    // 估算 Token 数
    const inputTokens = estimateTokens(inputLength.toString());
    const outputTokens = estimateTokens(outputLength.toString());

    // 获取模型定价（每 1M tokens 的价格）
    // 如果模型没有定价信息，使用默认值
    const inputPricePerMillion = (model as any).inputPrice || 0.5; // 默认 $0.5/1M tokens
    const outputPricePerMillion = (model as any).outputPrice || 1.5; // 默认 $1.5/1M tokens

    // 计算成本
    const inputCost = (inputTokens / 1000000) * inputPricePerMillion;
    const outputCost = (outputTokens / 1000000) * outputPricePerMillion;

    return inputCost + outputCost;
  }

  /**
   * 手动触发压缩
   */
  async manualCondense(topicId: string): Promise<CondenseResponse> {
    return this.condenseConversation(topicId, { isAutomatic: false });
  }

  /**
   * 自动触发压缩（如果满足条件）
   */
  async autoCondenseIfNeeded(topicId: string): Promise<CondenseResponse | null> {
    const shouldCondense = await this.shouldCondense(topicId);
    if (!shouldCondense) {
      return null;
    }
    return this.condenseConversation(topicId, { isAutomatic: true });
  }
}

// 导出单例实例
export const contextCondenseService = ContextCondenseService.getInstance();