import { useDispatch } from 'react-redux';
import { useRef } from 'react';
import { EventEmitter, EVENT_NAMES } from '../services/EventService';
import { TopicService } from '../services/topics/TopicService';
import { AssistantService } from '../services';
import { newMessagesActions } from '../store/slices/newMessagesSlice';
import { addTopic } from '../store/slices/assistantsSlice';
import { getDefaultTopic } from '../services/assistant/types';
import store from '../store';

/**
 * 统一的话题管理Hook
 * 提供创建话题的标准实现，供所有组件使用
 */
export const useTopicManagement = () => {
  const dispatch = useDispatch();
  const isCreatingRef = useRef(false);

  // 创建新话题 - Cherry Studio立即UI更新模式 + 防抖
  const handleCreateTopic = async () => {
    // 🔒 防止快速重复点击
    if (isCreatingRef.current) {
      console.log('[useTopicManagement] 正在创建话题，跳过重复请求');
      return null;
    }

    isCreatingRef.current = true;
    try {
      console.log('[useTopicManagement] 开始创建话题 - Cherry Studio模式');

      EventEmitter.emit(EVENT_NAMES.ADD_NEW_TOPIC);

      // 🌟 关键改进：不等待异步操作，立即创建和选择话题
      const currentAssistant = await AssistantService.getCurrentAssistant();
      if (!currentAssistant) {
        return null;
      }

      // 立即创建话题对象
      const newTopic = getDefaultTopic(currentAssistant.id);

      console.log('[useTopicManagement] 立即更新Redux和选择新话题:', newTopic.id);

      // 🚀 立即添加到Redux store
      store.dispatch(addTopic({ assistantId: currentAssistant.id, topic: newTopic }));

      // 🚀 立即选择新创建的话题 - 不等待保存完成
      dispatch(newMessagesActions.setCurrentTopicId(newTopic.id));

      // 立即显示话题侧边栏
      EventEmitter.emit(EVENT_NAMES.SHOW_TOPIC_SIDEBAR);

      // 立即发送事件通知其他组件
      EventEmitter.emit(EVENT_NAMES.TOPIC_CREATED, {
        topic: newTopic,
        assistantId: currentAssistant.id,
        type: 'create'
      });

      // 🔄 异步保存数据，不阻塞UI
      Promise.resolve().then(async () => {
        try {
          await TopicService.saveTopic(newTopic);
          await AssistantService.addAssistantMessagesToTopic({ assistant: currentAssistant, topic: newTopic });
          console.log('[useTopicManagement] 异步保存完成');
        } catch (error) {
          console.error('[useTopicManagement] 异步保存话题失败:', error);
        }
      });

      console.log('[useTopicManagement] 话题创建完成，UI已立即更新');
      return newTopic;
    } catch (error) {
      console.error('[useTopicManagement] 创建话题失败:', error);
      return null;
    } finally {
      // 🔓 重置创建状态，允许下次创建
      setTimeout(() => {
        isCreatingRef.current = false;
      }, 500); // 500ms防抖
    }
  };

  return {
    handleCreateTopic
  };
};
