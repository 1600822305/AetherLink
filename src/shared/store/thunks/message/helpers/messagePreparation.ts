/**
 * 消息准备辅助函数
 */
import { dexieStorage } from '../../../../services/storage/DexieStorageService';
import type { Message } from '../../../../types/newMessage';
import { createLogger } from '../../../../services/infra/logger';

const logger = createLogger('prepareOriginalMessages');

/**
 * 准备原始消息（用于 Gemini provider）
 * @param topicId 话题ID
 * @param assistantMessage 助手消息
 * @param cachedMessages 可选：缓存的消息列表，避免重复查询数据库
 */
export async function prepareOriginalMessages(
  topicId: string,
  assistantMessage: Message,
  cachedMessages?: Message[]
): Promise<Message[]> {
  // 优先使用缓存的消息，避免重复查询
  const originalMessages = cachedMessages || await dexieStorage.getTopicMessages(topicId);
  if (cachedMessages) {
    logger.debug(`使用缓存的消息列表，消息数: ${originalMessages.length}`);
  }
  
  const sortedMessages = [...originalMessages].sort((a, b) =>
    new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  const assistantMessageTime = new Date(assistantMessage.createdAt).getTime();
  return sortedMessages.filter(message => {
    if (message.id === assistantMessage.id || message.role === 'system') {
      return false;
    }
    return new Date(message.createdAt).getTime() < assistantMessageTime;
  });
}

/**
 * 提取 Gemini 系统提示词
 */
export function extractGeminiSystemPrompt(apiMessages: any[]): string {
  const systemMessage = apiMessages.find((msg: any) => msg.role === 'system');
  const content = systemMessage?.content;
  return typeof content === 'string' ? content : '';
}
