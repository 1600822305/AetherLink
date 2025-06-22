import { applyContextLimits, getContextSettings } from './messageService';
import { dexieStorage } from '../storage/DexieStorageService';

/**
 * 消息上下文管理模块
 * 负责准备和管理聊天上下文
 */
export const MessageContext = {
  /**
   * 准备消息上下文
   * @param topicId 主题ID
   * @returns 消息数组和上下文设置
   */
  async prepare(topicId: string) {
    // 获取上下文设置
    const contextSettings = await getContextSettings();

    // 获取当前主题的所有消息
    // 直接从数据库获取消息
    const messages = await dexieStorage.getMessagesByTopicId(topicId) || [];

    // 应用上下文限制
    const limitedMessages = applyContextLimits(
      messages,
      contextSettings.contextLength,
      contextSettings.contextCount
    );

    console.log(`[MessageContext] 准备消息上下文 - 主题ID: ${topicId}, 原始消息数: ${messages.length}, 限制后: ${limitedMessages.length}`);

    return {
      messages: limitedMessages,
      contextSettings
    };
  },

  /**
   * 获取主题的最后一条用户消息
   * @param topicId 主题ID
   * @returns 最后一条用户消息，如果没有则返回undefined
   */
  async getLastUserMessage(topicId: string) {
    // 从数据库获取消息
    const messages = await dexieStorage.getMessagesByTopicId(topicId) || [];

    // 从后向前查找第一条用户消息
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'user') {
        return messages[i];
      }
    }

    return undefined;
  }
};

export default MessageContext;