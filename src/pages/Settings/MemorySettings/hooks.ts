/**
 * 记忆设置页的数据逻辑：记忆列表、助手、整理、可用模型
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { useAppDispatch } from '../../../shared/store';
import { setCurrentAssistantId, patchMemoryConfig } from '../../../shared/store/slices/memorySlice';
import { selectProviders } from '../../../shared/store/selectors/settingsSelectors';
import { memoryService } from '../../../shared/services/memory/MemoryService';
import { dexieStorage } from '../../../shared/services/storage/DexieStorageService';
import {
  memoryMaintenanceService,
  type MemoryMaintenanceReport,
} from '../../../shared/services/memory/maintenance';
import type { Model } from '../../../shared/types';
import type { MemoryItem } from '../../../shared/types/memory';
import { toastManager } from '../../../components/EnhancedToast';
import { createLogger } from '../../../shared/services/infra/logger';

const logger = createLogger('MemorySettingsHooks');

export interface AssistantOption {
  id: string;
  name: string;
  memoryEnabled?: boolean;
}

/** 记忆列表的加载、搜索与增删改 */
export function useMemoryLibrary(assistantId: string) {
  const [memories, setMemories] = useState<MemoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [total, setTotal] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await memoryService.list({ assistantId, limit: 100 });
      setMemories(result.memories);
      setTotal(result.count);
    } catch (error) {
      logger.error('加载记忆失败:', error);
      toastManager.error('加载记忆失败');
    } finally {
      setLoading(false);
    }
  }, [assistantId]);

  useEffect(() => {
    load();
  }, [load]);

  const search = useCallback(async () => {
    if (!searchQuery.trim()) {
      load();
      return;
    }
    setLoading(true);
    try {
      const result = await memoryService.textSearch(searchQuery, { assistantId });
      setMemories(result.memories);
    } catch (error) {
      logger.error('搜索失败:', error);
    } finally {
      setLoading(false);
    }
  }, [searchQuery, assistantId, load]);

  const addMemory = useCallback(async (text: string) => {
    if (!text.trim()) return false;
    try {
      const memory = await memoryService.add(text, {
        assistantId,
        metadata: { source: 'manual' },
      });
      if (memory) {
        toastManager.success('记忆已添加');
        load();
        return true;
      }
    } catch (error) {
      logger.error('添加记忆失败:', error);
      toastManager.error('添加记忆失败');
    }
    return false;
  }, [assistantId, load]);

  const updateMemory = useCallback(async (id: string, text: string) => {
    if (!text.trim()) return false;
    try {
      const updated = await memoryService.update(id, text);
      if (updated) {
        toastManager.success('记忆已更新');
        load();
        return true;
      }
    } catch (error) {
      logger.error('更新记忆失败:', error);
      toastManager.error('更新记忆失败');
    }
    return false;
  }, [load]);

  const deleteMemory = useCallback(async (id: string) => {
    try {
      const deleted = await memoryService.delete(id);
      if (deleted) {
        toastManager.success('记忆已删除');
        load();
      }
    } catch (error) {
      logger.error('删除记忆失败:', error);
      toastManager.error('删除记忆失败');
    }
  }, [load]);

  const clearAll = useCallback(async () => {
    try {
      await memoryService.deleteAllMemoriesForAssistant(assistantId);
      toastManager.success('已清空所有记忆');
      load();
    } catch (error) {
      logger.error('清空记忆失败:', error);
      toastManager.error('清空记忆失败');
    }
  }, [assistantId, load]);

  return {
    memories, loading, total, searchQuery, setSearchQuery,
    load, search, addMemory, updateMemory, deleteMemory, clearAll,
  };
}

/** 读取助手列表并迁移 'default-user' 的旧记忆到第一个助手 */
async function fetchAssistantsWithMigration(): Promise<AssistantOption[]> {
  const allAssistants = await dexieStorage.getAllAssistants();
  const assistantList = allAssistants.map(a => ({ id: a.id, name: a.name, memoryEnabled: a.memoryEnabled }));
  const finalList = assistantList.length > 0 ? assistantList : [{ id: 'default', name: '默认助手', memoryEnabled: false }];

  if (finalList.length > 0 && finalList[0].id !== 'default') {
    const allMemories = await dexieStorage.memories.toArray();
    const oldMemories = allMemories.filter(m => m.userId === 'default-user' && !m.isDeleted);
    if (oldMemories.length > 0) {
      logger.debug(`迁移 ${oldMemories.length} 条旧记忆到助手 ${finalList[0].id}`);
      for (const memory of oldMemories) {
        await dexieStorage.memories.update(memory.id, { userId: finalList[0].id });
      }
      // 绕过 MemoryService 直接改了库，需失效其记忆缓存
      memoryService.invalidateMemoryCache();
    }
  }
  return finalList;
}

/** 助手列表加载、切换与单助手记忆开关（含旧记忆迁移） */
export function useAssistants(currentAssistantId: string) {
  const dispatch = useAppDispatch();
  const [assistants, setAssistants] = useState<AssistantOption[]>([]);
  const [currentMemoryEnabled, setCurrentMemoryEnabled] = useState(false);

  useEffect(() => {
    let active = true;
    fetchAssistantsWithMigration()
      .then(finalList => {
        if (!active) return;
        setAssistants(finalList);
        if (!currentAssistantId || !finalList.find(a => a.id === currentAssistantId)) {
          dispatch(setCurrentAssistantId(finalList[0].id));
          setCurrentMemoryEnabled(finalList[0].memoryEnabled || false);
        } else {
          const currentAst = finalList.find(a => a.id === currentAssistantId);
          setCurrentMemoryEnabled(currentAst?.memoryEnabled || false);
        }
      })
      .catch(error => {
        logger.error('加载助手列表失败:', error);
      });
    return () => {
      active = false;
    };
  }, [currentAssistantId, dispatch]);

  const changeAssistant = useCallback((assistantId: string) => {
    dispatch(setCurrentAssistantId(assistantId));
    const assistant = assistants.find(a => a.id === assistantId);
    setCurrentMemoryEnabled(assistant?.memoryEnabled || false);
  }, [dispatch, assistants]);

  const toggleMemoryEnabled = useCallback(async (enabled: boolean) => {
    if (!currentAssistantId || currentAssistantId === 'default') return;
    try {
      const assistant = await dexieStorage.getAssistant(currentAssistantId);
      if (assistant) {
        await dexieStorage.saveAssistant({ ...assistant, memoryEnabled: enabled });
        setCurrentMemoryEnabled(enabled);
        setAssistants(prev => prev.map(a =>
          a.id === currentAssistantId ? { ...a, memoryEnabled: enabled } : a
        ));
        toastManager.success(enabled ? '已开启助手记忆功能' : '已关闭助手记忆功能');
      }
    } catch (error) {
      logger.error('切换助手记忆失败:', error);
      toastManager.error('切换助手记忆失败');
    }
  }, [currentAssistantId]);

  return { assistants, currentMemoryEnabled, changeAssistant, toggleMemoryEnabled };
}

/** 记忆整理（dryRun 预览 / 立即整理）执行与报告状态 */
export function useMaintenance(
  assistantId: string,
  retentionDays: number | undefined,
  harvestEnabled: boolean | undefined,
  onCompleted: () => void
) {
  const dispatch = useAppDispatch();
  const [running, setRunning] = useState(false);
  const [report, setReport] = useState<MemoryMaintenanceReport | null>(null);
  const [showReport, setShowReport] = useState(false);

  const run = useCallback(async (dryRun: boolean) => {
    if (running) return;
    setRunning(true);
    try {
      const result = await memoryMaintenanceService.run({
        assistantId,
        dryRun,
        retentionDays,
        harvestEnabled,
      });
      setReport(result);
      setShowReport(true);
      if (!dryRun) {
        dispatch(patchMemoryConfig({ lastMaintenanceAt: result.finishedAt }));
        onCompleted();
      }
    } catch (error) {
      logger.error('记忆整理失败:', error);
      toastManager.error('记忆整理失败');
    } finally {
      setRunning(false);
    }
  }, [running, assistantId, retentionDays, harvestEnabled, dispatch, onCompleted]);

  return { running, report, showReport, setShowReport, run };
}

/** 从 providers 中提取所有启用的模型（与 useModelSelection 保持一致） */
export function useEnabledModels() {
  const providers = useSelector(selectProviders);

  const models = useMemo(() => {
    const allModels: Model[] = [];
    if (providers) {
      providers.forEach(provider => {
        if (provider.isEnabled && provider.models) {
          provider.models.forEach((model: Model) => {
            if (model.enabled) {
              allModels.push({
                ...model,
                apiKey: model.apiKey || provider.apiKey,
                baseUrl: model.baseUrl || provider.baseUrl,
                providerType: model.providerType || provider.providerType || provider.id,
              });
            }
          });
        }
      });
    }
    return allModels;
  }, [providers]);

  return { models, providers };
}
