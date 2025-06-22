// chatboxaiJsonParser.ts
import { v4 as uuidv4 } from 'uuid';
import type { MessageBlock } from '../../../../../../shared/types/newMessage';

/**
 * ChatboxAI 消息内容部分
 */
export interface ChatboxaiMessageContentPart {
  type: 'text' | 'image' | 'tool-call';
  text?: string;
  storageKey?: string;
  url?: string;
  toolCallId?: string;
  toolName?: string;
  args?: any;
  result?: any;
}

/**
 * ChatboxAI 消息结构
 */
export interface ChatboxaiMessage {
  id: string;
  role: 'system' | 'user' | 'assistant' | 'tool';
  contentParts: ChatboxaiMessageContentPart[];
  content?: string; // 兼容老版本
  timestamp?: number;
  wordCount?: number;
  tokenCount?: number;
  tokensUsed?: number;
  firstTokenLatency?: number;
  generating?: boolean;
  aiProvider?: string;
  model?: string;
  files?: Array<{
    id: string;
    name: string;
    fileType: string;
    url?: string;
    storageKey?: string;
  }>;
  links?: Array<{
    id: string;
    url: string;
    title: string;
    storageKey?: string;
  }>;
  reasoningContent?: string;
  error?: string;
  errorCode?: number;
  messageForksHash?: Record<string, {
    position: number;
    lists: {
      id: string;
      messages: ChatboxaiMessage[];
    }[];
    createdAt: number;
  }>;
  threadName?: string;
  threadId?: string;
}

/**
 * ChatboxAI 会话结构
 */
export interface ChatboxaiSession {
  id: string;
  type?: 'chat' | 'picture';
  name: string;
  picUrl?: string;
  messages: ChatboxaiMessage[];
  starred?: boolean;
  copilotId?: string;
  assistantAvatarKey?: string;
  settings?: {
    aiProvider?: string;
    model?: string;
    temperature?: number;
    maxTokens?: number;
    topP?: number;
    frequencyPenalty?: number;
    presencePenalty?: number;
    [key: string]: any;
  };
  threads?: Array<{
    id: string;
    name: string;
    messages: ChatboxaiMessage[];
    createdAt: number;
  }>;
  threadName?: string;
  messageForksHash?: Record<string, {
    position: number;
    lists: {
      id: string;
      messages: ChatboxaiMessage[];
    }[];
    createdAt: number;
  }>;
  createdAt?: number;
}

/**
 * ChatboxAI 备份数据结构
 */
export interface ChatboxaiBackup {
  'chat-sessions'?: any[];
  configVersion?: number;
  remoteConfig?: any;
  'chat-sessions-list'?: Array<{
    id: string;
    name: string;
    type: string;
    starred?: boolean;
    assistantAvatarKey?: string;
    picUrl?: string;
  }>;
  __exported_items?: string[];
  __exported_at?: string;
  settings?: {
    aiProvider?: string;
    model?: string;
    temperature?: number;
    [key: string]: any;
  };
  [key: string]: any; // 会有动态属性，格式为 session:${id}
}

/**
 * 提取消息文本内容
 */
export function extractMessageText(chatboxMsg: ChatboxaiMessage): string {
  // 优先使用 contentParts
  if (chatboxMsg.contentParts && Array.isArray(chatboxMsg.contentParts)) {
    const parts = chatboxMsg.contentParts.map(part => {
      if (part.type === 'text' && part.text) {
        return part.text;
      } else if (part.type === 'image') {
        return `[图片: ${part.storageKey || part.url || '未知'}]`;
      } else if (part.type === 'tool-call') {
        return `[工具调用: ${part.toolName || '未知工具'}]`;
      }
      return '';
    }).filter(Boolean);

    if (parts.length > 0) {
      return parts.join('\n');
    }
  }

  // 兼容老版本的 content 字段
  if (chatboxMsg.content && typeof chatboxMsg.content === 'string') {
    return chatboxMsg.content;
  }

  return '';
}

/**
 * 获取会话的所有消息（包括主线程和历史线程）
 */
export function getAllMessagesFromSession(sessionData: ChatboxaiSession): ChatboxaiMessage[] {
  const allMessages: ChatboxaiMessage[] = [];

  // 添加主线程消息
  if (Array.isArray(sessionData.messages)) {
    allMessages.push(...sessionData.messages);
  }

  // 添加历史线程消息
  if (Array.isArray(sessionData.threads)) {
    for (const thread of sessionData.threads) {
      if (Array.isArray(thread.messages)) {
        // 为线程消息添加标识
        const threadMessages = thread.messages.map(msg => ({
          ...msg,
          threadName: thread.name,
          threadId: thread.id
        }));
        allMessages.push(...threadMessages);
      }
    }
  }

  return allMessages;
}

/**
 * 检测是否为 ChatboxAI JSON 备份格式
 */
export function isChatboxaiBackupFormat(data: any): boolean {
  return !!(
    data &&
    (data['chat-sessions-list'] ||
     data['__exported_items']?.includes?.('Conversations') ||
     data['__exported_items']?.includes?.('conversations') ||
     data['__exported_at'])
  );
}

/**
 * 解析 ChatboxAI JSON 格式数据
 */
export function parseChatboxaiJson(backupData: ChatboxaiBackup): {
  sessionsList: Array<{
    id: string;
    name: string;
    type?: string;
    starred?: boolean;
    assistantAvatarKey?: string;
    picUrl?: string;
  }>;
  sessionsData: Record<string, ChatboxaiSession>;
  globalSettings: any;
} {
  console.log('开始解析 ChatboxAI JSON 格式...');
  console.log('备份数据结构:', Object.keys(backupData));

  const sessionsList = backupData['chat-sessions-list'] || [];
  console.log(`找到 ${sessionsList.length} 个ChatboxAI会话`);

  const sessionsData: Record<string, ChatboxaiSession> = {};

  // 提取会话详细数据
  for (const session of sessionsList) {
    const sessionKey = `session:${session.id}`;
    const sessionData = backupData[sessionKey];

    if (sessionData) {
      sessionsData[session.id] = sessionData;
    }
  }

  return {
    sessionsList,
    sessionsData,
    globalSettings: backupData.settings || {}
  };
}

/**
 * 从 chatbox 消息创建信息块
 */
export function createBlocksFromChatboxMessage(
  messageId: string,
  chatboxMsg: ChatboxaiMessage
): MessageBlock[] {
  const blocks: MessageBlock[] = [];
  const now = new Date(chatboxMsg.timestamp || Date.now()).toISOString();

  // 处理 contentParts
  if (chatboxMsg.contentParts && Array.isArray(chatboxMsg.contentParts)) {
    let hasMainText = false;

    for (const part of chatboxMsg.contentParts) {
      if (part.type === 'text' && part.text && part.text.trim()) {
        // 创建主文本块
        if (!hasMainText) {
          blocks.push({
            id: uuidv4(),
            messageId,
            type: 'main_text',
            content: part.text.trim(),
            createdAt: now,
            status: chatboxMsg.error ? 'error' : 'success'
          } as MessageBlock);
          hasMainText = true;
        } else {
          // 如果已经有主文本块，额外的文本作为新的主文本块
          blocks.push({
            id: uuidv4(),
            messageId,
            type: 'main_text',
            content: part.text.trim(),
            createdAt: now,
            status: chatboxMsg.error ? 'error' : 'success'
          } as MessageBlock);
        }
      } else if (part.type === 'image') {
        // 创建图片块
        blocks.push({
          id: uuidv4(),
          messageId,
          type: 'image',
          url: part.url || '',
          mimeType: 'image/png', // 默认类型
          createdAt: now,
          status: 'success',
          metadata: {
            storageKey: part.storageKey,
            originalUrl: part.url
          }
        } as MessageBlock);
      } else if (part.type === 'tool-call') {
        // 创建工具块
        blocks.push({
          id: uuidv4(),
          messageId,
          type: 'tool',
          toolId: part.toolCallId || uuidv4(),
          toolName: part.toolName,
          arguments: part.args,
          content: part.result,
          createdAt: now,
          status: part.result ? 'success' : 'processing',
          metadata: {
            originalToolCall: part
          }
        } as MessageBlock);
      }
    }

    // 如果没有创建任何主文本块，但有老版本的 content，创建一个
    if (!hasMainText && chatboxMsg.content && typeof chatboxMsg.content === 'string' && chatboxMsg.content.trim()) {
      blocks.push({
        id: uuidv4(),
        messageId,
        type: 'main_text',
        content: chatboxMsg.content.trim(),
        createdAt: now,
        status: chatboxMsg.error ? 'error' : 'success'
      } as MessageBlock);
    }
  } else if (chatboxMsg.content && typeof chatboxMsg.content === 'string' && chatboxMsg.content.trim()) {
    // 兼容老版本：只有 content 字段
    blocks.push({
      id: uuidv4(),
      messageId,
      type: 'main_text',
      content: chatboxMsg.content.trim(),
      createdAt: now,
      status: chatboxMsg.error ? 'error' : 'success'
    } as MessageBlock);
  }

  // 处理推理内容（思考过程）
  if (chatboxMsg.reasoningContent && chatboxMsg.reasoningContent.trim()) {
    blocks.push({
      id: uuidv4(),
      messageId,
      type: 'thinking',
      content: chatboxMsg.reasoningContent.trim(),
      createdAt: now,
      status: 'success'
    } as MessageBlock);
  }

  // 处理错误信息
  if (chatboxMsg.error) {
    blocks.push({
      id: uuidv4(),
      messageId,
      type: 'error',
      content: chatboxMsg.error,
      createdAt: now,
      status: 'error',
      error: {
        message: chatboxMsg.error,
        code: chatboxMsg.errorCode
      }
    } as MessageBlock);
  }

  // 如果没有创建任何块，创建一个空的主文本块
  if (blocks.length === 0) {
    blocks.push({
      id: uuidv4(),
      messageId,
      type: 'main_text',
      content: '[空消息]',
      createdAt: now,
      status: 'success',
      metadata: {
        isEmpty: true,
        originalMessage: chatboxMsg
      }
    } as MessageBlock);
  }

  return blocks;
}