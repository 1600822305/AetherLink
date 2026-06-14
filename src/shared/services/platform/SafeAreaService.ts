/**
 * 安全区域管理服务 (Rikkahub 风格)
 * 
 * 支持两种模式：
 * 1. CSS env() 模式 - 浏览器原生支持（iOS Safari、Chrome 等）
 * 2. JavaScript 注入模式 - Tauri 原生应用（通过 MainActivity.kt / WebViewEdgeToEdge.m 注入）
 * 
 * Tauri 移动端注入的 CSS 变量：
 * - --safe-area-inset-top/right/bottom/left（模拟 env()）
 * - --safe-area-top/right/bottom/left（兼容现有代码）
 * - --keyboard-height, --keyboard-visible（键盘状态）
 * 
 * 自定义事件：
 * - safeAreaChanged: 当原生层更新安全区域时触发
 */
import { getPlatformInfo } from '../../utils/platformDetection';
import { createLogger } from '../infra/logger';

const logger = createLogger('SafeAreaService');

export interface SafeAreaInsets {
  /** 顶部安全区域（px） */
  top: number;
  /** 右侧安全区域（px） */
  right: number;
  /** 底部安全区域（px） */
  bottom: number;
  /** 左侧安全区域（px） */
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
  private resizeObserver?: ResizeObserver;

  private constructor() {}

  public static getInstance(): SafeAreaService {
    if (!SafeAreaService.instance) {
      SafeAreaService.instance = new SafeAreaService();
    }
    return SafeAreaService.instance;
  }

  /**
   * 初始化安全区域服务 (Rikkahub 风格 - 纯 CSS 实现)
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.debug('已初始化，跳过');
      return;
    }

    try {
      // 直接从 CSS env() 变量读取安全区域
      this.readSafeAreaFromCSS();

      // 应用到 CSS 变量（用于组件使用）
      this.applySafeAreaToCSS();

      // 监听窗口变化（方向改变、键盘弹出等）
      this.setupListeners();

      this.isInitialized = true;
      logger.debug('✅ 安全区域初始化完成 (Rikkahub 风格)', this.currentInsets);
    } catch (error) {
      logger.error('❌ 安全区域初始化失败:', error);
      this.isInitialized = true;
    }
  }

  /**
   * 从 CSS env() 变量读取安全区域 (Rikkahub 方式)
   * 利用浏览器原生的 safe-area-inset 支持
   */
  private readSafeAreaFromCSS(): void {
    // 创建测试元素来读取 CSS env() 值
    const testElement = document.createElement('div');
    testElement.style.cssText = `
      position: fixed;
      top: env(safe-area-inset-top, 0px);
      right: env(safe-area-inset-right, 0px);
      bottom: env(safe-area-inset-bottom, 0px);
      left: env(safe-area-inset-left, 0px);
      visibility: hidden;
      pointer-events: none;
    `;
    
    document.body.appendChild(testElement);
    const computed = window.getComputedStyle(testElement);
    
    this.currentInsets = {
      top: this.parsePxValue(computed.top),
      right: this.parsePxValue(computed.right),
      bottom: this.parsePxValue(computed.bottom),
      left: this.parsePxValue(computed.left)
    };
    
    document.body.removeChild(testElement);
    
    logger.debug('📏 CSS 安全区域读取:', this.currentInsets);
  }

  /**
   * 设置监听器 (监听窗口、方向变化和 Tauri 原生注入事件)
   */
  private setupListeners(): void {
    // 监听窗口大小变化
    window.addEventListener('resize', this.handleResize);
    
    // 监听方向变化
    window.addEventListener('orientationchange', this.handleOrientationChange);
    
    // 🆕 监听 Tauri 原生层注入的安全区域事件
    // 由 MainActivity.kt (Android) 或 WebViewEdgeToEdge.m (iOS) 触发
    window.addEventListener('safeAreaChanged', this.handleSafeAreaChanged as EventListener);
    
    // 使用 ResizeObserver 监听 body 变化
    if ('ResizeObserver' in window) {
      this.resizeObserver = new ResizeObserver(() => {
        this.refresh();
      });
      this.resizeObserver.observe(document.body);
    }
    
    logger.debug('👂 监听器已设置（包含 Tauri 原生事件）');
  }
  
  /**
   * 处理 Tauri 原生层注入的安全区域变化事件
   */
  private handleSafeAreaChanged = (event: CustomEvent): void => {
    const detail = event.detail;
    if (detail) {
      logger.debug('📱 收到 Tauri 原生安全区域更新:', detail);
      
      const keyboardVisible = detail.keyboardVisible === true || detail.keyboardVisible === 'true' || detail.keyboardVisible === 1;
      
      // 更新缓存的安全区域值
      this.currentInsets = {
        top: detail.top || 0,
        right: detail.right || 0,
        bottom: detail.bottom || 0,
        left: detail.left || 0
      };
      
      // 直接应用原生层传入的值到 CSS（跳过最小值限制）
      this.applyNativeSafeArea(detail, keyboardVisible);
      
      // 通知所有监听器
      this.notifyListeners();
    }
  };
  
  /**
   * 直接应用原生层传入的安全区域（不做额外处理）
   */
  private applyNativeSafeArea(detail: any, keyboardVisible: boolean): void {
    const root = document.documentElement;
    const top = detail.top || 0;
    const right = detail.right || 0;
    const bottom = detail.bottom || 0;
    const left = detail.left || 0;
    const keyboardHeight = detail.keyboardHeight || 0;
    
    // 键盘显示时：使用原生层传入的值（已经是0）
    // 键盘隐藏时：使用原生层传入的值（已经处理过最小安全区域）
    root.style.setProperty('--safe-area-top', `${top}px`);
    root.style.setProperty('--safe-area-right', `${right}px`);
    root.style.setProperty('--safe-area-bottom', `${bottom}px`);
    root.style.setProperty('--safe-area-left', `${left}px`);
    root.style.setProperty('--safe-area-bottom-computed', `${bottom}px`);
    root.style.setProperty('--content-bottom-padding', `${bottom}px`);
    root.style.setProperty('--keyboard-height', `${keyboardHeight}px`);
    root.style.setProperty('--keyboard-visible', keyboardVisible ? '1' : '0');
    
    logger.debug(`应用原生安全区域: bottom=${bottom}px, keyboard=${keyboardVisible}`);
  }

  /**
   * 处理窗口大小变化
   */
  private handleResize = (): void => {
    // 延迟执行，避免频繁触发
    setTimeout(() => this.refresh(), 100);
  };

  /**
   * 处理方向变化
   */
  private handleOrientationChange = (): void => {
    // 方向变化后延迟刷新，等待系统栏调整完成
    setTimeout(() => this.refresh(), 300);
  };


  /**
   * 应用安全区域到 CSS 变量
   * 
   * 注意：主要的 CSS 变量已在 GlobalStyles.tsx 中定义
   * 这里作为补充，用于不支持 env() 的旧浏览器
   */
  private applySafeAreaToCSS(): void {
    const root = document.documentElement;
    const { top, right, bottom, left } = this.currentInsets;
    const platformInfo = getPlatformInfo();
    
    // 检测是否为原生移动平台（iOS/Android）
    const isNativeMobile = platformInfo.isMobile && (platformInfo.isTauri || platformInfo.isCapacitor);
    
    // 安全区域值：
    // - 移动端：使用系统值或默认值（顶部30px，底部48px）
    // - Web端：0px（不需要额外空间）
    const SAFE_AREA_TOP_MIN = isNativeMobile ? 30 : 0;
    const SAFE_AREA_BOTTOM_MIN = isNativeMobile ? 48 : 0;
    
    // 计算实际使用的顶部和底部安全区域
    const computedTop = isNativeMobile ? Math.max(top, SAFE_AREA_TOP_MIN) : 0;
    const computedBottom = isNativeMobile ? Math.max(bottom, SAFE_AREA_BOTTOM_MIN) : 0;
    
    // 应用自定义 CSS 变量
    root.style.setProperty('--safe-area-top', `${computedTop}px`);
    root.style.setProperty('--safe-area-right', `${right}px`);
    root.style.setProperty('--safe-area-bottom', `${bottom}px`);
    root.style.setProperty('--safe-area-left', `${left}px`);
    
    // 计算后的底部安全区域（所有页面统一使用）
    root.style.setProperty('--safe-area-bottom-computed', `${computedBottom}px`);
    root.style.setProperty('--safe-area-bottom-min', `${SAFE_AREA_BOTTOM_MIN}px`);
    
    // 内容区域底部 padding（不再额外添加16px，由原生层控制）
    root.style.setProperty('--content-bottom-padding', `${computedBottom}px`);
    
    // 标记平台类型
    const platformName = platformInfo.isTauri ? 'tauri' : (platformInfo.isCapacitor ? 'capacitor' : 'web');
    root.classList.add(`platform-${platformName}`);
    if (platformInfo.isAndroid) root.classList.add('platform-android');
    if (platformInfo.isIOS) root.classList.add('platform-ios');
    
    logger.debug(`平台: ${platformName}, 原生: ${isNativeMobile}, 顶部: ${computedTop}px, 底部: ${computedBottom}px`);
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
   * 刷新安全区域（方向改变、键盘弹出时调用）
   */
  public refresh(): void {
    if (!this.isInitialized) return;

    try {
      this.readSafeAreaFromCSS();
      this.applySafeAreaToCSS();
      this.notifyListeners();
    } catch (error) {
      logger.error('刷新失败:', error);
    }
  }

  /**
   * 通知所有监听器
   */
  private notifyListeners(): void {
    const insets = this.getCurrentInsets();
    this.listeners.forEach(callback => {
      try {
        callback(insets);
      } catch (error) {
        logger.error('监听器回调失败:', error);
      }
    });
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
   * 获取计算后的底部安全区域（统一值）
   * 返回 max(实际安全区域, 34px)
   */
  public getComputedBottomInset(): number {
    const SAFE_AREA_BOTTOM_MIN = 48;
    return Math.max(this.currentInsets.bottom, SAFE_AREA_BOTTOM_MIN);
  }

  /**
   * 清理资源
   */
  public cleanup(): void {
    window.removeEventListener('resize', this.handleResize);
    window.removeEventListener('orientationchange', this.handleOrientationChange);
    window.removeEventListener('safeAreaChanged', this.handleSafeAreaChanged as EventListener);
    
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = undefined;
    }
    
    this.listeners = [];
    this.isInitialized = false;
  }
}

// 导出单例实例
export const safeAreaService = SafeAreaService.getInstance();
