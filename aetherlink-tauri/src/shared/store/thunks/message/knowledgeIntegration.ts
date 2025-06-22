import { newMessagesActions } from '../../slices/newMessagesSlice';
import { DataRepository } from '../../../services/storage/DataRepository';
import { MobileKnowledgeService } from '../../../services/knowledge/MobileKnowledgeService';
import { getMainTextContent } from '../../../utils/blockUtils';
import { AssistantMessageStatus } from '../../../types/newMessage';
import type { Message } from '../../../types/newMessage';
import type { AppDispatch } from '../../index';

export const processKnowledgeSearch = async (
  assistantMessage: Message,
  topicId: string,
  dispatch: AppDispatch
) => {
  try {
    console.log('[processKnowledgeSearch] 开始检查知识库选择状态...');

    // 检查是否有选中的知识库
    const knowledgeContextData = window.sessionStorage.getItem('selectedKnowledgeBase');
    console.log('[processKnowledgeSearch] sessionStorage数据:', knowledgeContextData);

    if (!knowledgeContextData) {
      console.log('[processKnowledgeSearch] 没有选中知识库，直接返回');
      return; // 没有选中知识库，直接返回
    }

    const contextData = JSON.parse(knowledgeContextData);
    console.log('[processKnowledgeSearch] 解析后的上下文数据:', contextData);

    if (!contextData.isSelected || !contextData.searchOnSend) {
      console.log('[processKnowledgeSearch] 不需要搜索，直接返回', {
        isSelected: contextData.isSelected,
        searchOnSend: contextData.searchOnSend
      });
      return; // 不需要搜索，直接返回
    }

    console.log('[processKnowledgeSearch] 检测到知识库选择，开始搜索...');

    // 设置消息状态为搜索中
    dispatch(newMessagesActions.updateMessage({
      id: assistantMessage.id,
      changes: {
        status: AssistantMessageStatus.SEARCHING
      }
    }));

    // 获取用户消息内容
    const topic = await DataRepository.topics.getById(topicId);
    if (!topic || !topic.messages) {
      console.warn('[processKnowledgeSearch] 无法获取话题消息');
      return;
    }

    // 找到最后一条用户消息
    const userMessage = topic.messages
      .filter((m: Message) => m.role === 'user')
      .pop();

    if (!userMessage) {
      console.warn('[processKnowledgeSearch] 未找到用户消息');
      return;
    }

    // 获取用户消息的文本内容
    const userContent = getMainTextContent(userMessage);
    if (!userContent) {
      console.warn('[processKnowledgeSearch] 用户消息内容为空');
      return;
    }

    // 搜索知识库 - 使用增强RAG
    const knowledgeService = MobileKnowledgeService.getInstance();
    const searchResults = await knowledgeService.search({
      knowledgeBaseId: contextData.knowledgeBase.id,
      query: userContent.trim(),
      threshold: 0.6,
      limit: contextData.knowledgeBase.documentCount || 5, // 使用知识库配置的文档数量
      useEnhancedRAG: true // 启用增强RAG搜索
    });

    console.log(`[processKnowledgeSearch] 搜索到 ${searchResults.length} 个相关内容`);

    if (searchResults.length > 0) {
      // 转换为KnowledgeReference格式
      const references = searchResults.map((result, index) => ({
        id: index + 1,
        content: result.content,
        type: 'file' as const,
        similarity: result.similarity,
        knowledgeBaseId: contextData.knowledgeBase.id,
        knowledgeBaseName: contextData.knowledgeBase.name,
        sourceUrl: `knowledge://${contextData.knowledgeBase.id}/${result.documentId || index}`
      }));

      // 缓存搜索结果（模拟的window.keyv）
      const cacheKey = `knowledge-search-${userMessage.id}`;
      window.sessionStorage.setItem(cacheKey, JSON.stringify(references));

      console.log(`[processKnowledgeSearch] 知识库搜索结果已缓存: ${cacheKey}`);
    }

    // 清除知识库选择状态
    window.sessionStorage.removeItem('selectedKnowledgeBase');

  } catch (error) {
    console.error('[processKnowledgeSearch] 知识库搜索失败:', error);

    // 清除知识库选择状态
    window.sessionStorage.removeItem('selectedKnowledgeBase');
  }
};