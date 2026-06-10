import { DataRepository } from '../../../services/storage/DataRepository';
import { createUserMessage, createAssistantMessage } from '../../../utils/messageUtils';
import { newMessagesActions } from '../../slices/newMessagesSlice';
import { upsertManyBlocks } from '../../slices/messageBlocksSlice';
import type { Model, FileType } from '../../../types';
import type { RootState, AppDispatch } from '../../index';
import { saveMessageAndBlocksToDB } from './utils';
import { processAssistantResponse } from './assistantResponse';
import { AssistantMessageStatus } from '../../../types/newMessage';
import { getModelIdentityKey } from '../../../utils/modelUtils';

export const sendMessage = (
  content: string,
  topicId: string,
  model: Model,
  images?: Array<{ url: string }>,
  toolsEnabled?: boolean,
  files?: FileType[]
) => async (dispatch: AppDispatch, getState: () => RootState) => {
  try {
    // 获取当前助手ID
    // 直接从数据库获取主题信息
    const topic = await DataRepository.topics.getById(topicId);
    if (!topic) {
      throw new Error(`主题 ${topicId} 不存在`);
    }
    const assistantId = topic.assistantId || '';

    if (!assistantId) {
      throw new Error('找不到当前助手ID');
    }

    // 1. 创建用户消息和块
    const { message: userMessage, blocks: userBlocks } = createUserMessage({
      content,
      assistantId,
      topicId,
      modelId: getModelIdentityKey({ id: model.id, provider: model.provider }),
      model,
      images,
      files
    });

    // 2. 保存用户消息和块到数据库
    await saveMessageAndBlocksToDB(userMessage, userBlocks);

    // 3. 更新Redux状态
    dispatch(newMessagesActions.addMessage({ topicId, message: userMessage }));
    if (userBlocks.length > 0) {
      dispatch(upsertManyBlocks(userBlocks));
    }

    // 4. 创建助手消息
    const { message: assistantMessage, blocks: assistantBlocks } = createAssistantMessage({
      assistantId,
      topicId,
      modelId: getModelIdentityKey({ id: model.id, provider: model.provider }),
      model,
      askId: userMessage.id,
      status: AssistantMessageStatus.STREAMING
    });

    // 5. 保存助手消息到数据库
    await saveMessageAndBlocksToDB(assistantMessage, assistantBlocks);

    // 6. 更新Redux状态
    dispatch(newMessagesActions.addMessage({ topicId, message: assistantMessage }));
    if (assistantBlocks.length > 0) {
      dispatch(upsertManyBlocks(assistantBlocks));
    }

    // 7. 设置加载状态
    dispatch(newMessagesActions.setTopicLoading({ topicId, loading: true }));
    dispatch(newMessagesActions.setTopicStreaming({ topicId, streaming: true }));

    // 8. 处理助手响应
    await processAssistantResponse(dispatch, getState, assistantMessage, topicId, model, toolsEnabled);

    return userMessage.id;
  } catch (error) {
    console.error('发送消息失败:', error);

    // 清除加载状态
    dispatch(newMessagesActions.setTopicLoading({ topicId, loading: false }));
    dispatch(newMessagesActions.setTopicStreaming({ topicId, streaming: false }));

    throw error;
  }
};