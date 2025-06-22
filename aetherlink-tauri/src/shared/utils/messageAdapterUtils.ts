// messageAdapterUtils.ts - 消息状态适配工具
import type { Message } from '../types/newMessage.ts';
import { UserMessageStatus, AssistantMessageStatus, MessageBlockStatus } from '../types/newMessage.ts';
import { getMainTextContent, findImageBlocks } from './messageUtils';

// API消息类型接口
export interface APICompatibleMessage {
  id: string; 
  role: 'user' | 'assistant' | 'system';
  content: string | { text?: string; images?: any[] };
  timestamp: string;
  images?: any[];
  // 可选的其他字段
  status?: string;
  modelId?: string;
  reasoning?: string;
}

/**
 * 将新消息格式适配为API兼容格式
 * @param message 消息对象
 * @returns API兼容的消息格式
 */
export function adaptToAPIMessage(message: Message): APICompatibleMessage {
  // 从块系统中获取文本内容
  const textContent = getMainTextContent(message);
  
  // 获取图片块
  const imageBlocks = findImageBlocks(message);
  
  // 构建API兼容消息
  const apiMessage: APICompatibleMessage = {
    id: message.id,
    role: message.role,
    timestamp: message.createdAt || new Date().toISOString(),
    modelId: message.modelId,
    content: textContent // 默认使用文本内容
  };
  
  // 处理图片
  if (imageBlocks.length > 0) {
    apiMessage.content = {
      text: textContent,
      images: imageBlocks.map(block => ({
        url: block.url,
        base64Data: block.base64Data,
        mimeType: block.mimeType,
        width: block.width,
        height: block.height,
        size: block.size
      }))
    };
  }
  
  return apiMessage;
}

/**
 * 将消息块状态适配为消息状态
 * @param blockStatus 块状态
 * @param role 消息角色
 * @returns 消息状态
 */
export const adaptBlockStatusToMessageStatus = (
  blockStatus: MessageBlockStatus,
  role: 'user' | 'assistant' | 'system'
): UserMessageStatus | AssistantMessageStatus => {
  if (role === 'user') {
    switch (blockStatus) {
      case MessageBlockStatus.PENDING:
      case MessageBlockStatus.PROCESSING:
        return UserMessageStatus.SENDING;
      case MessageBlockStatus.SUCCESS:
        return UserMessageStatus.SUCCESS;
      case MessageBlockStatus.ERROR:
        return UserMessageStatus.ERROR;
      default:
        return UserMessageStatus.SUCCESS;
    }
  } else {
    switch (blockStatus) {
      case MessageBlockStatus.PENDING:
      case MessageBlockStatus.PROCESSING:
        return AssistantMessageStatus.PENDING;
      case MessageBlockStatus.STREAMING:
        return AssistantMessageStatus.STREAMING;
      case MessageBlockStatus.SUCCESS:
        return AssistantMessageStatus.SUCCESS;
      case MessageBlockStatus.ERROR:
        return AssistantMessageStatus.ERROR;
      case MessageBlockStatus.PAUSED:
        return AssistantMessageStatus.PAUSED;
      default:
        return AssistantMessageStatus.PENDING;
    }
  }
};

/**
 * 将消息内容更新适配为块更新
 */
export function adaptContentUpdate(): Partial<Message> {
  // 返回更新对象，而不是直接更新块
  return {
    updatedAt: new Date().toISOString()
    // 块更新应通过块API进行
  };
} 