/**
 * 通用技能绑定 Hook
 * 统一管理助手与技能的绑定关系，确保 SkillsSettings 和 EditAssistantDialog 数据一致
 *
 * 数据流：Redux assistants state + dexieStorage 持久化
 */

import { useCallback, useMemo } from 'react';
import { useAppSelector, useAppDispatch } from '../shared/store';
import { updateAssistant } from '../shared/store/slices/assistantsSlice';
import { dexieStorage } from '../shared/services/storage/DexieStorageService';
import type { Assistant } from '../shared/types/Assistant';
import { createLogger } from '../shared/services/infra/logger';

const logger = createLogger('useSkillBinding');

export interface SkillBindingInfo {
  assistantId: string;
  assistantName: string;
  assistantEmoji?: string;
  isBound: boolean;
}

export function useSkillBinding() {
  const dispatch = useAppDispatch();
  const assistants = useAppSelector(state => state.assistants.assistants);

  /**
   * 获取某个技能绑定到了哪些助手
   */
  const getAssistantsForSkill = useCallback((skillId: string): SkillBindingInfo[] => {
    return assistants.map(a => ({
      assistantId: a.id,
      assistantName: a.name,
      assistantEmoji: a.emoji,
      isBound: (a.skillIds || []).includes(skillId),
    }));
  }, [assistants]);

  /**
   * 获取某个技能绑定的助手数量
   */
  const getBindCount = useCallback((skillId: string): number => {
    return assistants.filter(a => (a.skillIds || []).includes(skillId)).length;
  }, [assistants]);

  /**
   * 切换某个助手对某个技能的绑定状态
   * 立即更新 Redux + 持久化到 DB
   */
  const toggleSkillForAssistant = useCallback(async (skillId: string, assistantId: string) => {
    const assistant = assistants.find(a => a.id === assistantId);
    if (!assistant) return;

    const currentSkillIds = assistant.skillIds || [];
    const isBound = currentSkillIds.includes(skillId);
    const newSkillIds = isBound
      ? currentSkillIds.filter(id => id !== skillId)
      : [...currentSkillIds, skillId];

    const updatedAssistant: Assistant = {
      ...assistant,
      skillIds: newSkillIds,
    };

    // 同步更新 Redux
    dispatch(updateAssistant(updatedAssistant));

    // 持久化到数据库
    try {
      await dexieStorage.saveAssistant(updatedAssistant);
    } catch (error) {
      logger.error('保存助手失败:', error);
    }
  }, [assistants, dispatch]);

  /**
   * 批量设置某个技能绑定到指定的助手列表
   */
  const setSkillAssistants = useCallback(async (skillId: string, assistantIds: string[]) => {
    const updates: Assistant[] = [];

    for (const assistant of assistants) {
      const currentSkillIds = assistant.skillIds || [];
      const shouldBind = assistantIds.includes(assistant.id);
      const isBound = currentSkillIds.includes(skillId);

      if (shouldBind !== isBound) {
        const newSkillIds = shouldBind
          ? [...currentSkillIds, skillId]
          : currentSkillIds.filter(id => id !== skillId);

        updates.push({ ...assistant, skillIds: newSkillIds });
      }
    }

    // 批量更新
    for (const updated of updates) {
      dispatch(updateAssistant(updated));
      try {
        await dexieStorage.saveAssistant(updated);
      } catch (error) {
        logger.error('批量保存助手失败:', error);
      }
    }
  }, [assistants, dispatch]);

  /**
   * 获取某个助手绑定的技能 ID 列表
   */
  const getSkillIdsForAssistant = useCallback((assistantId: string): string[] => {
    const assistant = assistants.find(a => a.id === assistantId);
    return assistant?.skillIds || [];
  }, [assistants]);

  /**
   * 非系统助手列表（用于 UI 展示）
   */
  const availableAssistants = useMemo(() => {
    return assistants.filter(a => !a.isSystem);
  }, [assistants]);

  return {
    assistants: availableAssistants,
    getAssistantsForSkill,
    getBindCount,
    toggleSkillForAssistant,
    setSkillAssistants,
    getSkillIdsForAssistant,
  };
}
