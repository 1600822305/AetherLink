import type { WebDavConfig, WebDavSyncState, WebDavUploadResult, WebDavDownloadResult } from '../../types';
import { WebDavManagerService } from './WebDavManagerService';
import { getStorageItem, setStorageItem } from '../../utils/storage';

/**
 * WebDAV 备份管理服务
 * 提供自动同步、备份管理等高级功能
 */
export class WebDavBackupService {
  private static instance: WebDavBackupService;
  private webdavService: WebDavManagerService | null = null;
  private syncTimer: NodeJS.Timeout | null = null;
  private isAutoSyncing = false;

  private constructor() {}

  static getInstance(): WebDavBackupService {
    if (!WebDavBackupService.instance) {
      WebDavBackupService.instance = new WebDavBackupService();
    }
    return WebDavBackupService.instance;
  }

  /**
   * 初始化 WebDAV 服务
   */
  async initialize(config: WebDavConfig): Promise<boolean> {
    try {
      this.webdavService = new WebDavManagerService(config);
      const result = await this.webdavService.checkConnection();
      return result.success;
    } catch (error) {
      console.error('初始化 WebDAV 服务失败:', error);
      return false;
    }
  }

  /**
   * 获取当前同步状态
   */
  async getSyncState(): Promise<WebDavSyncState> {
    const defaultState: WebDavSyncState = {
      syncing: false,
      lastSyncTime: null,
      lastSyncError: null,
      autoSync: false,
      syncInterval: 0,
      maxBackups: 5
    };

    try {
      const savedState = await getStorageItem('webdav-sync-state');
      return savedState ? { ...defaultState, ...JSON.parse(savedState as string) } : defaultState;
    } catch (error) {
      console.error('获取同步状态失败:', error);
      return defaultState;
    }
  }

  /**
   * 更新同步状态
   */
  async updateSyncState(updates: Partial<WebDavSyncState>): Promise<void> {
    try {
      const currentState = await this.getSyncState();
      const newState = { ...currentState, ...updates };
      await setStorageItem('webdav-sync-state', JSON.stringify(newState));
    } catch (error) {
      console.error('更新同步状态失败:', error);
    }
  }

  /**
   * 手动备份到 WebDAV
   */
  async backupToWebDav(backupData: any, fileName?: string): Promise<WebDavUploadResult> {
    if (!this.webdavService) {
      return { success: false, error: 'WebDAV 服务未初始化' };
    }

    try {
      await this.updateSyncState({ syncing: true, lastSyncError: null });

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const finalFileName = fileName || `AetherLink_Backup_${timestamp}.json`;
      
      const jsonData = JSON.stringify(backupData, null, 2);
      const result = await this.webdavService.uploadFile(finalFileName, jsonData);

      if (result.success) {
        await this.updateSyncState({
          syncing: false,
          lastSyncTime: Date.now(),
          lastSyncError: null
        });
        
        // 清理旧备份
        await this.cleanupOldBackups();
      } else {
        await this.updateSyncState({
          syncing: false,
          lastSyncError: result.error || '备份失败'
        });
      }

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      await this.updateSyncState({
        syncing: false,
        lastSyncError: errorMessage
      });
      return { success: false, error: errorMessage };
    }
  }

  /**
   * 从 WebDAV 恢复备份
   */
  async restoreFromWebDav(fileName: string): Promise<WebDavDownloadResult> {
    if (!this.webdavService) {
      return { success: false, error: 'WebDAV 服务未初始化' };
    }

    try {
      const result = await this.webdavService.downloadFile(fileName);
      
      if (result.success && result.data) {
        try {
          const backupData = JSON.parse(result.data);
          return { success: true, data: backupData };
        } catch (parseError) {
          return { success: false, error: '备份文件格式错误' };
        }
      }

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * 获取备份文件列表
   */
  async getBackupFilesList() {
    if (!this.webdavService) {
      return [];
    }

    try {
      return await this.webdavService.listBackupFiles();
    } catch (error) {
      console.error('获取备份文件列表失败:', error);
      return [];
    }
  }

  /**
   * 删除备份文件
   */
  async deleteBackupFile(fileName: string) {
    if (!this.webdavService) {
      return { success: false, error: 'WebDAV 服务未初始化' };
    }

    return await this.webdavService.deleteFile(fileName);
  }

  /**
   * 启动自动同步
   */
  async startAutoSync(config: WebDavConfig, intervalMinutes: number): Promise<boolean> {
    if (this.isAutoSyncing) {
      this.stopAutoSync();
    }

    const initialized = await this.initialize(config);
    if (!initialized) {
      return false;
    }

    this.isAutoSyncing = true;
    await this.updateSyncState({ autoSync: true, syncInterval: intervalMinutes });

    // 设置定时器
    const intervalMs = intervalMinutes * 60 * 1000;
    this.syncTimer = setInterval(async () => {
      if (this.isAutoSyncing) {
        await this.performAutoBackup();
      }
    }, intervalMs);

    // 立即执行一次备份
    setTimeout(() => {
      if (this.isAutoSyncing) {
        this.performAutoBackup();
      }
    }, 5000);

    return true;
  }

  /**
   * 停止自动同步
   */
  async stopAutoSync(): Promise<void> {
    this.isAutoSyncing = false;
    
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }

    await this.updateSyncState({ autoSync: false });
  }

  /**
   * 执行自动备份
   */
  private async performAutoBackup(): Promise<void> {
    try {
      // 这里需要获取当前的备份数据
      // 由于这是一个通用服务，具体的数据获取逻辑需要在调用时提供
      console.log('执行自动备份...');
      
      // 获取基本备份数据的逻辑应该从外部传入
      // 这里先留空，在实际使用时会被重写
    } catch (error) {
      console.error('自动备份失败:', error);
      await this.updateSyncState({
        lastSyncError: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * 清理旧备份文件
   */
  private async cleanupOldBackups(): Promise<void> {
    try {
      const syncState = await this.getSyncState();
      if (syncState.maxBackups <= 0) {
        return; // 不限制备份数量
      }

      const files = await this.getBackupFilesList();
      if (files.length <= syncState.maxBackups) {
        return; // 备份数量未超限
      }

      // 按时间排序，删除最旧的文件
      const sortedFiles = files.sort((a, b) => 
        new Date(b.modifiedTime).getTime() - new Date(a.modifiedTime).getTime()
      );

      const filesToDelete = sortedFiles.slice(syncState.maxBackups);
      
      for (const file of filesToDelete) {
        await this.deleteBackupFile(file.fileName);
        console.log(`已删除旧备份文件: ${file.fileName}`);
      }
    } catch (error) {
      console.error('清理旧备份失败:', error);
    }
  }

  /**
   * 检查 WebDAV 连接状态
   */
  async checkConnection(config: WebDavConfig): Promise<boolean> {
    try {
      const service = new WebDavManagerService(config);
      const result = await service.checkConnection();
      return result.success;
    } catch (error) {
      console.error('检查 WebDAV 连接失败:', error);
      return false;
    }
  }
}
