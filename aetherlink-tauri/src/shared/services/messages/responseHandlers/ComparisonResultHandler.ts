import store from '../../../store';
import { dexieStorage } from '../../storage/DexieStorageService';
import { AssistantMessageStatus } from '../../../types/newMessage';
import { newMessagesActions } from '../../../store/slices/newMessagesSlice';
import { addOneBlock } from '../../../store/slices/messageBlocksSlice';
import { parseComparisonResult, createModelComparisonBlock } from '../../../utils/modelComparisonUtils';

/**
 * 对比结果处理器 - 处理模型对比结果的逻辑
 */
export class ComparisonResultHandler {
  private messageId: string;

  constructor(messageId: string) {
    this.messageId = messageId;
  }

  /**
   * 处理对比结果
   * @param reasoningData 对比结果的JSON字符串
   */
  async handleComparisonResult(reasoningData: string) {
    try {
      console.log(`[ComparisonResultHandler] 处理对比结果，数据长度: ${reasoningData.length}`);

      // 解析对比结果
      const comboResult = parseComparisonResult(reasoningData);

      if (!comboResult) {
        console.error(`[ComparisonResultHandler] 解析对比结果失败`);
        return;
      }

      console.log(`[ComparisonResultHandler] 成功解析对比结果，模型数量: ${comboResult.modelResults.length}`);

      // 创建对比消息块
      const comparisonBlock = createModelComparisonBlock(comboResult, this.messageId);

      // 添加到Redux状态
      store.dispatch(addOneBlock(comparisonBlock));

      // 保存到数据库
      await dexieStorage.saveMessageBlock(comparisonBlock);

      // 将块添加到消息的blocks数组（使用最常用的方式）
      const currentMessage = store.getState().messages.entities[this.messageId];
      if (currentMessage) {
        const updatedBlocks = [...(currentMessage.blocks || []), comparisonBlock.id];

        // 🔧 修复：同时更新 Redux 和数据库
        store.dispatch(newMessagesActions.updateMessage({
          id: this.messageId,
          changes: {
            blocks: updatedBlocks
          }
        }));

        // 🔧 关键修复：同步更新数据库中的消息blocks数组
        await dexieStorage.updateMessage(this.messageId, {
          blocks: updatedBlocks
        });

        console.log(`[ComparisonResultHandler] 已更新消息 ${this.messageId} 的blocks数组: [${updatedBlocks.join(', ')}]`);
      } else {
        console.error(`[ComparisonResultHandler] 找不到消息: ${this.messageId}`);
      }

      console.log(`[ComparisonResultHandler] 对比块创建完成: ${comparisonBlock.id}`);

      // 更新消息状态为成功
      store.dispatch(newMessagesActions.updateMessage({
        id: this.messageId,
        changes: {
          status: AssistantMessageStatus.SUCCESS,
          updatedAt: new Date().toISOString()
        }
      }));

    } catch (error) {
      console.error(`[ComparisonResultHandler] 处理对比结果失败:`, error);
    }
  }

  /**
   * 检查是否是对比结果
   */
  isComparisonResult(chunk: string, reasoning?: string): boolean {
    return chunk === '__COMPARISON_RESULT__' && !!reasoning;
  }
}
