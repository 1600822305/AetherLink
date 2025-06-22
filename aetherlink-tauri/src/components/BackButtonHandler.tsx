import React, { useEffect } from 'react';
import { App } from '@capacitor/app';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAppState } from '../shared/hooks/useAppState';

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
          } else {
            // 在其他页面，返回上一页
            navigate(-1);
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
  }, [navigate, location.pathname, setShowExitConfirm]);

  // 这是一个纯逻辑组件，不渲染任何UI
  return null;
};

export default BackButtonHandler;
