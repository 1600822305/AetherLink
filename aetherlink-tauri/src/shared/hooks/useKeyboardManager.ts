import { useState, useEffect, useRef } from 'react';
import { Keyboard as CapacitorKeyboard } from '@capacitor/keyboard';
import { Capacitor } from '@capacitor/core';
import { useLocation } from 'react-router-dom';

/**
 * 键盘管理 Hook
 * 统一处理键盘显示/隐藏事件，避免页面切换时的输入法闪烁问题
 */
export const useKeyboardManager = () => {
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [isPageTransitioning, setIsPageTransitioning] = useState(false);
  const location = useLocation();
  const previousPathRef = useRef(location.pathname);
  const transitionTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Capacitor 键盘事件监听器
  useEffect(() => {
    let keyboardShowListener: any = null;
    let keyboardHideListener: any = null;

    const setupKeyboardListeners = async () => {
      // 只在原生移动平台上设置键盘监听器
      if (Capacitor.isNativePlatform()) {
        try {
          // 监听键盘显示事件
          keyboardShowListener = await CapacitorKeyboard.addListener('keyboardWillShow', () => {
            console.log('[KeyboardManager] 键盘将要显示');
            setIsKeyboardVisible(true);
            // 键盘显示时清除页面切换状态，但要延迟一点确保页面已稳定
            setTimeout(() => {
              setIsPageTransitioning(false);
            }, 100);
          });

          // 监听键盘隐藏事件
          keyboardHideListener = await CapacitorKeyboard.addListener('keyboardDidHide', () => {
            console.log('[KeyboardManager] 键盘已隐藏');
            setIsKeyboardVisible(false);
          });

          console.log('[KeyboardManager] 键盘事件监听器设置成功');
        } catch (error) {
          console.warn('[KeyboardManager] 键盘事件监听器设置失败:', error);
        }
      } else {
        console.log('[KeyboardManager] Web 平台，跳过 Capacitor 键盘监听器设置');
      }
    };

    setupKeyboardListeners();

    return () => {
      if (keyboardShowListener) {
        keyboardShowListener.remove();
      }
      if (keyboardHideListener) {
        keyboardHideListener.remove();
      }
    };
  }, []);

  // 路由变化检测 - 更精确的页面切换检测
  useEffect(() => {
    const currentPath = location.pathname;
    const previousPath = previousPathRef.current;

    // 只有在路径真正发生变化时才标记为页面切换
    if (currentPath !== previousPath) {
      console.log('[KeyboardManager] 检测到路由变化:', previousPath, '->', currentPath);
      setIsPageTransitioning(true);

      // 清除之前的定时器
      if (transitionTimerRef.current) {
        clearTimeout(transitionTimerRef.current);
      }

      // 根据目标页面调整切换时间
      const transitionDelay = currentPath === '/chat' ? 300 : 200; // 聊天页面需要更多时间加载

      transitionTimerRef.current = setTimeout(() => {
        setIsPageTransitioning(false);
        console.log('[KeyboardManager] 页面切换状态结束');
      }, transitionDelay);

      // 更新路径引用
      previousPathRef.current = currentPath;
    }

    return () => {
      if (transitionTimerRef.current) {
        clearTimeout(transitionTimerRef.current);
      }
    };
  }, [location.pathname]); // 依赖路径变化

  /**
   * 手动隐藏键盘
   */
  const hideKeyboard = async () => {
    // 只在原生移动平台上隐藏键盘
    if (Capacitor.isNativePlatform()) {
      try {
        await CapacitorKeyboard.hide();
        console.log('[KeyboardManager] 手动隐藏键盘');
      } catch (error) {
        console.warn('[KeyboardManager] 隐藏键盘失败:', error);
      }
    } else {
      console.log('[KeyboardManager] Web 平台，跳过键盘隐藏操作');
    }
  };

  /**
   * 检查是否应该执行焦点操作
   * 在页面切换期间避免不必要的焦点操作
   */
  const shouldHandleFocus = () => {
    const shouldHandle = !isPageTransitioning;
    // 只在状态变化时输出日志，避免重复日志
    return shouldHandle;
  };

  /**
   * 手动设置页面切换状态（用于特殊情况）
   */
  const setPageTransitioning = (transitioning: boolean) => {
    console.log('[KeyboardManager] 手动设置页面切换状态:', transitioning);
    setIsPageTransitioning(transitioning);
  };

  return {
    isKeyboardVisible,
    isPageTransitioning,
    hideKeyboard,
    shouldHandleFocus,
    setPageTransitioning
  };
};
