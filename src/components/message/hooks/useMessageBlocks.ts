import { useEffect, useRef } from 'react';
import { useDispatch } from 'react-redux';
import type { Message, MessageBlock } from '../../../shared/types/newMessage';
import { dexieStorage } from '../../../shared/services/storage/DexieStorageService';
import { upsertManyBlocks } from '../../../shared/store/slices/messageBlocksSlice';
import { createLogger } from '../../../shared/services/infra/logger';

const logger = createLogger('useMessageBlocks');

export const useMessageBlocks = (
  message: Message, 
  blocks: MessageBlock[], 
  forceUpdate?: () => void
) => {
  const dispatch = useDispatch();
  const forceUpdateRef = useRef(forceUpdate);

  // 更新 forceUpdateRef 的当前值
  useEffect(() => {
    forceUpdateRef.current = forceUpdate;
  }, [forceUpdate]);

  // 如果Redux中没有块，从数据库加载
  useEffect(() => {
    const loadBlocks = async () => {
      if (blocks.length === 0 && message.blocks.length > 0) {
        try {
          const messageBlocks: MessageBlock[] = await dexieStorage.getMessageBlocksByIds(message.blocks);

          if (messageBlocks.length < message.blocks.length) {
            const foundIds = new Set(messageBlocks.map(b => b.id));
            const missingIds = message.blocks.filter(id => !foundIds.has(id));
            logger.warn(`数据库中找不到块: ID=${missingIds.join(', ')}`);
          }

          if (messageBlocks.length > 0) {
            dispatch(upsertManyBlocks(messageBlocks));
          } else {
            logger.warn(`数据库中没有找到任何块: 消息ID=${message.id}`);
          }
        } catch (error) {
          logger.error(`加载消息块失败: 消息ID=${message.id}`, error);
        }
      }
    };

    loadBlocks();
  }, [message.blocks, blocks.length, dispatch]);

  // 🚀 优化流式更新逻辑，避免定时器导致的抖动
  useEffect(() => {
    if (message.status === 'streaming') {
      // 🚀 移除定时器，改为仅在必要时更新
      // 依赖Redux状态变化和事件系统来触发更新
      // 这样可以避免不必要的定时器导致的抖动

      // 如果确实需要强制更新，可以监听特定事件
      // 但通常Redux状态变化已经足够触发重新渲染
    }
  }, [message.status]);

  // 计算loading状态
  const loading = blocks.length === 0 && message.blocks.length > 0;

  return { loading };
};
