/**
 * useDataPersistence Hook
 * P0修复：确保应用退出前数据被正确保存到IndexedDB
 * 
 * 功能：
 * 1. 监听 Tauri 的 app-before-quit 事件
 * 2. 监听浏览器的 beforeunload 事件
 * 3. 监听页面可见性变化（移动端切后台）
 * 4. 刷新所有待保存的数据到数据库
 */

import { useEffect, useRef, useCallback } from 'react';
import { useSelector } from 'react-redux';
import type { RootState } from '../shared/store';
import store from '../shared/store';
import { dexieStorage } from '../shared/services/storage/DexieStorageService';
import { detectDetailedPlatform, RuntimeType } from '../shared/utils/platformDetection';
import { flushThrottledUpdates } from '../shared/store/thunks/message/utils';
import { DataRepairService } from '../shared/services/storage/DataRepairService';
import { createLogger } from '../shared/services/infra/logger';

const logger = createLogger('DataPersistence');

// 标记是否正在保存数据
let isSaving = false;

/**
 * 刷新所有待保存的数据到数据库
 * 确保当前话题的所有消息都已持久化
 */
export async function flushAllPendingWrites(): Promise<void> {
  if (isSaving) {
    logger.debug('已有保存任务进行中，跳过');
    return;
  }
  
  isSaving = true;
  logger.debug('开始刷新所有待保存的数据...');
  
  // P0修复：先刷新节流器中的待处理更新
  try {
    flushThrottledUpdates();
    logger.debug('已刷新节流器中的待处理更新');
  } catch (err) {
    logger.warn('刷新节流器失败:', err);
  }
  
  try {
    // 使用静态导入的 store
    const state = store.getState();
    const currentTopicId = state.messages.currentTopicId;
    
    if (!currentTopicId) {
      logger.debug('没有当前话题，跳过保存');
      return;
    }
    
    // 1. 获取当前话题在 Redux 中的所有消息
    const messageIds = state.messages.messageIdsByTopic[currentTopicId] || [];
    const messages = messageIds
      .map((id: string) => state.messages.entities[id])
      .filter(Boolean);
    
    logger.debug(`当前话题 ${currentTopicId} 有 ${messages.length} 条消息需要确认保存`);
    
    if (messages.length === 0) {
      return;
    }
    
    // 2. 获取所有消息块
    const blockIds = messages.flatMap((msg: any) => msg.blocks || []);
    const blocks = blockIds
      .map((id: string) => state.messageBlocks.entities[id])
      .filter(Boolean);
    
    logger.debug(`需要保存 ${blocks.length} 个消息块`);
    
    // 3. 使用事务批量保存，确保原子性
    await dexieStorage.transaction('rw', [
      dexieStorage.topics,
      dexieStorage.messages,
      dexieStorage.message_blocks
    ], async () => {
      // 3.1 保存所有消息块
      if (blocks.length > 0) {
        await dexieStorage.message_blocks.bulkPut(blocks);
        logger.debug(`已保存 ${blocks.length} 个消息块`);
      }
      
      // 3.2 保存所有消息
      await dexieStorage.messages.bulkPut(messages);
      logger.debug(`已保存 ${messages.length} 条消息`);
      
      // 3.3 更新话题的 messageIds
      const topic = await dexieStorage.topics.get(currentTopicId);
      if (topic) {
        // 确保 messageIds 包含所有消息
        const existingIds = new Set(topic.messageIds || []);
        let updated = false;
        
        for (const msg of messages) {
          if (!existingIds.has(msg.id)) {
            if (!topic.messageIds) topic.messageIds = [];
            topic.messageIds.push(msg.id);
            updated = true;
          }
        }
        
        if (updated) {
          // 按时间排序
          const sortedMessages = [...messages].sort((a: any, b: any) => 
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          );
          topic.messageIds = sortedMessages.map((m: any) => m.id);
          topic.lastMessageTime = sortedMessages[sortedMessages.length - 1]?.createdAt || new Date().toISOString();
          
          await dexieStorage.topics.put(topic);
          logger.debug(`已更新话题 ${currentTopicId} 的 messageIds`);
        }
      }
    });
    
    logger.debug('数据刷新完成');
    
  } catch (error) {
    logger.error('数据刷新失败:', error);
  } finally {
    isSaving = false;
  }
}

/**
 * 数据持久化 Hook
 * 在应用退出、页面关闭、切换到后台时自动保存数据
 */
export function useDataPersistence() {
  const currentTopicId = useSelector((state: RootState) => state.messages.currentTopicId);
  const isStreamingRef = useRef(false);
  
  // 监听流式状态变化
  const streamingByTopic = useSelector((state: RootState) => state.messages.streamingByTopic);
  
  useEffect(() => {
    if (currentTopicId) {
      isStreamingRef.current = streamingByTopic[currentTopicId] || false;
    }
  }, [currentTopicId, streamingByTopic]);
  
  // 保存数据的回调
  const handleSaveData = useCallback(async () => {
    // 如果正在流式响应中，延迟保存
    if (isStreamingRef.current) {
      logger.debug('流式响应进行中，延迟保存');
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    await flushAllPendingWrites();
  }, []);
  
  useEffect(() => {
    const platformInfo = detectDetailedPlatform();
    const isTauri = platformInfo.runtimeType === RuntimeType.TAURI;
    
    let unlistenTauri: (() => void) | null = null;
    
    // 1. Tauri 环境：监听 app-before-quit 事件
    if (isTauri) {
      import('@tauri-apps/api/event').then(({ listen }) => {
        listen('app-before-quit', async () => {
          logger.debug('收到 app-before-quit 事件，开始保存数据...');
          await handleSaveData();
          logger.debug('退出前数据保存完成');
        }).then(unlisten => {
          unlistenTauri = unlisten;
        });
      }).catch(err => {
        logger.warn('Tauri event API 不可用:', err);
      });
    }
    
    // 2. 浏览器环境：监听 beforeunload 事件
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      logger.debug('收到 beforeunload 事件');
      // 同步触发保存（beforeunload 中无法使用 async）
      // 使用 sendBeacon 或同步 localStorage 标记
      try {
        // 标记需要在下次启动时检查数据完整性
        localStorage.setItem('aether-link-dirty-exit', Date.now().toString());
      } catch (err) {
        logger.error('标记脏退出失败:', err);
      }
      
      // 尝试触发异步保存（可能不会完成）
      flushAllPendingWrites();
      
      // 生产环境：显示确认对话框防止意外关闭
      // 开发环境：跳过确认，避免 HMR 热更新时每次弹窗
      if (import.meta.env.PROD) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    
    // 3. 移动端：监听页面可见性变化（切换到后台时保存）
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        logger.debug('页面切换到后台，保存数据...');
        handleSaveData();
      }
    };
    
    // 4. 移动端：监听 pagehide 事件（iOS Safari）
    const handlePageHide = () => {
      logger.debug('收到 pagehide 事件，保存数据...');
      flushAllPendingWrites();
    };
    
    // 注册事件监听
    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', handlePageHide);
    
    // 检查上次是否为脏退出
    const dirtyExit = localStorage.getItem('aether-link-dirty-exit');
    if (dirtyExit) {
      logger.debug(`检测到上次脏退出 (${new Date(parseInt(dirtyExit)).toISOString()})，执行数据完整性检查...`);
      localStorage.removeItem('aether-link-dirty-exit');
      // 执行数据完整性检查
      DataRepairService.checkAndRepairMessageIntegrity().then(result => {
        if (result.repaired > 0 || result.missingMessages > 0) {
          logger.debug(`数据修复完成: 修复了 ${result.repaired} 个话题，发现 ${result.missingMessages} 条缺失消息`);
        }
      });
    }
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pagehide', handlePageHide);
      if (unlistenTauri) {
        unlistenTauri();
      }
    };
  }, [handleSaveData]);
  
  // 返回手动保存函数，供需要时调用
  return {
    flushData: handleSaveData
  };
}

export default useDataPersistence;
