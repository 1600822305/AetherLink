/**
 * 消息块 Thunk 操作
 * 参考 Cherry Studio 的 messageThunk.v2.ts 设计
 * 
 * 提供统一的消息块加载、保存、更新、删除操作
 */

import { dexieStorage } from '../../../services/storage/DexieStorageService';
import { upsertManyBlocks, updateOneBlock } from '../../slices/messageBlocksSlice';
import { newMessagesActions } from '../../slices/newMessagesSlice';
import type { Message, MessageBlock } from '../../../types/newMessage';
import type { AppDispatch, RootState } from '../../index';

// =================================================================
// 加载操作
// =================================================================

/**
 * 加载主题的消息和块
 * 参考 Cherry Studio 的 loadTopicMessagesThunkV2
 */
export const loadTopicMessagesThunk =
  (topicId: string, forceReload: boolean = false) =>
  async (dispatch: AppDispatch, getState: () => RootState) => {
    const state = getState();

    dispatch(newMessagesActions.setCurrentTopicId(topicId));

    // 如果已缓存且不强制刷新，跳过
    if (!forceReload && state.messages?.messageIdsByTopic?.[topicId]) {
      return;
    }

    try {
      dispatch(newMessagesActions.setTopicLoading({ topicId, loading: true }));

      // 加载消息
      const messages = await dexieStorage.getTopicMessages(topicId);
      
      // 批量获取所有消息的块
      const messageIds = messages.map(m => m.id);
      const blocks = await dexieStorage.getMessageBlocksByMessageIds(messageIds);

      console.log('[loadTopicMessagesThunk] 加载完成:', {
        topicId,
        messageCount: messages.length,
        blockCount: blocks.length
      });

      // 更新 Redux 状态
      if (blocks.length > 0) {
        dispatch(upsertManyBlocks(blocks));
      }
      dispatch(newMessagesActions.messagesReceived({ topicId, messages }));
    } catch (error) {
      console.error(`[loadTopicMessagesThunk] 加载消息失败 ${topicId}:`, error);
    } finally {
      dispatch(newMessagesActions.setTopicLoading({ topicId, loading: false }));
    }
  };

// =================================================================
// 保存操作
// =================================================================

/**
 * 保存消息和块到数据库
 * 参考 Cherry Studio 的 saveMessageAndBlocksToDBV2
 */
export const saveMessageAndBlocksToDB = async (
  topicId: string,
  message: Message,
  blocks: MessageBlock[],
  messageIndex: number = -1
): Promise<void> => {
  try {
    const blockIds = blocks.map((block) => block.id);
    const shouldSyncBlocks =
      blockIds.length > 0 && (!message.blocks || blockIds.some((id, index) => message.blocks?.[index] !== id));

    const messageWithBlocks = shouldSyncBlocks ? { ...message, blocks: blockIds } : message;
    
    // 保存消息
    await dexieStorage.saveMessage(messageWithBlocks);
    
    // 批量保存块
    if (blocks.length > 0) {
      for (const block of blocks) {
        await dexieStorage.saveMessageBlock(block);
      }
    }

    console.log('[saveMessageAndBlocksToDB] 保存完成:', {
      topicId,
      messageId: message.id,
      blockCount: blocks.length,
      messageIndex
    });
  } catch (error) {
    console.error('[saveMessageAndBlocksToDB] 保存失败:', { topicId, messageId: message.id, error });
    throw error;
  }
};

/**
 * 批量添加消息块
 * 参考 Cherry Studio 的 bulkAddBlocksV2
 */
export const bulkAddBlocks = async (blocks: MessageBlock[]): Promise<void> => {
  try {
    for (const block of blocks) {
      await dexieStorage.saveMessageBlock(block);
    }
    console.log('[bulkAddBlocks] 批量添加完成:', { count: blocks.length });
  } catch (error) {
    console.error('[bulkAddBlocks] 批量添加失败:', { count: blocks.length, error });
    throw error;
  }
};

// =================================================================
// 更新操作
// =================================================================

/**
 * 更新消息
 * 参考 Cherry Studio 的 updateMessageV2
 */
export const updateMessageInDB = async (
  topicId: string,
  messageId: string,
  updates: Partial<Message>
): Promise<void> => {
  try {
    await dexieStorage.updateMessage(messageId, updates);
    console.log('[updateMessageInDB] 更新完成:', { topicId, messageId });
  } catch (error) {
    console.error('[updateMessageInDB] 更新失败:', { topicId, messageId, error });
    throw error;
  }
};

/**
 * 更新单个块
 * 参考 Cherry Studio 的 updateSingleBlockV2
 */
export const updateSingleBlockInDB = async (
  blockId: string,
  updates: Partial<MessageBlock>
): Promise<void> => {
  try {
    await dexieStorage.updateMessageBlock(blockId, updates);
    console.log('[updateSingleBlockInDB] 更新完成:', { blockId });
  } catch (error) {
    console.error('[updateSingleBlockInDB] 更新失败:', { blockId, error });
    throw error;
  }
};

/**
 * 批量更新块
 * 参考 Cherry Studio 的 updateBlocksV2
 */
export const updateBlocksInDB = async (blocks: MessageBlock[]): Promise<void> => {
  try {
    for (const block of blocks) {
      await dexieStorage.updateMessageBlock(block.id, block);
    }
    console.log('[updateBlocksInDB] 批量更新完成:', { count: blocks.length });
  } catch (error) {
    console.error('[updateBlocksInDB] 批量更新失败:', { count: blocks.length, error });
    throw error;
  }
};

// =================================================================
// 删除操作
// =================================================================

/**
 * 删除消息
 * 参考 Cherry Studio 的 deleteMessageFromDBV2
 */
export const deleteMessageFromDB = async (topicId: string, messageId: string): Promise<void> => {
  try {
    // 先删除关联的块
    await dexieStorage.deleteMessageBlocksByMessageId(messageId);
    // 再删除消息
    await dexieStorage.deleteMessage(messageId);
    console.log('[deleteMessageFromDB] 删除完成:', { topicId, messageId });
  } catch (error) {
    console.error('[deleteMessageFromDB] 删除失败:', { topicId, messageId, error });
    throw error;
  }
};

/**
 * 批量删除消息
 * 参考 Cherry Studio 的 deleteMessagesFromDBV2
 */
export const deleteMessagesFromDB = async (topicId: string, messageIds: string[]): Promise<void> => {
  try {
    for (const messageId of messageIds) {
      await dexieStorage.deleteMessageBlocksByMessageId(messageId);
      await dexieStorage.deleteMessage(messageId);
    }
    console.log('[deleteMessagesFromDB] 批量删除完成:', { topicId, count: messageIds.length });
  } catch (error) {
    console.error('[deleteMessagesFromDB] 批量删除失败:', { topicId, messageIds, error });
    throw error;
  }
};

/**
 * 清空主题的所有消息
 * 参考 Cherry Studio 的 clearMessagesFromDBV2
 */
export const clearMessagesFromDB = async (topicId: string): Promise<void> => {
  try {
    const messages = await dexieStorage.getTopicMessages(topicId);
    for (const message of messages) {
      await dexieStorage.deleteMessageBlocksByMessageId(message.id);
      await dexieStorage.deleteMessage(message.id);
    }
    console.log('[clearMessagesFromDB] 清空完成:', { topicId });
  } catch (error) {
    console.error('[clearMessagesFromDB] 清空失败:', { topicId, error });
    throw error;
  }
};

// =================================================================
// 流式保存辅助函数
// =================================================================

/**
 * 创建流式保存函数
 * 用于 BlockManager 的 saveUpdatesToDB 回调
 * 
 * 🔧 改进：使用统一的 updateMessageAndBlocks 方法
 */
export const createSaveUpdatesToDB = (
  dispatch: AppDispatch
) => {
  return async (
    messageId: string,
    topicId: string,
    messageUpdates: Partial<Message>,
    blocksToUpdate: MessageBlock[]
  ): Promise<void> => {
    try {
      // 🔧 使用统一的 updateMessageAndBlocks 方法
      // 在单个事务中同时更新消息和块，保证数据一致性
      await dexieStorage.updateMessageAndBlocks(
        topicId,
        { id: messageId, ...messageUpdates },
        blocksToUpdate
      );

      // 同步更新 Redux 状态
      if (Object.keys(messageUpdates).length > 0) {
        dispatch(newMessagesActions.updateMessage({
          id: messageId,
          changes: messageUpdates
        }));
      }

      for (const block of blocksToUpdate) {
        dispatch(updateOneBlock({ id: block.id, changes: block }));
      }
    } catch (error) {
      console.error('[saveUpdatesToDB] 保存失败:', { messageId, topicId, error });
    }
  };
};

/**
 * 创建单个块保存函数
 * 用于 BlockManager 的 saveUpdatedBlockToDB 回调
 * 
 * 🔧 改进：使用 upsertMessageBlocks 方法
 */
export const createSaveUpdatedBlockToDB = () => {
  return async (
    blockId: string | null,
    messageId: string,
    topicId: string,
    getState: () => RootState
  ): Promise<void> => {
    if (!blockId) return;

    try {
      const state = getState();
      const block = state.messageBlocks?.entities?.[blockId];
      if (block) {
        // 🔧 使用 upsertMessageBlocks 进行 bulkPut 操作，确保新块也能被保存
        await dexieStorage.upsertMessageBlocks([block]);
      }
    } catch (error) {
      console.error('[saveUpdatedBlockToDB] 保存失败:', { blockId, messageId, topicId, error });
    }
  };
};
