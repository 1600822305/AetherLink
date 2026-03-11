import { useState, useEffect, useCallback, useRef } from 'react';
import { KeyboardManager } from '../services/KeyboardManager';
import type { KeyboardState } from '../services/KeyboardManager';

// ============================================================================
// useKeyboard Hook
// ============================================================================

export interface UseKeyboardOptions {
  /**
   * 是否锁定键盘（模态框使用）
   * 锁定后，其他未锁定的组件 keyboardHeight 会返回 0
   */
  lock?: boolean;
  
  /**
   * 是否忽略锁定状态（始终获取真实键盘高度）
   * 用于需要知道真实键盘状态但不需要响应的场景
   */
  ignoreLock?: boolean;
}

export interface UseKeyboardResult {
  /** 键盘是否可见 */
  isKeyboardVisible: boolean;
  
  /** 键盘高度（受锁定影响，可能为 0） */
  keyboardHeight: number;
  
  /** 原始键盘高度（不受锁定影响） */
  rawKeyboardHeight: number;
  
  /** 隐藏键盘 */
  hideKeyboard: () => void;
  
  /** 当前组件是否持有锁 */
  isLockOwner: boolean;
}

/**
 * 键盘管理 Hook
 * 
 * @example
 * // 普通使用（尊重锁定）
 * const { keyboardHeight } = useKeyboard();
 * 
 * @example
 * // 模态框使用（锁定键盘）
 * const { keyboardHeight } = useKeyboard({ lock: true });
 * 
 * @example
 * // 获取原始高度（忽略锁定）
 * const { rawKeyboardHeight } = useKeyboard({ ignoreLock: true });
 */
export const useKeyboard = (options: UseKeyboardOptions = {}): UseKeyboardResult => {
  const { lock = false, ignoreLock = false } = options;
  
  const [state, setState] = useState<KeyboardState>({ isVisible: false, height: 0 });
  const lockIdRef = useRef<string | null>(null);
  const managerRef = useRef<KeyboardManager | null>(null);
  
  // 初始化管理器
  useEffect(() => {
    const manager = KeyboardManager.getInstance();
    managerRef.current = manager;
    manager.init();
    
    // 订阅状态变化
    const unsubscribe = manager.subscribe((newState) => {
      setState(newState);
    });
    
    return unsubscribe;
  }, []);
  
  // 处理锁定
  useEffect(() => {
    const manager = managerRef.current;
    if (!manager) return;
    
    if (lock) {
      // 获取锁
      lockIdRef.current = manager.lock();
    }
    
    return () => {
      // 释放锁
      if (lockIdRef.current) {
        manager?.unlock(lockIdRef.current);
        lockIdRef.current = null;
      }
    };
  }, [lock]);
  
  // 隐藏键盘
  const hideKeyboard = useCallback(() => {
    managerRef.current?.hide();
  }, []);
  
  // 计算是否是锁持有者
  const isLockOwner = managerRef.current?.isLockOwner(lockIdRef.current) ?? false;
  
  // 计算有效键盘高度
  const manager = managerRef.current;
  const isLocked = manager?.isLocked() ?? false;
  
  let effectiveHeight = state.height;
  
  if (isLocked && !ignoreLock) {
    // 键盘被锁定
    if (lock && isLockOwner) {
      // 当前组件持有锁，返回真实高度
      effectiveHeight = state.height;
    } else {
      // 当前组件没有锁，返回 0
      effectiveHeight = 0;
    }
  }
  
  return {
    isKeyboardVisible: state.isVisible,
    keyboardHeight: effectiveHeight,
    rawKeyboardHeight: state.height,
    hideKeyboard,
    isLockOwner,
  };
};
