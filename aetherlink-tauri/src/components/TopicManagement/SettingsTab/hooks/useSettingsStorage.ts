import { useState, useEffect, useCallback } from 'react';
import type { MathRendererType } from '../../../../shared/types';
import type { ThinkingOption } from '../../../../shared/config/reasoningConfig';

// 设置项的类型定义
export interface AppSettings {
  // 上下文设置
  contextLength?: number;
  contextCount?: number;
  maxOutputTokens?: number;
  enableMaxOutputTokens?: boolean;
  mathRenderer?: MathRendererType;
  defaultThinkingEffort?: ThinkingOption;
  thinkingBudget?: number;
  
  // 常规设置
  streamOutput?: boolean;
  showMessageDivider?: boolean;
  copyableCodeBlocks?: boolean;
  renderUserInputAsMarkdown?: boolean;
  
  // 其他设置
  [key: string]: any;
}

// 默认设置值
const DEFAULT_SETTINGS: AppSettings = {
  contextLength: 16000,
  contextCount: 5,
  maxOutputTokens: 8192,
  enableMaxOutputTokens: true,
  mathRenderer: 'KaTeX' as MathRendererType,
  defaultThinkingEffort: 'medium' as ThinkingOption,
  thinkingBudget: 1024,
  streamOutput: true,
  showMessageDivider: true,
  copyableCodeBlocks: true,
  renderUserInputAsMarkdown: true,
};

/**
 * 统一的设置存储管理 Hook
 * 提供设置的读取、更新和事件通知功能
 */
export function useSettingsStorage() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [userAvatar, setUserAvatar] = useState<string>('');

  // 从 localStorage 加载设置
  const loadSettings = useCallback(() => {
    try {
      const appSettingsJSON = localStorage.getItem('appSettings');
      const savedSettings = appSettingsJSON ? JSON.parse(appSettingsJSON) : {};
      
      // 合并默认设置和保存的设置
      const mergedSettings = { ...DEFAULT_SETTINGS, ...savedSettings };
      setSettings(mergedSettings);

      // 加载用户头像
      const savedUserAvatar = localStorage.getItem('user_avatar');
      if (savedUserAvatar) {
        setUserAvatar(savedUserAvatar);
      }
    } catch (error) {
      console.error('加载设置失败:', error);
      setSettings(DEFAULT_SETTINGS);
    }
  }, []);

  // 保存单个设置项
  const updateSetting = useCallback((key: string, value: any) => {
    try {
      const appSettingsJSON = localStorage.getItem('appSettings');
      const currentSettings = appSettingsJSON ? JSON.parse(appSettingsJSON) : {};
      
      const updatedSettings = {
        ...currentSettings,
        [key]: value
      };
      
      localStorage.setItem('appSettings', JSON.stringify(updatedSettings));
      setSettings(prev => ({ ...prev, [key]: value }));

      // 触发自定义事件，通知其他组件设置已变化
      window.dispatchEvent(new CustomEvent('appSettingsChanged', {
        detail: { settingId: key, value }
      }));
      
      return true;
    } catch (error) {
      console.error(`保存设置 ${key} 失败:`, error);
      return false;
    }
  }, []);

  // 批量更新设置
  const updateSettings = useCallback((newSettings: Partial<AppSettings>) => {
    try {
      const appSettingsJSON = localStorage.getItem('appSettings');
      const currentSettings = appSettingsJSON ? JSON.parse(appSettingsJSON) : {};
      
      const updatedSettings = {
        ...currentSettings,
        ...newSettings
      };
      
      localStorage.setItem('appSettings', JSON.stringify(updatedSettings));
      setSettings(prev => ({ ...prev, ...newSettings }));

      // 触发批量更新事件
      window.dispatchEvent(new CustomEvent('appSettingsChanged', {
        detail: { batchUpdate: newSettings }
      }));
      
      return true;
    } catch (error) {
      console.error('批量保存设置失败:', error);
      return false;
    }
  }, []);

  // 保存用户头像
  const updateUserAvatar = useCallback((avatarDataUrl: string) => {
    try {
      localStorage.setItem('user_avatar', avatarDataUrl);
      setUserAvatar(avatarDataUrl);
      return true;
    } catch (error) {
      console.error('保存用户头像失败:', error);
      return false;
    }
  }, []);

  // 获取特定设置值
  const getSetting = useCallback(<T>(key: string, defaultValue: T): T => {
    return settings[key] !== undefined ? settings[key] : defaultValue;
  }, [settings]);

  // 初始化时加载设置
  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  return {
    settings,
    userAvatar,
    updateSetting,
    updateSettings,
    updateUserAvatar,
    getSetting,
    loadSettings,
  };
}

/**
 * 专门用于同步助手 maxTokens 的工具函数
 */
export async function syncAssistantMaxTokens(maxTokens: number): Promise<boolean> {
  try {
    const { dexieStorage } = await import('../../../../shared/services/storage/DexieStorageService');
    const assistants = await dexieStorage.getAllAssistants();

    for (const assistant of assistants) {
      const updatedAssistant = { ...assistant, maxTokens };
      await dexieStorage.saveAssistant(updatedAssistant);
    }

    console.log(`[SettingsStorage] 已同步更新 ${assistants.length} 个助手的maxTokens为 ${maxTokens}`);
    return true;
  } catch (error) {
    console.error('同步助手maxTokens失败:', error);
    return false;
  }
}
