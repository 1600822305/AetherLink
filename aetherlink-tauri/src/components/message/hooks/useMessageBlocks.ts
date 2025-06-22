import { useEffect, useRef } from 'react';
import { useDispatch } from 'react-redux';
import type { Message, MessageBlock } from '../../../shared/types/newMessage';
import { dexieStorage } from '../../../shared/services/storage/DexieStorageService';
import { upsertManyBlocks } from '../../../shared/store/slices/messageBlocksSlice';

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
          const messageBlocks: MessageBlock[] = [];
          for (const blockId of message.blocks) {
            const block = await dexieStorage.getMessageBlock(blockId);
            if (block) {
              // 🔧 修复：验证对比分析块的数据完整性
              if ('subType' in block && (block as any).subType === 'comparison') {
                const comparisonBlock = block as any;
                if (!comparisonBlock.comboResult || !comparisonBlock.comboResult.modelResults) {
                  console.error(`[MessageItem] 对比分析块数据不完整: ${blockId}`);
                  continue; // 跳过损坏的块
                }
                console.log(`[MessageItem] 成功加载对比分析块: ${blockId}`);
              }

              // 🔧 修复：验证多模型块的数据完整性
              if (block.type === 'multi_model' && 'responses' in block) {
                const multiModelBlock = block as any;
                if (!multiModelBlock.responses || !Array.isArray(multiModelBlock.responses)) {
                  console.error(`[MessageItem] 多模型块数据不完整: ${blockId}`);
                  continue; // 跳过损坏的块
                }
              }
              messageBlocks.push(block);
            } else {
              console.warn(`[MessageItem] 数据库中找不到块: ID=${blockId}`);
            }
          }

          if (messageBlocks.length > 0) {
            dispatch(upsertManyBlocks(messageBlocks));
          } else {
            console.warn(`[MessageItem] 数据库中没有找到任何块: 消息ID=${message.id}`);
          }
        } catch (error) {
          console.error(`[MessageItem] 加载消息块失败: 消息ID=${message.id}`, error);
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
