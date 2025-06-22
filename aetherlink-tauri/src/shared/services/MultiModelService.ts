import { v4 as uuid } from 'uuid';
import store from '../store';
import { dexieStorage } from './storage/DexieStorageService';
import { MessageBlockStatus, MessageBlockType } from '../types/newMessage';
import type { MultiModelMessageBlock } from '../types/newMessage';
import { addOneBlock, updateOneBlock, removeOneBlock } from '../store/slices/messageBlocksSlice';
import { newMessagesActions } from '../store/slices/newMessagesSlice';
import { EventEmitter, EVENT_NAMES } from './EventEmitter';
import type { Model } from '../types';

/**
 * 多模型响应接口
 */
interface ModelResponse {
  modelId: string;
  modelName: string;
  content: string;
  status: MessageBlockStatus;
}

/**
 * 多模型响应服务
 * 用于处理多模型并行响应
 */
export class MultiModelService {
  /**
   * 创建多模型响应块
   * @param messageId 消息ID
   * @param models 要使用的模型列表
   * @param displayStyle 显示样式
   * @returns 创建的块ID
   */
  async createMultiModelBlock(
    messageId: string,
    models: Model[],
    displayStyle: 'horizontal' | 'vertical' | 'grid' = 'horizontal'
  ): Promise<string> {
    // 输入验证
    if (!messageId || typeof messageId !== 'string') {
      throw new Error('messageId 不能为空且必须是字符串');
    }

    if (!models || !Array.isArray(models) || models.length === 0) {
      throw new Error('模型列表不能为空');
    }

    // 验证消息是否存在
    const message = await dexieStorage.getMessage(messageId);
    if (!message) {
      throw new Error(`消息 ${messageId} 不存在`);
    }

    // 创建块ID
    const blockId = `multi-model-${uuid()}`;

    // 创建响应数组
    const responses = models.map(model => ({
      modelId: model.id,
      modelName: model.name || model.id,
      content: '',
      status: MessageBlockStatus.PENDING
    }));

    // 创建多模型块
    const multiModelBlock = {
      id: blockId,
      messageId,
      type: MessageBlockType.MULTI_MODEL,
      responses,
      displayStyle,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: MessageBlockStatus.PENDING
    };

    try {
      // 保存到数据库
      await dexieStorage.saveMessageBlock(multiModelBlock);

      // 添加到Redux状态
      store.dispatch(addOneBlock(multiModelBlock));

      // 使用已验证的消息对象
      // 更新消息的块列表
      const updatedBlocks = [...(message.blocks || []), blockId];

      // 🔧 按照文档修复：必须同时执行数据库和Redux更新
      await dexieStorage.updateMessage(messageId, {
        blocks: updatedBlocks
      });
      store.dispatch(newMessagesActions.updateMessage({
        id: messageId,
        changes: {
          blocks: updatedBlocks
        }
      }));

      // 验证数据一致性（按照文档调试技巧）
      const dbMessage = await dexieStorage.getMessage(messageId);
      const reduxMessage = store.getState().messages.entities[messageId];
      console.log(`[MultiModelService] 数据一致性验证 - 数据库blocks: [${dbMessage?.blocks?.join(', ')}], Redux blocks: [${reduxMessage?.blocks?.join(', ')}]`);
    } catch (error) {
      console.error(`[MultiModelService] 创建多模型块失败: ${blockId}`, error);

      // 清理可能的部分数据
      try {
        await dexieStorage.deleteMessageBlock(blockId);
        store.dispatch(removeOneBlock(blockId));
      } catch (cleanupError) {
        console.error(`[MultiModelService] 清理失败的块时出错:`, cleanupError);
      }

      throw error;
    }

    // 发送事件
    EventEmitter.emit(EVENT_NAMES.BLOCK_CREATED, { blockId, type: MessageBlockType.MULTI_MODEL });

    return blockId;
  }

  /**
   * 更新多模型响应块中的单个模型响应
   * @param blockId 块ID
   * @param modelId 模型ID
   * @param content 内容
   * @param status 状态
   */
  async updateModelResponse(
    blockId: string,
    modelId: string,
    content: string,
    status: MessageBlockStatus = MessageBlockStatus.STREAMING
  ): Promise<void> {
    // 获取块
    const block = await dexieStorage.getMessageBlock(blockId);

    if (!block || block.type !== MessageBlockType.MULTI_MODEL) {
      throw new Error(`块 ${blockId} 不是多模型响应块`);
    }

    // 检查是否是对比块，对比块有不同的结构
    if ('subType' in block && (block as any).subType === 'comparison') {
      console.warn(`[MultiModelService] 跳过对比块的更新: ${blockId}`);
      return;
    }

    // 确保块有 responses 属性
    if (!('responses' in block) || !Array.isArray((block as any).responses)) {
      throw new Error(`块 ${blockId} 没有 responses 属性`);
    }

    // 验证modelId是否存在
    const responses = (block as MultiModelMessageBlock).responses;
    const modelExists = responses.some((r: ModelResponse) => r.modelId === modelId);
    if (!modelExists) {
      throw new Error(`模型 ${modelId} 不存在于块 ${blockId} 中`);
    }

    // 更新响应
    const updatedResponses: ModelResponse[] = responses.map((response: ModelResponse) => {
      if (response.modelId === modelId) {
        return {
          ...response,
          content,
          status
        };
      }
      return response;
    });

    // 计算块的整体状态 - 修复优先级逻辑：ERROR > STREAMING > PENDING > SUCCESS
    let blockStatus: MessageBlockStatus;

    if (updatedResponses.some((r: ModelResponse) => r.status === MessageBlockStatus.ERROR)) {
      blockStatus = MessageBlockStatus.ERROR;
    } else if (updatedResponses.some((r: ModelResponse) => r.status === MessageBlockStatus.STREAMING)) {
      blockStatus = MessageBlockStatus.STREAMING;
    } else if (updatedResponses.some((r: ModelResponse) => r.status === MessageBlockStatus.PENDING)) {
      blockStatus = MessageBlockStatus.PENDING;
    } else {
      blockStatus = MessageBlockStatus.SUCCESS;
    }

    // 更新块
    const updatedBlock = {
      ...block,
      responses: updatedResponses,
      status: blockStatus,
      updatedAt: new Date().toISOString()
    };

    try {
      // 🔧 按照文档修复：必须同时执行数据库和Redux更新
      await dexieStorage.updateMessageBlock(blockId, updatedBlock);
      store.dispatch(updateOneBlock({
        id: blockId,
        changes: {
          responses: updatedResponses,
          status: blockStatus,
          updatedAt: new Date().toISOString()
        }
      }));
    } catch (error) {
      console.error(`[MultiModelService] 更新多模型响应失败: ${blockId}`, error);
      throw error;
    }

    // 发送事件
    EventEmitter.emit(EVENT_NAMES.BLOCK_UPDATED, {
      blockId,
      modelId,
      status: blockStatus
    });
  }

  /**
   * 完成多模型响应块中的单个模型响应
   * @param blockId 块ID
   * @param modelId 模型ID
   * @param content 最终内容
   */
  async completeModelResponse(
    blockId: string,
    modelId: string,
    content: string
  ): Promise<void> {
    await this.updateModelResponse(blockId, modelId, content, MessageBlockStatus.SUCCESS);
  }
}

// 导出单例
export const multiModelService = new MultiModelService();
