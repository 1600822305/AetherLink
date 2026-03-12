import { useCallback } from 'react';
import { useDispatch } from 'react-redux';
import { newMessagesActions } from '../../../shared/store/slices/newMessagesSlice';
import { upsertManyBlocks } from '../../../shared/store/slices/messageBlocksSlice';
import { dexieStorage } from '../../../shared/services/storage/DexieStorageService';
import {
  createUserMessage,
  createAssistantMessage
} from '../../../shared/utils/messageUtils';
import { processAssistantResponse } from '../../../shared/store/thunks/message/assistantResponse';
import {
  AssistantMessageStatus
} from '../../../shared/types/newMessage.ts';
import type { MessageBlock } from '../../../shared/types/newMessage.ts';

import store from '../../../shared/store';
import type { SiliconFlowImageFormat, Model, ChatTopic } from '../../../shared/types';
import type { Message } from '../../../shared/types/newMessage.ts';

/**
 * 处理多模型并行发送消息的钩子
 * 支持同时向多个模型发送相同的消息
 */
export const useMultiModelSend = (
  currentTopic: ChatTopic | null,
  selectedModel: Model | null
) => {
  const dispatch = useDispatch();

  /**
   * 为多模型调用单个模型 - 使用标准的 processAssistantResponse
   * 这样可以正确支持思考过程显示
   */
  const callSingleModelForMultiModel = async (
    model: Model,
    assistantMessage: Message,
    assistantBlocks: MessageBlock[],
    topicId: string,
    enableTools?: boolean
  ) => {
    try {
      // 添加块到 Redux 状态
      if (assistantBlocks.length > 0) {
        dispatch(upsertManyBlocks(assistantBlocks));
      }

      // 使用标准的 processAssistantResponse 处理响应
      // 这会使用 ResponseHandler，正确处理思考过程
      await processAssistantResponse(
        dispatch as any,
        store.getState,
        assistantMessage,
        topicId,
        model,
        enableTools ?? false // 支持工具调用
      );

    } catch (error) {
      console.error(`[useMultiModelSend] 模型 ${model.id} 调用失败:`, error);

      // 更新消息状态为错误
      dispatch(newMessagesActions.updateMessage({
        id: assistantMessage.id,
        changes: {
          status: AssistantMessageStatus.ERROR,
          updatedAt: new Date().toISOString()
        }
      }));

      throw error;
    }
  };

  /**
   * 多模型发送消息
   * 支持同时向多个模型发送相同的消息
   */
  const handleMultiModelSend = useCallback(async (content: string, models: Model[], images?: SiliconFlowImageFormat[], _toolsEnabled?: boolean, files?: any[]) => {
    if (!currentTopic || !selectedModel) return;

    try {
      console.log(`[useMultiModelSend] `, models.length);
      console.log(`[useMultiModelSend] `, models.map(m => `${m.provider || m.providerType}:${m.id}`));
      console.log(`[useMultiModelSend] 选中的模型:`, models.map(m => `${m.provider || m.providerType}:${m.id}`));

      // 1. 创建用户消息，包含 mentions 字段记录选中的模型
      const { message: userMessage, blocks: userBlocks } = createUserMessage({
        content,
        assistantId: currentTopic.assistantId,
        topicId: currentTopic.id,
        modelId: selectedModel.id,
        model: selectedModel,
        images: images?.map(img => ({ url: img.image_url?.url || '' })),
        files: files?.map(file => file.fileRecord).filter(Boolean)
      });

      // 添加 mentions 字段到用户消息
      (userMessage as any).mentions = models;

      // 2. 保存用户消息和块
      await dexieStorage.saveMessage(userMessage);
      for (const block of userBlocks) {
        await dexieStorage.saveMessageBlock(block);
      }

      // 更新 Redux 状态
      dispatch(newMessagesActions.addMessage({ topicId: currentTopic.id, message: userMessage }));

      // 3. 为每个模型创建独立的助手消息
      const assistantMessages: { message: Message; blocks: MessageBlock[]; model: Model }[] = [];

      for (const model of models) {
        const { message: assistantMessage, blocks: assistantBlocks } = createAssistantMessage({
          assistantId: currentTopic.assistantId,
          topicId: currentTopic.id,
          askId: userMessage.id, // 关键：所有助手消息共享同一个 askId
          modelId: model.id,
          model: model,
          status: AssistantMessageStatus.PENDING
        });

        // 保存助手消息和块
        await dexieStorage.saveMessage(assistantMessage);
        for (const block of assistantBlocks) {
          await dexieStorage.saveMessageBlock(block);
        }

        // 更新 Redux 状态
        dispatch(newMessagesActions.addMessage({ topicId: currentTopic.id, message: assistantMessage }));

        assistantMessages.push({ message: assistantMessage, blocks: assistantBlocks, model });
      }

      // 4. 并行调用所有模型
      await Promise.all(assistantMessages.map(async ({ message: assistantMessage, blocks: assistantBlocks, model }) => {
        try {
          await callSingleModelForMultiModel(model, assistantMessage, assistantBlocks, currentTopic.id, _toolsEnabled);
        } catch (error) {
          console.error(`[useMultiModelSend] 模型 ${model.id} 调用失败:`, error);
          // 更新消息状态为错误
          dispatch(newMessagesActions.updateMessage({
            id: assistantMessage.id,
            changes: {
              status: AssistantMessageStatus.ERROR,
              updatedAt: new Date().toISOString()
            }
          }));
        }
      }));

    } catch (error) {
      console.error('[useMultiModelSend] 多模型发送失败:', error);
    }
  }, [currentTopic, selectedModel, dispatch]);

  return { handleMultiModelSend };
};
