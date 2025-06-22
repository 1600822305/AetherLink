/**
 * WebDAV配置和结果类型定义
 */

// WebDAV配置信息
export interface WebDavConfig {
  webdavHost: string;
  webdavUser: string;
  webdavPass: string;
  webdavPath: string;
  fileName?: string;
  skipBackupFile?: boolean;
}

// WebDAV同步状态
export interface WebDavSyncState {
  syncing: boolean;
  lastSyncTime: number | null;
  lastSyncError: string | null;
  autoSync: boolean;
  syncInterval: number; // 分钟
  maxBackups: number;
}

// WebDAV备份文件信息
export interface WebDavBackupFile {
  fileName: string;
  modifiedTime: string;
  size: number;
  path: string;
}

// WebDAV连接结果
export interface WebDavConnectionResult {
  success: boolean;
  error?: string;
}

// WebDAV上传结果
export interface WebDavUploadResult {
  success: boolean;
  fileName?: string;
  error?: string;
}

// WebDAV下载结果
export interface WebDavDownloadResult {
  success: boolean;
  data?: any;
  error?: string;
}
