/**
 * 触觉反馈工具类
 * 参考 Kelivo 项目的触觉反馈实现
 */

import { Haptics as CapacitorHaptics, ImpactStyle } from '@capacitor/haptics';
import { Capacitor } from '@capacitor/core';
import { createLogger } from '../services/infra/logger';
const logger = createLogger('Haptic');

/**
 * 触觉反馈类型
 */
export enum HapticType {
  /** 轻触反馈 - 用于小型UI交互 */
  LIGHT = 'light',
  /** 中等反馈 - 用于抽屉打开/关闭、开关切换等 */
  MEDIUM = 'medium',
  /** 柔和反馈 - 用于列表项点击 */
  SOFT = 'soft',
  /** 抽屉专用脉冲 - 为抽屉操作定制 */
  DRAWER_PULSE = 'drawerPulse'
}

/**
 * 触觉反馈工具类
 */
class HapticFeedback {
  private static instance: HapticFeedback;
  private enabled: boolean = true;

  private constructor() {}

  /**
   * 获取单例实例
   */
  public static getInstance(): HapticFeedback {
    if (!HapticFeedback.instance) {
      HapticFeedback.instance = new HapticFeedback();
    }
    return HapticFeedback.instance;
  }

  /**
   * 设置触觉反馈是否启用
   */
  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /**
   * 获取触觉反馈是否启用
   */
  public isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * 执行触觉反馈（内部方法）
   */
  private async vibrate(pattern: number | number[]): Promise<void> {
    if (!this.enabled) return;

    try {
      // Capacitor 环境（优先） - 支持 iOS 和 Android
      if (Capacitor.isNativePlatform()) {
        logger.debug('🎵 Capacitor 原生平台，使用 Haptics API');
        
        // 将振动模式映射到 Capacitor 的触觉样式
        if (typeof pattern === 'number') {
          if (pattern <= 10) {
            await CapacitorHaptics.impact({ style: ImpactStyle.Light });
          } else if (pattern <= 20) {
            await CapacitorHaptics.impact({ style: ImpactStyle.Medium });
          } else {
            await CapacitorHaptics.impact({ style: ImpactStyle.Heavy });
          }
        } else {
          // 对于模式数组，使用中等强度
          await CapacitorHaptics.impact({ style: ImpactStyle.Medium });
        }
        return;
      }

      // Web 环境 - 降级到 Vibration API
      if (typeof window !== 'undefined' && 'navigator' in window && 'vibrate' in navigator) {
        logger.debug('🎵 Web 环境，使用 Vibration API');
        navigator.vibrate(pattern);
      } else {
        logger.debug('🎵 不支持触觉反馈');
      }
    } catch (error) {
      logger.debug('🎵 触觉反馈失败:', error);
    }
  }

  /**
   * 轻触反馈 - 用于小型UI交互（如按钮点击）
   */
  public async light(): Promise<void> {
    logger.debug('🎵 触发 light 反馈');
    await this.vibrate(10);
  }

  /**
   * 中等反馈 - 用于抽屉打开/关闭、开关切换等
   */
  public async medium(): Promise<void> {
    logger.debug('🎵 触发 medium 反馈');
    await this.vibrate(20);
  }

  /**
   * 柔和反馈 - 用于列表项点击
   */
  public async soft(): Promise<void> {
    logger.debug('🎵 触发 soft 反馈');
    await this.vibrate(15);
  }

  /**
   * 抽屉专用脉冲 - 为侧边栏/抽屉操作定制，感觉明显但不刺耳
   */
  public async drawerPulse(): Promise<void> {
    logger.debug('🎵 触发 drawerPulse 反馈');
    // 使用短促的振动模式，模仿 iOS 的触觉反馈
    await this.vibrate(15);
  }

  /**
   * 通用触觉反馈方法
   */
  public async trigger(type: HapticType): Promise<void> {
    switch (type) {
      case HapticType.LIGHT:
        await this.light();
        break;
      case HapticType.MEDIUM:
        await this.medium();
        break;
      case HapticType.SOFT:
        await this.soft();
        break;
      case HapticType.DRAWER_PULSE:
        await this.drawerPulse();
        break;
      default:
        await this.soft();
    }
  }

  /**
   * 取消当前的振动（如果支持）
   */
  public cancel(): void {
    try {
      if (Capacitor.isNativePlatform()) {
        // Capacitor 没有取消方法，但可以触发一个非常短的振动来"中断"
        CapacitorHaptics.selectionStart().catch(() => {});
      } else if (typeof window !== 'undefined' && 'navigator' in window && 'vibrate' in navigator) {
        navigator.vibrate(0);
      }
    } catch (error) {
      logger.debug('Cannot cancel vibration:', error);
    }
  }
}

// 导出单例实例
export const hapticFeedback = HapticFeedback.getInstance();

// 导出便捷方法
export const Haptics = {
  light: async () => await hapticFeedback.light(),
  medium: async () => await hapticFeedback.medium(),
  soft: async () => await hapticFeedback.soft(),
  drawerPulse: async () => await hapticFeedback.drawerPulse(),
  trigger: async (type: HapticType) => await hapticFeedback.trigger(type),
  setEnabled: (enabled: boolean) => hapticFeedback.setEnabled(enabled),
  isEnabled: () => hapticFeedback.isEnabled(),
  cancel: () => hapticFeedback.cancel()
};

export default hapticFeedback;

