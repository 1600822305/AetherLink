import type { WebDavConfig, WebDavSyncState, WebDavUploadResult, WebDavDownloadResult } from '../../types';
import { WebDavManagerService } from './WebDavManagerService';
import { getStorageItem, setStorageItem } from '../../utils/storage';
import { createLogger } from '../infra/logger';

const logger = createLogger('WebDAV Backup');

/**
 * 自动备份的数据来源。
 * 服务层不关心备份数据如何组装，由应用启动时通过 registerBackupDataProvider 注入，
 * 以此解耦 WebDAV 服务与上层备份数据准备逻辑（prepareFullBackupData）。
 */
export type BackupDataProvider = () => Promise<any>;

/**
 * WebDAV 备份管理服务
 * 提供自动同步、备份管理等高级功能
 */
export class WebDavBackupService {
  private static instance: WebDavBackupService;
  private webdavService: WebDavManagerService | null = null;
  private syncTimer: ReturnType<typeof setInterval> | null = null;
  private initialBackupTimer: ReturnType<typeof setTimeout> | null = null;
  private isAutoSyncing = false;
  /** 自动备份数据来源（依赖注入，避免服务层耦合 UI/数据准备逻辑） */
  private backupDataProvider: BackupDataProvider | null = null;

  private constructor() {}

  static getInstance(): WebDavBackupService {
    if (!WebDavBackupService.instance) {
      WebDavBackupService.instance = new WebDavBackupService();
    }
    return WebDavBackupService.instance;
  }

  /**
   * 注册自动备份的数据来源。
   * 由应用启动时调用，使自动备份能够获取与手动备份一致的完整备份数据。
   */
  registerBackupDataProvider(provider: BackupDataProvider): void {
    this.backupDataProvider = provider;
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
      logger.error('初始化 WebDAV 服务失败:', error);
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
      logger.error('获取同步状态失败:', error);
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
      logger.error('更新同步状态失败:', error);
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
      logger.error('获取备份文件列表失败:', error);
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
   * @param config WebDAV 配置
   * @param intervalMinutes 同步间隔（分钟），必须大于 0
   * @param options.immediate 是否在启动后立即执行一次备份（默认 true；应用启动恢复时传 false）
   */
  async startAutoSync(
    config: WebDavConfig,
    intervalMinutes: number,
    options: { immediate?: boolean } = {}
  ): Promise<boolean> {
    // 无效间隔直接视为关闭自动同步，避免 setInterval(0) 造成的高频循环
    if (!Number.isFinite(intervalMinutes) || intervalMinutes <= 0) {
      logger.warn('自动同步间隔无效，已停止自动同步');
      await this.stopAutoSync();
      return false;
    }

    if (!this.backupDataProvider) {
      logger.warn('未注册备份数据来源，自动同步将无法上传数据');
    }

    // 幂等启动：先清理旧定时器，避免重复调用造成多个定时器叠加
    await this.stopAutoSync();

    const initialized = await this.initialize(config);
    if (!initialized) {
      await this.updateSyncState({ lastSyncError: 'WebDAV 连接失败，自动同步未启动' });
      return false;
    }

    this.isAutoSyncing = true;
    await this.updateSyncState({ autoSync: true, syncInterval: intervalMinutes, lastSyncError: null });

    // 设置周期定时器
    const intervalMs = intervalMinutes * 60 * 1000;
    this.syncTimer = setInterval(() => {
      void this.performAutoBackup();
    }, intervalMs);

    // 默认在启动后延迟立即备份一次（为用户手动开启时提供即时反馈）；
    // 应用启动恢复时传 immediate=false，避免每次启动都产生一个备份。
    if (options.immediate !== false) {
      this.initialBackupTimer = setTimeout(() => {
        void this.performAutoBackup();
      }, 5000);
    }

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

    if (this.initialBackupTimer) {
      clearTimeout(this.initialBackupTimer);
      this.initialBackupTimer = null;
    }

    await this.updateSyncState({ autoSync: false });
  }

  /**
   * 应用启动时根据持久化状态恢复自动同步。
   * 仅在上次会话已启用自动同步且间隔有效时生效；启动时不立即备份，等待首个间隔。
   */
  async resumeAutoSyncIfEnabled(config: WebDavConfig): Promise<void> {
    const state = await this.getSyncState();
    if (!state.autoSync || state.syncInterval <= 0) {
      return;
    }
    await this.startAutoSync(config, state.syncInterval, { immediate: false });
  }

  /**
   * 执行自动备份
   * 通过注入的 backupDataProvider 获取完整备份数据并上传至 WebDAV。
   */
  private async performAutoBackup(): Promise<void> {
    // 跳过条件：服务未初始化 / 未注册数据来源 / 已有同步进行中
    if (!this.webdavService) {
      logger.warn('自动备份跳过：服务未初始化');
      return;
    }
    if (!this.backupDataProvider) {
      logger.warn('自动备份跳过：未注册备份数据来源');
      return;
    }

    const { syncing } = await this.getSyncState();
    if (syncing) {
      logger.debug('自动备份跳过：已有同步任务进行中');
      return;
    }

    try {
      logger.debug('开始执行自动备份...');
      const backupData = await this.backupDataProvider();
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const fileName = `AetherLink_AutoBackup_${timestamp}.json`;

      // 复用 backupToWebDav：其内部已统一处理 syncing 状态、lastSyncTime/lastSyncError 与旧备份清理
      const result = await this.backupToWebDav(backupData, fileName);
      if (result.success) {
        logger.debug(`自动备份成功：${result.fileName}`);
      } else {
        logger.error(`自动备份失败：${result.error}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error('自动备份异常：', message);
      await this.updateSyncState({ syncing: false, lastSyncError: message });
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
        logger.debug(`已删除旧备份文件: ${file.fileName}`);
      }
    } catch (error) {
      logger.error('清理旧备份失败:', error);
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
      logger.error('检查 WebDAV 连接失败:', error);
      return false;
    }
  }
}
