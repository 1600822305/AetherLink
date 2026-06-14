/**
 * HarmonyOS 文件服务
 * 处理鸿蒙系统的文件访问权限和操作
 */

import { Capacitor } from '@capacitor/core';
import { isHarmonyOS } from '../../../utils/platformDetection';
import { harmonyOSPermissionService } from './HarmonyOSPermissionService';
import { HarmonyOSPermission } from '../../../config/harmonyOSConfig';
import { createLogger } from '../../infra/logger';

const logger = createLogger('HarmonyOSFileService');

/**
 * 鸿蒙文件服务类
 */
export class HarmonyOSFileService {
  private static instance: HarmonyOSFileService;

  private constructor() {}

  public static getInstance(): HarmonyOSFileService {
    if (!HarmonyOSFileService.instance) {
      HarmonyOSFileService.instance = new HarmonyOSFileService();
    }
    return HarmonyOSFileService.instance;
  }

  /**
   * 读取文件（带权限检查）
   */
  public async readFile(path: string): Promise<string> {
    if (!isHarmonyOS() || !Capacitor.isNativePlatform()) {
      // 非鸿蒙系统直接使用 Capacitor API
      const { Filesystem, Directory } = await import('@capacitor/filesystem');
      const result = await Filesystem.readFile({
        path,
        directory: Directory.Documents,
      });
      return result.data as string;
    }

    // 鸿蒙系统需要先检查权限
    const hasPermission = await harmonyOSPermissionService.hasPermission(
      HarmonyOSPermission.READ_USER_STORAGE
    );

    if (!hasPermission) {
      const result = await harmonyOSPermissionService.requestPermission(
        HarmonyOSPermission.READ_USER_STORAGE
      );

      if (result.status !== 'granted') {
        throw new Error('文件读取权限被拒绝');
      }
    }

    // 读取文件
    const { Filesystem, Directory } = await import('@capacitor/filesystem');
    const result = await Filesystem.readFile({
      path,
      directory: Directory.Documents,
    });
    return result.data as string;
  }

  /**
   * 写入文件（带权限检查）
   */
  public async writeFile(path: string, data: string): Promise<void> {
    if (!isHarmonyOS() || !Capacitor.isNativePlatform()) {
      // 非鸿蒙系统直接使用 Capacitor API
      const { Filesystem, Directory } = await import('@capacitor/filesystem');
      await Filesystem.writeFile({
        path,
        data,
        directory: Directory.Documents,
      });
      return;
    }

    // 鸿蒙系统需要先检查权限
    const hasPermission = await harmonyOSPermissionService.hasPermission(
      HarmonyOSPermission.WRITE_USER_STORAGE
    );

    if (!hasPermission) {
      const result = await harmonyOSPermissionService.requestPermission(
        HarmonyOSPermission.WRITE_USER_STORAGE
      );

      if (result.status !== 'granted') {
        throw new Error('文件写入权限被拒绝');
      }
    }

    // 写入文件
    const { Filesystem, Directory } = await import('@capacitor/filesystem');
    await Filesystem.writeFile({
      path,
      data,
      directory: Directory.Documents,
    });
  }

  /**
   * 选择文件（带权限检查）
   */
  public async pickFile(): Promise<File | null> {
    if (!isHarmonyOS() || !Capacitor.isNativePlatform()) {
      // 非鸿蒙系统使用标准方式
      return this.pickFileStandard();
    }

    // 鸿蒙系统需要先检查权限
    const hasPermission = await harmonyOSPermissionService.hasPermission(
      HarmonyOSPermission.READ_USER_STORAGE
    );

    if (!hasPermission) {
      const result = await harmonyOSPermissionService.requestPermission(
        HarmonyOSPermission.READ_USER_STORAGE
      );

      if (result.status !== 'granted') {
        throw new Error('文件选择权限被拒绝');
      }
    }

    return this.pickFileStandard();
  }

  /**
   * 标准文件选择方法
   */
  private async pickFileStandard(): Promise<File | null> {
    try {
      // 尝试使用 Capacitor File Picker
      const { FilePicker } = await import('@capawesome/capacitor-file-picker');
      const result = await FilePicker.pickFiles({
        types: [], // 允许所有文件类型
        // 注意: @capawesome/capacitor-file-picker 默认支持多选
        // 我们只取第一个文件
      });

      if (result.files && result.files.length > 0) {
        const file = result.files[0];
        // 转换为 File 对象
        // 注意：这里可能需要额外的处理
        return file as any;
      }

      return null;
    } catch (error) {
      logger.error('文件选择失败:', error);
      return null;
    }
  }
}

// 导出单例实例
export const harmonyOSFileService = HarmonyOSFileService.getInstance();
export default HarmonyOSFileService;

