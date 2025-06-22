// 处理外部AI软件备份的工具函数
import { v4 as uuidv4 } from 'uuid';
import type { ChatTopic } from '../../../../shared/types';
import type { Assistant } from '../../../../shared/types/Assistant';
import type { MessageBlock } from '../../../../shared/types/newMessage';
import {
  convertDesktopBackup,
  isDesktopBackupFormat,
  validateDesktopBackupData
} from './desktopBackupUtils';
// 导入 ChatboxAI 解析器
import {
  isChatboxaiTxtFormat,
  parseChatboxaiTxt
} from './importers/chatboxai/chatboxaiTxtParser';
import {
  isChatboxaiBackupFormat,
  parseChatboxaiJson,
  extractMessageText,
  getAllMessagesFromSession,
  createBlocksFromChatboxMessage,
  type ChatboxaiBackup,
  type ChatboxaiSession
} from './importers/chatboxai/chatboxaiJsonParser';

/**
 * 导入方式选项
 */
export type ImportMode = 'separate' | 'unified';

/**
 * 转换Chatboxai备份为AetherLink格式
 */
export async function convertChatboxaiBackup(
  backupData: ChatboxaiBackup,
  importMode: ImportMode = 'separate'
): Promise<{
  topics: ChatTopic[];
  assistants: Assistant[];
  messageBlocks: MessageBlock[];
}> {
  try {
    console.log('开始转换 ChatboxAI 备份数据...');

    // 使用新的JSON解析器解析数据
    const { sessionsList, sessionsData, globalSettings } = parseChatboxaiJson(backupData);
    console.log(`找到 ${sessionsList.length} 个ChatboxAI会话`);

    if (sessionsList.length === 0) {
      console.warn('ChatboxAI备份中没有找到会话列表');
      console.log('完整备份数据:', backupData);
      return { topics: [], assistants: [], messageBlocks: [] };
    }

    const convertedTopics: ChatTopic[] = [];
    const convertedAssistants: Assistant[] = [];
    const allMessageBlocks: MessageBlock[] = [];

    // 统一助手模式：创建一个共享的助手ID
    const unifiedAssistantId = importMode === 'unified' ? uuidv4() : null;

    for (const session of sessionsList) {
      const sessionId = session.id;

      // 获取会话数据
      let sessionData: ChatboxaiSession;

      if ((session as any).messages && Array.isArray((session as any).messages)) {
        // TXT 格式：会话数据直接在 session 对象中
        sessionData = session as any as ChatboxaiSession;
        console.log(`处理 TXT 格式会话: ${session.name} (${sessionId})`);
      } else {
        // JSON 格式：从解析结果中获取会话数据
        sessionData = sessionsData[sessionId];
        if (!sessionData) {
          console.warn(`未找到会话 ${sessionId} 的详情数据`);
          continue;
        }
        console.log(`处理 JSON 格式会话: ${session.name} (${sessionId})`);
      }

      // 根据导入模式决定助手ID
      const assistantId = importMode === 'unified' ? unifiedAssistantId! : uuidv4();
      const topicId = uuidv4();

      const newTopic: ChatTopic = {
        id: topicId,
        name: session.name || '导入的对话',
        title: session.name || '导入的对话',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        lastMessageTime: new Date().toISOString(),
        messages: [],
        messageIds: [],
        prompt: '',
        assistantId: assistantId,
        isNameManuallyEdited: session.name ? true : false
      };

      // 使用新的函数获取所有消息（包括主线程和历史线程）
      const allMessages = getAllMessagesFromSession(sessionData);

      console.log(`会话 ${session.name} 包含 ${allMessages.length} 条消息`);

      // 转换消息
      for (const chatboxMsg of allMessages) {
        try {
          // 处理系统消息作为 prompt
          if (chatboxMsg.role === 'system') {
            const systemText = extractMessageText(chatboxMsg);
            if (systemText && !newTopic.prompt) {
              newTopic.prompt = systemText;
            }
            continue;
          }

          // 跳过空消息
          const messageText = extractMessageText(chatboxMsg);
          if (!messageText.trim()) {
            console.warn(`跳过空消息: ${chatboxMsg.id}`);
            continue;
          }

          const messageId = chatboxMsg.id || uuidv4();
          const now = new Date(chatboxMsg.timestamp || Date.now()).toISOString();

          // 使用新的块创建逻辑
          const messageBlocks = createBlocksFromChatboxMessage(messageId, chatboxMsg);

          // 将块添加到全局块列表中
          allMessageBlocks.push(...messageBlocks);

          const newMsg = {
            id: messageId,
            role: chatboxMsg.role === 'user' ? 'user' : 'assistant',
            assistantId: assistantId,
            topicId: topicId,
            createdAt: now,
            status: chatboxMsg.generating ? 'pending' : (chatboxMsg.error ? 'error' : 'success'),
            blocks: messageBlocks.map(block => block.id)
          } as any;

          // 添加模型信息
          if (chatboxMsg.model) {
            newMsg.modelId = chatboxMsg.model;
          }

          // 添加统计信息
          if (chatboxMsg.wordCount) {
            newMsg.wordCount = chatboxMsg.wordCount;
          }
          if (chatboxMsg.tokenCount) {
            newMsg.tokenCount = chatboxMsg.tokenCount;
          }
          if (chatboxMsg.tokensUsed) {
            newMsg.tokensUsed = chatboxMsg.tokensUsed;
          }

          // 添加错误信息
          if (chatboxMsg.error) {
            newMsg.error = chatboxMsg.error;
            newMsg.errorCode = chatboxMsg.errorCode;
          }

          // 添加推理内容
          if (chatboxMsg.reasoningContent) {
            newMsg.reasoningContent = chatboxMsg.reasoningContent;
          }

          // 处理文件附件 - 创建文件块
          if (chatboxMsg.files && Array.isArray(chatboxMsg.files)) {
            for (const file of chatboxMsg.files) {
              const fileBlock: MessageBlock = {
                id: uuidv4(),
                messageId,
                type: 'file',
                name: file.name,
                url: file.url || '',
                mimeType: file.fileType || 'application/octet-stream',
                createdAt: now,
                status: 'success',
                metadata: {
                  storageKey: file.storageKey,
                  originalFile: file
                }
              } as MessageBlock;

              messageBlocks.push(fileBlock);
              allMessageBlocks.push(fileBlock);
            }

            // 同时保留原始文件信息
            newMsg.files = chatboxMsg.files.map(file => ({
              id: file.id,
              name: file.name,
              type: file.fileType,
              url: file.url,
              storageKey: file.storageKey
            }));
          }

          // 处理链接 - 创建引用块
          if (chatboxMsg.links && Array.isArray(chatboxMsg.links)) {
            for (const link of chatboxMsg.links) {
              const citationBlock: MessageBlock = {
                id: uuidv4(),
                messageId,
                type: 'citation',
                title: link.title || link.url,
                url: link.url,
                content: link.title || link.url,
                createdAt: now,
                status: 'success',
                metadata: {
                  storageKey: link.storageKey,
                  originalLink: link
                }
              } as MessageBlock;

              messageBlocks.push(citationBlock);
              allMessageBlocks.push(citationBlock);
            }

            // 同时保留原始链接信息
            newMsg.links = chatboxMsg.links.map(link => ({
              id: link.id,
              url: link.url,
              title: link.title,
              storageKey: link.storageKey
            }));
          }

          // 更新消息的块列表
          newMsg.blocks = messageBlocks.map(block => block.id);

          newTopic.messages!.push(newMsg);
          newTopic.messageIds.push(newMsg.id);
        } catch (msgError) {
          console.error(`处理消息 ${chatboxMsg.id} 时出错:`, msgError);
          // 继续处理其他消息
        }
      }

      // 更新最后消息时间
      if (newTopic.messages && newTopic.messages.length > 0) {
        const lastMsg = newTopic.messages[newTopic.messages.length - 1];
        if (lastMsg) {
          newTopic.lastMessageTime = lastMsg.createdAt;
          newTopic.updatedAt = lastMsg.createdAt;
        }

        convertedTopics.push(newTopic);

        // 根据导入模式创建助手
        if (importMode === 'separate') {
          // 独立模式：为每个会话创建独立助手
          const assistant: Assistant = {
            id: assistantId,
            name: session.name || '导入的对话',
            description: `从ChatboxAI导入的对话：${session.name || '未命名对话'}`,
            systemPrompt: '', // 使用从系统消息提取的prompt
            icon: null,
            isSystem: false,
            topicIds: [topicId],
            topics: [newTopic],
            avatar: undefined,
            tags: ['导入', 'ChatboxAI'],
            engine: sessionData.settings?.aiProvider || globalSettings?.aiProvider || undefined,
            model: sessionData.settings?.model || globalSettings?.model || undefined,
            temperature: sessionData.settings?.temperature || globalSettings?.temperature || undefined,
            maxTokens: sessionData.settings?.maxTokens || undefined,
            topP: sessionData.settings?.topP || undefined,
            frequencyPenalty: sessionData.settings?.frequencyPenalty || undefined,
            presencePenalty: sessionData.settings?.presencePenalty || undefined,
            prompt: undefined,
            maxMessagesInContext: undefined,
            isDefault: false,
            archived: false,
            createdAt: newTopic.createdAt,
            updatedAt: newTopic.updatedAt,
            lastUsedAt: newTopic.lastMessageTime,
            selectedSystemPromptId: undefined,
            mcpConfigId: undefined,
            tools: [],
            tool_choice: undefined,
            speechModel: undefined,
            speechVoice: undefined,
            speechSpeed: undefined,
            responseFormat: undefined,
            isLocal: undefined,
            localModelName: undefined,
            localModelPath: undefined,
            localModelType: undefined,
            file_ids: [],
          };
          convertedAssistants.push(assistant);
        }

        console.log(`成功转换会话: ${newTopic.name}, 包含 ${newTopic.messageIds.length} 条消息`);
      } else {
        console.warn(`会话 ${session.name} 没有有效消息，跳过`);
      }
    }

    // 统一模式：创建一个包含所有话题的助手
    if (importMode === 'unified' && convertedTopics.length > 0) {
      const unifiedAssistant: Assistant = {
        id: unifiedAssistantId!,
        name: 'ChatboxAI 导入助手',
        description: `从ChatboxAI导入的对话助手，包含 ${convertedTopics.length} 个对话`,
        systemPrompt: '',
        icon: null,
        isSystem: false,
        topicIds: convertedTopics.map(topic => topic.id),
        topics: convertedTopics,
        avatar: undefined,
        tags: ['导入', 'ChatboxAI'],
        engine: globalSettings?.aiProvider || undefined,
        model: globalSettings?.model || undefined,
        temperature: globalSettings?.temperature || undefined,
        maxTokens: undefined,
        topP: undefined,
        frequencyPenalty: undefined,
        presencePenalty: undefined,
        prompt: undefined,
        maxMessagesInContext: undefined,
        isDefault: false,
        archived: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        lastUsedAt: new Date().toISOString(),
        selectedSystemPromptId: undefined,
        mcpConfigId: undefined,
        tools: [],
        tool_choice: undefined,
        speechModel: undefined,
        speechVoice: undefined,
        speechSpeed: undefined,
        responseFormat: undefined,
        isLocal: undefined,
        localModelName: undefined,
        localModelPath: undefined,
        localModelType: undefined,
        file_ids: [],
      };
      convertedAssistants.push(unifiedAssistant);
    }

    console.log(`ChatboxAI导入完成: ${convertedTopics.length} 个对话, ${convertedAssistants.length} 个助手, ${allMessageBlocks.length} 个消息块`);

    return {
      topics: convertedTopics,
      assistants: convertedAssistants,
      messageBlocks: allMessageBlocks
    };
  } catch (error) {
    console.error('转换ChatboxAI备份失败:', error);
    throw new Error(`转换ChatboxAI备份失败: ${error instanceof Error ? error.message : '未知错误'}`);
  }
}



/**
 * 从文件内容解析外部备份格式并转换
 */
export async function importExternalBackup(data: any, importMode: ImportMode = 'separate'): Promise<{
  topics: ChatTopic[];
  assistants: Assistant[];
  source: string;
  messageBlocks?: MessageBlock[];
}> {
  try {
    console.log('开始检测外部备份格式...');

    // 检测是否为字符串（TXT格式）
    if (typeof data === 'string') {
      if (isChatboxaiTxtFormat(data)) {
        console.log('检测到ChatboxAI TXT格式');

        // 解析 TXT 格式为 JSON 结构
        const parsedData = parseChatboxaiTxt(data);

        // 转换TXT解析结果为ChatboxAI备份格式
        const chatboxaiBackup: ChatboxaiBackup = {
          'chat-sessions-list': parsedData['chat-sessions-list'].map(session => ({
            id: session.id,
            name: session.name,
            type: 'chat', // 默认类型
            starred: false,
            assistantAvatarKey: undefined,
            picUrl: undefined
          })),
          settings: parsedData.settings
        };

        // 将TXT会话数据添加到备份对象中
        for (const session of parsedData['chat-sessions-list']) {
          const sessionKey = `session:${session.id}`;
          (chatboxaiBackup as any)[sessionKey] = session;
        }

        // 转换为标准格式
        const converted = await convertChatboxaiBackup(chatboxaiBackup, importMode);
        return {
          topics: converted.topics,
          assistants: converted.assistants,
          messageBlocks: converted.messageBlocks,
          source: 'chatboxai-txt'
        };
      } else {
        throw new Error('无法识别的TXT格式。目前只支持ChatboxAI导出的TXT格式。');
      }
    }

    // 检测备份格式 (Cherry Studio)
    if (isDesktopBackupFormat(data)) {
      console.log('检测到Cherry Studio备份格式');

      // 验证数据完整性
      const validation = validateDesktopBackupData(data);
      if (!validation.isValid) {
        throw new Error(`Cherry Studio备份数据验证失败: ${validation.errors.join(', ')}`);
      }

      // 记录备份信息
      if (validation.detectedVersion) {
        console.log(`Cherry Studio备份版本: ${validation.detectedVersion}`);
      }

      if (validation.backupInfo) {
        const { topicsCount, assistantsCount, messageBlocksCount, hasSettings } = validation.backupInfo;
        console.log(`备份内容: ${topicsCount}个话题, ${assistantsCount}个助手, ${messageBlocksCount}个消息块, ${hasSettings ? '包含' : '不包含'}设置`);
      }

      if (validation.warnings.length > 0) {
        console.warn('Cherry Studio备份数据警告:', validation.warnings);
      }

      // 转换备份数据
      const converted = await convertDesktopBackup(data);
      return {
        topics: converted.topics,
        assistants: converted.assistants,
        messageBlocks: converted.messageBlocks,
        source: `cherry-studio-v${validation.detectedVersion || 'unknown'}`
      };
    }

    // 检测 ChatboxAI JSON 格式
    if (isChatboxaiBackupFormat(data)) {
      console.log('检测到ChatboxAI JSON备份格式');

      // 转换 ChatboxAI 备份数据
      const converted = await convertChatboxaiBackup(data, importMode);
      return {
        topics: converted.topics,
        assistants: converted.assistants,
        messageBlocks: converted.messageBlocks,
        source: 'chatboxai'
      };
    }

    // 如果需要支持其他格式，可以在这里添加
    // 例如：OpenAI ChatGPT 导出格式、Claude 导出格式等

    // 未识别的格式
    console.error('无法识别的备份格式，数据结构:', typeof data === 'object' ? Object.keys(data) : typeof data);
    throw new Error('无法识别的外部备份格式。支持的格式：Cherry Studio JSON、ChatboxAI JSON、ChatboxAI TXT');
  } catch (error) {
    console.error('导入外部备份失败:', error);

    // 提供更详细的错误信息
    if (error instanceof Error) {
      if (error.message.includes('无法识别')) {
        throw error; // 直接抛出格式识别错误
      }
      throw new Error(`导入外部备份失败: ${error.message}`);
    }

    throw new Error('导入外部备份失败: 未知错误');
  }
}