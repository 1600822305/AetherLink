/**
 * HarmonyOS 权限管理服务
 * 处理鸿蒙系统的权限请求、检查和管理
 */

import { Capacitor } from '@capacitor/core';
import {
  HarmonyOSPermission,
  PermissionStatus,
  HARMONYOS_PERMISSION_CONFIG,
  HarmonyOSErrorCode,
  HARMONYOS_ERROR_MESSAGES,
  type PermissionConfig,
} from '../../../config/harmonyOSConfig';
import { isHarmonyOS } from '../../../utils/platformDetection';
import { createLogger } from '../../infra/logger';

const logger = createLogger('HarmonyOSPermissionService');

/**
 * 权限请求结果
 */
export interface PermissionRequestResult {
  permission: HarmonyOSPermission;
  status: PermissionStatus;
  error?: string;
  shouldShowRationale?: boolean; // 是否应该显示权限说明
}

/**
 * 鸿蒙权限管理服务类
 */
export class HarmonyOSPermissionService {
  private static instance: HarmonyOSPermissionService;
  private permissionCache: Map<HarmonyOSPermission, PermissionStatus> = new Map();
  private deniedCount: Map<HarmonyOSPermission, number> = new Map();

  private constructor() {
    this.loadPermissionCache();
  }

  public static getInstance(): HarmonyOSPermissionService {
    if (!HarmonyOSPermissionService.instance) {
      HarmonyOSPermissionService.instance = new HarmonyOSPermissionService();
    }
    return HarmonyOSPermissionService.instance;
  }

  /**
   * 检查是否在鸿蒙系统上运行
   */
  private isRunningOnHarmonyOS(): boolean {
    return isHarmonyOS() && Capacitor.isNativePlatform();
  }

  /**
   * 检查权限状态
   */
  public async checkPermission(permission: HarmonyOSPermission): Promise<PermissionStatus> {
    if (!this.isRunningOnHarmonyOS()) {
      return PermissionStatus.GRANTED; // 非鸿蒙系统直接返回已授权
    }

    // 先检查缓存
    const cached = this.permissionCache.get(permission);
    if (cached) {
      return cached;
    }

    try {
      // 通过 Capacitor 检查权限
      // 注意：这里需要实际的原生实现支持
      const status = await this.checkNativePermission(permission);
      this.permissionCache.set(permission, status);
      this.savePermissionCache();
      return status;
    } catch (error) {
      logger.error(`检查权限失败: ${permission}`, error);
      return PermissionStatus.DENIED;
    }
  }

  /**
   * 请求权限
   */
  public async requestPermission(
    permission: HarmonyOSPermission,
    showRationale: boolean = true
  ): Promise<PermissionRequestResult> {
    if (!this.isRunningOnHarmonyOS()) {
      return {
        permission,
        status: PermissionStatus.GRANTED,
      };
    }

    try {
      // 检查是否已经被永久拒绝
      const currentStatus = await this.checkPermission(permission);
      if (currentStatus === PermissionStatus.PERMANENT_DENIED) {
        return {
          permission,
          status: PermissionStatus.PERMANENT_DENIED,
          error: HARMONYOS_ERROR_MESSAGES[HarmonyOSErrorCode.PERMISSION_PERMANENT_DENIED],
          shouldShowRationale: true,
        };
      }

      // 请求权限
      const status = await this.requestNativePermission(permission);
      
      // 更新缓存
      this.permissionCache.set(permission, status);
      this.savePermissionCache();

      // 如果被拒绝，增加拒绝计数
      if (status === PermissionStatus.DENIED) {
        const count = (this.deniedCount.get(permission) || 0) + 1;
        this.deniedCount.set(permission, count);
        
        // 如果被拒绝超过 2 次，标记为永久拒绝
        if (count >= 2) {
          this.permissionCache.set(permission, PermissionStatus.PERMANENT_DENIED);
          this.savePermissionCache();
          
          return {
            permission,
            status: PermissionStatus.PERMANENT_DENIED,
            error: HARMONYOS_ERROR_MESSAGES[HarmonyOSErrorCode.PERMISSION_PERMANENT_DENIED],
            shouldShowRationale: true,
          };
        }
      }

      return {
        permission,
        status,
        shouldShowRationale: status === PermissionStatus.DENIED && showRationale,
      };
    } catch (error) {
      logger.error(`请求权限失败: ${permission}`, error);
      return {
        permission,
        status: PermissionStatus.DENIED,
        error: error instanceof Error ? error.message : '权限请求失败',
      };
    }
  }

  /**
   * 批量请求权限
   */
  public async requestPermissions(
    permissions: HarmonyOSPermission[]
  ): Promise<Map<HarmonyOSPermission, PermissionRequestResult>> {
    const results = new Map<HarmonyOSPermission, PermissionRequestResult>();
    
    for (const permission of permissions) {
      const result = await this.requestPermission(permission);
      results.set(permission, result);
    }
    
    return results;
  }

  /**
   * 检查是否有权限
   */
  public async hasPermission(permission: HarmonyOSPermission): Promise<boolean> {
    const status = await this.checkPermission(permission);
    return status === PermissionStatus.GRANTED;
  }

  /**
   * 获取权限配置
   */
  public getPermissionConfig(permission: HarmonyOSPermission): PermissionConfig {
    return HARMONYOS_PERMISSION_CONFIG[permission];
  }

  /**
   * 打开应用设置页面（引导用户手动授权）
   */
  public async openAppSettings(): Promise<void> {
    if (!this.isRunningOnHarmonyOS()) {
      logger.warn('非鸿蒙系统，无法打开设置');
      return;
    }

    try {
      // 通过 Capacitor 打开设置
      // 注意：需要原生实现支持
      await this.openNativeSettings();
    } catch (error) {
      logger.error('打开设置失败:', error);
      throw error;
    }
  }

  /**
   * 清除权限缓存
   */
  public clearPermissionCache(): void {
    this.permissionCache.clear();
    this.deniedCount.clear();
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('harmonyos_permission_cache');
      localStorage.removeItem('harmonyos_denied_count');
    }
  }

  /**
   * 加载权限缓存
   */
  private loadPermissionCache(): void {
    if (typeof localStorage === 'undefined') return;

    try {
      const cached = localStorage.getItem('harmonyos_permission_cache');
      if (cached) {
        const data = JSON.parse(cached);
        this.permissionCache = new Map(Object.entries(data) as [HarmonyOSPermission, PermissionStatus][]);
      }

      const deniedCache = localStorage.getItem('harmonyos_denied_count');
      if (deniedCache) {
        const data = JSON.parse(deniedCache);
        this.deniedCount = new Map(Object.entries(data).map(([k, v]) => [k as HarmonyOSPermission, Number(v)] as const));
      }
    } catch (error) {
      logger.error('加载权限缓存失败:', error);
    }
  }

  /**
   * 保存权限缓存
   */
  private savePermissionCache(): void {
    if (typeof localStorage === 'undefined') return;

    try {
      const cacheData = Object.fromEntries(this.permissionCache);
      localStorage.setItem('harmonyos_permission_cache', JSON.stringify(cacheData));

      const deniedData = Object.fromEntries(this.deniedCount);
      localStorage.setItem('harmonyos_denied_count', JSON.stringify(deniedData));
    } catch (error) {
      logger.error('保存权限缓存失败:', error);
    }
  }

  /**
   * 检查原生权限（需要原生实现）
   */
  private async checkNativePermission(permission: HarmonyOSPermission): Promise<PermissionStatus> {
    try {
      // 尝试通过 Web API 检查（如果支持）
      if (permission === HarmonyOSPermission.WRITE_CLIPBOARD && navigator.permissions) {
        const result = await navigator.permissions.query({ name: 'clipboard-write' as PermissionName });
        return result.state as PermissionStatus;
      }
      if (permission === HarmonyOSPermission.READ_CLIPBOARD && navigator.permissions) {
        const result = await navigator.permissions.query({ name: 'clipboard-read' as PermissionName });
        return result.state as PermissionStatus;
      }
      
      // 对于其他权限，返回 PROMPT（需要请求）
      return PermissionStatus.PROMPT;
    } catch (error) {
      logger.warn(`Web API 检查权限失败，返回 PROMPT: ${permission}`);
      return PermissionStatus.PROMPT;
    }
  }

  /**
   * 请求原生权限（需要原生实现）
   */
  private async requestNativePermission(permission: HarmonyOSPermission): Promise<PermissionStatus> {
    try {
      // 这里应该调用原生方法请求权限
      // 由于我们使用 Capacitor，可以通过插件实现
      // 暂时使用 Web API 作为降级方案
      
      if (permission === HarmonyOSPermission.WRITE_CLIPBOARD) {
        // 尝试写入剪贴板来隐式请求权限
        await navigator.clipboard.writeText('');
        return PermissionStatus.GRANTED;
      }
      
      if (permission === HarmonyOSPermission.READ_CLIPBOARD) {
        // 尝试读取剪贴板来隐式请求权限
        await navigator.clipboard.readText();
        return PermissionStatus.GRANTED;
      }
      
      // 对于其他权限，暂时返回 GRANTED（需要原生实现）
      logger.warn(`权限 ${permission} 需要原生实现，暂时返回 GRANTED`);
      return PermissionStatus.GRANTED;
    } catch (error) {
      logger.error(`请求原生权限失败: ${permission}`, error);
      return PermissionStatus.DENIED;
    }
  }

  /**
   * 打开原生设置（需要原生实现）
   */
  private async openNativeSettings(): Promise<void> {
    // 这里应该调用原生方法打开设置
    // 暂时提供一个提示
    logger.debug('请在设置 > 应用管理 > AetherLink > 权限 中手动开启权限');
    
    // 如果可以，尝试使用 Capacitor 打开设置
    if (Capacitor.isPluginAvailable('App')) {
      const { App: CapApp } = await import('@capacitor/app');
      // 注意：这可能不会直接打开权限设置页面
      // 需要原生插件支持
      void CapApp;
    }
  }
}

// 导出单例实例
export const harmonyOSPermissionService = HarmonyOSPermissionService.getInstance();
export default HarmonyOSPermissionService;

