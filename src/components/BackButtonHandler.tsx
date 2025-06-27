import React, { useEffect } from 'react';
import { App } from '@capacitor/app';
import { useNavigate, useLocation } from 'react-router-dom';
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
  const location = useLocation();
  const { setShowExitConfirm, hasOpenDialogs, openDialogs, closeDialog } = useAppState();

  useEffect(() => {
    // 保存监听器引用
    let listenerCleanup: (() => void) | undefined;

    // 监听返回键事件
    const setupListener = async () => {
      try {
        const listener = await App.addListener('backButton', () => {
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
          if (location.pathname === '/chat') {
            // 在聊天页面，显示退出确认对话框
            setShowExitConfirm(true);
          } else if (location.pathname === '/welcome') {
            // 在欢迎页面，显示退出确认对话框
            setShowExitConfirm(true);
          } else if (location.pathname.startsWith('/settings')) {
            // 在设置页面，智能返回到上级页面
            handleSettingsBack(location.pathname, navigate);
          } else {
            // 在其他页面，返回到聊天页面
            navigate('/chat');
          }
        });

        // 保存清理函数
        listenerCleanup = () => {
          listener.remove();
        };
      } catch (error) {
        console.error('设置返回键监听器失败:', error);
      }
    };

    // 设置监听器
    setupListener();

    // 组件卸载时移除监听器
    return () => {
      if (listenerCleanup) {
        listenerCleanup();
      }
    };
  }, [navigate, location.pathname, setShowExitConfirm, hasOpenDialogs, openDialogs, closeDialog]);

  // 这是一个纯逻辑组件，不渲染任何UI
  return null;
};

export default BackButtonHandler;
