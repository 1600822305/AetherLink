/**
 * 统一平台适配器
 * 提供跨平台的统一 API，自动适配 Web、Capacitor、Tauri 环境
 */

import {
  detectDetailedPlatform,
  RuntimeType
} from '../utils/platformDetection';

// 统一的接口定义
export interface UnifiedPlatformAPI {
  // 文件系统
  filesystem: {
    writeFile(path: string, data: string): Promise<void>;
    readFile(path: string): Promise<string>;
    deleteFile(path: string): Promise<void>;
    exists(path: string): Promise<boolean>;
  };
  
  // 通知
  notifications: {
    show(title: string, body: string): Promise<void>;
    requestPermission(): Promise<boolean>;
  };
  
  // 剪贴板
  clipboard: {
    writeText(text: string): Promise<void>;
    readText(): Promise<string>;
  };
  
  // 设备信息
  device: {
    getInfo(): Promise<DeviceInfo>;
    getBatteryInfo(): Promise<BatteryInfo | null>;
  };
  
  // 窗口控制 (仅桌面端)
  window?: {
    minimize(): Promise<void>;
    maximize(): Promise<void>;
    close(): Promise<void>;
    setTitle(title: string): Promise<void>;
    setSize(width: number, height: number): Promise<void>;
  };
  
  // 相机 (仅移动端)
  camera?: {
    takePicture(): Promise<string>;
    pickFromGallery(): Promise<string>;
  };
}

export interface DeviceInfo {
  platform: string;
  model: string;
  operatingSystem: string;
  osVersion: string;
  manufacturer: string;
  isVirtual: boolean;
  architecture?: string; // 可选字段，用于 Tauri
}

export interface BatteryInfo {
  batteryLevel: number;
  isCharging: boolean;
}

/**
 * 平台适配器工厂 (增强版)
 */
export class PlatformAdapterFactory {
  private static instance: UnifiedPlatformAPI | null = null;

  static getInstance(): UnifiedPlatformAPI {
    if (!this.instance) {
      const platformInfo = detectDetailedPlatform();

      switch (platformInfo.runtimeType) {
        case RuntimeType.TAURI:
          this.instance = new TauriAdapter();
          break;
        case RuntimeType.CAPACITOR:
          this.instance = new CapacitorAdapter();
          break;
        case RuntimeType.WEB:
        default:
          this.instance = new WebAdapter();
          break;
      }
    }

    return this.instance;
  }

  /**
   * 重置实例 (用于测试或强制重新检测)
   */
  static reset(): void {
    this.instance = null;
  }

  /**
   * 获取当前平台信息
   */
  static getPlatformInfo() {
    return detectDetailedPlatform();
  }
}

/**
 * Web 平台适配器
 */
class WebAdapter implements UnifiedPlatformAPI {
  filesystem = {
    async writeFile(path: string, data: string): Promise<void> {
      // Web 环境使用 localStorage 或 IndexedDB
      localStorage.setItem(`file:${path}`, data);
    },
    
    async readFile(path: string): Promise<string> {
      const data = localStorage.getItem(`file:${path}`);
      if (data === null) {
        throw new Error(`File not found: ${path}`);
      }
      return data;
    },
    
    async deleteFile(path: string): Promise<void> {
      localStorage.removeItem(`file:${path}`);
    },
    
    async exists(path: string): Promise<boolean> {
      return localStorage.getItem(`file:${path}`) !== null;
    },
  };

  notifications = {
    async show(title: string, body: string): Promise<void> {
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(title, { body });
      }
    },
    
    async requestPermission(): Promise<boolean> {
      if ('Notification' in window) {
        const permission = await Notification.requestPermission();
        return permission === 'granted';
      }
      return false;
    },
  };

  clipboard = {
    async writeText(text: string): Promise<void> {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(text);
      } else {
        // 降级方案
        const textArea = document.createElement('textarea');
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
    },
    
    async readText(): Promise<string> {
      if (navigator.clipboard) {
        return await navigator.clipboard.readText();
      }
      throw new Error('Clipboard read not supported in this environment');
    },
  };

  device = {
    async getInfo(): Promise<DeviceInfo> {
      return {
        platform: 'web',
        model: 'Unknown',
        operatingSystem: navigator.platform,
        osVersion: 'Unknown',
        manufacturer: 'Unknown',
        isVirtual: false,
      };
    },
    
    async getBatteryInfo(): Promise<BatteryInfo | null> {
      if ('getBattery' in navigator) {
        const battery = await (navigator as any).getBattery();
        return {
          batteryLevel: battery.level,
          isCharging: battery.charging,
        };
      }
      return null;
    },
  };
}

/**
 * Capacitor 平台适配器
 */
class CapacitorAdapter implements UnifiedPlatformAPI {
  filesystem = {
    async writeFile(path: string, data: string): Promise<void> {
      const { Filesystem, Directory } = await import('@capacitor/filesystem');
      await Filesystem.writeFile({
        path,
        data,
        directory: Directory.Documents,
      });
    },
    
    async readFile(path: string): Promise<string> {
      const { Filesystem, Directory } = await import('@capacitor/filesystem');
      const result = await Filesystem.readFile({
        path,
        directory: Directory.Documents,
      });
      return result.data as string;
    },
    
    async deleteFile(path: string): Promise<void> {
      const { Filesystem, Directory } = await import('@capacitor/filesystem');
      await Filesystem.deleteFile({
        path,
        directory: Directory.Documents,
      });
    },
    
    async exists(path: string): Promise<boolean> {
      try {
        const { Filesystem, Directory } = await import('@capacitor/filesystem');
        await Filesystem.stat({
          path,
          directory: Directory.Documents,
        });
        return true;
      } catch {
        return false;
      }
    },
  };

  notifications = {
    async show(title: string, body: string): Promise<void> {
      const { LocalNotifications } = await import('@capacitor/local-notifications');
      await LocalNotifications.schedule({
        notifications: [{
          title,
          body,
          id: Date.now(),
        }],
      });
    },
    
    async requestPermission(): Promise<boolean> {
      const { LocalNotifications } = await import('@capacitor/local-notifications');
      const result = await LocalNotifications.requestPermissions();
      return result.display === 'granted';
    },
  };

  clipboard = {
    async writeText(text: string): Promise<void> {
      const { Clipboard } = await import('@capacitor/clipboard');
      await Clipboard.write({ string: text });
    },
    
    async readText(): Promise<string> {
      const { Clipboard } = await import('@capacitor/clipboard');
      const result = await Clipboard.read();
      return result.value;
    },
  };

  device = {
    async getInfo(): Promise<DeviceInfo> {
      const { Device } = await import('@capacitor/device');
      const info = await Device.getInfo();
      return {
        platform: info.platform,
        model: info.model,
        operatingSystem: info.operatingSystem,
        osVersion: info.osVersion,
        manufacturer: info.manufacturer,
        isVirtual: info.isVirtual,
      };
    },
    
    async getBatteryInfo(): Promise<BatteryInfo | null> {
      try {
        const { Device } = await import('@capacitor/device');
        const info = await Device.getBatteryInfo();
        return {
          batteryLevel: info.batteryLevel || 0,
          isCharging: info.isCharging || false,
        };
      } catch {
        return null;
      }
    },
  };

  camera = {
    async takePicture(): Promise<string> {
      const { Camera, CameraResultType } = await import('@capacitor/camera');
      const result = await Camera.getPhoto({
        resultType: CameraResultType.DataUrl,
      });
      return result.dataUrl!;
    },
    
    async pickFromGallery(): Promise<string> {
      const { Camera, CameraResultType, CameraSource } = await import('@capacitor/camera');
      const result = await Camera.getPhoto({
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Photos,
      });
      return result.dataUrl!;
    },
  };
}

/**
 * Tauri 平台适配器
 */
class TauriAdapter implements UnifiedPlatformAPI {
  filesystem = {
    async writeFile(path: string, data: string): Promise<void> {
      const { writeTextFile } = await import('@tauri-apps/api/fs');
      await writeTextFile(path, data);
    },
    
    async readFile(path: string): Promise<string> {
      const { readTextFile } = await import('@tauri-apps/api/fs');
      return await readTextFile(path);
    },
    
    async deleteFile(path: string): Promise<void> {
      const { removeFile } = await import('@tauri-apps/api/fs');
      await removeFile(path);
    },
    
    async exists(path: string): Promise<boolean> {
      try {
        const { exists } = await import('@tauri-apps/api/fs');
        return await exists(path);
      } catch {
        return false;
      }
    },
  };

  notifications = {
    async show(title: string, body: string): Promise<void> {
      const { sendNotification } = await import('@tauri-apps/api/notification');
      await sendNotification({ title, body });
    },
    
    async requestPermission(): Promise<boolean> {
      const { isPermissionGranted, requestPermission } = await import('@tauri-apps/api/notification');
      
      let permissionGranted = await isPermissionGranted();
      if (!permissionGranted) {
        const permission = await requestPermission();
        permissionGranted = permission === 'granted';
      }
      
      return permissionGranted;
    },
  };

  clipboard = {
    async writeText(text: string): Promise<void> {
      const { writeText } = await import('@tauri-apps/api/clipboard');
      await writeText(text);
    },
    
    async readText(): Promise<string> {
      const { readText } = await import('@tauri-apps/api/clipboard');
      return await readText() || '';
    },
  };

  device = {
    async getInfo(): Promise<DeviceInfo> {
      const { platform, arch, version } = await import('@tauri-apps/api/os');

      return {
        platform: await platform(),
        model: 'Desktop',
        operatingSystem: await platform(),
        architecture: await arch(),
        osVersion: await version(),
        manufacturer: 'Unknown',
        isVirtual: false,
      };
    },
    
    async getBatteryInfo(): Promise<BatteryInfo | null> {
      // Tauri 目前不支持电池信息
      return null;
    },
  };

  window = {
    async minimize(): Promise<void> {
      const { getCurrentWindow } = await import('@tauri-apps/api/window');
      await getCurrentWindow().minimize();
    },
    
    async maximize(): Promise<void> {
      const { getCurrentWindow } = await import('@tauri-apps/api/window');
      await getCurrentWindow().toggleMaximize();
    },
    
    async close(): Promise<void> {
      const { getCurrentWindow } = await import('@tauri-apps/api/window');
      await getCurrentWindow().close();
    },
    
    async setTitle(title: string): Promise<void> {
      const { getCurrentWindow } = await import('@tauri-apps/api/window');
      await getCurrentWindow().setTitle(title);
    },
    
    async setSize(width: number, height: number): Promise<void> {
      const { getCurrentWindow, LogicalSize } = await import('@tauri-apps/api/window');
      await getCurrentWindow().setSize(new LogicalSize(width, height));
    },
  };
}

// 导出单例实例
export const platformAdapter = PlatformAdapterFactory.getInstance();
