// chatboxaiTxtParser.ts
import { v4 as uuidv4 } from 'uuid';

/**
 * ChatboxAI TXT 格式消息结构
 */
export interface ChatboxaiTxtMessage {
  id: string;
  role: 'system' | 'user' | 'assistant';
  contentParts: Array<{
    type: 'text';
    text: string;
  }>;
  timestamp: number;
  generating: boolean;
  error: boolean;
}

/**
 * ChatboxAI TXT 格式会话结构
 */
export interface ChatboxaiTxtSession {
  id: string;
  name: string;
  messages: ChatboxaiTxtMessage[];
  settings: Record<string, any>;
}

/**
 * ChatboxAI TXT 解析结果
 */
export interface ChatboxaiTxtParseResult {
  'chat-sessions-list': ChatboxaiTxtSession[];
  settings: Record<string, any>;
}

/**
 * 检测是否为 ChatboxAI TXT 格式
 */
export function isChatboxaiTxtFormat(content: string): boolean {
  console.log('检测 TXT 格式...');

  // 检查是否包含 ChatboxAI TXT 格式的特征标记
  const hasHeader = content.includes('====================================');
  const hasFooter = content.includes('Chatbox AI (https://chatboxai.app)');
  const hasUserMessage = content.includes('▶ USER:');
  const hasAssistantMessage = content.includes('▶ ASSISTANT:');

  console.log('TXT 格式检测结果:', {
    hasHeader,
    hasFooter,
    hasUserMessage,
    hasAssistantMessage
  });

  return hasHeader && hasFooter && (hasUserMessage || hasAssistantMessage);
}

/**
 * 解析 ChatboxAI TXT 格式
 */
export function parseChatboxaiTxt(content: string): ChatboxaiTxtParseResult {
  console.log('开始解析 ChatboxAI TXT 格式...');
  console.log('TXT 内容长度:', content.length);

  const sessions: ChatboxaiTxtSession[] = [];

  // 提取会话名称
  const sessionNameMatch = content.match(/==================================== \[\[(.*?)\]\] ====================================/);
  const sessionName = sessionNameMatch ? sessionNameMatch[1] : '导入的对话';
  console.log('提取的会话名称:', sessionName);

  // 解析消息 - 使用更宽松的正则表达式
  const messages: ChatboxaiTxtMessage[] = [];

  // 分割内容，查找所有消息块
  const messagePattern = /▶ (SYSTEM|USER|ASSISTANT):\s*\n\n([\s\S]*?)(?=\n\n▶|========================================================================)/g;
  let match;

  while ((match = messagePattern.exec(content)) !== null) {
    const role = match[1].toLowerCase() as 'system' | 'user' | 'assistant';
    const messageContent = match[2].trim();

    console.log(`找到消息 - 角色: ${role}, 内容长度: ${messageContent.length}`);

    if (messageContent) {
      messages.push({
        id: uuidv4(),
        role: role,
        contentParts: [{
          type: 'text',
          text: messageContent
        }],
        timestamp: Date.now(),
        generating: false,
        error: false
      });
    }
  }

  console.log(`解析完成，共找到 ${messages.length} 条消息`);

  // 创建会话
  const session: ChatboxaiTxtSession = {
    id: uuidv4(),
    name: sessionName,
    messages: messages,
    settings: {}
  };

  sessions.push(session);

  const result: ChatboxaiTxtParseResult = {
    'chat-sessions-list': sessions,
    settings: {}
  };

  console.log('TXT 解析结果:', {
    sessionCount: sessions.length,
    messageCount: messages.length,
    sessionName: sessionName
  });

  return result;
}