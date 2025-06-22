import { useMemo } from 'react';
import { useSelector } from 'react-redux';
import type { RootState } from '../../../../shared/store';
import type { Assistant } from '../../../../shared/types/Assistant';
import type { Group } from '../../../../shared/types';

// 添加GroupMap类型定义
type AssistantGroupMap = Record<string, string>;

/**
 * 助手分组钩子 - 简化版
 * 
 * 仅用于获取分组数据，不再支持编辑模式
 */
export function useAssistantGroups(userAssistants: Assistant[]) {
  // 安全地获取分组数据
  const groupState = useSelector((state: RootState) => {
    try {
      // 确保state.groups存在
      if (!state || !state.groups) {
        console.warn('Groups state is missing');
        return { groups: [] as Group[], assistantGroupMap: {} as AssistantGroupMap };
      }
      
      return state.groups;
    } catch (error) {
      console.error('Error accessing groups state:', error);
      return { groups: [] as Group[], assistantGroupMap: {} as AssistantGroupMap };
    }
  });

  // 安全地获取助手分组
  const assistantGroups = useMemo(() => {
    try {
      if (!Array.isArray(groupState.groups)) {
        return [];
      }
      
      return groupState.groups
        .filter(group => {
          return group && 
                 typeof group === 'object' && 
                 group.type === 'assistant' && 
                 Array.isArray(group.items);
        })
        .sort((a, b) => {
          const orderA = typeof a.order === 'number' ? a.order : 0;
          const orderB = typeof b.order === 'number' ? b.order : 0;
          return orderA - orderB;
        });
    } catch (error) {
      console.error('Error processing assistant groups:', error);
      return [];
    }
  }, [groupState.groups]);

  // 安全地获取未分组的助手
  const ungroupedAssistants = useMemo(() => {
    try {
      if (!Array.isArray(userAssistants)) {
        return [];
      }
      
      // 确保assistantGroupMap是对象且不为null
      const map: AssistantGroupMap = (groupState.assistantGroupMap && 
                                      typeof groupState.assistantGroupMap === 'object') ? 
                                      groupState.assistantGroupMap as AssistantGroupMap : 
                                      {};
      
      return userAssistants.filter(assistant => {
        return assistant && 
               typeof assistant === 'object' && 
               assistant.id && 
               !map[assistant.id];
      });
    } catch (error) {
      console.error('Error processing ungrouped assistants:', error);
      return Array.isArray(userAssistants) ? [...userAssistants] : [];
    }
  }, [userAssistants, groupState.assistantGroupMap]);

  // 确保返回的assistantGroupMap有正确的类型
  const safeAssistantGroupMap: AssistantGroupMap = 
    (groupState.assistantGroupMap && typeof groupState.assistantGroupMap === 'object') ? 
    groupState.assistantGroupMap as AssistantGroupMap : 
    {};

  return {
    assistantGroups,
    assistantGroupMap: safeAssistantGroupMap,
    ungroupedAssistants
  };
} 