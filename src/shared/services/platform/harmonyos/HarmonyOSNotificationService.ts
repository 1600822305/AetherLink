/**
 * HarmonyOS 通知服务
 * 处理鸿蒙系统的通知权限和操作
 */

import { Capacitor } from '@capacitor/core';
import { isHarmonyOS } from '../../../utils/platformDetection';
import { harmonyOSPermissionService } from './HarmonyOSPermissionService';
import { HarmonyOSPermission } from '../../../config/harmonyOSConfig';
import { createLogger } from '../../infra/logger';

const logger = createLogger('HarmonyOSNotificationService');

/**
 * 通知配置
 */
export interface NotificationConfig {
  title: string;
  body: string;
  id?: number;
  schedule?: {
    at: Date;
  };
}

/**
 * 鸿蒙通知服务类
 */
export class HarmonyOSNotificationService {
  private static instance: HarmonyOSNotificationService;

  private constructor() {}

  public static getInstance(): HarmonyOSNotificationService {
    if (!HarmonyOSNotificationService.instance) {
      HarmonyOSNotificationService.instance = new HarmonyOSNotificationService();
    }
    return HarmonyOSNotificationService.instance;
  }

  /**
   * 显示通知（带权限检查）
   */
  public async showNotification(config: NotificationConfig): Promise<void> {
    if (!isHarmonyOS() || !Capacitor.isNativePlatform()) {
      // 非鸿蒙系统直接使用 Capacitor API
      return this.showNotificationStandard(config);
    }

    // 鸿蒙系统需要先检查通知权限
    const hasPermission = await harmonyOSPermissionService.hasPermission(
      HarmonyOSPermission.NOTIFICATION
    );

    if (!hasPermission) {
      const result = await harmonyOSPermissionService.requestPermission(
        HarmonyOSPermission.NOTIFICATION
      );

      if (result.status !== 'granted') {
        logger.warn('通知权限被拒绝');
        return; // 通知权限被拒绝时静默失败
      }
    }

    return this.showNotificationStandard(config);
  }

  /**
   * 标准通知显示方法
   */
  private async showNotificationStandard(config: NotificationConfig): Promise<void> {
    try {
      const { LocalNotifications } = await import('@capacitor/local-notifications');
      
      await LocalNotifications.schedule({
        notifications: [{
          title: config.title,
          body: config.body,
          id: config.id || Date.now(),
          schedule: config.schedule,
        }],
      });
    } catch (error) {
      logger.error('显示通知失败:', error);
      throw error;
    }
  }

  /**
   * 请求通知权限
   */
  public async requestPermission(): Promise<boolean> {
    if (!isHarmonyOS() || !Capacitor.isNativePlatform()) {
      // 非鸿蒙系统使用标准方式
      try {
        const { LocalNotifications } = await import('@capacitor/local-notifications');
        const result = await LocalNotifications.requestPermissions();
        return result.display === 'granted';
      } catch {
        return false;
      }
    }

    // 鸿蒙系统使用权限服务
    const result = await harmonyOSPermissionService.requestPermission(
      HarmonyOSPermission.NOTIFICATION
    );

    return result.status === 'granted';
  }
}

// 导出单例实例
export const harmonyOSNotificationService = HarmonyOSNotificationService.getInstance();
export default HarmonyOSNotificationService;

