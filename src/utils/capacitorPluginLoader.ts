/**
 * Capacitor 插件懒加载工具
 * 
 * 根据性能优化最佳实践，将非核心插件延迟加载，减少启动时间
 * 参考：https://blog.csdn.net/gitblog_00832/article/details/151374765
 * 
 * 🎯 优化目标：
 * - 核心插件立即加载（App, SplashScreen, StatusBar）
 * - 非核心插件按需懒加载（Camera, Filesystem, Geolocation 等）
 * - 减少初始 Bundle 大小
 * - 提升启动速度 50%+
 */

import { Capacitor } from '@capacitor/core';
import { createLogger } from '../shared/services/infra/logger';

const logger = createLogger('PluginLoader');

// 插件缓存，避免重复加载
const pluginCache = new Map<string, any>();

/**
 * 懒加载 Capacitor 插件
 * @param pluginName 插件名称（如 'Camera', 'Filesystem' 等）
 * @returns 插件实例
 * 
 * @example
 * const Camera = await lazyLoadPlugin('Camera');
 * const photo = await Camera.getPhoto({ quality: 90 });
 */
export async function lazyLoadPlugin(pluginName: string): Promise<any> {
  // 检查缓存
  if (pluginCache.has(pluginName)) {
    logger.debug(`从缓存加载插件: ${pluginName}`);
    return pluginCache.get(pluginName);
  }

  logger.debug(`懒加载插件: ${pluginName}`);
  const startTime = performance.now();

  try {
    // 根据插件名称动态导入
    let plugin: any;

    switch (pluginName) {
      case 'Camera':
        const { Camera } = await import('@capacitor/camera');
        plugin = Camera;
        break;

      case 'Filesystem':
        const { Filesystem } = await import('@capacitor/filesystem');
        plugin = Filesystem;
        break;

      case 'Geolocation':
        const { Geolocation } = await import('@capacitor/geolocation');
        plugin = Geolocation;
        break;

      case 'Share':
        const { Share } = await import('@capacitor/share');
        plugin = Share;
        break;

      case 'Toast':
        const { Toast } = await import('@capacitor/toast');
        plugin = Toast;
        break;

      case 'Haptics':
        const { Haptics } = await import('@capacitor/haptics');
        plugin = Haptics;
        break;

      case 'Clipboard':
        const { Clipboard } = await import('@capacitor/clipboard');
        plugin = Clipboard;
        break;

      case 'Device':
        const { Device } = await import('@capacitor/device');
        plugin = Device;
        break;

      case 'Network':
        const { Network } = await import('@capacitor/network');
        plugin = Network;
        break;

      case 'AppLauncher':
        const { AppLauncher } = await import('@capacitor/app-launcher');
        plugin = AppLauncher;
        break;

      case 'Browser':
        const { Browser } = await import('@capacitor/browser');
        plugin = Browser;
        break;

      case 'Dialog':
        const { Dialog } = await import('@capacitor/dialog');
        plugin = Dialog;
        break;

      default:
        throw new Error(`未知的插件: ${pluginName}`);
    }

    // 存入缓存
    pluginCache.set(pluginName, plugin);

    const loadTime = performance.now() - startTime;
    logger.debug(`✅ 插件 ${pluginName} 加载完成 (${loadTime.toFixed(2)}ms)`);

    return plugin;
  } catch (error) {
    logger.error(`❌ 插件 ${pluginName} 加载失败:`, error);
    throw error;
  }
}

/**
 * 批量预加载插件（后台执行）
 * @param pluginNames 插件名称列表
 * 
 * @example
 * // 在应用启动后，后台预加载常用插件
 * preloadPlugins(['Camera', 'Share', 'Toast']);
 */
export function preloadPlugins(pluginNames: string[]): Promise<void> {
  logger.debug(`后台预加载 ${pluginNames.length} 个插件...`);

  return Promise.all(
    pluginNames.map(name => 
      lazyLoadPlugin(name).catch(err => 
        logger.warn(`预加载 ${name} 失败:`, err)
      )
    )
  ).then(() => {
    logger.debug('后台预加载完成');
  });
}

/**
 * 检查插件是否可用
 * @param pluginName 插件名称
 * @returns 是否可用
 */
export function isPluginAvailable(pluginName: string): boolean {
  return Capacitor.isPluginAvailable(pluginName);
}

// ⚠️ 平台检测函数已统一到 src/shared/utils/platformDetection.ts
// 请使用以下导入方式:
// import { isCapacitor, isTauri, isMobile, isIOS, isAndroid } from '../shared/utils/platformDetection';

// 导出常用的插件类型（用于类型提示）
export type CapacitorPlugin = 
  | 'Camera'
  | 'Filesystem'
  | 'Geolocation'
  | 'Share'
  | 'Toast'
  | 'Haptics'
  | 'Clipboard'
  | 'Device'
  | 'Network'
  | 'AppLauncher'
  | 'Browser'
  | 'Dialog';

