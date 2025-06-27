import React, { useEffect, useRef, useCallback } from 'react';
import { App } from '@capacitor/app';
import { useNavigate } from 'react-router-dom';
import { useAppState } from '../shared/hooks/useAppState';

/**
 * 处理设置页面的智能返回逻辑
 * @param pathname 当前路径
 * @param navigate 导航函数
 */
const handleSettingsBack = (pathname: string, navigate: (path: string) => void) => {
  // 设置页面的层级关系映射
  const settingsRoutes: { [key: string]: string } = {
    // 主设置页面返回聊天页面
    '/settings': '/chat',

    // 一级设置页面返回主设置页面
    '/settings/appearance': '/settings',
    '/settings/behavior': '/settings',
    '/settings/default-model': '/settings',
    '/settings/topic-naming-settings': '/settings',
    '/settings/agent-prompts': '/settings',
    '/settings/ai-debate': '/settings',
    '/settings/model-combo': '/settings',
    '/settings/web-search': '/settings',
    '/settings/mcp-server': '/settings',
    '/settings/quick-phrases': '/settings',
    '/settings/workspace': '/settings',
    '/settings/knowledge': '/settings',
    '/settings/data': '/settings',
    '/settings/notion': '/settings',
    '/settings/voice': '/settings',
    '/settings/about': '/settings',
    '/settings/assistant-settings': '/settings',

    // 二级设置页面返回对应的一级页面
    '/settings/appearance/chat-interface': '/settings/appearance',
    '/settings/appearance/message-bubble': '/settings/appearance',
    '/settings/appearance/toolbar-customization': '/settings/appearance',
    '/settings/appearance/thinking-process': '/settings/appearance',
    '/settings/appearance/input-box': '/settings/appearance',
    '/settings/appearance/top-toolbar': '/settings/appearance',
    '/settings/data/advanced-backup': '/settings/data',
    '/settings/assistant-model-settings': '/settings/assistant-settings',
  };

  // 处理动态路由（如 /settings/model-provider/:providerId）
  if (pathname.startsWith('/settings/model-provider/')) {
    navigate('/settings/default-model');
    return;
  }
  if (pathname.startsWith('/settings/mcp-server/') && pathname !== '/settings/mcp-server') {
    navigate('/settings/mcp-server');
    return;
  }
  if (pathname.startsWith('/settings/workspace/') && pathname !== '/settings/workspace') {
    navigate('/settings/workspace');
    return;
  }

  // 查找对应的返回路径
  const backPath = settingsRoutes[pathname];
  if (backPath) {
    navigate(backPath);
  } else {
    // 如果没有找到对应的路径，默认返回主设置页面
    navigate('/settings');
  }
};

/**
 * 处理Android返回键的组件
 * 当用户点击返回键时，根据当前路由和对话框状态决定行为
 */
const BackButtonHandler: React.FC = () => {
  const navigate = useNavigate();
  const { setShowExitConfirm, hasOpenDialogs, openDialogs, closeDialog } = useAppState();

  // 防抖机制：防止短时间内重复处理返回键事件
  const lastBackButtonTime = useRef<number>(0);
  const DEBOUNCE_DELAY = 300; // 300ms 防抖延迟

  // 用于追踪组件是否已卸载
  const isMountedRef = useRef(true);

  // 使用useCallback缓存处理函数，避免因为依赖变化导致监听器重复创建
  const handleBackButton = useCallback(() => {
    const now = Date.now();

    // 防抖检查：如果距离上次处理时间太短，则忽略此次事件
    if (now - lastBackButtonTime.current < DEBOUNCE_DELAY) {
      console.log('[BackButtonHandler] 防抖：忽略重复的返回键事件');
      return;
    }

    lastBackButtonTime.current = now;

    // 获取当前路径（实时获取，避免闭包问题）
    const currentPath = window.location.hash.replace('#', '') || '/';

    // 优先处理对话框关闭
    if (hasOpenDialogs()) {
      // 关闭最后打开的对话框
      const dialogsArray = Array.from(openDialogs);
      const lastDialog = dialogsArray[dialogsArray.length - 1];
      if (lastDialog) {
        closeDialog(lastDialog);
        // 触发对话框关闭事件
        window.dispatchEvent(new CustomEvent('closeDialog', {
          detail: { dialogId: lastDialog }
        }));
      }
      return;
    }

    // 根据当前路径决定行为
    if (currentPath === '/chat') {
      // 在聊天页面，显示退出确认对话框
      setShowExitConfirm(true);
    } else if (currentPath === '/welcome') {
      // 在欢迎页面，显示退出确认对话框
      setShowExitConfirm(true);
    } else if (currentPath.startsWith('/settings')) {
      // 在设置页面，智能返回到上级页面
      handleSettingsBack(currentPath, navigate);
    } else {
      // 在其他页面，返回到聊天页面
      navigate('/chat');
    }
  }, [navigate, setShowExitConfirm, hasOpenDialogs, openDialogs, closeDialog]);

  useEffect(() => {
    isMountedRef.current = true;
    let listenerCleanup: (() => void) | undefined;

    // 监听返回键事件
    const setupListener = async () => {
      try {
        const listener = await App.addListener('backButton', handleBackButton);

        // 确保组件仍然挂载
        if (isMountedRef.current) {
          listenerCleanup = () => {
            listener.remove();
          };
        } else {
          // 如果组件已卸载，立即清理
          listener.remove();
        }
      } catch (error) {
        console.error('设置返回键监听器失败:', error);
      }
    };

    // 设置监听器并处理Promise
    setupListener().catch(error => {
      console.error('BackButtonHandler setupListener error:', error);
    });

    // 组件卸载时移除监听器
    return () => {
      isMountedRef.current = false;
      if (listenerCleanup) {
        listenerCleanup();
      }
    };
  }, [handleBackButton]); // 只依赖handleBackButton

  // 这是一个纯逻辑组件，不渲染任何UI
  return null;
};

export default BackButtonHandler;
