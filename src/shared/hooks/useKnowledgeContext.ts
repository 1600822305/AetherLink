/**
 * 知识库上下文处理Hook
 * 用于在发送消息时应用知识库内容
 * 
 * 状态管理：通过 Redux knowledgeSelectionSlice 管理知识库选择状态
 */

import { useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import type { RootState } from '../store';
import { clearSelectedKnowledgeBase, removeSelectedKnowledgeBase } from '../store/slices/knowledgeSelectionSlice';
import type { KnowledgeSelectionState, SelectedKnowledgeInfo } from '../store/slices/knowledgeSelectionSlice';
import { REFERENCE_PROMPT } from '../config/prompts';
import { createLogger } from '../services/infra/logger';

const logger = createLogger('useKnowledgeContext');

export interface KnowledgeContextData {
  knowledgeBase: {
    id: string;
    name: string;
    documentCount?: number;
  };
  isSelected: boolean;
  searchOnSend: boolean;
}

/**
 * 知识库上下文Hook
 */
export const useKnowledgeContext = () => {
  const knowledgeSelection = useSelector((state: RootState) => state.knowledgeSelection);
  const dispatch = useDispatch();

  /**
   * 获取存储的知识库上下文（向后兼容单选）
   */
  const getStoredKnowledgeContext = useCallback((): KnowledgeContextData | null => {
    return knowledgeSelection.selectedKnowledgeBase || null;
  }, [knowledgeSelection.selectedKnowledgeBase]);

  /**
   * 获取所有已选中的知识库列表（多选模式）
   */
  const getSelectedKnowledgeBases = useCallback((): SelectedKnowledgeInfo[] => {
    return knowledgeSelection.selectedKnowledgeBases || [];
  }, [knowledgeSelection.selectedKnowledgeBases]);

  /**
   * 移除单个知识库
   */
  const removeKnowledgeBase = useCallback((id: string) => {
    dispatch(removeSelectedKnowledgeBase(id));
  }, [dispatch]);

  /**
   * 清除存储的知识库上下文
   */
  const clearStoredKnowledgeContext = useCallback(() => {
    dispatch(clearSelectedKnowledgeBase());
  }, [dispatch]);

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
      logger.debug('开始搜索知识库内容...');

      // 动态导入MobileKnowledgeService（避免循环依赖）
      const { MobileKnowledgeService } = await import('../services/knowledge/MobileKnowledgeService');
      const knowledgeService = MobileKnowledgeService.getInstance();

      // 基于用户问题搜索知识库
      const searchResults = await knowledgeService.search({
        knowledgeBaseId: contextData.knowledgeBase.id,
        query: originalMessage.trim(),
        threshold: 0.6,
        limit: contextData.knowledgeBase.documentCount || 5
      });

      logger.debug(`搜索到 ${searchResults.length} 个相关内容`);

      if (searchResults.length === 0) {
        logger.debug('未找到相关内容');
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

        logger.debug('应用REFERENCE_PROMPT格式');
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

        logger.debug('应用简单文本格式');
        return originalMessage + knowledgeContent;
      }
    } catch (error) {
      logger.error('搜索知识库失败:', error);
      return originalMessage;
    }
  }, [getStoredKnowledgeContext]);

  /**
   * 检查是否有知识库上下文（支持多选）
   */
  const hasKnowledgeContext = useCallback((): boolean => {
    // 优先检查多选列表
    if (knowledgeSelection.selectedKnowledgeBases?.length > 0) return true;
    // 兼容旧的单选
    const contextData = getStoredKnowledgeContext();
    return !!(contextData && contextData.isSelected && contextData.searchOnSend);
  }, [knowledgeSelection.selectedKnowledgeBases, getStoredKnowledgeContext]);

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
    getSelectedKnowledgeBases,
    clearStoredKnowledgeContext,
    removeKnowledgeBase,
    applyKnowledgeContext,
    hasKnowledgeContext,
    getKnowledgeContextSummary
  };
};

/**
 * 非 Hook 版本：从 Redux store 中直接获取知识库选择状态
 * 供 thunks 等非 React 上下文使用
 */
export function getKnowledgeSelectionFromStore(
  state: { knowledgeSelection: KnowledgeSelectionState }
): KnowledgeContextData | null {
  return state.knowledgeSelection.selectedKnowledgeBase || null;
}

export default useKnowledgeContext;
