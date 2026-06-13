/**
 * 助手信息获取辅助函数
 */
import { dexieStorage } from '../../../../services/storage/DexieStorageService';
import { createLogger } from '../../../../services/infra/logger';

const logger = createLogger('processAssistantResponse');

/**
 * 获取助手信息
 */
export async function fetchAssistantInfo(topicId: string): Promise<any> {
  try {
    const topic = await dexieStorage.getTopic(topicId);
    if (topic?.assistantId) {
      const assistant = await dexieStorage.getAssistant(topic.assistantId);
      logger.debug(`获取到助手信息:`, {
        id: assistant?.id,
        name: assistant?.name,
        temperature: assistant?.temperature,
        topP: assistant?.topP,
        maxTokens: assistant?.maxTokens,
        model: assistant?.model
      });
      return assistant;
    }
  } catch (error) {
    logger.error('获取助手信息失败:', error);
  }
  return null;
}
