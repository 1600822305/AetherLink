/**
 * ============================================================================
 * 键盘管理系统 v2.0 - 支持锁定机制的全局键盘管理
 * ============================================================================
 * 
 * 设计理念：
 * 1. 全局单例管理键盘状态，避免多个组件重复监听
 * 2. 支持"锁定"机制：模态框可以锁定键盘，其他组件不响应
 * 3. 支持优先级：后锁定的优先级更高（栈结构）
 * 
 * 使用场景：
 * - 聊天输入框：普通使用，不锁定
 * - 编辑框（模态框）：锁定键盘，其他组件不响应
 * - 嵌套模态框：支持多层锁定
 */

import { getPlatformInfo } from '../utils/platformDetection';

export type KeyboardListener = (state: KeyboardState) => void;

export interface KeyboardState {
  isVisible: boolean;
  height: number;
}

interface LockInfo {
  id: string;
  timestamp: number;
}

export class KeyboardManager {
  private static instance: KeyboardManager;
  
  // 键盘状态
  private state: KeyboardState = { isVisible: false, height: 0 };
  
  // 监听器列表
  private listeners: Set<KeyboardListener> = new Set();
  
  // 锁定栈（后进先出）
  private lockStack: LockInfo[] = [];
  
  // 是否已初始化
  private initialized = false;
  
  // 原生事件句柄
  private showHandle: any = null;
  private hideHandle: any = null;
  
  private constructor() {}
  
  static getInstance(): KeyboardManager {
    if (!KeyboardManager.instance) {
      KeyboardManager.instance = new KeyboardManager();
    }
    return KeyboardManager.instance;
  }
  
  /**
   * 初始化键盘监听（只执行一次）
   * 支持 Tauri 和 Capacitor 两种平台
   */
  async init(): Promise<void> {
    const platformInfo = getPlatformInfo();
    const isNativeMobile = platformInfo.isMobile && (platformInfo.isTauri || platformInfo.isCapacitor);
    
    if (this.initialized || !isNativeMobile) return;
    
    this.initialized = true;
    
    try {
      // 监听原生层注入的 safeAreaChanged 事件
      // 由 Tauri Edge-to-Edge 插件或 Capacitor iOS 插件触发
      const handleSafeAreaChanged = (event: CustomEvent) => {
        const detail = event.detail;
        if (detail) {
          const keyboardVisible = detail.keyboardVisible === true || detail.keyboardVisible === 'true' || detail.keyboardVisible === 1;
          const keyboardHeight = parseFloat(detail.keyboardHeight) || 0;
          
          this.updateState({
            isVisible: keyboardVisible,
            height: keyboardHeight
          });
        }
      };
      
      // 监听 Capacitor Android 的 keyboardWillShow/keyboardDidHide window 事件
      const handleKeyboardWillShow = (event: any) => {
        const keyboardHeight = event?.keyboardHeight || event?.detail?.keyboardHeight || 0;
        this.updateState({
          isVisible: true,
          height: keyboardHeight
        });
      };
      
      const handleKeyboardDidHide = () => {
        this.updateState({
          isVisible: false,
          height: 0
        });
      };
      
      window.addEventListener('safeAreaChanged', handleSafeAreaChanged as EventListener);
      window.addEventListener('keyboardWillShow', handleKeyboardWillShow as EventListener);
      window.addEventListener('keyboardDidShow', handleKeyboardWillShow as EventListener);
      window.addEventListener('keyboardWillHide', handleKeyboardDidHide as EventListener);
      window.addEventListener('keyboardDidHide', handleKeyboardDidHide as EventListener);
      
      // 保存移除监听器的引用
      this.showHandle = {
        remove: () => {
          window.removeEventListener('safeAreaChanged', handleSafeAreaChanged as EventListener);
          window.removeEventListener('keyboardWillShow', handleKeyboardWillShow as EventListener);
          window.removeEventListener('keyboardDidShow', handleKeyboardWillShow as EventListener);
          window.removeEventListener('keyboardWillHide', handleKeyboardDidHide as EventListener);
          window.removeEventListener('keyboardDidHide', handleKeyboardDidHide as EventListener);
        }
      };
      
      console.log('[KeyboardManager] 初始化完成 (Tauri/Capacitor 兼容模式)');
    } catch (error) {
      console.error('[KeyboardManager] 初始化失败:', error);
    }
  }
  
  /**
   * 更新状态并通知所有监听器
   */
  private updateState(newState: KeyboardState): void {
    this.state = newState;
    this.listeners.forEach(listener => listener(this.state));
  }
  
  /**
   * 获取当前状态
   */
  getState(): KeyboardState {
    return this.state;
  }
  
  /**
   * 添加监听器
   */
  subscribe(listener: KeyboardListener): () => void {
    this.listeners.add(listener);
    // 立即通知当前状态
    listener(this.state);
    
    return () => {
      this.listeners.delete(listener);
    };
  }
  
  /**
   * 锁定键盘（模态框使用）
   * @returns 锁定 ID，用于解锁
   */
  lock(): string {
    const id = `lock_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.lockStack.push({ id, timestamp: Date.now() });
    return id;
  }
  
  /**
   * 解锁键盘
   * @param lockId 锁定时返回的 ID
   */
  unlock(lockId: string): void {
    const index = this.lockStack.findIndex(lock => lock.id === lockId);
    if (index !== -1) {
      this.lockStack.splice(index, 1);
    }
  }
  
  /**
   * 检查是否被锁定
   */
  isLocked(): boolean {
    return this.lockStack.length > 0;
  }
  
  /**
   * 检查指定 ID 是否持有锁（是否是当前锁的持有者）
   */
  isLockOwner(lockId: string | null): boolean {
    if (!lockId || this.lockStack.length === 0) return false;
    // 栈顶的锁是当前持有者
    return this.lockStack[this.lockStack.length - 1].id === lockId;
  }
  
  /**
   * 隐藏键盘
   * 通过 blur 当前聚焦元素来隐藏键盘
   */
  hide(): void {
    const platformInfo = getPlatformInfo();
    const isNativeMobile = platformInfo.isMobile && (platformInfo.isTauri || platformInfo.isCapacitor);
    
    if (isNativeMobile) {
      // 移除当前焦点来隐藏键盘
      const activeElement = document.activeElement as HTMLElement;
      if (activeElement && typeof activeElement.blur === 'function') {
        activeElement.blur();
      }
    }
  }
  
  /**
   * 销毁（通常不需要调用）
   */
  destroy(): void {
    this.showHandle?.remove();
    this.hideHandle?.remove();
    this.listeners.clear();
    this.lockStack = [];
    this.initialized = false;
  }
}
