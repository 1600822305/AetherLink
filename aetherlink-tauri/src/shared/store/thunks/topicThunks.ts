import { createAsyncThunk } from '@reduxjs/toolkit';
import { v4 as uuid } from 'uuid';
import { dexieStorage } from '../../services/storage/DexieStorageService';
import { newMessagesActions } from '../slices/newMessagesSlice';
import { upsertManyBlocks } from '../slices/messageBlocksSlice';
import type { Message, MessageBlock } from '../../types/newMessage';
import type { ChatTopic } from '../../types';

/**
 * 创建主题分支的Thunk
 * 将源主题中的消息克隆到新主题，直到指定的分支点
 */
export const cloneMessagesToNewTopicThunk = createAsyncThunk(
  'topics/cloneMessagesToNewTopic',
  async (
    {
      sourceTopicId,
      branchPointMessageId,
      newTopic
    }: {
      sourceTopicId: string;
      branchPointMessageId: string;
      newTopic: ChatTopic;
    },
    { dispatch }
  ) => {
    try {
      console.log(`[cloneMessagesToNewTopicThunk] 开始从主题 ${sourceTopicId} 克隆消息到新主题 ${newTopic.id}`);
      console.log(`[cloneMessagesToNewTopicThunk] 分支点消息ID: ${branchPointMessageId}`);

      // 1. 获取源主题的所有消息
      const sourceMessages = await dexieStorage.getMessagesByTopicId(sourceTopicId);

      if (!sourceMessages || sourceMessages.length === 0) {
        console.warn(`[cloneMessagesToNewTopicThunk] 源主题 ${sourceTopicId} 没有消息可克隆`);
        return false;
      }

      // 2. 找到分支点消息的索引
      const branchPointIndex = sourceMessages.findIndex((msg: any) => msg.id === branchPointMessageId);

      if (branchPointIndex === -1) {
        console.error(`[cloneMessagesToNewTopicThunk] 找不到分支点消息 ${branchPointMessageId}`);
        return false;
      }

      // 3. 获取需要克隆的消息（包括分支点消息）
      const messagesToClone = sourceMessages.slice(0, branchPointIndex + 1);
      console.log(`[cloneMessagesToNewTopicThunk] 将克隆 ${messagesToClone.length} 条消息`);

      // 4. 克隆每条消息及其块
      const clonedMessages: Message[] = [];
      const allClonedBlocks: MessageBlock[] = [];

      for (const originalMessage of messagesToClone) {
        // 获取原始消息的块
        const originalBlocks = await dexieStorage.getMessageBlocksByMessageId(originalMessage.id);

        // 创建新消息ID
        const newMessageId = uuid();

        // 克隆消息
        const clonedMessage: Message = {
          ...originalMessage,
          id: newMessageId,
          topicId: newTopic.id,
          blocks: [], // 先清空块列表，后面会重新添加
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        // 克隆块并关联到新消息
        const clonedBlocks: MessageBlock[] = [];

        for (const originalBlock of originalBlocks) {
          const newBlockId = uuid();

          const clonedBlock: MessageBlock = {
            ...originalBlock,
            id: newBlockId,
            messageId: newMessageId,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };

          clonedBlocks.push(clonedBlock);
          clonedMessage.blocks.push(newBlockId);
        }

        // 添加到集合中
        clonedMessages.push(clonedMessage);
        allClonedBlocks.push(...clonedBlocks);
      }

      // 5. 保存克隆的消息和块到数据库
      await dexieStorage.transaction('rw', [
        dexieStorage.topics,
        dexieStorage.messages,
        dexieStorage.message_blocks
      ], async () => {
        // 保存消息块
        if (allClonedBlocks.length > 0) {
          await dexieStorage.bulkSaveMessageBlocks(allClonedBlocks);
        }

        // 保存消息
        for (const message of clonedMessages) {
          await dexieStorage.messages.put(message);
        }

        // 更新主题
        const topic = await dexieStorage.topics.get(newTopic.id);
        if (topic) {
          // 更新messageIds数组
          topic.messageIds = clonedMessages.map(m => m.id);

          // 更新lastMessageTime
          if (clonedMessages.length > 0) {
            const lastMessage = clonedMessages[clonedMessages.length - 1];
            topic.lastMessageTime = lastMessage.createdAt || lastMessage.updatedAt || new Date().toISOString();
          }

          // 保存更新后的主题
          await dexieStorage.topics.put(topic);
        }
      });

      // 6. 更新Redux状态
      // 添加消息到Redux
      for (const message of clonedMessages) {
        dispatch(newMessagesActions.addMessage({
          topicId: newTopic.id,
          message
        }));
      }

      // 添加块到Redux
      if (allClonedBlocks.length > 0) {
        dispatch(upsertManyBlocks(allClonedBlocks));
      }

      console.log(`[cloneMessagesToNewTopicThunk] 成功克隆 ${clonedMessages.length} 条消息和 ${allClonedBlocks.length} 个块到新主题 ${newTopic.id}`);

      return true;
    } catch (error) {
      console.error('[cloneMessagesToNewTopicThunk] 克隆消息失败:', error);
      return false;
    }
  }
);
