import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { createSelector } from '@reduxjs/toolkit';
import { useAssistant } from '../../../shared/hooks';
import { AssistantService } from '../../../shared/services';
import { EventEmitter, EVENT_NAMES } from '../../../shared/services/infra/EventService';
import { setSidebarTabIndex } from '../../../shared/store/settingsSlice';
import type { Assistant } from '../../../shared/types/Assistant';
import type { RootState } from '../../../shared/store';
import { setAssistants, setCurrentAssistant as setReduxCurrentAssistant } from '../../../shared/store/slices/assistantsSlice';

/**
 * 侧边栏状态管理钩子
 */
export function useSidebarState() {
  // 从 Redux 获取侧边栏 tab 索引，页面切换时状态会保持
  const sidebarTabIndex = useSelector((state: RootState) => state.settings.sidebarTabIndex ?? 0);
  
  const dispatch = useDispatch();

  // 包装 setValue，同时保存到 Redux（会自动持久化到存储）
  const setValue = useCallback((newValue: number) => {
    dispatch(setSidebarTabIndex(newValue));
  }, [dispatch]);
  
  const [loading, setLoading] = useState(true);
  const initialized = useRef(false);

  // 创建记忆化的 selector 来避免不必要的重新渲染
  const selectSidebarState = useMemo(
    () => createSelector(
      [
        (state: RootState) => state.assistants.assistants,
        (state: RootState) => state.assistants.currentAssistant,
        (state: RootState) => state.messages.currentTopicId
      ],
      (assistants, currentAssistant, currentTopicId) => ({
        assistants,
        currentAssistant,
        currentTopicId
      })
    ),
    []
  );

  // 直接从Redux获取数据，移除冗余的本地状态
  const { assistants: userAssistants, currentAssistant, currentTopicId } = useSelector(selectSidebarState);

  // 使用useAssistant钩子加载当前助手的话题
  const {
    assistant: assistantWithTopics,
    // isLoading: topicsLoading, // 注释掉未使用的变量
    updateTopic: updateAssistantTopic,
    refreshTopics,
  } = useAssistant(currentAssistant?.id || null);

  // 🚀 优化：使用 useMemo 直接从 assistantWithTopics.topics 计算 currentTopic
  // 移除复杂的 useEffect 和异步逻辑，避免状态重复维护
  // 注意：列表项 (TopicItem / AssistantItem) 已经直接从 Redux 获取 currentTopicId
  const currentTopic = useMemo(() => {
    if (!currentTopicId) return null;
    // 直接从已加载的话题列表中查找，无需额外的数据库查询
    return assistantWithTopics?.topics?.find(t => t.id === currentTopicId) || null;
  }, [currentTopicId, assistantWithTopics?.topics]);

  // 简化状态设置函数，直接使用Redux
  const setUserAssistants = useCallback((assistants: Assistant[]) => {
    dispatch(setAssistants(assistants));
  }, [dispatch]);

  const setCurrentAssistant = useCallback((assistant: Assistant | null) => {
    dispatch(setReduxCurrentAssistant(assistant));
  }, [dispatch]);

  // 移除复杂的加载状态防护，数据已预加载

  // 🔥 简化版本：数据已在AppInitializer中预加载，这里只处理强制重新加载
  const loadAssistants = useCallback(async (forceReload = false) => {
    // 如果需要强制重新加载，重新获取数据
    if (forceReload) {
      console.log('[SidebarTabs] 强制重新加载助手列表...');
      try {
        const assistants = await AssistantService.getUserAssistants();
        dispatch(setAssistants(assistants));
        console.log(`[SidebarTabs] 重新加载了 ${assistants.length} 个助手`);
      } catch (error) {
        console.error('[SidebarTabs] 重新加载助手列表失败:', error);
        throw error;
      }
    } else {
      // 正常情况下，数据已经在Redux中预加载，无需额外操作
      console.log('[SidebarTabs] 使用预加载的助手数据');
    }
  }, [dispatch]);

  // 🔥 简化初始化逻辑：数据已在AppInitializer中预加载，这里只需要设置loading状态
  useEffect(() => {
    // 数据已在AppInitializer中预加载，直接设置为已加载
    if (!initialized.current && userAssistants.length > 0) {
      console.log('[SidebarTabs] 检测到预加载数据，设置为已初始化');
      initialized.current = true;
      setLoading(false);
    } else if (!initialized.current) {
      // 如果还没有数据，等待AppInitializer完成
      console.log('[SidebarTabs] 等待AppInitializer完成数据预加载...');
    }
  }, [userAssistants.length]);

  // 监听SHOW_TOPIC_SIDEBAR事件，切换到话题标签页
  useEffect(() => {
    const unsubscribe = EventEmitter.on(EVENT_NAMES.SHOW_TOPIC_SIDEBAR, () => {
      setValue(1); // 切换到话题标签页（索引为1），会自动保存到 localStorage
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // 移除冗余的状态同步逻辑，直接使用Redux状态

  return {
    value: sidebarTabIndex,
    setValue,
    loading,
    userAssistants,
    setUserAssistants,
    currentAssistant,
    setCurrentAssistant,
    assistantWithTopics,
    currentTopic,
    updateAssistantTopic,
    refreshTopics,
    loadAssistants
  };
}
