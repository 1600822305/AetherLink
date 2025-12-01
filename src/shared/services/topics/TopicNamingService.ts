import { sendChatRequest } from "../../aiCore/legacy/clients";
import store from '../../store';
import type { ChatTopic } from '../../types';
import { getStorageItem, setStorageItem } from '../../utils/storage';
import { saveTopicToDB } from '../storage/storageService';
import { getMainTextContent } from '../../utils/messageUtils';
import { TopicService } from './TopicService';
import { EventEmitter, EVENT_NAMES } from '../EventService';
import { updateTopic } from '../../store/slices/assistantsSlice';
import { dexieStorage } from '../storage/DexieStorageService';

export class TopicNamingService {
  static shouldNameTopic(topic: ChatTopic): boolean {
    if (!store.getState().settings.enableTopicNaming) return false;
    if (topic.isNameManuallyEdited) return false;

    const topicName = topic.name || topic.title || '';
    const isDefaultName = (
      topicName.includes('新话题') ||
      topicName.includes('New Topic') ||
      topicName.includes('新的对话') ||
      topicName.includes('新对话') ||
      topicName === '' ||
      topicName.trim() === ''
    );
    if (!isDefaultName) return false;

    const allMessages = topic.messages || [];
    let userMessageCount = 0;
    let assistantMessageCount = 0;

    if (allMessages.length > 0) {
      userMessageCount = allMessages.filter(m => m.role === 'user').length;
      assistantMessageCount = allMessages.filter(m => m.role === 'assistant' && (!m.status || m.status === 'success')).length;
      
      if (userMessageCount === 0 && topic.messageIds?.length >= 6) {
        userMessageCount = 3;
        assistantMessageCount = 3;
      }
    } else if (topic.messageIds?.length >= 6) {
      userMessageCount = 3;
      assistantMessageCount = 3;
    } else {
      return false;
    }

    return userMessageCount >= 3 && assistantMessageCount >= 3;
  }

  static async generateTopicName(topic: ChatTopic, modelId?: string, forceGenerate: boolean = false): Promise<string | null> {
    try {
      if (!forceGenerate) {
        const alreadyNamed = await getStorageItem<boolean>(`topic_naming_${topic.id}`);
        if (alreadyNamed) return null;
      }

      let messages = topic.messages || [];
      if (messages.length === 0 || !messages.some(m => m.role === 'user')) {
        if (!topic.messageIds?.length) return null;
        messages = await TopicService.loadTopicMessages(topic.id);
        if (messages.length === 0) return null;
      }

      const userMessages = messages.filter(m => m.role === 'user');
      const assistantMessages = messages.filter(m => m.role === 'assistant' && (!m.status || m.status === 'success'));
      
      if (userMessages.length < 3 || assistantMessages.length < 3) return null;

      const validMessages = [];
      for (const msg of messages) {
        if (msg.role !== 'user' && msg.role !== 'assistant') continue;
        
        let content = '';
        try {
          content = getMainTextContent(msg);
        } catch {
          // 忽略异常
        }
        
        // 如果getMainTextContent返回空，尝试从数据库获取块内容
        if (!content && msg.blocks && msg.blocks.length > 0) {
          try {
            const blocks = await dexieStorage.getMessageBlocksByMessageId(msg.id);
            const mainTextBlock = blocks.find(block => block.type === 'main_text');
            if (mainTextBlock && 'content' in mainTextBlock) {
              content = mainTextBlock.content;
            }
          } catch {
            // 忽略数据库获取失败
          }
        }
        
        // 最后尝试从旧版本的content属性获取
        if (!content && typeof (msg as any).content === 'string') {
          content = (msg as any).content;
        }

        if (content && content.trim().length > 0) {
          validMessages.push({ ...msg, extractedContent: content });
          if (validMessages.length >= 6) break;
        }
      }

      if (validMessages.length < 2) return null;

      const contentSummary = validMessages.map(msg => {
        const content = (msg as any).extractedContent;
        const truncatedContent = content.slice(0, 150);
        return `${msg.role === 'user' ? '用户' : 'AI'}: ${truncatedContent}`;
      }).join('\n');

      const customPrompt = store.getState().settings.topicNamingPrompt;
      const systemPrompt = customPrompt || '你是一个话题生成专家。根据对话内容生成一个简洁、精确、具有描述性的标题。标题应简洁，不超过10个字。你只需要返回标题文本，不需要解释或扩展。';
      
      // 根据设置决定使用哪个模型
      const useCurrentTopicModel = store.getState().settings.topicNamingUseCurrentModel ?? true;
      const currentModelId = store.getState().settings.currentModelId;
      let namingModelId: string;
      if (modelId) {
        // 如果传入了 modelId 参数，优先使用
        namingModelId = modelId;
      } else if (useCurrentTopicModel && currentModelId) {
        // 如果启用了"使用当前话题模型"且有当前选择的模型，使用当前模型
        namingModelId = currentModelId;
      } else {
        // 否则使用配置的命名模型或默认模型
        namingModelId = store.getState().settings.topicNamingModelId || store.getState().settings.defaultModelId || 'gpt-3.5-turbo';
      }

      const response = await sendChatRequest({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `以下是一些对话内容，请为这个话题生成一个标题：\n\n${contentSummary}` }
        ],
        modelId: namingModelId
      });

      if (!response.success || !response.content) return null;

      let newTitle = response.content.trim();
      if (newTitle.startsWith('"') && newTitle.endsWith('"')) {
        newTitle = newTitle.slice(1, -1).trim();
      }

      const currentName = topic.name || topic.title || '';
      if (!newTitle || newTitle === currentName || newTitle.length === 0) return null;

      const updatedTopic = {
        ...topic,
        name: newTitle,
        title: newTitle,
        isNameManuallyEdited: false
      };

      await saveTopicToDB(updatedTopic);

      if (updatedTopic.assistantId) {
        store.dispatch(updateTopic({ assistantId: updatedTopic.assistantId, topic: updatedTopic }));
      }

      EventEmitter.emit(EVENT_NAMES.TOPIC_UPDATED, updatedTopic);

      if (!forceGenerate) {
        await setStorageItem(`topic_naming_${topic.id}`, true);
      }

      return newTitle;
    } catch (error) {
      console.error('生成话题标题失败:', error);
      return null;
    }
  }
}