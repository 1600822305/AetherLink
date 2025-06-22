import { dexieStorage } from '../../../services/storage/DexieStorageService';
import { newMessagesActions } from '../../slices/newMessagesSlice';
import { removeManyBlocks } from '../../slices/messageBlocksSlice';
import { DataRepository } from '../../../services/storage/DataRepository';
import { createAssistantMessage } from '../../../utils/messageUtils';
import { saveMessageAndBlocksToDB } from './utils';
import { processAssistantResponse } from './assistantResponse';
import { versionService } from '../../../services/VersionService';
import { getMainTextContent } from '../../../utils/blockUtils';
import type { Message } from '../../../types/newMessage';
import type { Model } from '../../../types';
import type { RootState, AppDispatch } from '../../index';
import { AssistantMessageStatus } from '../../../types/newMessage';

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

    return true;
  } catch (error) {
    console.error(`删除消息失败:`, error);
    throw error;
  }
};

export const resendUserMessage = (userMessageId: string, topicId: string, model: Model) =>
  async (dispatch: AppDispatch, getState: () => RootState) => {
  try {
    // 1. 获取要重新发送的用户消息
    const userMessage = await dexieStorage.getMessage(userMessageId);
    if (!userMessage) {
      throw new Error(`用户消息 ${userMessageId} 不存在`);
    }

    if (userMessage.role !== 'user') {
      throw new Error('只能重新发送用户消息');
    }

    // 2. 获取主题信息
    const topic = await DataRepository.topics.getById(topicId);
    if (!topic) {
      throw new Error(`主题 ${topicId} 不存在`);
    }
    const assistantId = topic.assistantId || '';

    if (!assistantId) {
      throw new Error('找不到当前助手ID');
    }

    // 3. 查找与此用户消息关联的助手消息
    const allMessages = await dexieStorage.getMessagesByTopicId(topicId);
    const assistantMessagesToReset = allMessages.filter((msg: Message) =>
      msg.role === 'assistant' && msg.askId === userMessageId
    );

    const resetDataList: Message[] = [];
    const allBlockIdsToDelete: string[] = [];

    // 4. 如果没有助手消息，创建一个新的
    if (assistantMessagesToReset.length === 0) {
      const { message: assistantMessage } = createAssistantMessage({
        assistantId,
        topicId,
        modelId: model.id,
        model,
        askId: userMessageId
      });

      resetDataList.push(assistantMessage);

      // 添加到Redux状态
      dispatch(newMessagesActions.addMessage({ topicId, message: assistantMessage }));

      // 保存到数据库
      await saveMessageAndBlocksToDB(assistantMessage, []);
    } else {
      // 5. 重置现有的助手消息
      for (const originalMsg of assistantMessagesToReset) {
        const blockIdsToDelete = [...(originalMsg.blocks || [])];
        allBlockIdsToDelete.push(...blockIdsToDelete);

        // 重置助手消息
        const resetMsg = {
          ...originalMsg,
          status: AssistantMessageStatus.PENDING,
          updatedAt: new Date().toISOString(),
          model: model,
          modelId: model.id,
          blocks: [] // 清空块数组
        };

        resetDataList.push(resetMsg);

        // 更新Redux状态
        dispatch(newMessagesActions.updateMessage({
          id: resetMsg.id,
          changes: resetMsg
        }));
      }

      // 6. 删除旧的消息块
      if (allBlockIdsToDelete.length > 0) {
        dispatch(removeManyBlocks(allBlockIdsToDelete));

        // 从数据库删除块
        await dexieStorage.transaction('rw', [
          dexieStorage.message_blocks,
          dexieStorage.messages,
          dexieStorage.topics
        ], async () => {
          await dexieStorage.deleteMessageBlocksByIds(allBlockIdsToDelete);

          // 更新消息到数据库
          for (const resetMsg of resetDataList) {
            await dexieStorage.updateMessage(resetMsg.id, resetMsg);
          }

          // 更新topics表中的messages数组
          const topic = await dexieStorage.topics.get(topicId);
          if (topic && topic.messages) {
            for (const resetMsg of resetDataList) {
              const messageIndex = topic.messages.findIndex((m: Message) => m.id === resetMsg.id);
              if (messageIndex >= 0) {
                topic.messages[messageIndex] = resetMsg;
              }
            }
            await dexieStorage.topics.put(topic);
          }
        });
      }
    }

    // 7. 设置加载状态
    dispatch(newMessagesActions.setTopicLoading({ topicId, loading: true }));
    dispatch(newMessagesActions.setTopicStreaming({ topicId, streaming: true }));

    // 8. 重新生成助手响应
    for (const resetMsg of resetDataList) {
      await processAssistantResponse(dispatch, getState, resetMsg, topicId, model, false);
    }

    return true;
  } catch (error) {
    console.error(`重新发送用户消息失败:`, error);

    // 清除加载状态
    dispatch(newMessagesActions.setTopicLoading({ topicId, loading: false }));
    dispatch(newMessagesActions.setTopicStreaming({ topicId, streaming: false }));

    throw error;
  }
};

export const regenerateMessage = (messageId: string, topicId: string, model: Model) =>
  async (dispatch: AppDispatch, getState: () => RootState) => {
  try {
    console.log(`[regenerateMessage] 开始重新生成消息: ${messageId}`, {
      topicId,
      newModel: {
        id: model.id,
        name: model.name,
        provider: model.provider
      }
    });

    // 1. 获取消息
    const message = await dexieStorage.getMessage(messageId);
    if (!message) {
      throw new Error(`消息 ${messageId} 不存在`);
    }

    console.log(`[regenerateMessage] 原始消息模型信息:`, {
      originalModelId: message.modelId,
      originalModel: message.model,
      newModelId: model.id,
      newModelName: model.name
    });

    // 只能重新生成助手消息
    if (message.role !== 'assistant') {
      throw new Error('只能重新生成助手消息');
    }

    // 2. 获取原始用户消息
    const askId = message.askId;
    if (!askId) {
      throw new Error('找不到原始用户消息ID');
    }

    const userMessage = await dexieStorage.getMessage(askId);
    if (!userMessage) {
      throw new Error(`找不到原始用户消息 ${askId}`);
    }

    // 3. 获取消息块
    const blocks = await dexieStorage.getMessageBlocksByMessageId(messageId);
    const blockIds = blocks.map(block => block.id);

    // 4. 基于 Chatbox 原理的版本管理 - 保存当前内容为版本
    let updatedMessage = message;
    try {
      const currentContent = getMainTextContent(message);
      if (currentContent.trim()) {
        // 传入具体内容，确保版本保存正确的内容
        // 增加modelId参数，确保版本记录正确的模型信息
        await versionService.saveCurrentAsVersion(
          messageId,
          currentContent,
          {
            ...model,
            id: model.id || message.modelId
          },
          'regenerate'
        );
        console.log(`[regenerateMessage] 当前内容已保存为版本，内容长度: ${currentContent.length}`);

        // 重新获取消息以获取最新的版本信息
        const messageWithVersions = await dexieStorage.getMessage(messageId);
        if (messageWithVersions) {
          updatedMessage = messageWithVersions;
          console.log(`[regenerateMessage] 获取到更新后的消息，版本数: ${messageWithVersions.versions?.length || 0}`);
        }
      }
    } catch (versionError) {
      console.error(`[regenerateMessage] 保存版本失败:`, versionError);
      // 版本保存失败不影响重新生成流程
    }

    // 5. 从Redux中移除消息块
    if (blockIds.length > 0) {
      dispatch(removeManyBlocks(blockIds));
    }

    // 6. 重置消息状态
    // const resetMessage = resetAssistantMessage(message, {
    //   status: AssistantMessageStatus.PENDING,
    //   updatedAt: new Date().toISOString(),
    //   model: model,
    //   // 添加版本历史
    //   versions: versions.map((v, index) => ({
    //     ...v,
    //     // 最后添加的版本设置为活跃状态
    //     isActive: index === versions.length - 1
    //   }))
    // });

    // 创建更新对象 - 使用包含最新版本信息的消息，并更新为新的模型
    const resetMessage = {
      ...updatedMessage, // 使用包含最新版本信息的消息
      status: AssistantMessageStatus.PENDING,
      updatedAt: new Date().toISOString(),
      model: model, // 使用顶部模型选择器的新模型
      modelId: model.id, // 更新模型ID
      blocks: [], // 清空块，等待processAssistantResponse创建新的块
      // 保持版本信息，包括新保存的版本
      versions: updatedMessage.versions || []
    };

    console.log(`[regenerateMessage] 重置消息完成，模型已更新:`, {
      messageId: resetMessage.id,
      originalModelId: updatedMessage.modelId,
      newModelId: resetMessage.modelId,
      newModelName: resetMessage.model?.name,
      newModelProvider: resetMessage.model?.provider
    });

    // 7. 更新Redux状态
    dispatch(newMessagesActions.updateMessage({
      id: messageId,
      changes: resetMessage
    }));

    // 8. 从数据库中删除消息块并更新消息（同时更新topics表）
    await dexieStorage.transaction('rw', [
      dexieStorage.messages,
      dexieStorage.message_blocks,
      dexieStorage.topics // 添加topics表到事务中
    ], async () => {
      // 删除消息块
      if (blockIds.length > 0) {
        await dexieStorage.deleteMessageBlocksByIds(blockIds);
      }

      // 更新消息
      await dexieStorage.updateMessage(messageId, resetMessage);

      // 更新topics表中的messageIds数组
      const topic = await dexieStorage.topics.get(topicId);
      if (topic) {
        // 确保messageIds数组存在
        if (!topic.messageIds) {
          topic.messageIds = [];
        }

        // 如果消息不存在，添加到messageIds数组
        if (!topic.messageIds.includes(resetMessage.id)) {
          topic.messageIds.push(resetMessage.id);
        }

        // 保存更新后的话题
        await dexieStorage.topics.put(topic);
      }
    });

    // 9. 设置流式状态 - 关键修复：让重新生成时显示停止按钮
    dispatch(newMessagesActions.setTopicLoading({ topicId, loading: true }));
    dispatch(newMessagesActions.setTopicStreaming({ topicId, streaming: true }));

    // 10. 处理助手响应
    await processAssistantResponse(dispatch, getState, resetMessage, topicId, model, true); // 默认启用工具

    return true;
  } catch (error) {
    console.error(`重新生成消息 ${messageId} 失败:`, error);

    // 清除加载状态
    dispatch(newMessagesActions.setTopicLoading({ topicId, loading: false }));
    dispatch(newMessagesActions.setTopicStreaming({ topicId, streaming: false }));

    throw error;
  }
};