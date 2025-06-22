/**
 * 知识库上下文服务
 * 参考的知识库处理机制
 */

import { MobileKnowledgeService } from './MobileKnowledgeService';
import { REFERENCE_PROMPT } from '../../config/prompts';


export interface KnowledgeReference {
  id: number;
  content: string;
  sourceUrl?: string;
  type: 'file' | 'url';
  similarity?: number;
  knowledgeBaseId?: string;
  knowledgeBaseName?: string;
}

/**
 * 知识库上下文服务
 */
export class KnowledgeContextService {
  private static instance: KnowledgeContextService;
  private knowledgeCache: Map<string, KnowledgeReference[]> = new Map();

  private constructor() {}

  public static getInstance(): KnowledgeContextService {
    if (!KnowledgeContextService.instance) {
      KnowledgeContextService.instance = new KnowledgeContextService();
    }
    return KnowledgeContextService.instance;
  }

  /**
   * 为消息搜索知识库内容
   * @param messageId 消息ID
   * @param query 搜索查询
   * @param knowledgeBaseIds 知识库ID列表
   * @param options 搜索选项
   */
  async searchKnowledgeForMessage(
    messageId: string,
    query: string,
    knowledgeBaseIds: string[],
    options?: {
      limit?: number;
      threshold?: number;
    }
  ): Promise<KnowledgeReference[]> {
    try {
      const { limit = 5, threshold = 0.7 } = options || {};
      const allReferences: KnowledgeReference[] = [];
      let referenceId = 1;

      // 为每个知识库搜索
      for (const kbId of knowledgeBaseIds) {
        try {
          const knowledgeService = MobileKnowledgeService.getInstance();
          const searchResults = await knowledgeService.search({
            knowledgeBaseId: kbId,
            query,
            threshold,
            limit
          });

          // 获取知识库信息
          const knowledgeBase = await knowledgeService.getKnowledgeBase(kbId);
          const knowledgeBaseName = knowledgeBase?.name || '未知知识库';

          // 转换为引用格式
          const references: KnowledgeReference[] = searchResults.map((result) => ({
            id: referenceId++,
            content: result.content,
            type: 'file' as const,
            similarity: result.similarity,
            knowledgeBaseId: kbId,
            knowledgeBaseName,
            sourceUrl: `knowledge://${kbId}/${result.documentId}`
          }));

          allReferences.push(...references);
        } catch (error) {
          console.error(`[KnowledgeContextService] 搜索知识库 ${kbId} 失败:`, error);
        }
      }

      // 按相似度排序并限制数量
      const sortedReferences = allReferences
        .sort((a, b) => (b.similarity || 0) - (a.similarity || 0))
        .slice(0, limit);

      // 缓存结果
      this.knowledgeCache.set(`knowledge-search-${messageId}`, sortedReferences);

      console.log(`[KnowledgeContextService] 为消息 ${messageId} 搜索到 ${sortedReferences.length} 个知识库引用`);

      return sortedReferences;
    } catch (error) {
      console.error('[KnowledgeContextService] 搜索知识库失败:', error);
      return [];
    }
  }

  /**
   * 从缓存获取消息的知识库引用
   * @param messageId 消息ID
   */
  getKnowledgeReferencesFromCache(messageId: string): KnowledgeReference[] {
    const cacheKey = `knowledge-search-${messageId}`;
    return this.knowledgeCache.get(cacheKey) || [];
  }

  /**
   * 清除消息的知识库缓存
   * @param messageId 消息ID
   */
  clearKnowledgeCache(messageId: string): void {
    const cacheKey = `knowledge-search-${messageId}`;
    this.knowledgeCache.delete(cacheKey);
  }

  /**
   * 将知识库引用转换为JSON格式（风格）
   * @param references 知识库引用列表
   */
  formatKnowledgeReferencesToJSON(references: KnowledgeReference[]): string {
    if (references.length === 0) {
      return '';
    }

    return JSON.stringify(references, null, 2);
  }

  /**
   * 将知识库引用转换为上下文文本
   * @param references 知识库引用列表
   */
  formatKnowledgeReferencesToContext(references: KnowledgeReference[]): string {
    if (references.length === 0) {
      return '';
    }

    let contextText = '\n\n--- 知识库参考内容 ---\n';

    // 按知识库分组
    const groupedByKB = references.reduce((groups, ref) => {
      const kbName = ref.knowledgeBaseName || '未知知识库';
      if (!groups[kbName]) {
        groups[kbName] = [];
      }
      groups[kbName].push(ref);
      return groups;
    }, {} as Record<string, KnowledgeReference[]>);

    // 为每个知识库添加内容
    Object.entries(groupedByKB).forEach(([kbName, refs]) => {
      contextText += `\n[${kbName}]:\n`;
      refs.forEach((ref, index) => {
        const similarity = ref.similarity ? ` (相似度: ${(ref.similarity * 100).toFixed(1)}%)` : '';
        contextText += `${index + 1}. ${ref.content}${similarity}\n`;
      });
    });

    contextText += '\n--- 请基于以上知识库内容回答问题 ---\n';

    return contextText;
  }

  /**
   * 为消息添加知识库上下文（风格，使用REFERENCE_PROMPT）
   * @param messageContent 原始消息内容
   * @param messageId 消息ID
   * @param useReferencePrompt 是否使用REFERENCE_PROMPT格式
   */
  addKnowledgeContextToMessage(
    messageContent: string,
    messageId: string,
    useReferencePrompt: boolean = true
  ): string {
    const references = this.getKnowledgeReferencesFromCache(messageId);
    if (references.length === 0) {
      return messageContent;
    }

    if (useReferencePrompt) {
      // 使用的REFERENCE_PROMPT格式
      const referenceContent = `\`\`\`json\n${this.formatKnowledgeReferencesToJSON(references)}\n\`\`\``;
      return REFERENCE_PROMPT
        .replace('{question}', messageContent)
        .replace('{references}', referenceContent);
    } else {
      // 使用简单的文本格式
      const knowledgeContext = this.formatKnowledgeReferencesToContext(references);
      return messageContent + knowledgeContext;
    }
  }

  /**
   * 清理过期的缓存
   * @param maxAge 最大缓存时间（毫秒）
   */
  cleanupExpiredCache(_maxAge: number = 24 * 60 * 60 * 1000): void {
    // 简单的清理策略：清除所有缓存
    // 在实际应用中，可以根据时间戳进行更精确的清理
    if (this.knowledgeCache.size > 100) {
      this.knowledgeCache.clear();
      console.log('[KnowledgeContextService] 清理知识库缓存');
    }
  }
}

export default KnowledgeContextService;
