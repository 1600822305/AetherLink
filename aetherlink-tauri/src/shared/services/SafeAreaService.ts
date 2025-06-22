/**
 * 安全区域管理服务
 * 处理各平台的安全区域，主要用于iOS设备
 */
import { initialize } from '@capacitor-community/safe-area';
import { Capacitor } from '@capacitor/core';

export interface SafeAreaInsets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/**
 * 安全区域管理服务类
 */
export class SafeAreaService {
  private static instance: SafeAreaService;
  private currentInsets: SafeAreaInsets = { top: 0, right: 0, bottom: 0, left: 0 };
  private isInitialized = false;
  private listeners: Array<(insets: SafeAreaInsets) => void> = [];
  private cssWatchTimer?: number;

  private constructor() {}

  public static getInstance(): SafeAreaService {
    if (!SafeAreaService.instance) {
      SafeAreaService.instance = new SafeAreaService();
    }
    return SafeAreaService.instance;
  }

  /**
   * 初始化安全区域服务
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      // 首先调用 initialize 函数来设置基础 CSS 变量
      initialize();

      if (Capacitor.isNativePlatform()) {
        // 原生平台：使用新的 Safe Area 插件 API
        await this.initializeNativeSafeArea();
      } else {
        // Web 平台：使用 CSS env() 变量
        this.initializeWebSafeArea();
      }

      // 应用安全区域到 CSS 变量
      this.applySafeAreaToCSS();

      this.isInitialized = true;
      console.log('[SafeAreaService] 安全区域服务初始化完成', this.currentInsets);
    } catch (error) {
      console.error('[SafeAreaService] 安全区域服务初始化失败:', error);
      // 使用默认值
      this.setFallbackInsets();
      this.applySafeAreaToCSS();
      this.isInitialized = true; // 即使失败也标记为已初始化，避免重复尝试
    }
  }

  /**
   * 初始化原生平台安全区域
   */
  private async initializeNativeSafeArea(): Promise<void> {
    try {
      // 对于Android，使用回退值（避免与StatusBarService的EdgeToEdge配置冲突）
      // 对于iOS，使用回退值（提供基本的安全区域支持）
      this.setFallbackInsets();
      console.log('[SafeAreaService] 原生安全区域初始化完成:', this.currentInsets);
    } catch (error) {
      console.error('[SafeAreaService] 原生安全区域获取失败:', error);
      this.setFallbackInsets();
    }
  }

  /**
   * 初始化 Web 平台安全区域
   */
  private initializeWebSafeArea(): void {
    // 在 Web 平台，尝试从 CSS env() 变量获取安全区域
    const testElement = document.createElement('div');
    testElement.style.position = 'fixed';
    testElement.style.top = 'env(safe-area-inset-top, 0px)';
    testElement.style.right = 'env(safe-area-inset-right, 0px)';
    testElement.style.bottom = 'env(safe-area-inset-bottom, 0px)';
    testElement.style.left = 'env(safe-area-inset-left, 0px)';
    testElement.style.visibility = 'hidden';
    testElement.style.pointerEvents = 'none';

    document.body.appendChild(testElement);

    const computedStyle = window.getComputedStyle(testElement);

    this.currentInsets = {
      top: this.parsePxValue(computedStyle.top),
      right: this.parsePxValue(computedStyle.right),
      bottom: this.parsePxValue(computedStyle.bottom),
      left: this.parsePxValue(computedStyle.left)
    };

    document.body.removeChild(testElement);

    console.log('[SafeAreaService] Web 安全区域获取成功:', this.currentInsets);
  }

  /**
   * 设置回退安全区域值
   */
  private setFallbackInsets(): void {
    // 根据平台设置默认值
    if (Capacitor.getPlatform() === 'android') {
      // Android：不设置底部安全区域（由StatusBarService处理）
      this.currentInsets = { top: 24, right: 0, bottom: 0, left: 0 };
    } else if (Capacitor.getPlatform() === 'ios') {
      // iOS：设置典型的安全区域值（刘海屏和底部安全区域）
      this.currentInsets = { top: 44, right: 0, bottom: 34, left: 0 };
    } else {
      // Web：无安全区域
      this.currentInsets = { top: 0, right: 0, bottom: 0, left: 0 };
    }

    console.log('[SafeAreaService] 使用回退安全区域值:', this.currentInsets);
  }

  /**
   * 应用安全区域到 CSS 变量
   */
  private applySafeAreaToCSS(): void {
    const root = document.documentElement;
    
    // 设置基础安全区域变量
    root.style.setProperty('--safe-area-inset-top', `${this.currentInsets.top}px`);
    root.style.setProperty('--safe-area-inset-right', `${this.currentInsets.right}px`);
    root.style.setProperty('--safe-area-inset-bottom', `${this.currentInsets.bottom}px`);
    root.style.setProperty('--safe-area-inset-left', `${this.currentInsets.left}px`);
    
    // 设置常用的组合变量
    root.style.setProperty('--safe-area-top', `${this.currentInsets.top}px`);
    root.style.setProperty('--safe-area-bottom', `${this.currentInsets.bottom}px`);
    
    // 设置聊天输入框底部边距（主要用于iOS）
    const chatInputPadding = this.currentInsets.bottom > 0 ? this.currentInsets.bottom + 8 : 8;
    root.style.setProperty('--chat-input-bottom-padding', `${chatInputPadding}px`);
    
    // 为聊天界面设置专用变量
    root.style.setProperty('--chat-container-padding-top', `${this.currentInsets.top}px`);
    root.style.setProperty('--chat-container-padding-bottom', `${this.currentInsets.bottom}px`);
    
    console.log('[SafeAreaService] CSS 变量已更新');
  }

  /**
   * 解析像素值
   */
  private parsePxValue(value: string): number {
    if (!value || value === 'none' || value === 'auto') {
      return 0;
    }

    // 匹配 px 值
    const pxMatch = value.match(/^(\d+(?:\.\d+)?)px$/);
    if (pxMatch) {
      return parseFloat(pxMatch[1]);
    }

    // 匹配纯数字
    const numMatch = value.match(/^(\d+(?:\.\d+)?)$/);
    if (numMatch) {
      return parseFloat(numMatch[1]);
    }

    return 0;
  }

  /**
   * 获取当前安全区域
   */
  public getCurrentInsets(): SafeAreaInsets {
    return { ...this.currentInsets };
  }

  /**
   * 添加安全区域变化监听器
   */
  public addListener(callback: (insets: SafeAreaInsets) => void): () => void {
    this.listeners.push(callback);
    
    // 返回移除监听器的函数
    return () => {
      const index = this.listeners.indexOf(callback);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  /**
   * 检查是否已初始化
   */
  public isReady(): boolean {
    return this.isInitialized;
  }

  /**
   * 获取特定区域的安全距离
   */
  public getInset(side: 'top' | 'right' | 'bottom' | 'left'): number {
    return this.currentInsets[side];
  }

  /**
   * 检查是否有底部安全区域（用于判断是否有底部导航栏）
   */
  public hasBottomInset(): boolean {
    return this.currentInsets.bottom > 0;
  }

  /**
   * 获取聊天输入框应该使用的底部边距
   */
  public getChatInputBottomPadding(): number {
    return this.currentInsets.bottom > 0 ? this.currentInsets.bottom + 8 : 8;
  }

  /**
   * 清理资源
   */
  public cleanup(): void {
    if (this.cssWatchTimer) {
      clearInterval(this.cssWatchTimer);
      this.cssWatchTimer = undefined;
    }
    this.listeners = [];
  }
}

// 导出单例实例
export const safeAreaService = SafeAreaService.getInstance();
