import { dexieStorage } from '../../../services/storage/DexieStorageService';
import { newMessagesActions } from '../../slices/newMessagesSlice';
import { removeManyBlocks } from '../../slices/messageBlocksSlice';
import { DataRepository } from '../../../services/storage/DataRepository';
import { createAssistantMessage } from '../../../utils/messageUtils';
import { saveMessageAndBlocksToDB } from './utils';
import { refreshTopicPreview } from '../../../services/topics/TopicPreviewService';
import { processAssistantResponse } from './assistantResponse';
import { versionService } from '../../../services/messages/VersionService';
import { getMainTextContent } from '../../../utils/blockUtils';
import { getModelIdentityKey } from '../../../utils/modelUtils';
import type { Message } from '../../../types/newMessage';
import type { Model } from '../../../types';
import type { RootState, AppDispatch } from '../../index';
import { AssistantMessageStatus } from '../../../types/newMessage';

/**
 * 统一的重新生成选项接口
 * 企业级代码标准：使用清晰的接口定义，避免重复代码
 */
export interface RegenerateOptions {
  /** 消息ID - 用户消息ID或助手消息ID */
  messageId: string;
  /** 话题ID */
  topicId: string;
  /** 使用的模型 */
  model: Model;
  /** 来源类型：user=用户消息重发，assistant=AI消息重新生成 */
  source: 'user' | 'assistant';
  /** 是否保存版本历史，默认true */
  saveVersion?: boolean;
}

export const deleteMessage = (messageId: string, topicId: string) => async (dispatch: AppDispatch) => {
  try {
    // 1. 获取消息
    const message = await dexieStorage.getMessage(messageId);
    if (!message) {
      throw new Error(`消息 ${messageId} 不存在`);
    }

    // 2. 获取消息块
    const blocks = await dexieStorage.getMessageBlocksByMessageId(messageId);
    const blockIds = blocks.map(block => block.id);

    // 3. 从Redux中移除消息块
    if (blockIds.length > 0) {
      dispatch(removeManyBlocks(blockIds));
    }

    // 4. 从Redux中移除消息
    dispatch(newMessagesActions.removeMessage({ topicId, messageId }));

    // 5. 从数据库中删除消息块和消息
    await dexieStorage.transaction('rw', [
      dexieStorage.messages,
      dexieStorage.message_blocks,
      dexieStorage.topics
    ], async () => {
      // 删除消息块
      if (blockIds.length > 0) {
        await dexieStorage.message_blocks.bulkDelete(blockIds);
      }

      // 删除messages表中的消息（保持兼容性）
      await dexieStorage.messages.delete(messageId);

      // 更新topics表中的messageIds数组
      const topic = await dexieStorage.topics.get(topicId);
      if (topic) {
        // 更新messageIds数组
        if (topic.messageIds) {
          topic.messageIds = topic.messageIds.filter(id => id !== messageId);
        }

        // 更新lastMessageTime - 从剩余消息中获取最新时间
        if (topic.messageIds && topic.messageIds.length > 0) {
          // 获取最后一条消息的时间
          const lastMessageId = topic.messageIds[topic.messageIds.length - 1];
          const lastMessage = await dexieStorage.messages.get(lastMessageId);
          topic.lastMessageTime = lastMessage?.createdAt || lastMessage?.updatedAt || new Date().toISOString();
        } else {
          topic.lastMessageTime = new Date().toISOString();
        }

        // 保存更新后的话题
        await dexieStorage.topics.put(topic);
      }
    });

    // 删除后刷新话题预览（条数/最后消息可能已变）
    void refreshTopicPreview(topicId);

    return true;
  } catch (error) {
    console.error(`删除消息失败:`, error);
    throw error;
  }
};

/**
 * 统一的重新生成响应函数
 * 企业级代码标准：合并 resendUserMessage 和 regenerateMessage 为单一入口
 * 
 * @param options 重新生成选项
 * @returns Redux Thunk 函数
 */
export const regenerateResponse = (options: RegenerateOptions) =>
  async (dispatch: AppDispatch, getState: () => RootState) => {
    const { messageId, topicId, model, source, saveVersion = true } = options;
    
    console.log(`[regenerateResponse] 开始重新生成响应`, {
      messageId,
      topicId,
      source,
      saveVersion,
      model: { id: model.id, name: model.name, provider: model.provider }
    });

    try {
      // Step 1: 获取目标助手消息
      const assistantMessages = await getTargetAssistantMessages(
        messageId, 
        topicId, 
        model, 
        source, 
        dispatch
      );

      if (assistantMessages.length === 0) {
        throw new Error('没有找到或创建助手消息');
      }

      // Step 2: 为每个助手消息执行重新生成
      for (const assistantMsg of assistantMessages) {
        // 2.1 保存版本（如果启用且有内容）
        let messageWithVersion = assistantMsg;
        if (saveVersion) {
          messageWithVersion = await saveMessageVersionIfNeeded(assistantMsg);
        }

        // 2.2 重置助手消息并删除旧块
        const resetMessage = await resetAssistantMessageForRegenerate(
          messageWithVersion,
          topicId,
          model,
          dispatch
        );

        // 2.3 设置流式状态
        dispatch(newMessagesActions.setTopicLoading({ topicId, loading: true }));
        dispatch(newMessagesActions.setTopicStreaming({ topicId, streaming: true }));

        // 2.4 处理助手响应
        await processAssistantResponse(dispatch, getState, resetMessage, topicId, model, true);
      }

      return true;
    } catch (error) {
      console.error(`[regenerateResponse] 重新生成失败:`, error);

      // 清除加载状态
      dispatch(newMessagesActions.setTopicLoading({ topicId, loading: false }));
      dispatch(newMessagesActions.setTopicStreaming({ topicId, streaming: false }));

      throw error;
    }
  };

/**
 * 获取目标助手消息
 * - source='user': 查找关联的助手消息，如不存在则创建
 * - source='assistant': 直接返回该助手消息
 */
async function getTargetAssistantMessages(
  messageId: string,
  topicId: string,
  model: Model,
  source: 'user' | 'assistant',
  dispatch: AppDispatch
): Promise<Message[]> {
  if (source === 'assistant') {
    // 直接获取助手消息
    const message = await dexieStorage.getMessage(messageId);
    if (!message) {
      throw new Error(`消息 ${messageId} 不存在`);
    }
    if (message.role !== 'assistant') {
      throw new Error('指定的消息不是助手消息');
    }
    return [message];
  }

  // source === 'user': 查找或创建关联的助手消息
  const userMessage = await dexieStorage.getMessage(messageId);
  if (!userMessage) {
    throw new Error(`用户消息 ${messageId} 不存在`);
  }
  if (userMessage.role !== 'user') {
    throw new Error('指定的消息不是用户消息');
  }

  // 获取主题信息
  const topic = await DataRepository.topics.getById(topicId);
  if (!topic) {
    throw new Error(`主题 ${topicId} 不存在`);
  }
  const assistantId = topic.assistantId || '';
  if (!assistantId) {
    throw new Error('找不到当前助手ID');
  }

  // 查找关联的助手消息
  const allMessages = await dexieStorage.getMessagesByTopicId(topicId);
  const associatedAssistants = allMessages.filter((msg: Message) =>
    msg.role === 'assistant' && msg.askId === messageId
  );

  if (associatedAssistants.length > 0) {
    return associatedAssistants;
  }

  // 没有关联的助手消息，创建新的
  const { message: newAssistantMessage } = createAssistantMessage({
    assistantId,
    topicId,
    modelId: getModelIdentityKey({ id: model.id, provider: model.provider }),
    model,
    askId: messageId
  });

  // 添加到Redux状态
  dispatch(newMessagesActions.addMessage({ topicId, message: newAssistantMessage }));

  // 保存到数据库
  await saveMessageAndBlocksToDB(newAssistantMessage, []);

  return [newAssistantMessage];
}

/**
 * 保存消息版本（如果有内容）
 */
async function saveMessageVersionIfNeeded(message: Message): Promise<Message> {
  try {
    const currentContent = getMainTextContent(message);
    if (!currentContent.trim()) {
      return message;
    }

    await versionService.saveCurrentAsVersion(
      message.id,
      currentContent,
      message.model || { id: message.modelId, provider: (message as any).model?.provider },
      'regenerate'
    );
    console.log(`[regenerateResponse] 版本已保存，内容长度: ${currentContent.length}`);

    // 重新获取消息以获取最新的版本信息
    const messageWithVersions = await dexieStorage.getMessage(message.id);
    if (messageWithVersions) {
      console.log(`[regenerateResponse] 版本数: ${messageWithVersions.versions?.length || 0}`);
      return messageWithVersions;
    }
    return message;
  } catch (versionError) {
    console.error(`[regenerateResponse] 保存版本失败:`, versionError);
    return message; // 版本保存失败不影响主流程
  }
}

/**
 * 重置助手消息准备重新生成
 */
async function resetAssistantMessageForRegenerate(
  message: Message,
  topicId: string,
  model: Model,
  dispatch: AppDispatch
): Promise<Message> {
  // 获取并删除旧的消息块
  const blocks = await dexieStorage.getMessageBlocksByMessageId(message.id);
  const blockIds = blocks.map(block => block.id);

  if (blockIds.length > 0) {
    dispatch(removeManyBlocks(blockIds));
  }

  // 创建重置后的消息
  const resetMessage: Message = {
    ...message,
    status: AssistantMessageStatus.STREAMING,
    updatedAt: new Date().toISOString(),
    model: model,
    modelId: getModelIdentityKey({ id: model.id, provider: model.provider }),
    blocks: [],
    versions: message.versions || []
  };

  console.log(`[regenerateResponse] 消息已重置`, {
    messageId: resetMessage.id,
    newModelId: resetMessage.modelId,
    newModelName: resetMessage.model?.name
  });

  // 更新Redux状态
  dispatch(newMessagesActions.updateMessage({
    id: message.id,
    changes: resetMessage
  }));

  // 更新数据库
  await dexieStorage.transaction('rw', [
    dexieStorage.messages,
    dexieStorage.message_blocks,
    dexieStorage.topics
  ], async () => {
    // 删除消息块
    if (blockIds.length > 0) {
      await dexieStorage.deleteMessageBlocksByIds(blockIds);
    }

    // 更新消息
    await dexieStorage.updateMessage(message.id, resetMessage);

    // 确保消息在topic的messageIds中
    const topic = await dexieStorage.topics.get(topicId);
    if (topic) {
      if (!topic.messageIds) {
        topic.messageIds = [];
      }
      if (!topic.messageIds.includes(resetMessage.id)) {
        topic.messageIds.push(resetMessage.id);
      }
      await dexieStorage.topics.put(topic);
    }
  });

  return resetMessage;
}
