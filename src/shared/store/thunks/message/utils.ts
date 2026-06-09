import { dexieStorage } from '../../../services/storage/DexieStorageService';
import { throttle } from 'lodash';
import type { Message, MessageBlock } from '../../../types/newMessage';
import { refreshTopicPreview } from '../../../services/topics/TopicPreviewService';

export const saveMessageAndBlocksToDB = async (message: Message, blocks: MessageBlock[]) => {
  try {
    // 使用事务保证原子性
    await dexieStorage.transaction('rw', [
      dexieStorage.topics,
      dexieStorage.messages,
      dexieStorage.message_blocks
    ], async () => {
      // 保存消息块
      if (blocks.length > 0) {
        await dexieStorage.bulkSaveMessageBlocks(blocks);
      }

      // 保存消息到messages表（保持兼容性）
      await dexieStorage.messages.put(message);

      // 更新topics表中的messageIds数组
      const topic = await dexieStorage.topics.get(message.topicId);
      if (topic) {
        // 确保messageIds数组存在
        if (!topic.messageIds) {
          topic.messageIds = [];
        }

        // 如果消息不存在，添加到messageIds数组
        if (!topic.messageIds.includes(message.id)) {
          topic.messageIds.push(message.id);
          console.log(`[saveMessageAndBlocksToDB] 添加新消息 ${message.id} 到话题 ${topic.id}`);
        } else {
          console.log(`[saveMessageAndBlocksToDB] 消息 ${message.id} 已存在于话题 ${topic.id}`);
        }

        // 更新话题的lastMessageTime
        topic.lastMessageTime = message.createdAt || message.updatedAt || new Date().toISOString();

        // 保存更新后的话题
        await dexieStorage.topics.put(topic);
        console.log(`[saveMessageAndBlocksToDB] 话题 ${topic.id} 现有 ${topic.messageIds.length} 条消息`);
      }
    });

    // 刷新话题预览元数据（条数/最后消息预览），供侧边栏列表展示。
    // 与消息主流程解耦，失败不影响保存。
    void refreshTopicPreview(message.topicId);
  } catch (error) {
    console.error('保存消息和块到数据库失败:', error);
    throw error;
  }
};

// Per-block 节流器，避免共享 throttle 在窗口内丢弃其他块的更新
const blockThrottleMap = new Map<string, ReturnType<typeof throttle>>();

const getBlockThrottler = (id: string) => {
  let fn = blockThrottleMap.get(id);
  if (!fn) {
    fn = throttle(async (blockUpdate: Partial<MessageBlock>) => {
      await dexieStorage.updateMessageBlock(id, blockUpdate);
    }, 150);
    blockThrottleMap.set(id, fn);
  }
  return fn;
};

export const throttledBlockUpdate = (id: string, blockUpdate: Partial<MessageBlock>) => {
  return getBlockThrottler(id)(blockUpdate);
};

/**
 * 刷新所有块节流器中待处理的更新
 */
export const flushThrottledUpdates = () => {
  for (const fn of blockThrottleMap.values()) {
    fn.flush();
  }
};

/**
 * 清理不再需要的块节流器，防止内存泄漏
 */
export const clearBlockThrottler = (id: string) => {
  const fn = blockThrottleMap.get(id);
  if (fn) {
    fn.flush();
    fn.cancel();
    blockThrottleMap.delete(id);
  }
};