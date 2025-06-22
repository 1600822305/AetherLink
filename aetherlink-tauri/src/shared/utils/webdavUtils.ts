import type { WebDavConfig } from '../types';
import { getStorageItem, setStorageItem } from './storage';

/**
 * WebDAV 配置存储键
 */
const WEBDAV_CONFIG_KEY = 'webdav-config';

/**
 * 保存 WebDAV 配置
 */
export async function saveWebDavConfig(config: WebDavConfig): Promise<void> {
  try {
    await setStorageItem(WEBDAV_CONFIG_KEY, JSON.stringify(config));
  } catch (error) {
    console.error('保存 WebDAV 配置失败:', error);
    throw error;
  }
}

/**
 * 获取 WebDAV 配置
 */
export async function getWebDavConfig(): Promise<WebDavConfig | null> {
  try {
    const configStr = await getStorageItem(WEBDAV_CONFIG_KEY);
    return configStr ? JSON.parse(configStr as string) : null;
  } catch (error) {
    console.error('获取 WebDAV 配置失败:', error);
    return null;
  }
}

/**
 * 清除 WebDAV 配置
 */
export async function clearWebDavConfig(): Promise<void> {
  try {
    await setStorageItem(WEBDAV_CONFIG_KEY, '');
  } catch (error) {
    console.error('清除 WebDAV 配置失败:', error);
    throw error;
  }
}

/**
 * 验证 WebDAV 配置
 */
export function validateWebDavConfig(config: Partial<WebDavConfig>): string[] {
  const errors: string[] = [];

  if (!config.webdavHost?.trim()) {
    errors.push('WebDAV 服务器地址不能为空');
  } else {
    try {
      new URL(config.webdavHost);
    } catch {
      errors.push('WebDAV 服务器地址格式不正确');
    }
  }

  if (!config.webdavUser?.trim()) {
    errors.push('用户名不能为空');
  }

  if (!config.webdavPass?.trim()) {
    errors.push('密码不能为空');
  }

  if (!config.webdavPath?.trim()) {
    errors.push('路径不能为空');
  } else if (!config.webdavPath.startsWith('/')) {
    errors.push('路径必须以 / 开头');
  }

  return errors;
}

/**
 * 格式化文件大小
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * 格式化时间
 */
export function formatDateTime(dateString: string): string {
  try {
    const date = new Date(dateString);
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  } catch {
    return dateString;
  }
}

/**
 * 生成备份文件名
 */
export function generateBackupFileName(prefix = 'AetherLink_Backup'): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  return `${prefix}_${timestamp}.json`;
}

/**
 * 检查是否为备份文件
 */
export function isBackupFile(fileName: string): boolean {
  return fileName.endsWith('.json') && 
         (fileName.includes('Backup') || fileName.includes('backup'));
}

/**
 * 解析备份文件信息
 */
export function parseBackupFileName(fileName: string): {
  type: string;
  timestamp: string;
  isValid: boolean;
} {
  try {
    // 匹配格式: AetherLink_Backup_2024-01-01T12-00-00-000Z.json
    const match = fileName.match(/^(.+)_(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z)\.json$/);
    
    if (match) {
      return {
        type: match[1],
        timestamp: match[2].replace(/-/g, ':').replace(/T(\d{2}):(\d{2}):(\d{2}):(\d{3})Z/, 'T$1:$2:$3.$4Z'),
        isValid: true
      };
    }
    
    return {
      type: 'Unknown',
      timestamp: '',
      isValid: false
    };
  } catch {
    return {
      type: 'Unknown',
      timestamp: '',
      isValid: false
    };
  }
}

/**
 * 获取同步间隔选项
 */
export function getSyncIntervalOptions() {
  return [
    { value: 0, label: '关闭自动同步' },
    { value: 1, label: '1 分钟' },
    { value: 5, label: '5 分钟' },
    { value: 15, label: '15 分钟' },
    { value: 30, label: '30 分钟' },
    { value: 60, label: '1 小时' },
    { value: 120, label: '2 小时' },
    { value: 360, label: '6 小时' },
    { value: 720, label: '12 小时' },
    { value: 1440, label: '24 小时' }
  ];
}

/**
 * 获取最大备份数量选项
 */
export function getMaxBackupsOptions() {
  return [
    { value: 0, label: '不限制' },
    { value: 1, label: '1 个' },
    { value: 3, label: '3 个' },
    { value: 5, label: '5 个' },
    { value: 10, label: '10 个' },
    { value: 20, label: '20 个' },
    { value: 50, label: '50 个' }
  ];
}
