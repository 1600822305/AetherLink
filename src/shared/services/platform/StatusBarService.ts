import { StatusBar } from '@capacitor/status-bar';
import { Capacitor } from '@capacitor/core';
import { EdgeToEdge } from 'capacitor-edge-to-edge';
import { themeConfigs, type ThemeStyle } from '../../config/themes';
import { createLogger } from '../infra/logger';

const logger = createLogger('StatusBarService');

/**
 * 状态栏管理服务 (Rikkahub 风格)
 * 提供统一的状态栏和导航栏样式管理
 * 实现 Edge-to-Edge 效果，状态栏和导航栏完全透明
 * 图标颜色根据主题自动切换
 */
export class StatusBarService {
  private static instance: StatusBarService;
  private currentTheme: 'light' | 'dark' = 'light';
  private currentThemeStyle: ThemeStyle = 'default';
  private isInitialized = false;

  private constructor() {}

  public static getInstance(): StatusBarService {
    if (!StatusBarService.instance) {
      StatusBarService.instance = new StatusBarService();
    }
    return StatusBarService.instance;
  }

  /**
   * 初始化状态栏 (Rikkahub 风格)
   * @param theme 当前主题模式
   * @param themeStyle 主题风格
   */
  public async initialize(theme: 'light' | 'dark', themeStyle: ThemeStyle = 'default'): Promise<void> {
    // 防重入保护：如果已初始化，只更新主题
    if (this.isInitialized) {
      logger.debug('已初始化，仅更新主题');
      await this.updateTheme(theme, themeStyle);
      return;
    }

    this.currentTheme = theme;
    this.currentThemeStyle = themeStyle;

    if (!Capacitor.isNativePlatform()) {
      logger.debug('Web平台，执行Web状态栏初始化');
      this.updateWebStatusBar();
      this.isInitialized = true;
      return;
    }

    // --- Native Platform Only ---
    try {
      // 1. 启用 Edge-to-Edge 模式（内容延伸到系统栏后面）
      await EdgeToEdge.enable();
      logger.debug('✅ Edge-to-Edge 模式已启用');

      // 2. 设置系统栏完全透明
      await EdgeToEdge.setTransparentSystemBars({
        statusBar: true,
        navigationBar: true
      });
      logger.debug('✅ 系统栏已设置为透明');

      // 3. 设置状态栏覆盖WebView（允许内容延伸到状态栏区域）
      await StatusBar.setOverlaysWebView({ overlay: true });

      // 4. 根据主题设置图标颜色
      await this.applyNativeThemeStyle();

      this.isInitialized = true;
      logger.debug(`✅ 状态栏初始化完成 (Rikkahub 风格) - 主题: ${theme}, 风格: ${themeStyle}`);
    } catch (error) {
      logger.error('❌ 状态栏初始化失败:', error);
      throw error;
    }
  }

  /**
   * 更新主题
   * @param theme 新主题模式
   * @param themeStyle 主题风格
   */
  public async updateTheme(theme: 'light' | 'dark', themeStyle?: ThemeStyle): Promise<void> {
    // !!! 必须在任何分支和 return 之前，首先更新内部状态 !!!
    this.currentTheme = theme;
    if (themeStyle) {
      this.currentThemeStyle = themeStyle;
    }

    if (!Capacitor.isNativePlatform()) {
      // Web 平台：更新 CSS 变量和 meta 标签
      this.updateWebStatusBar();
      return;
    }

    // 检查是否已初始化
    if (!this.isInitialized) {
      logger.warn("updateTheme called before initialize on native platform. Skipping.");
      return;
    }

    // --- Native Platform Only ---
    try {
      // 调用抽取出的应用样式方法
      await this.applyNativeThemeStyle();
      logger.debug(`主题已更新: ${this.currentTheme}, 风格: ${this.currentThemeStyle}`);
    } catch (error) {
      logger.error('主题更新失败:', error);
      throw error;
    }
  }

  /**
   * 显示状态栏
   */
  public async show(): Promise<void> {
    if (!Capacitor.isNativePlatform()) {
      return;
    }

    try {
      await StatusBar.show();
      logger.debug('状态栏已显示');
    } catch (error) {
      logger.error('显示状态栏失败:', error);
      throw error;
    }
  }

  /**
   * 隐藏状态栏
   */
  public async hide(): Promise<void> {
    if (!Capacitor.isNativePlatform()) {
      return;
    }

    try {
      await StatusBar.hide();
      logger.debug('状态栏已隐藏');
    } catch (error) {
      logger.error('隐藏状态栏失败:', error);
      throw error;
    }
  }

  /**
   * 获取状态栏信息
   */
  public async getInfo() {
    if (!Capacitor.isNativePlatform()) {
      return null;
    }

    try {
      const info = await StatusBar.getInfo();
      logger.debug('状态栏信息:', info);
      return info;
    } catch (error) {
      logger.error('获取状态栏信息失败:', error);
      throw error;
    }
  }

  /**
   * 设置状态栏是否覆盖WebView
   * @param overlay 是否覆盖
   */
  public async setOverlaysWebView(overlay: boolean): Promise<void> {
    if (!Capacitor.isNativePlatform()) {
      return;
    }

    try {
      await StatusBar.setOverlaysWebView({ overlay });
      logger.debug(`状态栏覆盖设置: ${overlay}`);
    } catch (error) {
      logger.error('设置状态栏覆盖失败:', error);
      throw error;
    }
  }

  /**
   * 获取当前主题模式
   */
  public getCurrentTheme(): 'light' | 'dark' {
    return this.currentTheme;
  }

  /**
   * 获取当前主题风格
   */
  public getCurrentThemeStyle(): ThemeStyle {
    return this.currentThemeStyle;
  }

  /**
   * 检查是否已初始化
   */
  public isReady(): boolean {
    return this.isInitialized;
  }

  /**
   * 获取系统栏安全区域（用于 UI 布局调整）
   * 返回状态栏和导航栏的高度信息
   */
  public async getSystemBarInsets() {
    if (!Capacitor.isNativePlatform()) {
      return {
        statusBar: 0,
        navigationBar: 0,
        top: 0,
        bottom: 0,
        left: 0,
        right: 0
      };
    }

    try {
      const insets = await EdgeToEdge.getSystemBarInsets();
      logger.debug('系统栏安全区域:', insets);
      return insets;
    } catch (error) {
      logger.error('获取系统栏安全区域失败:', error);
      return {
        statusBar: 0,
        navigationBar: 0,
        top: 0,
        bottom: 0,
        left: 0,
        right: 0
      };
    }
  }

  /**
   * 获取当前主题配置和颜色信息
   */
  private getThemeColors(): { themeConfig: any; backgroundColor: string; isDark: boolean } | null {
    const themeConfig = themeConfigs[this.currentThemeStyle];
    if (!themeConfig) {
      logger.error(`Theme config not found for style: ${this.currentThemeStyle}`);
      return null;
    }

    const isDark = this.currentTheme === 'dark';
    // 使用主题配置的背景色，而不是硬编码白色
    const backgroundColor = isDark
      ? themeConfig.colors.background.dark
      : themeConfig.colors.background.light;

    return { themeConfig, backgroundColor, isDark };
  }

  /**
   * 应用 Native 平台主题样式 (Rikkahub 风格)
   * 只控制图标颜色，背景色由页面内容决定
   */
  private async applyNativeThemeStyle(): Promise<void> {
    const themeColors = this.getThemeColors();
    if (!themeColors) return;

    const { isDark } = themeColors;

    // 根据主题设置图标颜色（与 rikkahub 完全一致）
    // 'light' = 浅色图标（深色背景）
    // 'dark' = 深色图标（浅色背景）
    const iconStyle = isDark ? 'light' : 'dark';

    try {
      // 使用新插件的 setSystemBarAppearance 方法
      await EdgeToEdge.setSystemBarAppearance({
        statusBarStyle: iconStyle,
        navigationBarStyle: iconStyle
      });
      logger.debug(`✅ 系统栏图标颜色已更新: ${iconStyle} (深色模式: ${isDark})`);
    } catch (error) {
      logger.warn('⚠️ 设置系统栏图标颜色失败:', error);
    }
  }

  /**
   * Web 平台状态栏处理
   * 使用当前实例的主题状态进行更新
   */
  private updateWebStatusBar(): void {
    try {
      const themeColors = this.getThemeColors();
      if (!themeColors) return;

      const { backgroundColor, isDark } = themeColors;

      // 更新 theme-color meta 标签（影响浏览器状态栏）
      let themeColorMeta = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement;
      if (!themeColorMeta) {
        themeColorMeta = document.createElement('meta');
        themeColorMeta.name = 'theme-color';
        document.head.appendChild(themeColorMeta);
      }

      // 更新 apple-mobile-web-app-status-bar-style（iOS Safari）
      let appleStatusBarMeta = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]') as HTMLMetaElement;
      if (!appleStatusBarMeta) {
        appleStatusBarMeta = document.createElement('meta');
        appleStatusBarMeta.name = 'apple-mobile-web-app-status-bar-style';
        document.head.appendChild(appleStatusBarMeta);
      }

      // 设置状态栏颜色和样式
      themeColorMeta.content = backgroundColor;
      appleStatusBarMeta.content = isDark ? 'black' : 'default';

      // 更新 CSS 变量用于安全区域
      document.documentElement.style.setProperty('--status-bar-height', 'env(safe-area-inset-top, 20px)');
      document.documentElement.style.setProperty('--status-bar-color', backgroundColor);

      logger.debug(`Web 状态栏已更新: ${this.currentTheme}, 风格: ${this.currentThemeStyle}, 颜色: ${backgroundColor}`);
    } catch (error) {
      logger.error('Web 状态栏更新失败:', error);
    }
  }
}

// 导出单例实例
export const statusBarService = StatusBarService.getInstance();
