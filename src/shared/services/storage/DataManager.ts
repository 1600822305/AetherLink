import { DB_CONFIG } from '../../types/DatabaseSchema';
import { dexieStorage } from './DexieStorageService';
import Dexie from 'dexie';
import { createLogger } from '../infra/logger';

const logger = createLogger('DataManager');

// 版本检查状态缓存
let versionCheckPromise: Promise<any> | null = null;

/**
 * 数据管理工具
 * 负责数据库版本检查和基础数据维护
 */
export const DataManager = {
  /**
   * 检查并修复数据库版本
   * 确保数据库版本与应用版本一致
   * 使用缓存避免重复执行
   */
  async ensureDatabaseVersion(): Promise<{
    success: boolean;
    message: string;
    oldVersion?: number;
    newVersion?: number;
  }> {
    // 如果已经有正在进行的版本检查，直接返回该Promise
    if (versionCheckPromise) {
      logger.debug('DataManager: 版本检查已在进行中，等待结果...');
      return versionCheckPromise;
    }

    // 创建新的版本检查Promise
    versionCheckPromise = this._performVersionCheck();

    try {
      const result = await versionCheckPromise;
      return result;
    } finally {
      // 检查完成后清除缓存，允许下次检查
      versionCheckPromise = null;
    }
  },

  /**
   * 实际执行版本检查的内部方法
   */
  async _performVersionCheck(): Promise<{
    success: boolean;
    message: string;
    oldVersion?: number;
    newVersion?: number;
  }> {
    try {
      logger.debug('DataManager: 开始检查数据库版本');

      // 使用Dexie获取所有数据库
      const databases = await Dexie.getDatabaseNames();

      // 检查目标数据库是否存在
      const targetDB = databases.includes(DB_CONFIG.NAME);

      // 如果数据库不存在，不需要修复
      if (!targetDB) {
        logger.debug('DataManager: 数据库不存在，将在首次访问时创建');
        return {
          success: true,
          message: '数据库不存在，将在首次访问时创建'
        };
      }

      // 检查版本是否匹配
      // 获取当前数据库实例的版本
      const currentVersion = dexieStorage.verno;

      if (currentVersion === DB_CONFIG.VERSION) {
        logger.debug(`DataManager: 数据库版本匹配 (v${currentVersion})`);
        return {
          success: true,
          message: `数据库版本匹配 (v${currentVersion})`
        };
      }

      // 版本不匹配时，让 Dexie 自己处理版本升级
      // 移除激进清理机制，避免数据丢失
      logger.debug(`DataManager: 数据库版本不匹配，当前: v${currentVersion}，期望: v${DB_CONFIG.VERSION}`);
      logger.debug('DataManager: 将使用 Dexie 标准迁移机制进行版本升级，保留用户数据');

      return {
        success: true,
        message: `数据库版本将从 v${currentVersion} 升级到 v${DB_CONFIG.VERSION}，使用渐进迁移保留数据`,
        oldVersion: currentVersion,
        newVersion: DB_CONFIG.VERSION
      };
    } catch (error) {
      logger.error('DataManager: 检查数据库版本失败:', error);
      return {
        success: false,
        message: `检查数据库版本失败: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }
};
