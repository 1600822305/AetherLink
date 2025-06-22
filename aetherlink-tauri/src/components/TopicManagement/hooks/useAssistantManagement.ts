import { useCallback, startTransition } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { newMessagesActions } from '../../../shared/store/slices/newMessagesSlice';
import { addAssistant, setCurrentAssistant as setReduxCurrentAssistant, updateAssistant, removeAssistant } from '../../../shared/store/slices/assistantsSlice';
import { dexieStorage } from '../../../shared/services/storage/DexieStorageService';
import { TopicService } from '../../../shared/services/topics/TopicService';
import { setStorageItem } from '../../../shared/utils/storage';
import type { Assistant, ChatTopic } from '../../../shared/types/Assistant';
import type { RootState } from '../../../shared/store';

// 常量
const CURRENT_ASSISTANT_ID_KEY = 'currentAssistantId';

/**
 * 助手管理钩子
 */
export function useAssistantManagement({
  currentAssistant,
  setCurrentAssistant,
  // setUserAssistants, // 暂时注释掉未使用的变量
  currentTopic,
  switchToTopicTab // 🔥 新增：切换到话题标签页的函数
}: {
  currentAssistant: Assistant | null;
  setCurrentAssistant: (assistant: Assistant | null) => void;
  setUserAssistants?: (assistants: Assistant[]) => void; // 改为可选参数
  currentTopic: ChatTopic | null;
  switchToTopicTab?: () => void; // 🔥 新增：切换到话题标签页的函数
}) {
  const dispatch = useDispatch();
  // ：移除useTransition，实现即时响应

  // 获取当前Redux中的助手列表
  const allAssistants = useSelector((state: RootState) => state.assistants.assistants);

  // 保存当前选择的助手ID到本地存储
  const persistCurrentAssistantId = useCallback(async (assistantId: string) => {
    try {
      await setStorageItem(CURRENT_ASSISTANT_ID_KEY, assistantId);
    } catch (error) {
      console.warn('[SidebarTabs] 缓存助手ID到存储失败:', error);
    }
  }, []);

  // 当选择新助手时，保存助手ID到本地存储
  useCallback(() => {
    if (currentAssistant?.id) {
      persistCurrentAssistantId(currentAssistant.id);
    }
  }, [currentAssistant?.id, persistCurrentAssistantId]);

  // 选择助手 - 简化版本，直接状态更新
  const handleSelectAssistant = useCallback((assistant: Assistant) => {
    console.log('[useAssistantManagement] 切换助手:', assistant.name);

    // 批量更新状态，减少重渲染
    startTransition(() => {
      // 更新当前助手
      dispatch(setReduxCurrentAssistant(assistant));
      setCurrentAssistant(assistant);

      // 🔥 优化：直接切换到话题标签页，无需事件
      if (switchToTopicTab) {
        switchToTopicTab();
      }

      // 如果助手有话题，自动选择第一个话题
      if (assistant.topics && assistant.topics.length > 0) {
        dispatch(newMessagesActions.setCurrentTopicId(assistant.topics[0].id));
      }
    });

    // 后台异步保存到数据库（不阻塞UI）
    Promise.resolve().then(async () => {
      try {
        // 保存当前助手到数据库
        await dexieStorage.saveSetting('currentAssistant', assistant.id);

        // 如果助手没有话题数据，创建默认话题
        if (!assistant.topics || assistant.topics.length === 0) {
          const newTopic = await TopicService.createNewTopic();
          if (newTopic) {
            await dexieStorage.saveTopic(newTopic);

            const updatedAssistant = {
              ...assistant,
              topicIds: [newTopic.id],
              topics: [newTopic]
            };

            await dexieStorage.saveAssistant(updatedAssistant);
            dispatch(updateAssistant(updatedAssistant));
          }
        }

        console.log('[useAssistantManagement] 后台保存完成:', assistant.id);
      } catch (error) {
        console.error('后台保存助手失败:', error);
      }
    });
  }, [dispatch, setCurrentAssistant, currentTopic]);

  // 添加助手 - 直接使用Redux dispatch，类似最佳实例，添加useCallback缓存
  const handleAddAssistant = useCallback(async (assistant: Assistant) => {
    try {
      console.log('[useAssistantManagement] 开始添加助手:', assistant.name);

      // 保存话题到数据库（仍然需要保存到数据库以便持久化）
      if (assistant.topics && assistant.topics.length > 0) {
        for (const topic of assistant.topics) {
          await dexieStorage.saveTopic(topic);
        }
      }

      // 保存助手到数据库（仍然需要保存到数据库以便持久化）
      await dexieStorage.saveAssistant(assistant);

      // 设置为当前助手到数据库（仍然需要保存到数据库以便持久化）
      await dexieStorage.saveSetting('currentAssistant', assistant.id);

      // ：立即更新状态
      // 直接使用Redux dispatch更新状态
      dispatch(addAssistant(assistant));
      dispatch(setReduxCurrentAssistant(assistant));

      // 更新本地状态
      setCurrentAssistant(assistant);

      console.log('[useAssistantManagement] 助手添加完成:', assistant.id);
    } catch (error) {
      console.error('添加助手失败:', error);
    }
  }, [dispatch, setCurrentAssistant]);

  // 更新助手 - 直接使用Redux dispatch，类似最佳实例，添加useCallback缓存
  const handleUpdateAssistant = useCallback(async (assistant: Assistant) => {
    try {
      console.log('[useAssistantManagement] 开始更新助手:', assistant.name);

      // 保存助手到数据库（仍然需要保存到数据库以便持久化）
      await dexieStorage.saveAssistant(assistant);

      // ：立即更新状态
      // 直接使用Redux dispatch更新状态
      dispatch(updateAssistant(assistant));

      // 如果更新的是当前助手，更新本地状态
      if (currentAssistant && currentAssistant.id === assistant.id) {
        setCurrentAssistant(assistant);
      }

      console.log('[useAssistantManagement] 助手更新完成:', assistant.id);
    } catch (error) {
      console.error('更新助手失败:', error);
    }
  }, [dispatch, currentAssistant, setCurrentAssistant]);

  // 删除助手 - 直接使用Redux dispatch，类似最佳实例，添加useCallback缓存
  const handleDeleteAssistant = useCallback(async (assistantId: string) => {
    try {
      console.log('[useAssistantManagement] 开始删除助手:', assistantId);

      // 从数据库删除助手（仍然需要从数据库删除以便持久化）
      await dexieStorage.deleteAssistant(assistantId);

      // ：立即更新状态
      // 直接使用Redux dispatch更新状态
      dispatch(removeAssistant(assistantId));

      // 如果删除的是当前助手，从Redux状态中选择新的当前助手
      if (currentAssistant && currentAssistant.id === assistantId) {
        // ：立即更新状态
        // 从当前Redux状态中获取剩余的助手
        const remainingAssistants = allAssistants.filter((a: Assistant) => a.id !== assistantId);

        if (remainingAssistants.length > 0) {
          setCurrentAssistant(remainingAssistants[0]);
          dispatch(setReduxCurrentAssistant(remainingAssistants[0]));
        } else {
          setCurrentAssistant(null);
          dispatch(setReduxCurrentAssistant(null));
        }
      }

      console.log('[useAssistantManagement] 助手删除完成:', assistantId);
    } catch (error) {
      console.error('删除助手失败:', error);
    }
  }, [dispatch, currentAssistant, setCurrentAssistant]);

  return {
    handleSelectAssistant,
    handleAddAssistant,
    handleUpdateAssistant,
    handleDeleteAssistant
  };
}
