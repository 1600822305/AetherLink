import store from '../../../store';
import { dexieStorage } from '../../storage/DexieStorageService';
import { newMessagesActions } from '../../../store/slices/newMessagesSlice';
import { addOneBlock } from '../../../store/slices/messageBlocksSlice';
import { createKnowledgeReferenceBlock } from '../../../utils/messageUtils';

/**
 * 知识库搜索处理器 - 处理知识库搜索相关的逻辑
 */
export class KnowledgeSearchHandler {
  private messageId: string;

  constructor(messageId: string) {
    this.messageId = messageId;
  }

  /**
   * 处理知识库搜索完成事件（借鉴MCP工具块的处理机制）
   * 创建一个综合的知识库引用块，包含所有搜索结果
   */
  async handleKnowledgeSearchComplete(data: {
    messageId: string;
    knowledgeBaseId: string;
    knowledgeBaseName: string;
    searchQuery: string;
    searchResults: any[];
    references: any[];
  }) {
    try {
      console.log(`[KnowledgeSearchHandler] 处理知识库搜索完成，创建综合引用块，包含 ${data.searchResults.length} 个结果`);

      // 使用已导入的知识库引用块创建函数

      // 创建一个综合的引用块，包含所有搜索结果
      const combinedContent = data.searchResults.map((result, index) =>
        `[${index + 1}] ${result.content} (相似度: ${(result.similarity * 100).toFixed(1)}%)`
      ).join('\n\n');

      const referenceBlock = createKnowledgeReferenceBlock(
        this.messageId,
        combinedContent,
        data.knowledgeBaseId,
        {
          searchQuery: data.searchQuery,
          source: data.knowledgeBaseName,
          // 添加额外的元数据来标识这是一个综合块
          metadata: {
            isCombined: true,
            resultCount: data.searchResults.length,
            results: data.searchResults.map((result, index) => ({
              index: index + 1,
              content: result.content,
              similarity: result.similarity,
              documentId: result.documentId
            }))
          }
        }
      );

      console.log(`[KnowledgeSearchHandler] 创建综合知识库引用块: ${referenceBlock.id}`);

      // 添加到Redux状态
      store.dispatch(addOneBlock(referenceBlock));

      // 保存到数据库
      await dexieStorage.saveMessageBlock(referenceBlock);

      // 将块添加到消息的blocks数组的开头（显示在顶部）
      const currentMessage = store.getState().messages.entities[this.messageId];
      if (currentMessage) {
        const updatedBlocks = [referenceBlock.id, ...(currentMessage.blocks || [])];

        // 更新Redux中的消息
        store.dispatch(newMessagesActions.updateMessage({
          id: this.messageId,
          changes: {
            blocks: updatedBlocks
          }
        }));

        // 同步更新数据库
        await dexieStorage.updateMessage(this.messageId, {
          blocks: updatedBlocks
        });

        console.log(`[KnowledgeSearchHandler] 知识库引用块已添加到消息顶部: ${referenceBlock.id}`);
      }

      console.log(`[KnowledgeSearchHandler] 综合知识库引用块创建完成，包含 ${data.searchResults.length} 个结果`);

    } catch (error) {
      console.error(`[KnowledgeSearchHandler] 处理知识库搜索完成事件失败:`, error);
    }
  }
}
