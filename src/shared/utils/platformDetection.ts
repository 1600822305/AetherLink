/**
 * 平台检测工具 v2.0
 * 用于精确检测当前运行环境，支持细分平台类型
 */

// 运行时环境类型
export enum RuntimeType {
  TAURI = 'tauri',
  CAPACITOR = 'capacitor',
  WEB = 'web'
}

// 操作系统类型
export enum OSType {
  WINDOWS = 'windows',
  MACOS = 'macos',
  LINUX = 'linux',
  ANDROID = 'android',
  IOS = 'ios',
  WEB = 'web'
}

// 详细平台类型
export enum PlatformType {
  // Tauri 平台
  TAURI_WINDOWS = 'tauri-windows',
  TAURI_MACOS = 'tauri-macos',
  TAURI_LINUX = 'tauri-linux',
  TAURI_ANDROID = 'tauri-android',
  TAURI_IOS = 'tauri-ios',

  // Capacitor 平台
  CAPACITOR_ANDROID = 'capacitor-android',
  CAPACITOR_IOS = 'capacitor-ios',
  CAPACITOR_WEB = 'capacitor-web',

  // 纯 Web
  WEB = 'web'
}

// 向后兼容的旧平台类型
export enum LegacyPlatformType {
  WEB = 'web',
  CAPACITOR = 'capacitor',
  TAURI = 'tauri'
}

export interface DetailedPlatformInfo {
  // 新的详细信息
  platformType: PlatformType;
  runtimeType: RuntimeType;
  osType: OSType;

  // 基本分类
  isMobile: boolean;
  isDesktop: boolean;
  isWeb: boolean;

  // 运行时检测
  isTauri: boolean;
  isCapacitor: boolean;

  // 操作系统检测
  isWindows: boolean;
  isMacOS: boolean;
  isLinux: boolean;
  isAndroid: boolean;
  isIOS: boolean;

  // 系统信息
  platform: string;
  userAgent: string;

  // 向后兼容
  type: LegacyPlatformType;
}

/**
 * 检测操作系统类型
 */
export function detectOS(): OSType {
  if (typeof navigator === 'undefined') {
    return OSType.WEB;
  }

  const userAgent = navigator.userAgent.toLowerCase();
  const platform = navigator.platform?.toLowerCase() || '';

  // 检测移动端
  if (/android/i.test(userAgent)) {
    return OSType.ANDROID;
  }

  if (/iphone|ipad|ipod/i.test(userAgent) ||
      (platform.includes('mac') && 'ontouchend' in document)) {
    return OSType.IOS;
  }

  // 检测桌面端
  if (platform.includes('win') || userAgent.includes('windows')) {
    return OSType.WINDOWS;
  }

  if (platform.includes('mac') || userAgent.includes('macintosh')) {
    return OSType.MACOS;
  }

  if (platform.includes('linux') || userAgent.includes('linux')) {
    return OSType.LINUX;
  }

  return OSType.WEB;
}

/**
 * 检测运行时环境
 */
export function detectRuntime(): RuntimeType {
  if (typeof window !== 'undefined' && '__TAURI__' in window) {
    return RuntimeType.TAURI;
  }

  // 更严格的Capacitor检测：不仅要有Capacitor对象，还要确保是真正的原生环境
  if (typeof window !== 'undefined' && 'Capacitor' in window) {
    const capacitor = (window as any).Capacitor;

    // 检查是否真正在原生环境中运行
    if (capacitor && capacitor.isNativePlatform && capacitor.isNativePlatform()) {
      return RuntimeType.CAPACITOR;
    }
  }

  return RuntimeType.WEB;
}

/**
 * 组合运行时和操作系统得到详细平台类型
 */
export function getPlatformType(runtime: RuntimeType, os: OSType): PlatformType {
  switch (runtime) {
    case RuntimeType.TAURI:
      switch (os) {
        case OSType.WINDOWS: return PlatformType.TAURI_WINDOWS;
        case OSType.MACOS: return PlatformType.TAURI_MACOS;
        case OSType.LINUX: return PlatformType.TAURI_LINUX;
        case OSType.ANDROID: return PlatformType.TAURI_ANDROID;
        case OSType.IOS: return PlatformType.TAURI_IOS;
        default: return PlatformType.TAURI_WINDOWS; // 默认
      }

    case RuntimeType.CAPACITOR:
      switch (os) {
        case OSType.ANDROID: return PlatformType.CAPACITOR_ANDROID;
        case OSType.IOS: return PlatformType.CAPACITOR_IOS;
        default: return PlatformType.CAPACITOR_WEB;
      }

    case RuntimeType.WEB:
    default:
      return PlatformType.WEB;
  }
}

/**
 * 检测详细平台信息
 */
export function detectDetailedPlatform(): DetailedPlatformInfo {
  const runtimeType = detectRuntime();
  const osType = detectOS();
  const platformType = getPlatformType(runtimeType, osType);

  const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const platform = typeof navigator !== 'undefined' ? navigator.platform : '';

  // 基本分类
  const isMobile = [OSType.ANDROID, OSType.IOS].includes(osType);
  const isDesktop = [OSType.WINDOWS, OSType.MACOS, OSType.LINUX].includes(osType);
  const isWeb = runtimeType === RuntimeType.WEB;

  // 运行时检测
  const isTauri = runtimeType === RuntimeType.TAURI;
  const isCapacitor = runtimeType === RuntimeType.CAPACITOR;

  // 操作系统检测
  const isWindows = osType === OSType.WINDOWS;
  const isMacOS = osType === OSType.MACOS;
  const isLinux = osType === OSType.LINUX;
  const isAndroid = osType === OSType.ANDROID;
  const isIOS = osType === OSType.IOS;

  // 向后兼容的类型
  let legacyType: LegacyPlatformType;
  switch (runtimeType) {
    case RuntimeType.TAURI:
      legacyType = LegacyPlatformType.TAURI;
      break;
    case RuntimeType.CAPACITOR:
      legacyType = LegacyPlatformType.CAPACITOR;
      break;
    default:
      legacyType = LegacyPlatformType.WEB;
      break;
  }

  return {
    platformType,
    runtimeType,
    osType,
    isMobile,
    isDesktop,
    isWeb,
    isTauri,
    isCapacitor,
    isWindows,
    isMacOS,
    isLinux,
    isAndroid,
    isIOS,
    platform,
    userAgent,
    type: legacyType
  };
}

// ============================================
// 新的推荐 API
// ============================================

/**
 * 获取详细的平台信息 (推荐使用)
 */
export function getPlatformInfo(): DetailedPlatformInfo {
  return detectDetailedPlatform();
}

/**
 * 获取平台配置
 */
export function getPlatformConfig() {
  const platformInfo = getPlatformInfo();

  return {
    // 窗口配置
    window: {
      defaultWidth: platformInfo.isDesktop ? 1200 : undefined,
      defaultHeight: platformInfo.isDesktop ? 800 : undefined,
      minWidth: platformInfo.isDesktop ? 800 : undefined,
      minHeight: platformInfo.isDesktop ? 600 : undefined,
      // 平台特定配置
      titleBarStyle: platformInfo.isMacOS ? 'hiddenInset' : 'default',
      decorations: !platformInfo.isMacOS, // macOS 使用系统装饰
    },

    // 功能支持
    features: {
      fileSystem: platformInfo.isDesktop || platformInfo.isMobile,
      notifications: true,
      clipboard: true,
      camera: platformInfo.isMobile,
      microphone: true,
      fullscreen: platformInfo.isDesktop,
      windowControls: platformInfo.isDesktop,
      systemTray: platformInfo.isWindows || platformInfo.isLinux,
      menuBar: platformInfo.isMacOS,
      touchID: platformInfo.isMacOS || platformInfo.isIOS,
      faceID: platformInfo.isIOS,
      fingerprint: platformInfo.isAndroid,
    },

    // UI 配置
    ui: {
      showTitleBar: platformInfo.isDesktop && !platformInfo.isMacOS,
      showMobileNavigation: platformInfo.isMobile,
      compactMode: platformInfo.isMobile,
      sidebarCollapsible: platformInfo.isDesktop,
      useNativeScrollbars: platformInfo.isMacOS,
      roundedCorners: platformInfo.isIOS,
      materialDesign: platformInfo.isAndroid,
      fluentDesign: platformInfo.isWindows,
    },

    // 网络配置
    network: {
      corsMode: platformInfo.isWeb ? 'cors' : 'no-cors',
      allowInsecure: platformInfo.isDesktop,
      useProxy: platformInfo.isWeb,
    }
  };
}

// ============================================
// 向后兼容的 API (保持现有代码正常工作)
// ============================================

/**
 * 检测当前平台类型 (向后兼容)
 * @deprecated 请使用 getPlatformInfo() 获取更详细的信息
 */
export function detectPlatform(): LegacyPlatformType {
  const info = detectDetailedPlatform();
  return info.type;
}

/**
 * 检查是否为移动端环境
 */
export function isMobile(): boolean {
  const info = detectDetailedPlatform();
  return info.isMobile;
}

/**
 * 检查是否为桌面端环境
 */
export function isDesktop(): boolean {
  const info = detectDetailedPlatform();
  return info.isDesktop;
}

/**
 * 检查是否为 Web 环境
 */
export function isWeb(): boolean {
  const info = detectDetailedPlatform();
  return info.isWeb;
}

/**
 * 检查是否为 Tauri 环境
 */
export function isTauri(): boolean {
  const info = detectDetailedPlatform();
  return info.isTauri;
}

/**
 * 检查是否为 Capacitor 环境
 */
export function isCapacitor(): boolean {
  const info = detectDetailedPlatform();
  return info.isCapacitor;
}

// ============================================
// 新的细分检测函数
// ============================================

/**
 * 检查是否为 Windows 环境
 */
export function isWindows(): boolean {
  const info = detectDetailedPlatform();
  return info.isWindows;
}

/**
 * 检查是否为 macOS 环境
 */
export function isMacOS(): boolean {
  const info = detectDetailedPlatform();
  return info.isMacOS;
}

/**
 * 检查是否为 Linux 环境
 */
export function isLinux(): boolean {
  const info = detectDetailedPlatform();
  return info.isLinux;
}

/**
 * 检查是否为 Android 环境
 */
export function isAndroid(): boolean {
  const info = detectDetailedPlatform();
  return info.isAndroid;
}

/**
 * 检查是否为 iOS 环境
 */
export function isIOS(): boolean {
  const info = detectDetailedPlatform();
  return info.isIOS;
}


