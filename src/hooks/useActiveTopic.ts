import { useEffect, useState, useRef, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import type { RootState } from '../shared/store';
import { loadTopicMessagesThunk } from '../shared/store/slices/newMessagesSlice';
import { EventEmitter, EVENT_NAMES } from '../shared/services/EventService';
import { dexieStorage } from '../shared/services/storage/DexieStorageService';
import type { ChatTopic, Assistant } from '../shared/types/Assistant';

/**
 * useActiveTopic Hook
 * 自动触发消息加载和事件发送，无需在Redux reducer中初始化
 */
export function useActiveTopic(assistant: Assistant, initialTopic?: ChatTopic) {
  const dispatch = useDispatch();
  const [activeTopic, setActiveTopic] = useState<ChatTopic | null>(initialTopic || null);
  const isMountedRef = useRef(true);
  
  // 从Redux获取当前话题ID
  const currentTopicId = useSelector((state: RootState) => state.messages.currentTopicId);
  // 从Redux获取助手数据，优先使用Redux中的话题
  const reduxAssistant = useSelector((state: RootState) =>
    state.assistants.assistants.find(a => a.id === assistant?.id)
  );

  // 安全的setState函数，检查组件是否已卸载
  const safeSetActiveTopic = useCallback((topic: ChatTopic | null) => {
    if (isMountedRef.current) {
      setActiveTopic(topic);
    }
  }, []);

  // 清理函数：组件卸载时设置标记
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Effect 1: 话题变化时立即响应
  useEffect(() => {
    if (!activeTopic) return;

    console.log(`[useActiveTopic] 即时切换话题: ${activeTopic.name} (${activeTopic.id})`);

    // 1. 立即发送话题变更事件
    EventEmitter.emit(EVENT_NAMES.CHANGE_TOPIC, activeTopic);

    // 2. 立即加载话题消息
    dispatch(loadTopicMessagesThunk(activeTopic.id) as any);
    console.log(`[useActiveTopic] 立即触发消息加载: ${activeTopic.id}`);
  }, [activeTopic?.id, dispatch]); // 只依赖ID，避免对象引用变化

  // Effect 2: 助手变化时选择第一个话题 - 优化版本
  useEffect(() => {
    if (!assistant?.id) return;

    // 避免重复设置相同助手的话题
    if (activeTopic?.assistantId === assistant.id) return;

    const loadFirstTopic = async () => {
      try {
        // 优先从Redux中的助手数据获取话题
        if (reduxAssistant?.topics && reduxAssistant.topics.length > 0) {
          console.log(`[useActiveTopic] 从Redux立即获取第一个话题: ${reduxAssistant.topics[0].name}`);
          safeSetActiveTopic(reduxAssistant.topics[0]);
          return;
        }

        // 其次使用助手的topicIds
        if (Array.isArray(assistant.topicIds) && assistant.topicIds.length > 0) {
          const firstTopic = await dexieStorage.getTopic(assistant.topicIds[0]);
          if (firstTopic && isMountedRef.current) {
            console.log(`[useActiveTopic] 从数据库获取第一个话题: ${firstTopic.name}`);
            safeSetActiveTopic(firstTopic);
            return;
          }
        }

        // 兜底：从数据库查找助手话题
        console.log(`[useActiveTopic] 从数据库查找助手话题`);
        const allTopics = await dexieStorage.getAllTopics();
        const assistantTopics = allTopics.filter(topic => topic.assistantId === assistant.id);

        if (assistantTopics.length > 0 && isMountedRef.current) {
          // 选择最新的话题
          const latestTopic = assistantTopics.sort((a, b) => {
            const timeA = new Date(a.lastMessageTime || a.updatedAt || a.createdAt || 0).getTime();
            const timeB = new Date(b.lastMessageTime || b.updatedAt || b.createdAt || 0).getTime();
            return timeB - timeA;
          })[0];

          console.log(`[useActiveTopic] 选择话题: ${latestTopic.name}`);
          safeSetActiveTopic(latestTopic);
        } else if (isMountedRef.current) {
          console.log(`[useActiveTopic] 助手 ${assistant.name} 没有话题`);
          safeSetActiveTopic(null);
        }
      } catch (error) {
        console.error(`[useActiveTopic] 加载助手话题失败:`, error);
        if (isMountedRef.current) {
          safeSetActiveTopic(null);
        }
      }
    };

    loadFirstTopic();
  }, [assistant?.id, reduxAssistant?.topics?.length, safeSetActiveTopic]); // 添加Redux话题依赖

  // Effect 3: 监听外部话题ID变化
  useEffect(() => {
    if (!currentTopicId || !assistant?.id) return;

    // 如果当前激活话题已经是目标话题，无需重复处理
    if (activeTopic?.id === currentTopicId) return;

    console.log(`[useActiveTopic] 外部话题ID变化，即时切换: ${currentTopicId}`);

    const loadTopicById = async () => {
      try {
        // 优先从Redux中查找话题
        const assistantToUse = reduxAssistant || assistant;
        if (assistantToUse?.topics) {
          const topicFromRedux = assistantToUse.topics.find(t => t.id === currentTopicId);
          if (topicFromRedux && isMountedRef.current) {
            console.log(`[useActiveTopic] 从Redux立即获取话题: ${topicFromRedux.name}`);
            safeSetActiveTopic(topicFromRedux);
            return;
          }
        }

        // 兜底：从数据库加载话题
        const topic = await dexieStorage.getTopic(currentTopicId);

        if (!isMountedRef.current) return;

        if (topic && topic.assistantId === assistant.id) {
          console.log(`[useActiveTopic] 从数据库加载话题成功: ${topic.name}`);
          safeSetActiveTopic(topic);
        } else if (topic) {
          console.warn(`[useActiveTopic] 话题 ${currentTopicId} 不属于当前助手 ${assistant.id}`);
        } else {
          console.warn(`[useActiveTopic] 找不到话题 ${currentTopicId}`);
        }
      } catch (error) {
        console.error(`[useActiveTopic] 从数据库加载话题失败:`, error);
      }
    };

    loadTopicById();
  }, [currentTopicId, assistant?.id, activeTopic?.id, reduxAssistant?.topics?.length, safeSetActiveTopic]);

  // 提供即时切换话题的方法
  const switchToTopic = useCallback((topic: ChatTopic) => {
    console.log(`[useActiveTopic] 即时切换到话题: ${topic.name} (${topic.id})`);
    safeSetActiveTopic(topic);
  }, [safeSetActiveTopic]);

  return {
    activeTopic,
    setActiveTopic: switchToTopic
  };
}

/**
 * 话题管理器
 * 提供话题的基本操作方法
 */
export const TopicManager = {
  async getTopic(id: string): Promise<ChatTopic | null> {
    try {
      return await dexieStorage.getTopic(id);
    } catch (error) {
      console.error(`[TopicManager] 获取话题 ${id} 失败:`, error);
      return null;
    }
  },

  async getAllTopics(): Promise<ChatTopic[]> {
    try {
      return await dexieStorage.getAllTopics();
    } catch (error) {
      console.error('[TopicManager] 获取所有话题失败:', error);
      return [];
    }
  },

  async getTopicMessages(id: string) {
    try {
      const messages = await dexieStorage.getMessagesByTopicId(id);
      return messages || [];
    } catch (error) {
      console.error(`[TopicManager] 获取话题 ${id} 的消息失败:`, error);
      return [];
    }
  },

  async removeTopic(id: string) {
    try {
      await dexieStorage.deleteTopic(id);
      console.log(`[TopicManager] 话题 ${id} 删除成功`);
    } catch (error) {
      console.error(`[TopicManager] 删除话题 ${id} 失败:`, error);
      throw error;
    }
  }
};