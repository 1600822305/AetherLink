// 处理备份数据的工具函数
import { v4 as uuidv4 } from 'uuid';
import type { ChatTopic } from '../../../../shared/types';
import type { Assistant } from '../../../../shared/types/Assistant';
import type { Message, MessageBlock } from '../../../../shared/types/newMessage';

/**
 * 备份数据结构
 */
interface DesktopBackupData {
  time: number;
  version: number;
  localStorage: Record<string, any>;
  indexedDB: {
    topics?: Array<{
      id: string;
      messages: Message[];
    }>;
    assistants?: Array<{
      id: string;
      name: string;
      description?: string;
      systemPrompt?: string;
      [key: string]: any;
    }>;
    message_blocks?: MessageBlock[];
    settings?: Array<{
      id: string;
      value: any;
    }>;
    files?: any[];
    knowledge_notes?: any[];
    translate_history?: any[];
    quick_phrases?: any[];
  };
}

/**
 * 转换备份数据为移动端格式
 */
export async function convertDesktopBackup(backupData: DesktopBackupData): Promise<{
  topics: ChatTopic[];
  assistants: Assistant[];
  settings?: any;
  messageBlocks?: MessageBlock[];
}> {
  try {
    console.log('开始转换 Cherry Studio 备份数据...');
    console.log('备份版本:', backupData.version);
    console.log('备份时间:', new Date(backupData.time).toLocaleString());

    // 统计原始数据
    const originalStats = {
      topics: backupData.indexedDB.topics?.length || 0,
      assistants: backupData.indexedDB.assistants?.length || 0,
      messageBlocks: backupData.indexedDB.message_blocks?.length || 0,
      settings: backupData.indexedDB.settings?.length || 0
    };
    console.log('原始数据统计:', originalStats);

    const result = {
      topics: [] as ChatTopic[],
      assistants: [] as Assistant[],
      settings: undefined as any,
      messageBlocks: [] as MessageBlock[]
    };

    // 获取消息块数据，用于后续内容提取
    const messageBlocks = backupData.indexedDB.message_blocks || [];
    result.messageBlocks = messageBlocks;
    console.log(`处理 ${messageBlocks.length} 个消息块`);

    // 创建助手ID映射表
    const assistantMap = new Map<string, Assistant>();

    // 0. 首先处理助手数据
    if (backupData.indexedDB.assistants) {
      console.log(`发现 ${backupData.indexedDB.assistants.length} 个助手`);
      for (const desktopAssistant of backupData.indexedDB.assistants) {
        if (desktopAssistant.id) {
          const mobileAssistant: Assistant = {
            id: desktopAssistant.id,
            name: desktopAssistant.name || `助手 ${desktopAssistant.id}`,
            description: desktopAssistant.description || '从 Cherry Studio 导入的助手',
            systemPrompt: desktopAssistant.systemPrompt || desktopAssistant.prompt || '你是一个有用的AI助手。',
            icon: null,
            isSystem: false,
            topicIds: [],
            topics: []
          };
          assistantMap.set(desktopAssistant.id, mobileAssistant);
          console.log(`添加助手: ${mobileAssistant.name} (${mobileAssistant.id})`);
        }
      }
    }

    // 0.1 尝试从 localStorage 中提取助手信息
    if (backupData.localStorage && backupData.localStorage['persist:cherry-studio']) {
      try {
        const persistData = JSON.parse(backupData.localStorage['persist:cherry-studio']);
        if (persistData.assistants) {
          const assistantsData = JSON.parse(persistData.assistants);
          if (Array.isArray(assistantsData)) {
            console.log(`从 localStorage 发现 ${assistantsData.length} 个助手`);
            for (const assistant of assistantsData) {
              if (assistant.id && !assistantMap.has(assistant.id)) {
                const mobileAssistant: Assistant = {
                  id: assistant.id,
                  name: assistant.name || `助手 ${assistant.id}`,
                  description: assistant.description || '从 Cherry Studio 导入的助手',
                  systemPrompt: assistant.prompt || assistant.systemPrompt || '你是一个有用的AI助手。',
                  icon: null,
                  isSystem: assistant.isSystem || false,
                  topicIds: [],
                  topics: []
                };
                assistantMap.set(assistant.id, mobileAssistant);
                console.log(`从 localStorage 添加助手: ${mobileAssistant.name} (${mobileAssistant.id})`);
              }
            }
          }
        }
      } catch (error) {
        console.warn('解析 localStorage 中的助手数据失败:', error);
      }
    }

    // 1. 转换话题数据
    if (backupData.indexedDB.topics) {
      for (const desktopTopic of backupData.indexedDB.topics) {
        const mobileTopicId = desktopTopic.id || uuidv4();

        // 从话题数据和消息中提取助手ID和话题名称
        let assistantId = 'imported_assistant';
        let topicName = '导入的对话';

        // 优先使用话题自身的名称
        if ((desktopTopic as any).name) {
          topicName = (desktopTopic as any).name;
          console.log(`使用话题原始名称: ${topicName}`);
        }

        if (desktopTopic.messages && desktopTopic.messages.length > 0) {
          const firstMessage = desktopTopic.messages[0];
          if (firstMessage.assistantId) {
            assistantId = firstMessage.assistantId;
          }

          // 如果话题没有名称，才从第一条用户消息提取话题名称
          if (topicName === '导入的对话') {
            const firstUserMessage = desktopTopic.messages.find(m => m.role === 'user');
            if (firstUserMessage) {
              topicName = extractTopicNameFromMessages([firstUserMessage], messageBlocks);
            }
          }
        }

        // 创建移动端话题格式
        const mobileTopic: ChatTopic = {
          id: mobileTopicId,
          name: topicName,
          createdAt: desktopTopic.messages?.[0]?.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          lastMessageTime: new Date().toISOString(),
          assistantId: assistantId,
          messageIds: [],
          messages: [],
          isNameManuallyEdited: false
        };

        // 转换消息数据
        if (desktopTopic.messages && Array.isArray(desktopTopic.messages)) {
          for (const desktopMessage of desktopTopic.messages) {
            // 确保消息有必要的字段
            const msgAssistantId = desktopMessage.assistantId || assistantId;

            // 处理消息块ID数组
            let messageBlockIds: string[] = [];
            if (desktopMessage.blocks && Array.isArray(desktopMessage.blocks)) {
              messageBlockIds = desktopMessage.blocks.map((block: any) => {
                // 如果是字符串，直接使用；如果是对象，使用其ID
                if (typeof block === 'string') {
                  return block;
                } else if (block && typeof block === 'object' && block.id) {
                  return block.id;
                } else {
                  console.warn('消息块格式异常，生成新ID:', block);
                  return uuidv4();
                }
              }).filter(Boolean); // 过滤掉空值
            }

            const mobileMessage: Message = {
              id: desktopMessage.id || uuidv4(),
              role: desktopMessage.role || 'user',
              assistantId: msgAssistantId,
              topicId: mobileTopicId,
              createdAt: desktopMessage.createdAt || new Date().toISOString(),
              updatedAt: desktopMessage.updatedAt,
              status: desktopMessage.status || 'success',
              modelId: desktopMessage.modelId,
              model: desktopMessage.model,
              type: desktopMessage.type,
              isPreset: desktopMessage.isPreset,
              useful: desktopMessage.useful,
              askId: desktopMessage.askId,
              mentions: desktopMessage.mentions,
              usage: desktopMessage.usage,
              metrics: desktopMessage.metrics,
              blocks: messageBlockIds
            };

            // 添加到话题的消息ID数组
            mobileTopic.messageIds.push(mobileMessage.id);
            // @ts-ignore - 保持兼容性，同时添加到 messages 数组
            if (!mobileTopic.messages) {
              // @ts-ignore
              mobileTopic.messages = [];
            }
            // @ts-ignore
            mobileTopic.messages.push(mobileMessage);

            // 收集助手信息（只有在助手映射表中不存在时才创建）
            if (msgAssistantId && msgAssistantId !== 'imported_assistant' && !assistantMap.has(msgAssistantId)) {
              // 优先使用助手ID作为名称，而不是模型名
              let assistantName = `助手 ${msgAssistantId}`;
              let description = '从 Cherry Studio 导入的助手';

              // 如果助手ID看起来像是一个有意义的名称，直接使用
              if (msgAssistantId.length > 10 && !msgAssistantId.includes('-') && !msgAssistantId.match(/^[a-f0-9]{8,}$/)) {
                assistantName = msgAssistantId;
              }

              // 如果有模型信息，添加到描述中而不是替换名称
              if (desktopMessage.model?.name) {
                description = `从 Cherry Studio 导入的助手 (使用模型: ${desktopMessage.model.name})`;
              } else if (desktopMessage.modelId) {
                description = `从 Cherry Studio 导入的助手 (使用模型: ${desktopMessage.modelId})`;
              }

              console.log(`创建缺失的助手: ${assistantName} (${msgAssistantId})`);
              assistantMap.set(msgAssistantId, {
                id: msgAssistantId,
                name: assistantName,
                description: description,
                icon: null,
                isSystem: false,
                topicIds: [],
                topics: [],
                systemPrompt: '你是一个有用的AI助手。'
              });
            }
          }

          // 更新话题的时间信息
          if (desktopTopic.messages.length > 0) {
            const lastMessage = desktopTopic.messages[desktopTopic.messages.length - 1];
            mobileTopic.lastMessageTime = lastMessage.createdAt || new Date().toISOString();
            mobileTopic.updatedAt = lastMessage.createdAt || new Date().toISOString();
          }
        }

        result.topics.push(mobileTopic);
      }
    }

    // 2. 转换助手数据
    assistantMap.forEach(assistant => {
      // 为每个助手分配相关的话题
      assistant.topicIds = result.topics
        .filter(topic => topic.assistantId === assistant.id)
        .map(topic => topic.id);
      result.assistants.push(assistant);
    });

    // 3. 创建默认助手（用于没有明确助手ID的对话）
    const defaultTopics = result.topics.filter(t => t.assistantId === 'imported_assistant');
    if (defaultTopics.length > 0) {
      const importedAssistant: Assistant = {
        id: 'imported_assistant',
        name: 'Cherry Studio 导入助手',
        description: '从 Cherry Studio 导入的对话助手',
        icon: null,
        isSystem: false,
        topicIds: defaultTopics.map(t => t.id),
        topics: [],
        systemPrompt: '你是一个有用的AI助手。'
      };
      result.assistants.push(importedAssistant);
    }

    // 4. 转换消息块数据
    if (backupData.indexedDB.message_blocks) {
      result.messageBlocks = backupData.indexedDB.message_blocks;
    }

    // 5. 转换设置数据
    if (backupData.indexedDB.settings) {
      const settingsMap: Record<string, any> = {};
      for (const setting of backupData.indexedDB.settings) {
        settingsMap[setting.id] = setting.value;
      }
      result.settings = settingsMap;
    }

    // 输出转换结果统计
    const convertedStats = {
      topics: result.topics.length,
      assistants: result.assistants.length,
      messageBlocks: result.messageBlocks?.length || 0,
      hasSettings: !!result.settings
    };
    console.log('转换结果统计:', convertedStats);
    console.log('Cherry Studio 备份转换完成');

    return result;
  } catch (error) {
    console.error('转换备份数据失败:', error);
    throw new Error('转换备份数据失败: ' + (error instanceof Error ? error.message : '未知错误'));
  }
}

/**
 * 检测是否为 Cherry Studio 备份格式
 */
export function isDesktopBackupFormat(data: any): boolean {
  // 基本结构检查
  const hasBasicStructure = (
    data &&
    typeof data === 'object' &&
    typeof data.time === 'number' &&
    typeof data.version === 'number' &&
    data.indexedDB &&
    typeof data.indexedDB === 'object'
  );

  if (!hasBasicStructure) {
    return false;
  }

  // Cherry Studio 特有字段检查
  const hasCherryStudioFeatures = (
    data.indexedDB.topics ||
    data.indexedDB.message_blocks ||
    data.indexedDB.settings ||
    data.indexedDB.files ||
    data.localStorage?.['persist:cherry-studio']
  );

  // 排除 ChatboxAI 特征（避免格式冲突）
  const hasChatboxAIFeatures = (
    data['chat-sessions-list'] ||
    data['__exported_items'] ||
    data['__exported_at']
  );

  // 必须有 Cherry Studio 特征且没有 ChatboxAI 特征
  return hasCherryStudioFeatures && !hasChatboxAIFeatures;
}

/**
 * 从消息块中提取消息内容
 */
export function extractMessageContent(
  message: any,
  messageBlocks: any[]
): string {
  try {
    if (!message.blocks || !Array.isArray(message.blocks) || message.blocks.length === 0) {
      return message.content || '';
    }

    let content = '';
    for (const blockId of message.blocks) {
      const block = messageBlocks.find(b => b.id === blockId);
      if (block) {
        // 根据不同的块类型提取内容
        let blockContent = '';

        // 根据块类型提取内容
        switch (block.type) {
          case 'main_text':
          case 'thinking':
          case 'code':
          case 'error':
          case 'citation':
          case 'translation':
            blockContent = block.content || '';
            break;
          case 'image':
            blockContent = `[图片: ${block.url || block.file?.name || block.metadata?.originalUrl || '未知图片'}]`;
            break;
          case 'file':
            blockContent = `[文件: ${block.name || block.file?.name || block.file?.origin_name || '未知文件'}]`;
            break;
          case 'tool':
            const toolName = block.toolName || block.toolId || '未知工具';
            const toolResult = block.content ? ` - ${typeof block.content === 'string' ? block.content : JSON.stringify(block.content)}` : '';
            blockContent = `[工具调用: ${toolName}${toolResult}]`;
            break;
          case 'unknown':
            blockContent = '[未知内容块]';
            break;
          default:
            // 其他类型的块，如果有content属性就使用
            if (block.content) {
              blockContent = typeof block.content === 'string'
                ? block.content
                : JSON.stringify(block.content);
            } else {
              blockContent = `[${block.type || '未知类型'}]`;
            }
        }

        if (blockContent) {
          content += blockContent + '\n';
        }
      }
    }

    return content.trim() || message.content || '';
  } catch (error) {
    console.error('提取消息内容失败:', error);
    return message.content || '';
  }
}

/**
 * 从备份中提取话题名称
 * 通过分析消息块内容来生成合适的话题名称
 */
export function extractTopicNameFromMessages(
  messages: any[],
  messageBlocks: MessageBlock[]
): string {
  try {
    // 查找第一条用户消息
    const firstUserMessage = messages.find(m => m.role === 'user');
    if (!firstUserMessage) {
      return '导入的对话';
    }

    const content = extractMessageContent(firstUserMessage, messageBlocks);
    if (content) {
      // 截取前30个字符作为话题名称
      return content.length > 30
        ? content.substring(0, 30) + '...'
        : content;
    }

    return '导入的对话';
  } catch (error) {
    console.error('提取话题名称失败:', error);
    return '导入的对话';
  }
}

/**
 * 验证 Cherry Studio 备份数据的完整性
 */
export function validateDesktopBackupData(data: DesktopBackupData): {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  detectedVersion?: number;
  backupInfo?: {
    topicsCount: number;
    assistantsCount: number;
    messageBlocksCount: number;
    hasSettings: boolean;
  };
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 检查基本结构
  if (!data.indexedDB) {
    errors.push('缺少 indexedDB 数据');
    return {
      isValid: false,
      errors,
      warnings,
      detectedVersion: data.version
    };
  }

  // 版本特定检查
  const version = data.version || 1;
  if (version >= 4) {
    // 版本4及以上应该有 message_blocks
    if (!data.indexedDB.message_blocks) {
      warnings.push('版本4+备份缺少 message_blocks 数据，可能影响消息显示');
    }
  }

  if (version >= 7) {
    // 版本7及以上的新特性检查
    if (data.indexedDB.message_blocks && Array.isArray(data.indexedDB.message_blocks)) {
      const hasInvalidBlocks = data.indexedDB.message_blocks.some(block => !block.messageId);
      if (hasInvalidBlocks) {
        warnings.push('部分消息块缺少 messageId，可能影响消息关联');
      }
    }
  }

  // 检查话题数据
  let topicsCount = 0;
  if (data.indexedDB.topics) {
    if (!Array.isArray(data.indexedDB.topics)) {
      errors.push('topics 数据格式错误');
    } else {
      topicsCount = data.indexedDB.topics.length;
      for (let i = 0; i < data.indexedDB.topics.length; i++) {
        const topic = data.indexedDB.topics[i];
        if (!topic.id) {
          warnings.push(`话题 ${i} 缺少 ID`);
        }
        if (!topic.messages || !Array.isArray(topic.messages)) {
          warnings.push(`话题 ${i} 缺少消息数据`);
        } else if (topic.messages.length === 0) {
          warnings.push(`话题 ${i} "${(topic as any).name || '未命名'}" 没有消息内容`);
        }
      }
    }
  } else {
    warnings.push('没有找到话题数据');
  }

  // 检查助手数据
  let assistantsCount = 0;
  if (data.indexedDB.assistants) {
    if (!Array.isArray(data.indexedDB.assistants)) {
      warnings.push('assistants 数据格式错误');
    } else {
      assistantsCount = data.indexedDB.assistants.length;
      for (let i = 0; i < data.indexedDB.assistants.length; i++) {
        const assistant = data.indexedDB.assistants[i];
        if (!assistant.id) {
          warnings.push(`助手 ${i} 缺少 ID`);
        }
        if (!assistant.name) {
          warnings.push(`助手 ${i} 缺少名称`);
        }
      }
    }
  }

  // 检查消息块数据
  let messageBlocksCount = 0;
  if (data.indexedDB.message_blocks) {
    if (!Array.isArray(data.indexedDB.message_blocks)) {
      warnings.push('message_blocks 数据格式错误');
    } else {
      messageBlocksCount = data.indexedDB.message_blocks.length;
    }
  }

  // 检查设置数据
  const hasSettings = !!(data.indexedDB.settings && Array.isArray(data.indexedDB.settings));

  // 数据一致性检查
  if (topicsCount > 0 && messageBlocksCount === 0 && version >= 4) {
    warnings.push('有话题数据但缺少消息块数据，消息内容可能无法正确显示');
  }

  const backupInfo = {
    topicsCount,
    assistantsCount,
    messageBlocksCount,
    hasSettings
  };

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    detectedVersion: version,
    backupInfo
  };
}
