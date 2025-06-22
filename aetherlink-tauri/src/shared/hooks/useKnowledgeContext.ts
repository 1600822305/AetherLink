/**
 * 知识库上下文处理Hook
 * 用于在发送消息时应用知识库内容
 */

import { useCallback } from 'react';
import { REFERENCE_PROMPT } from '../config/prompts';

export interface KnowledgeContextData {
  knowledgeBase: any;
  references: any[];
  messageId: string;
  isSelected: boolean;
  searchOnSend: boolean;
}

/**
 * 知识库上下文Hook
 */
export const useKnowledgeContext = () => {
  /**
   * 获取存储的知识库上下文
   */
  const getStoredKnowledgeContext = useCallback((): KnowledgeContextData | null => {
    try {
      const stored = window.sessionStorage.getItem('selectedKnowledgeBase');
      if (stored) {
        return JSON.parse(stored);
      }
      return null;
    } catch (error) {
      console.error('获取知识库上下文失败:', error);
      return null;
    }
  }, []);

  /**
   * 清除存储的知识库上下文
   */
  const clearStoredKnowledgeContext = useCallback(() => {
    try {
      window.sessionStorage.removeItem('selectedKnowledgeBase');
    } catch (error) {
      console.error('清除知识库上下文失败:', error);
    }
  }, []);

  /**
   * 应用知识库上下文到消息（风格：发送时搜索）
   * @param originalMessage 原始消息内容
   * @param useReferencePrompt 是否使用REFERENCE_PROMPT格式
   * @returns 处理后的消息内容
   */
  const applyKnowledgeContext = useCallback(async (
    originalMessage: string,
    useReferencePrompt: boolean = true
  ): Promise<string> => {
    const contextData = getStoredKnowledgeContext();

    // 检查是否有选中的知识库且需要搜索
    if (!contextData || !contextData.isSelected || !contextData.searchOnSend) {
      return originalMessage;
    }

    try {
      console.log('[useKnowledgeContext] 开始搜索知识库内容...');

      // 动态导入MobileKnowledgeService（避免循环依赖）
      const { MobileKnowledgeService } = await import('../services/knowledge/MobileKnowledgeService');
      const knowledgeService = MobileKnowledgeService.getInstance();

      // 基于用户问题搜索知识库
      const searchResults = await knowledgeService.search({
        knowledgeBaseId: contextData.knowledgeBase.id,
        query: originalMessage.trim(),
        threshold: 0.6,
        limit: contextData.knowledgeBase.documentCount || 5 // 使用知识库配置的文档数量
      });

      console.log(`[useKnowledgeContext] 搜索到 ${searchResults.length} 个相关内容`);

      if (searchResults.length === 0) {
        console.log('[useKnowledgeContext] 未找到相关内容');
        return originalMessage;
      }

      // 转换为引用格式
      const references = searchResults.map((result, index) => ({
        id: index + 1,
        content: result.content,
        type: 'file' as const,
        similarity: result.similarity,
        knowledgeBaseId: contextData.knowledgeBase.id,
        knowledgeBaseName: contextData.knowledgeBase.name,
        sourceUrl: `knowledge://${contextData.knowledgeBase.id}/${result.documentId || index}`
      }));

      if (useReferencePrompt) {
        // 使用的REFERENCE_PROMPT格式
        const referenceContent = `\`\`\`json\n${JSON.stringify(references, null, 2)}\n\`\`\``;
        const processedMessage = REFERENCE_PROMPT
          .replace('{question}', originalMessage)
          .replace('{references}', referenceContent);

        console.log('[useKnowledgeContext] 应用REFERENCE_PROMPT格式');
        return processedMessage;
      } else {
        // 使用简单的文本格式
        let knowledgeContent = '\n\n--- 知识库参考内容 ---\n';

        knowledgeContent += `\n[${contextData.knowledgeBase.name}]:\n`;
        references.forEach((ref, index) => {
          const similarity = ref.similarity ? ` (相似度: ${(ref.similarity * 100).toFixed(1)}%)` : '';
          knowledgeContent += `${index + 1}. ${ref.content}${similarity}\n`;
        });

        knowledgeContent += '\n--- 请基于以上知识库内容回答问题 ---\n';

        console.log('[useKnowledgeContext] 应用简单文本格式');
        return originalMessage + knowledgeContent;
      }
    } catch (error) {
      console.error('搜索知识库失败:', error);
      return originalMessage;
    }
  }, [getStoredKnowledgeContext]);

  /**
   * 检查是否有知识库上下文
   */
  const hasKnowledgeContext = useCallback((): boolean => {
    const contextData = getStoredKnowledgeContext();
    return !!(contextData && contextData.isSelected && contextData.searchOnSend);
  }, [getStoredKnowledgeContext]);

  /**
   * 获取知识库信息摘要
   */
  const getKnowledgeContextSummary = useCallback((): string | null => {
    const contextData = getStoredKnowledgeContext();
    if (!contextData || !contextData.isSelected) {
      return null;
    }

    const kbName = contextData.knowledgeBase?.name || '未知知识库';
    return `${kbName} (将在发送时搜索)`;
  }, [getStoredKnowledgeContext]);

  return {
    getStoredKnowledgeContext,
    clearStoredKnowledgeContext,
    applyKnowledgeContext,
    hasKnowledgeContext,
    getKnowledgeContextSummary
  };
};

export default useKnowledgeContext;
