import { v4 as uuidv4 } from 'uuid';
import { approximateTokenSize } from 'tokenx';

/**
 * 生成UUID - 用于重要实体（话题、助手、消息等）
 * @returns {string} UUID
 */
export const uuid = (): string => uuidv4();

/**
 * 生成唯一ID - 用于一般场景
 * @returns {string} 唯一ID
 */
export const generateId = (): string => {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
};

/**
 * 生成短唯一ID - 用于临时或短期使用的ID
 * @returns {string} 短唯一ID
 */
export const nanoid = (): string => {
  return Math.random().toString(36).substring(2, 10);
};

/**
 * 生成消息ID - 专门用于消息
 * @returns {string} 消息ID
 */
export const generateMessageId = (): string => {
  return uuid(); // 消息使用UUID确保全局唯一
};

/**
 * 生成块ID - 专门用于消息块
 * @param prefix 可选前缀
 * @returns {string} 块ID
 */
export const generateBlockId = (prefix: string = 'block'): string => {
  return `${prefix}-${Date.now()}-${nanoid()}`;
};

/**
 * 生成版本ID - 专门用于版本管理
 * @returns {string} 版本ID
 */
export const generateVersionId = (): string => {
  return uuid(); // 版本使用UUID确保全局唯一
};

/**
 * 检查是否是合法的URL
 * @param {string} url - 要检查的URL字符串
 * @returns {boolean} 是否是合法的URL
 */
export const isValidUrl = (url: string): boolean => {
  try {
    new URL(url);
    return true;
  } catch (error) {
    return false;
  }
};

// 格式化日期
export function formatDate(date: Date): string {
  return date.toISOString();
}

/**
 * 格式化日期时间为对话标题格式
 * @param date 日期对象
 * @returns 格式化后的日期时间字符串，如"05-20 15:30"
 */
export function formatDateForTopicTitle(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');

  return `${month}-${day} ${hours}:${minutes}`;
}

// 创建新主题
export function createTopic(title: string): any {
  const now = new Date();
  // 如果没有提供标题，使用带时间的默认标题
  const topicTitle = title || `新的对话 ${formatDateForTopicTitle(now)}`;
  return {
    id: uuid(),
    title: topicTitle,
    lastMessageTime: formatDate(now),
    messageIds: [], // 使用新消息系统
  };
}

/**
 * 获取模型的API ID
 * @param model 模型对象
 * @returns 用于API调用的正确模型ID
 */
export function getApiModelId(model: any): string {
  if (!model) return '';

  // 首先尝试使用预设模型ID
  if (model.presetModelId) {
    return model.presetModelId;
  }

  // 直接使用模型ID，不进行复杂匹配
  // 这样可以确保传递原始模型ID到API
  if (model.id) {
    return model.id;
  }

  // 如果没有ID，尝试使用name
  if (model.name) {
    return model.name;
  }

  return '';
}

/**
 * 计算文本的token数量
 * @param text 文本内容
 * @returns token数量
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  try {
    return approximateTokenSize(text);
  } catch (error) {
    console.error('计算token失败:', error);
    // 简单估算：英文大概每4个字符一个token，中文每个字符约是一个token
    const chineseCount = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
    const otherCount = text.length - chineseCount;
    return chineseCount + Math.ceil(otherCount / 4);
  }
}
