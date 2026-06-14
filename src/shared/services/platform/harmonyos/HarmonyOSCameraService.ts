/**
 * HarmonyOS 相机服务
 * 处理鸿蒙系统的相机权限和操作
 */

import { Capacitor } from '@capacitor/core';
import { isHarmonyOS } from '../../../utils/platformDetection';
import { harmonyOSPermissionService } from './HarmonyOSPermissionService';
import { HarmonyOSPermission } from '../../../config/harmonyOSConfig';
import { createLogger } from '../../infra/logger';

const logger = createLogger('HarmonyOSCameraService');

/**
 * 相机结果类型
 */
export interface CameraResult {
  dataUrl: string;
  format: string;
}

/**
 * 鸿蒙相机服务类
 */
export class HarmonyOSCameraService {
  private static instance: HarmonyOSCameraService;

  private constructor() {}

  public static getInstance(): HarmonyOSCameraService {
    if (!HarmonyOSCameraService.instance) {
      HarmonyOSCameraService.instance = new HarmonyOSCameraService();
    }
    return HarmonyOSCameraService.instance;
  }

  /**
   * 拍照（带权限检查）
   */
  public async takePicture(): Promise<CameraResult> {
    if (!isHarmonyOS() || !Capacitor.isNativePlatform()) {
      // 非鸿蒙系统直接使用 Capacitor API
      return this.takePictureStandard();
    }

    // 鸿蒙系统需要先检查相机权限
    const hasPermission = await harmonyOSPermissionService.hasPermission(
      HarmonyOSPermission.CAMERA
    );

    if (!hasPermission) {
      const result = await harmonyOSPermissionService.requestPermission(
        HarmonyOSPermission.CAMERA
      );

      if (result.status !== 'granted') {
        throw new Error('相机权限被拒绝');
      }
    }

    return this.takePictureStandard();
  }

  /**
   * 从相册选择照片（带权限检查）
   */
  public async pickFromGallery(): Promise<CameraResult> {
    if (!isHarmonyOS() || !Capacitor.isNativePlatform()) {
      // 非鸿蒙系统直接使用 Capacitor API
      return this.pickFromGalleryStandard();
    }

    // 鸿蒙系统需要先检查存储权限
    const hasPermission = await harmonyOSPermissionService.hasPermission(
      HarmonyOSPermission.READ_USER_STORAGE
    );

    if (!hasPermission) {
      const result = await harmonyOSPermissionService.requestPermission(
        HarmonyOSPermission.READ_USER_STORAGE
      );

      if (result.status !== 'granted') {
        throw new Error('存储访问权限被拒绝');
      }
    }

    return this.pickFromGalleryStandard();
  }

  /**
   * 标准拍照方法
   */
  private async takePictureStandard(): Promise<CameraResult> {
    try {
      const { Camera, CameraResultType, CameraSource } = await import('@capacitor/camera');
      
      const result = await Camera.getPhoto({
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Camera,
        quality: 90,
      });

      return {
        dataUrl: result.dataUrl!,
        format: result.format,
      };
    } catch (error) {
      logger.error('拍照失败:', error);
      throw error;
    }
  }

  /**
   * 标准相册选择方法
   */
  private async pickFromGalleryStandard(): Promise<CameraResult> {
    try {
      const { Camera, CameraResultType, CameraSource } = await import('@capacitor/camera');
      
      const result = await Camera.getPhoto({
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Photos,
        quality: 90,
      });

      return {
        dataUrl: result.dataUrl!,
        format: result.format,
      };
    } catch (error) {
      logger.error('相册选择失败:', error);
      throw error;
    }
  }
}

// 导出单例实例
export const harmonyOSCameraService = HarmonyOSCameraService.getInstance();
export default HarmonyOSCameraService;

