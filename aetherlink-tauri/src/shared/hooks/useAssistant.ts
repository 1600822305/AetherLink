import { useCallback, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { dexieStorage } from '../services/storage/DexieStorageService';
import { EventEmitter, EVENT_NAMES } from '../services/EventService';
import { addTopic, removeTopic, updateTopic } from '../store/slices/assistantsSlice';
import type { RootState } from '../store';
import type { Assistant, ChatTopic } from '../types/Assistant';

/**
 * 助手钩子 - 加载助手及其关联的话题
 * 参考最佳实例实现，但适配移动端的数据结构
 */
export function useAssistant(assistantId: string | null) {
  const dispatch = useDispatch();
  const assistants = useSelector((state: RootState) => state.assistants.assistants);
  const assistant = assistantId
    ? assistants.find((a: Assistant) => a.id === assistantId) || null
    : null;





  const loadAssistantTopics = useCallback(async (forceRefresh = false) => {
    if (!assistantId || !assistant) {
      return;
    }

    // 🔥 Cherry Studio模式：移除自动创建逻辑，由Redux层面处理
    if (forceRefresh) {
      console.log(`[useAssistant] 强制刷新助手 ${assistant.name} 的话题数据`);
      // 这里可以添加从数据库重新加载话题的逻辑
      // 但目前助手数据已经预加载，通常不需要强制刷新
    }
  }, [assistantId, assistant]);

  useEffect(() => {
    loadAssistantTopics();
  }, [loadAssistantTopics]);

  useEffect(() => {
    if (!assistantId) return;

    const handleTopicChange = (eventData: any) => {
      if (eventData && (eventData.assistantId === assistantId || !eventData.assistantId)) {
        loadAssistantTopics();
      }
    };

    // 只监听 TOPICS_CLEARED 事件，TOPIC_DELETED 通过 Redux 状态变化自动处理
    const unsubClear = EventEmitter.on(EVENT_NAMES.TOPICS_CLEARED, handleTopicChange);

    return () => {
      unsubClear();
    };
  }, [assistantId, loadAssistantTopics]);

  const addTopicToAssistant = useCallback(async (topic: ChatTopic) => {
    if (!assistantId) return false;

    if (topic.assistantId !== assistantId) {
        console.warn(`addTopicToAssistant: Topic ${topic.id} had assistantId ${topic.assistantId}. Forcing to current assistant ${assistantId}.`);
        topic.assistantId = assistantId;
    }

    try {
      // 保存话题到数据库
      await dexieStorage.saveTopic(topic);

      // 更新Redux状态
      dispatch(addTopic({ assistantId, topic }));
      return true;
    } catch (err) {
      console.error('添加话题失败:', err);
      return false;
    }
  }, [assistantId, dispatch]);

  const removeTopicFromAssistant = useCallback(async (topicId: string) => {
    if (!assistantId) return false;

    try {
      await dexieStorage.deleteTopic(topicId);

      dispatch(removeTopic({ assistantId, topicId }));
      return true;
    } catch (err) {
      console.error('删除话题失败:', err);
      return false;
    }
  }, [assistantId, dispatch]);

  const updateAssistantTopic = useCallback(async (topic: ChatTopic) => {
    if (!assistantId) return false;

    if (topic.assistantId !== assistantId) {
        console.warn(`updateAssistantTopic: Topic ${topic.id} had assistantId ${topic.assistantId}. Forcing to current assistant ${assistantId}.`);
        topic.assistantId = assistantId;
    }

    try {
      await dexieStorage.saveTopic(topic);
      dispatch(updateTopic({ assistantId, topic }));
      return true;
    } catch (err) {
      console.error('更新话题失败:', err);
      return false;
    }
  }, [assistantId, dispatch]);

  return {
    assistant,
    addTopic: addTopicToAssistant,
    removeTopic: removeTopicFromAssistant,
    updateTopic: updateAssistantTopic,
    refreshTopics: loadAssistantTopics
  };
}