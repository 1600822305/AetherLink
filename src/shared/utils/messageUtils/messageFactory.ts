import { v4 as uuid } from 'uuid';
import type {
  Message,
  MessageBlock,
  MainTextMessageBlock
} from '../../types/newMessage';
import {
  MessageBlockType,
  MessageBlockStatus,
  AssistantMessageStatus,
  UserMessageStatus
} from '../../types/newMessage';
import type { Model, FileType } from '../../types';
import { FileTypes } from '../fileUtils';
import { createImageBlock, createVideoBlock, createFileBlock } from './blockFactory';
import { guessImageMimeType } from './utilityFunctions';

/**
 * 创建用户消息
 */
export function createUserMessage(options: {
  content: string;
  assistantId: string;
  topicId: string;
  modelId?: string;
  model?: Model;
  images?: Array<{ url: string }>;
  files?: FileType[];
}): { message: Message; blocks: MessageBlock[] } {
  const { content, assistantId, topicId, modelId, model, images, files } = options;
  const messageId = uuid();
  const now = new Date().toISOString();

  // 创建主文本块
  const mainTextBlock: MainTextMessageBlock = {
    id: uuid(),
    messageId,
    type: MessageBlockType.MAIN_TEXT,
    content,
    createdAt: now,
    status: MessageBlockStatus.SUCCESS
  };

  // 创建消息对象
  const message: Message = {
    id: messageId,
    role: 'user',
    assistantId,
    topicId,
    createdAt: now,
    status: UserMessageStatus.SUCCESS,
    modelId,
    model,
    blocks: [mainTextBlock.id]
  };

  const blocks: MessageBlock[] = [mainTextBlock];

  // 处理图片
  if (images && Array.isArray(images) && images.length > 0) {
    for (const image of images) {
      if (image.url) {
        const imageBlock = createImageBlock(messageId, {
          url: image.url,
          mimeType: guessImageMimeType(image.url)
        });
        blocks.push(imageBlock);
        message.blocks.push(imageBlock.id);
      }
    }
  }

  // 处理文件
  if (files && Array.isArray(files) && files.length > 0) {
    for (const file of files) {
      if (file.type === FileTypes.IMAGE) {
        const imageBlock = createImageBlock(messageId, {
          file,
          url: file.base64Data ? `data:${file.mimeType};base64,${file.base64Data}` : '',
          mimeType: file.mimeType || 'image/jpeg'
        });
        blocks.push(imageBlock);
        message.blocks.push(imageBlock.id);
      } else if (file.type === FileTypes.VIDEO) {
        const videoBlock = createVideoBlock(messageId, {
          file,
          url: file.base64Data ? `data:${file.mimeType};base64,${file.base64Data}` : '',
          mimeType: file.mimeType || 'video/mp4'
        });
        blocks.push(videoBlock);
        message.blocks.push(videoBlock.id);
      } else {
        const fileBlock = createFileBlock(messageId, file);
        blocks.push(fileBlock);
        message.blocks.push(fileBlock.id);
      }
    }
  }

  return { message, blocks };
}

/**
 * 创建助手消息
 */
export function createAssistantMessage(options: {
  assistantId: string;
  topicId: string;
  modelId?: string;
  model?: Model;
  askId?: string;
  initialContent?: string;
  status?: AssistantMessageStatus;
}): { message: Message; blocks: MessageBlock[] } {
  const { assistantId, topicId, modelId, model, askId, initialContent = '', status = AssistantMessageStatus.SUCCESS } = options;
  const messageId = uuid();
  const now = new Date().toISOString();

  // 根据消息状态确定块状态
  let blockStatus: MessageBlockStatus = MessageBlockStatus.SUCCESS;
  if (status === AssistantMessageStatus.PENDING || status === AssistantMessageStatus.PROCESSING) {
    blockStatus = MessageBlockStatus.PROCESSING as MessageBlockStatus;
  } else if (status === AssistantMessageStatus.STREAMING) {
    blockStatus = MessageBlockStatus.STREAMING as MessageBlockStatus;
  } else if (status === AssistantMessageStatus.ERROR) {
    blockStatus = MessageBlockStatus.ERROR as MessageBlockStatus;
  } else if (status === AssistantMessageStatus.SEARCHING) {
    blockStatus = MessageBlockStatus.PROCESSING as MessageBlockStatus;
  }

  // 创建主文本块
  const mainTextBlock: MainTextMessageBlock = {
    id: uuid(),
    messageId,
    type: MessageBlockType.MAIN_TEXT,
    content: initialContent,
    createdAt: now,
    status: blockStatus
  };

  // 创建消息对象
  const message: Message = {
    id: messageId,
    role: 'assistant',
    assistantId,
    topicId,
    createdAt: now,
    status,
    modelId,
    model,
    askId,
    blocks: [mainTextBlock.id]
  };

  return { message, blocks: [mainTextBlock] };
}

/**
 * 创建系统消息
 */
export function createSystemMessage(options: {
  content: string;
  assistantId: string;
  topicId: string;
}): { message: Message; blocks: MessageBlock[] } {
  const { content, assistantId, topicId } = options;
  const messageId = uuid();
  const now = new Date().toISOString();

  // 创建主文本块
  const mainTextBlock: MainTextMessageBlock = {
    id: uuid(),
    messageId,
    type: MessageBlockType.MAIN_TEXT,
    content,
    createdAt: now,
    status: MessageBlockStatus.SUCCESS
  };

  // 创建消息对象
  const message: Message = {
    id: messageId,
    role: 'system',
    assistantId,
    topicId,
    createdAt: now,
    status: AssistantMessageStatus.SUCCESS,
    blocks: [mainTextBlock.id]
  };

  return { message, blocks: [mainTextBlock] };
}

/**
 * 统一创建消息函数
 */
export function createMessage(options: {
  role: 'user' | 'assistant' | 'system';
  content?: string;
  topicId: string;
  assistantId: string;
  modelId?: string;
  model?: Model;
  askId?: string;
}): { message: Message; blocks: MessageBlock[] } {
  const {
    role,
    content = '',
    topicId,
    assistantId,
    modelId,
    model,
    askId
  } = options;

  if (role === 'user') {
    return createUserMessage({
      content,
      assistantId,
      topicId,
      modelId,
      model
    });
  } else if (role === 'assistant') {
    return createAssistantMessage({
      assistantId,
      topicId,
      modelId,
      model,
      askId,
      initialContent: content
    });
  } else {
    return createSystemMessage({
      content,
      assistantId,
      topicId
    });
  }
}

/**
 * 重置助手消息
 */
export function resetAssistantMessage(
  originalMessage: Message,
  updates?: Partial<Pick<Message, 'status' | 'updatedAt' | 'model' | 'modelId'>>
): Message {
  if (originalMessage.role !== 'assistant') {
    console.warn(
      `[resetAssistantMessage] 尝试重置非助手消息 (ID: ${originalMessage.id}, Role: ${originalMessage.role})。返回原始消息。`
    );
    return originalMessage;
  }

  return {
    id: originalMessage.id,
    topicId: originalMessage.topicId,
    askId: originalMessage.askId,
    role: 'assistant',
    assistantId: originalMessage.assistantId,
    model: originalMessage.model,
    modelId: originalMessage.modelId,
    blocks: [],
    status: AssistantMessageStatus.PENDING,
    createdAt: originalMessage.createdAt,
    updatedAt: new Date().toISOString(),
    ...updates
  };
}
