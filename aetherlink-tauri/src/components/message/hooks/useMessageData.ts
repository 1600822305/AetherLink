import { useEffect, useState, useMemo } from 'react';
import { useSelector } from 'react-redux';
import { createSelector } from '@reduxjs/toolkit';
import { useTheme } from '@mui/material';
import type { RootState } from '../../../shared/store';
import type { Message, MessageBlock } from '../../../shared/types/newMessage';
import { getMessageDividerSetting } from '../../../shared/utils/settingsUtils';
import { getThemeColors } from '../../../shared/utils/themeUtils';
import { dexieStorage } from '../../../shared/services/storage/DexieStorageService';

export const useMessageData = (message: Message) => {
  const theme = useTheme();
  const [modelAvatar, setModelAvatar] = useState<string | null>(null);
  const [assistantAvatar, setAssistantAvatar] = useState<string | null>(null);
  const [userAvatar, setUserAvatar] = useState<string | null>(null);
  const [showMessageDivider, setShowMessageDivider] = useState<boolean>(true);

  // 创建一个稳定的空数组引用
  const EMPTY_BLOCKS_ARRAY = useMemo(() => [], []);

  // 获取设置
  const settings = useSelector((state: RootState) => state.settings);
  const providers = useSelector((state: RootState) => state.settings.providers || []);

  // 获取主题和主题工具
  const themeStyle = useSelector((state: RootState) => state.settings.themeStyle);
  const themeColors = getThemeColors(theme, themeStyle);

  // 获取头像和名称显示设置
  const showUserAvatar = settings.showUserAvatar !== false;
  const showUserName = settings.showUserName !== false;
  const showModelAvatar = settings.showModelAvatar !== false;
  const showModelName = settings.showModelName !== false;

  // 获取消息样式设置
  const messageStyle = settings.messageStyle || 'bubble';
  const isBubbleStyle = messageStyle === 'bubble';

  // 获取供应商友好名称的函数 - 使用useMemo进一步优化
  const getProviderName = useMemo(() => {
    const providerMap = new Map(providers.map((p: any) => [p.id, p.name]));
    return (providerId: string): string => providerMap.get(providerId) || providerId || '';
  }, [providers]);

  // 创建记忆化的 selector 来避免不必要的重新渲染
  const selectMessageBlocks = useMemo(
    () => createSelector(
      [
        (state: RootState) => state.messageBlocks.entities,
        (_state: RootState) => message.blocks // 移除箭头函数，直接访问message.blocks
      ],
      (blockEntities, blockIds) => {
        // 如果blockIds为空或undefined，返回稳定的空数组引用
        if (!blockIds || blockIds.length === 0) {
          return EMPTY_BLOCKS_ARRAY;
        }
        // 直接返回映射结果，createSelector会处理记忆化
        return blockIds
          .map((blockId: string) => blockEntities[blockId])
          .filter(Boolean) as MessageBlock[];
      }
    ),
    [message.blocks, EMPTY_BLOCKS_ARRAY] // 只有当 message.blocks 改变时才重新创建 selector
  );

  // 使用记忆化的 selector
  const blocks = useSelector(selectMessageBlocks);

  // 获取消息分割线设置
  useEffect(() => {
    const fetchMessageDividerSetting = () => {
      try {
        const dividerSetting = getMessageDividerSetting();
        setShowMessageDivider(dividerSetting);
      } catch (error) {
        console.error('获取消息分割线设置失败:', error);
      }
    };

    fetchMessageDividerSetting();

    // 监听 localStorage 变化，实时更新设置
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'appSettings') {
        fetchMessageDividerSetting();
      }
    };

    // 使用自定义事件监听设置变化（用于同一页面内的变化）
    const handleCustomSettingChange = () => {
      fetchMessageDividerSetting();
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('settingsChanged', handleCustomSettingChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('settingsChanged', handleCustomSettingChange);
    };
  }, []);

  // 获取用户头像
  useEffect(() => {
    const fetchUserAvatar = () => {
      try {
        const savedUserAvatar = localStorage.getItem('user_avatar');
        if (savedUserAvatar) {
          setUserAvatar(savedUserAvatar);
        } else {
          setUserAvatar(null);
        }
      } catch (error) {
        console.error('获取用户头像失败:', error);
      }
    };

    fetchUserAvatar();

    // 监听 localStorage 变化，实时更新头像
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'user_avatar') {
        setUserAvatar(e.newValue);
      }
    };

    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  // 获取助手头像
  useEffect(() => {
    const fetchAssistantAvatar = async () => {
      if (message.role === 'assistant' && message.assistantId) {
        try {
          // 从数据库获取助手信息
          const assistant = await dexieStorage.getAssistant(message.assistantId);

          if (assistant?.avatar) {
            // 如果助手有自定义头像，使用它
            setAssistantAvatar(assistant.avatar);
          } else {
            // 如果没有自定义头像，清空状态
            setAssistantAvatar(null);
          }
        } catch (error) {
          console.error('获取助手头像失败:', error);
          setAssistantAvatar(null);
        }
      } else {
        setAssistantAvatar(null);
      }
    };

    fetchAssistantAvatar();
  }, [message.role, message.assistantId]);

  // 尝试获取模型头像
  useEffect(() => {
    const fetchModelAvatar = async () => {
      if (message.role === 'assistant' && message.model?.id) {
        try {
          // 从数据库获取模型配置
          const modelConfig = await dexieStorage.getModel(message.model.id);

          if (modelConfig?.avatar) {
            // 如果数据库中有头像，使用它
            setModelAvatar(modelConfig.avatar);
          } else if (message.model.iconUrl) {
            // 如果模型有iconUrl，使用它
            setModelAvatar(message.model.iconUrl);

            // 同时保存到数据库以便将来使用
            await dexieStorage.saveModel(message.model.id, {
              id: message.model.id,
              avatar: message.model.iconUrl,
              updatedAt: new Date().toISOString()
            });
          }
          // 如果没有头像，将使用默认的字母头像
        } catch (error) {
          console.error('获取模型头像失败:', error);

          // 如果数据库访问失败但模型有iconUrl，仍然使用它
          if (message.model.iconUrl) {
            setModelAvatar(message.model.iconUrl);
          }
        }
      }
    };

    fetchModelAvatar();
  }, [message.role, message.model?.id]);

  return {
    blocks,
    modelAvatar,
    assistantAvatar,
    userAvatar,
    showMessageDivider,
    settings,
    themeColors,
    themeStyle,
    showUserAvatar,
    showUserName,
    showModelAvatar,
    showModelName,
    isBubbleStyle,
    getProviderName,
    theme
  };
};
