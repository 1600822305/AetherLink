/**
 * 统一的返回键处理 Hook
 * 
 * 支持平台：
 * - Capacitor Android/iOS: 使用 @capacitor/app 的 backButton 事件
 * - Tauri Android: 通过 MainActivity.kt 转发的 Escape 键事件
 * - Tauri Desktop: Escape 键
 * - Web: Escape 键
 * 
 * 使用方式：
 * useBackButton(() => {
 *   // 处理返回逻辑
 * });
 */

import { useEffect, useRef } from 'react';
import { App as CapApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { getPlatformInfo } from '../utils/platformDetection';
import { createLogger } from '../services/infra/logger';

const logger = createLogger('BackButton');

// 全局返回键回调栈（用于多个监听器的优先级管理）
const backButtonCallbacks: Array<{ id: string; callback: () => boolean | void }> = [];

/**
 * 注册返回键回调
 * @param id 唯一标识符
 * @param callback 回调函数，返回 true 表示已处理，阻止后续回调
 */
export function registerBackButtonCallback(id: string, callback: () => boolean | void) {
  // 移除已存在的同 ID 回调
  const existingIndex = backButtonCallbacks.findIndex(c => c.id === id);
  if (existingIndex !== -1) {
    backButtonCallbacks.splice(existingIndex, 1);
  }
  // 添加到栈顶
  backButtonCallbacks.push({ id, callback });
}

/**
 * 注销返回键回调
 * @param id 唯一标识符
 */
export function unregisterBackButtonCallback(id: string) {
  const index = backButtonCallbacks.findIndex(c => c.id === id);
  if (index !== -1) {
    backButtonCallbacks.splice(index, 1);
  }
}

/**
 * 执行返回键回调（从栈顶开始）
 * @returns 是否有回调处理了事件
 */
function executeBackButtonCallbacks(): boolean {
  // 从栈顶（最后注册的）开始执行
  for (let i = backButtonCallbacks.length - 1; i >= 0; i--) {
    const { callback } = backButtonCallbacks[i];
    const handled = callback();
    if (handled === true) {
      return true;
    }
  }
  return false;
}

// 全局监听器状态
let isGlobalListenerInitialized = false;
let capacitorListenerHandle: { remove: () => Promise<void> } | null = null;

/**
 * 初始化全局返回键监听器
 * 只需调用一次，通常在应用启动时
 */
export function initBackButtonListener() {
  if (isGlobalListenerInitialized) {
    return;
  }
  
  isGlobalListenerInitialized = true;
  const platformInfo = getPlatformInfo();
  
  logger.debug('初始化返回键监听器', {
    isCapacitor: platformInfo.isCapacitor,
    isTauri: platformInfo.isTauri,
    isAndroid: platformInfo.isAndroid
  });
  
  // Capacitor 平台：使用原生 backButton API
  if (platformInfo.isCapacitor && Capacitor.isNativePlatform()) {
    logger.debug('注册 Capacitor backButton 监听器');
    
    CapApp.addListener('backButton', ({ canGoBack }) => {
      logger.debug('Capacitor 返回键触发, canGoBack:', canGoBack);
      executeBackButtonCallbacks();
    }).then(listener => {
      capacitorListenerHandle = listener;
      logger.debug('Capacitor 监听器注册成功');
    }).catch(err => {
      logger.error('Capacitor 监听器注册失败:', err);
    });
  }
  
  // 键盘事件监听（Tauri Android/Desktop 和 Web）
  // Tauri Android 通过 MainActivity.kt 将返回键转发为 Escape 事件
  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      logger.debug('Escape 键触发');
      const handled = executeBackButtonCallbacks();
      if (handled) {
        event.preventDefault();
        event.stopPropagation();
      }
    }
  };
  
  document.addEventListener('keydown', handleKeyDown);
  logger.debug('键盘监听器注册成功');
}

/**
 * 清理全局返回键监听器
 * 通常在应用卸载时调用
 */
export function cleanupBackButtonListener() {
  if (!isGlobalListenerInitialized) {
    return;
  }
  
  isGlobalListenerInitialized = false;
  
  // 移除 Capacitor 监听器
  if (capacitorListenerHandle) {
    capacitorListenerHandle.remove().catch(err => {
      logger.warn('移除 Capacitor 监听器失败:', err);
    });
    capacitorListenerHandle = null;
  }
  
  logger.debug('全局监听器已清理');
}

/**
 * 返回键处理 Hook
 * 
 * @param callback 返回键按下时的回调函数，返回 true 表示已处理
 * @param deps 依赖数组
 * 
 * @example
 * useBackButton(() => {
 *   if (isDialogOpen) {
 *     closeDialog();
 *     return true; // 已处理，阻止其他回调
 *   }
 *   return false; // 未处理，继续执行其他回调
 * }, [isDialogOpen]);
 */
export function useBackButton(
  callback: () => boolean | void,
  deps: React.DependencyList = []
) {
  const callbackRef = useRef(callback);
  const idRef = useRef(`back-button-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
  
  // 更新回调引用
  useEffect(() => {
    callbackRef.current = callback;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callback, ...deps]);
  
  // 注册/注销回调
  useEffect(() => {
    const id = idRef.current;
    
    registerBackButtonCallback(id, () => {
      return callbackRef.current();
    });
    
    return () => {
      unregisterBackButtonCallback(id);
    };
  }, []);
}

export default useBackButton;
