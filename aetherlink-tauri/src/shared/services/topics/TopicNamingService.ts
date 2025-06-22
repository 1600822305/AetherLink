import { sendChatRequest } from '../../api';
import store from '../../store';
import type { ChatTopic } from '../../types';
import { getStorageItem, setStorageItem } from '../../utils/storage';
import { saveTopicToDB } from '../storage/storageService';
import { getMainTextContent } from '../../utils/messageUtils';
import { dexieStorage } from '../storage/DexieStorageService';

/**
 * 话题命名服务
 * 用于自动命名话题，根据对话内容生成合适的标题
 */
export class TopicNamingService {
  /**
   * 检查话题是否需要自动命名
   * @param topic 当前话题
   * @returns 如果需要命名返回true，否则返回false
   */
  static shouldNameTopic(topic: ChatTopic): boolean {
    // 首先检查是否启用了话题命名功能
    const enableTopicNaming = store.getState().settings.enableTopicNaming;
    if (!enableTopicNaming) {
      console.log('话题命名功能已禁用');
      return false;
    }

    // 检查话题是否已被手动编辑
    if (topic.isNameManuallyEdited) {
      console.log('话题已被手动编辑，跳过自动命名');
      return false;
    }

    // 获取有效的用户和助手消息 - 使用简化的内容检查
    const allMessages = topic.messages || [];

    // 简化检查：只要消息存在且角色正确就认为有效
    // 避免在shouldNameTopic中进行复杂的内容提取，这会在generateTopicName中处理
    const userMessages = allMessages.filter(m => m.role === 'user');
    const assistantMessages = allMessages.filter(m => {
      if (m.role !== 'assistant') return false;
      // 只检查状态，不检查内容
      return !m.status || m.status === 'success';
    });

    // 获取话题名称（优先使用name字段，兼容旧版本使用title字段）
    const topicName = topic.name || topic.title || '';

    // 简化调试日志
    console.log(`话题命名检查 [${topic.id}]: 启用=${enableTopicNaming}, 手动编辑=${topic.isNameManuallyEdited}, 有效消息数=${userMessages.length}/${assistantMessages.length}, 话题名="${topicName}"`);

    // 检查是否满足自动命名条件：
    // 1. 标题符合默认格式（包含"新话题"、"New Topic"、"新的对话"或"新对话"）
    // 2. 至少有1条用户消息和1条助手消息
    const isDefaultName = (
      topicName.includes('新话题') ||
      topicName.includes('New Topic') ||
      topicName.includes('新的对话') ||
      topicName.includes('新对话') ||
      topicName === '' ||
      topicName.trim() === ''
    );

    const hasEnoughMessages = userMessages.length >= 1 && assistantMessages.length >= 1;

    return isDefaultName && hasEnoughMessages;
  }

  /**
   * 为话题生成一个有意义的标题
   * @param topic 需要命名的对话
   * @param modelId 可选的模型ID，默认使用默认模型ID
   * @param forceGenerate 是否强制生成，跳过重复检查和条件检查
   * @returns 生成的标题，如果失败则返回null
   */
  static async generateTopicName(topic: ChatTopic, modelId?: string, forceGenerate: boolean = false): Promise<string | null> {
    try {
      // 如果不是强制生成，检查是否已经命名过
      if (!forceGenerate) {
        const namingKey = `topic_naming_${topic.id}`;
        const alreadyNamed = await getStorageItem<boolean>(namingKey);
        if (alreadyNamed) {
          console.log('该话题已经完成自动命名，跳过');
          return null;
        }
      }

      // 获取对话内容作为命名依据
      const messages = topic.messages || [];
      if (messages.length < 2) {
        console.log('消息数量不足，无法生成有意义的标题');
        return null;
      }

      // 过滤出有效的消息内容（排除空消息和系统消息）
      const validMessages = [];

      for (const msg of messages) {
        if (msg.role !== 'user' && msg.role !== 'assistant') continue;

        // 尝试多种方式获取消息内容
        let content = '';

        // 方法1: 使用getMainTextContent从块系统获取
        try {
          content = getMainTextContent(msg);
        } catch (error) {
          console.warn('从块系统获取内容失败:', error);
        }

        // 方法2: 如果块系统没有内容，尝试从数据库直接获取块
        if (!content || content.trim().length === 0) {
          try {
            const blocks = await dexieStorage.getMessageBlocksByMessageId(msg.id);
            const mainTextBlock = blocks.find(block => block.type === 'main_text');
            if (mainTextBlock && 'content' in mainTextBlock) {
              content = mainTextBlock.content;
            }
          } catch (error) {
            console.warn('从数据库获取块内容失败:', error);
          }
        }

        // 方法3: 兼容旧版本，尝试从content属性获取
        if (!content || content.trim().length === 0) {
          if (typeof (msg as any).content === 'string') {
            content = (msg as any).content;
          }
        }

        // 如果有有效内容，添加到列表
        if (content && content.trim().length > 0) {
          validMessages.push({ ...msg, extractedContent: content });
        }

        // 限制最多6条消息
        if (validMessages.length >= 6) break;
      }

      if (validMessages.length < 2) {
        console.log('有效消息数量不足，无法生成有意义的标题');
        return null;
      }

      // 提取消息内容作为命名依据
      const contentSummary = validMessages.map(msg => {
        const content = (msg as any).extractedContent;
        const truncatedContent = content.slice(0, 150); // 增加内容长度
        return `${msg.role === 'user' ? '用户' : 'AI'}: ${truncatedContent}`;
      }).join('\n');

      console.log('话题命名内容摘要:', contentSummary.substring(0, 300) + '...');

      // 准备系统提示 - 支持自定义提示词
      const customPrompt = store.getState().settings.topicNamingPrompt;
      const systemPrompt = customPrompt || '你是一个话题生成专家。根据对话内容生成一个简洁、精确、具有描述性的标题。标题应简洁，不超过10个字。你只需要返回标题文本，不需要解释或扩展。';

      // 使用话题命名专用模型或默认模型
      const namingModelId = modelId || store.getState().settings.topicNamingModelId || store.getState().settings.defaultModelId || 'gpt-3.5-turbo';

      console.log(`正在使用模型 ${namingModelId} 为话题生成标题...`);

      // 发送请求生成标题
      const response = await sendChatRequest({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `以下是一些对话内容，请为这个话题生成一个标题：\n\n${contentSummary}` }
        ],
        modelId: namingModelId
      });

      if (response.success && response.content) {
        // 清理可能存在的引号和换行符
        let newTitle = response.content.trim();
        if (newTitle.startsWith('"') && newTitle.endsWith('"')) {
          newTitle = newTitle.slice(1, -1).trim();
        }

        // 获取当前话题名称
        const currentName = topic.name || topic.title || '';

        // 新标题与旧标题不同且有意义
        if (newTitle && newTitle !== currentName && newTitle.length > 0) {
          // 更新话题标题
          console.log(`生成新标题: "${newTitle}"`);
          const updatedTopic = {
            ...topic,
            name: newTitle,
            title: newTitle,
            isNameManuallyEdited: forceGenerate ? false : true // 强制生成时标记为自动生成
          };

          // 在Redux中更新话题
          // 注意：newMessagesSlice 中没有直接更新话题的 action，
          // 所以我们只在数据库中更新话题，Redux 状态会在下次加载时更新

          // 同时更新数据库中的话题
          try {
            // 直接保存到数据库
            await saveTopicToDB(updatedTopic);

            // 记录已命名状态，防止重复命名（仅在非强制生成时）
            if (!forceGenerate) {
              const namingKey = `topic_naming_${topic.id}`;
              await setStorageItem(namingKey, true);
            }

            return newTitle; // 返回生成的标题
          } catch (error) {
            console.error('更新数据库中的话题失败:', error);
            return null;
          }
        } else {
          console.log('生成的话题标题无效或与旧标题相同，保持旧标题');
          return null;
        }
      } else {
        console.error('生成话题标题失败:', response.error);
        return null;
      }
    } catch (error) {
      console.error('在生成话题标题时发生错误:', error);
      return null;
    }
  }
}