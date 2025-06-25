/**
 * 平台相关的 React Hook
 * 提供平台检测和统一 API 访问
 */

import { useState, useEffect, useCallback } from 'react';
import {
  getPlatformInfo,
  getPlatformConfig,
  DetailedPlatformInfo,
  PlatformType,
  RuntimeType,
  OSType,
  LegacyPlatformType
} from '../shared/utils/platformDetection';
import {
  platformAdapter,
  UnifiedPlatformAPI,
  DeviceInfo,
  BatteryInfo
} from '../shared/adapters/PlatformAdapter';

/**
 * 平台信息 Hook (增强版)
 */
export function usePlatformInfo() {
  const [platformInfo, setPlatformInfo] = useState<DetailedPlatformInfo | null>(null);
  const [platformConfig, setPlatformConfig] = useState<any>(null);

  useEffect(() => {
    const info = getPlatformInfo();
    const config = getPlatformConfig();

    setPlatformInfo(info);
    setPlatformConfig(config);
  }, []);

  return {
    // 详细平台信息
    platformInfo,
    platformConfig,

    // 基本分类 (向后兼容)
    isMobile: platformInfo?.isMobile ?? false,
    isDesktop: platformInfo?.isDesktop ?? false,
    isWeb: platformInfo?.isWeb ?? false,
    isTauri: platformInfo?.isTauri ?? false,
    isCapacitor: platformInfo?.isCapacitor ?? false,

    // 新增：详细平台检测
    isWindows: platformInfo?.isWindows ?? false,
    isMacOS: platformInfo?.isMacOS ?? false,
    isLinux: platformInfo?.isLinux ?? false,
    isAndroid: platformInfo?.isAndroid ?? false,
    isIOS: platformInfo?.isIOS ?? false,

    // 新增：平台类型
    platformType: platformInfo?.platformType,
    runtimeType: platformInfo?.runtimeType,
    osType: platformInfo?.osType,

    // 向后兼容
    legacyType: platformInfo?.type,
  };
}

/**
 * 设备信息 Hook
 */
export function useDeviceInfo() {
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo | null>(null);
  const [batteryInfo, setBatteryInfo] = useState<BatteryInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDeviceInfo = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const [device, battery] = await Promise.all([
        platformAdapter.device.getInfo(),
        platformAdapter.device.getBatteryInfo(),
      ]);
      
      setDeviceInfo(device);
      setBatteryInfo(battery);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch device info');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDeviceInfo();
  }, [fetchDeviceInfo]);

  return {
    deviceInfo,
    batteryInfo,
    loading,
    error,
    refresh: fetchDeviceInfo,
  };
}

/**
 * 文件系统 Hook
 */
export function useFileSystem() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const writeFile = useCallback(async (path: string, data: string) => {
    try {
      setLoading(true);
      setError(null);
      await platformAdapter.filesystem.writeFile(path, data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to write file');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const readFile = useCallback(async (path: string): Promise<string> => {
    try {
      setLoading(true);
      setError(null);
      return await platformAdapter.filesystem.readFile(path);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to read file');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const deleteFile = useCallback(async (path: string) => {
    try {
      setLoading(true);
      setError(null);
      await platformAdapter.filesystem.deleteFile(path);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete file');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const fileExists = useCallback(async (path: string): Promise<boolean> => {
    try {
      setError(null);
      return await platformAdapter.filesystem.exists(path);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to check file existence');
      return false;
    }
  }, []);

  return {
    writeFile,
    readFile,
    deleteFile,
    fileExists,
    loading,
    error,
  };
}

/**
 * 通知 Hook
 */
export function useNotifications() {
  const [permissionGranted, setPermissionGranted] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requestPermission = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const granted = await platformAdapter.notifications.requestPermission();
      setPermissionGranted(granted);
      return granted;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to request permission');
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const showNotification = useCallback(async (title: string, body: string) => {
    try {
      setError(null);
      await platformAdapter.notifications.show(title, body);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to show notification');
      throw err;
    }
  }, []);

  useEffect(() => {
    // 初始化时检查权限状态
    requestPermission();
  }, [requestPermission]);

  return {
    permissionGranted,
    showNotification,
    requestPermission,
    loading,
    error,
  };
}

/**
 * 剪贴板 Hook
 */
export function useClipboard() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const writeText = useCallback(async (text: string) => {
    try {
      setLoading(true);
      setError(null);
      await platformAdapter.clipboard.writeText(text);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to write to clipboard');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const readText = useCallback(async (): Promise<string> => {
    try {
      setLoading(true);
      setError(null);
      return await platformAdapter.clipboard.readText();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to read from clipboard');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    writeText,
    readText,
    loading,
    error,
  };
}

/**
 * 窗口控制 Hook (仅桌面端)
 */
export function useWindowControls() {
  const { isDesktop } = usePlatformInfo();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const minimize = useCallback(async () => {
    if (!isDesktop || !platformAdapter.window) return;
    
    try {
      setLoading(true);
      setError(null);
      await platformAdapter.window.minimize();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to minimize window');
    } finally {
      setLoading(false);
    }
  }, [isDesktop]);

  const maximize = useCallback(async () => {
    if (!isDesktop || !platformAdapter.window) return;
    
    try {
      setLoading(true);
      setError(null);
      await platformAdapter.window.maximize();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to maximize window');
    } finally {
      setLoading(false);
    }
  }, [isDesktop]);

  const close = useCallback(async () => {
    if (!isDesktop || !platformAdapter.window) return;
    
    try {
      setLoading(true);
      setError(null);
      await platformAdapter.window.close();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to close window');
    } finally {
      setLoading(false);
    }
  }, [isDesktop]);

  const setTitle = useCallback(async (title: string) => {
    if (!isDesktop || !platformAdapter.window) return;
    
    try {
      setError(null);
      await platformAdapter.window.setTitle(title);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to set window title');
    }
  }, [isDesktop]);

  const setSize = useCallback(async (width: number, height: number) => {
    if (!isDesktop || !platformAdapter.window) return;
    
    try {
      setError(null);
      await platformAdapter.window.setSize(width, height);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to set window size');
    }
  }, [isDesktop]);

  return {
    minimize,
    maximize,
    close,
    setTitle,
    setSize,
    loading,
    error,
    available: isDesktop && !!platformAdapter.window,
  };
}

/**
 * 相机 Hook (仅移动端)
 */
export function useCamera() {
  const { isMobile } = usePlatformInfo();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const takePicture = useCallback(async (): Promise<string> => {
    if (!isMobile || !platformAdapter.camera) {
      throw new Error('Camera not available on this platform');
    }
    
    try {
      setLoading(true);
      setError(null);
      return await platformAdapter.camera.takePicture();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to take picture');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [isMobile]);

  const pickFromGallery = useCallback(async (): Promise<string> => {
    if (!isMobile || !platformAdapter.camera) {
      throw new Error('Camera not available on this platform');
    }
    
    try {
      setLoading(true);
      setError(null);
      return await platformAdapter.camera.pickFromGallery();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to pick from gallery');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [isMobile]);

  return {
    takePicture,
    pickFromGallery,
    loading,
    error,
    available: isMobile && !!platformAdapter.camera,
  };
}
