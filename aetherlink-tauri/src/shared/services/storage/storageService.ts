import { Preferences } from '@capacitor/preferences';
import type { Assistant } from '../../types/Assistant';
import type { ChatTopic, Message } from '../../types';
import { dexieStorage } from './DexieStorageService';
import { DB_CONFIG } from '../../database/config';
import Dexie from 'dexie';

// 定义 DatabaseStatus 类型
export interface DatabaseStatus {
  databases: string[];
  currentDB: string;
  objectStores: string[];
  topicsCount: number;
  assistantsCount: number;
  imagesCount: number;
  settingsCount: number;
  metadataCount: number;
  memoriesCount: number;
  missingStores: string[];
  dbVersion?: number; // Dexie的原生verno是数字
  isDBOpen: boolean;
  error?: string;
}

// 导出Dexie实例，方便直接使用
export { dexieStorage };

/**
 * 数据库初始化
 * 简化版本，不再包含迁移逻辑
 */
export async function initStorageService(): Promise<void> {
  try {
    // 启用数据库清理机制，清理旧版本数据库
    const cleanupResult = await cleanupOldDatabases();
    if (cleanupResult.found > 0) {
      console.log(`[StorageService] 清理了 ${cleanupResult.cleaned}/${cleanupResult.found} 个旧数据库`);
    }

    // Dexie会自动打开数据库，无需手动initialize
    // console.log('存储服务: 数据库初始化检查完成，或已通过initialize()处理。');

    // 初始化StorageService单例实例
    if (storageService) {
      storageService.setUseDexiePriority(true);
    }

    console.log('存储服务初始化成功');
  } catch (error) {
    const errorMessage = error instanceof Error 
      ? `${error.name}: ${error.message}` 
      : String(error);
    const errorDetails = error instanceof Error && error.stack 
      ? `\n错误堆栈: ${error.stack}` 
      : '';
    console.error(`存储服务初始化失败: ${errorMessage}${errorDetails}`);
    
    try {
      const isOpen = dexieStorage.isOpen();
      console.error(`数据库状态: ${isOpen ? '已打开' : '未打开'}`);
      
      if (!isOpen) {
        console.log('尝试重新打开数据库...');
        await dexieStorage.open();
        console.log('数据库已重新打开');
      }
    } catch (dbError) {
      console.error('获取数据库状态失败:', 
        dbError instanceof Error ? dbError.message : String(dbError));
    }
    throw error;
  }
}

/**
 * 清理旧数据库
 */
export async function cleanupOldDatabases(): Promise<{
  found: number;
  cleaned: number;
  current: string;
}> {
  try {
    // 获取所有数据库
    const databases = await Dexie.getDatabaseNames();

    // 筛选出需要清理的数据库名称
    const oldDatabases = databases.filter((name: string) => {
      // 清理旧版本的aetherlink数据库
      if (name.startsWith('aetherlink-db-') && name !== DB_CONFIG.NAME) {
        return true;
      }
      // 清理其他已知的旧数据库
      if (name === 'samantha-web' || name === 'Disc' || name === 'CherryStudio') {
        return true;
      }
      return false;
    });

    console.log(`[StorageService] 清理旧数据库: 找到 ${oldDatabases.length} 个旧数据库`, oldDatabases);

    // 删除旧数据库
    let cleanedCount = 0;
    for (const dbName of oldDatabases) {
      try {
        console.log(`[StorageService] 正在删除数据库: ${dbName}`);
        await Dexie.delete(dbName);
        cleanedCount++;
        console.log(`[StorageService] 已删除数据库: ${dbName}`);
      } catch (e) {
        console.error(`[StorageService] 删除数据库 ${dbName} 失败:`, e);
      }
    }

    return {
      found: oldDatabases.length,
      cleaned: cleanedCount,
      current: DB_CONFIG.NAME
    };
  } catch (error) {
    console.error('[StorageService] 清理旧数据库失败:', error);
    return {
      found: 0,
      cleaned: 0,
      current: DB_CONFIG.NAME
    };
  }
}

/**
 * 获取数据库状态
 */
export async function getDatabaseStatus(): Promise<DatabaseStatus> { // 使用新的类型
  console.log('storageService: 获取数据库状态...');
  try {
    const databases = await Dexie.getDatabaseNames();
    const status: DatabaseStatus = {
      databases,
      currentDB: DB_CONFIG.NAME,
      objectStores: [],
      topicsCount: 0,
      assistantsCount: 0,
      imagesCount: 0,
      settingsCount: 0,
      metadataCount: 0,
      memoriesCount: 0,
      missingStores: [],
      dbVersion: 0,
      isDBOpen: false
    };

    if (dexieStorage.isOpen()) {
      status.isDBOpen = true;
      status.objectStores = dexieStorage.tables.map(t => t.name);
      status.dbVersion = dexieStorage.verno;
      try { status.topicsCount = await dexieStorage.topics.count(); } catch(e) { console.warn('Failed to count topics', e); }
      try { status.assistantsCount = await dexieStorage.assistants.count(); } catch(e) { console.warn('Failed to count assistants', e); }
      try { status.imagesCount = await dexieStorage.images.count(); } catch(e) { console.warn('Failed to count images', e); }
      try { status.settingsCount = await dexieStorage.settings.count(); } catch(e) { console.warn('Failed to count settings', e); }
      try { status.metadataCount = await dexieStorage.metadata.count(); } catch(e) { console.warn('Failed to count metadata', e); }
      try { status.memoriesCount = await dexieStorage.memories.count(); } catch(e) { console.warn('Failed to count memories', e); }

      const expectedStores = Object.values(DB_CONFIG.STORES);
      status.missingStores = expectedStores.filter(storeName => !status.objectStores.includes(storeName));
    } else {
      console.warn('storageService: 数据库未打开，无法获取详细状态。');
      status.missingStores = Object.values(DB_CONFIG.STORES);
    }
    return status;
  } catch (error) {
    console.error('获取数据库状态失败:', error);
    return {
      databases: await Dexie.getDatabaseNames().catch(() => []),
      currentDB: DB_CONFIG.NAME,
      objectStores: [],
      topicsCount: 0,
      assistantsCount: 0,
      imagesCount: 0,
      settingsCount: 0,
      metadataCount: 0,
      memoriesCount: 0,
      missingStores: Object.values(DB_CONFIG.STORES),
      dbVersion: 0,
      isDBOpen: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

// 以下是直接转发到Dexie的方法，保留API兼容性

export async function saveTopicToDB(topic: ChatTopic): Promise<void> {
  await dexieStorage.saveTopic(topic);
}

export async function getAllTopicsFromDB(): Promise<ChatTopic[]> {
  return await dexieStorage.getAllTopics();
}

export async function getTopicsByAssistantId(assistantId: string): Promise<ChatTopic[]> {
  return await dexieStorage.getTopicsByAssistantId(assistantId);
}

export async function getRecentTopics(limit: number = 10): Promise<ChatTopic[]> {
  return await dexieStorage.getRecentTopics(limit);
}

export async function getTopicFromDB(id: string): Promise<ChatTopic | undefined> {
  const topic = await dexieStorage.getTopic(id);
  return topic || undefined;
}

export async function saveAssistantToDB(assistant: Assistant): Promise<void> {
  await dexieStorage.saveAssistant(assistant);
}

export async function getAllAssistantsFromDB(): Promise<Assistant[]> {
  return await dexieStorage.getAllAssistants();
}

export async function getSystemAssistants(): Promise<Assistant[]> {
  return await dexieStorage.getSystemAssistants();
}

export async function getAssistantFromDB(id: string): Promise<Assistant | undefined> {
  const assistant = await dexieStorage.getAssistant(id);
  return assistant || undefined;
}

export async function deleteAssistantFromDB(id: string): Promise<void> {
  await dexieStorage.deleteAssistant(id);
}

export async function deleteTopicFromDB(id: string): Promise<void> {
  await dexieStorage.deleteTopic(id);
}

export async function saveSettingToDB(id: string, value: any): Promise<void> {
  await dexieStorage.saveSetting(id, value);
}

export async function getSettingFromDB(id: string): Promise<any> {
  return await dexieStorage.getSetting(id);
}

/**
 * 统一存储服务类
 * 提供本地存储API，全部基于Dexie.js实现
 */
class StorageService {
  /**
   * 设置是否优先使用Dexie
   * @param enable 是否启用
   */
  setUseDexiePriority(enable: boolean): void {
    console.log(`StorageService: ${enable ? '启用' : '禁用'}Dexie存储`);
  }

  /**
   * 保存助手
   * @param assistant 助手对象
   */
  async saveAssistant(assistant: Assistant): Promise<void> {
    await dexieStorage.saveAssistant(assistant);
  }

  /**
   * 获取助手
   * @param id 助手ID
   */
  async getAssistant(id: string): Promise<Assistant | null> {
    try {
      const assistant = await dexieStorage.getAssistant(id);
      return assistant;
    } catch (error) {
      console.error('StorageService: 获取助手失败', error);
      return null;
    }
  }

  /**
   * 获取所有助手
   */
  async getAllAssistants(): Promise<Assistant[]> {
    try {
      return await dexieStorage.getAllAssistants();
    } catch (error) {
      console.error('StorageService: 获取所有助手失败', error);
      return [];
    }
  }

  /**
   * 删除助手
   * @param id 助手ID
   */
  async deleteAssistant(id: string): Promise<void> {
    await dexieStorage.deleteAssistant(id);
  }

  /**
   * 保存话题
   * @param topic 话题对象
   */
  async saveTopic(topic: ChatTopic): Promise<void> {
    await dexieStorage.saveTopic(topic);
  }

  /**
   * 获取话题
   * @param id 话题ID
   */
  async getTopic(id: string): Promise<ChatTopic | null> {
    try {
      const topic = await dexieStorage.getTopic(id);
      return topic;
    } catch (error) {
      console.error('StorageService: 获取话题失败', error);
      return null;
    }
  }

  /**
   * 获取所有话题
   */
  async getAllTopics(): Promise<ChatTopic[]> {
    try {
      return await dexieStorage.getAllTopics();
    } catch (error) {
      console.error('StorageService: 获取所有话题失败', error);
      return [];
    }
  }

  /**
   * 删除话题
   * @param id 话题ID
   */
  async deleteTopic(id: string): Promise<void> {
    await dexieStorage.deleteTopic(id);
  }

  /**
   * 添加消息到话题
   * @param topicId 话题ID
   * @param message 消息对象
   */
  async addMessageToTopic(topicId: string, message: Message): Promise<void> {
    await dexieStorage.addMessageToTopic(topicId, message);
  }

  /**
   * 更新话题中的消息
   * @param topicId 话题ID
   * @param messageId 消息ID
   * @param updatedMessage 更新后的消息
   */
  async updateMessageInTopic(topicId: string, messageId: string, updatedMessage: Message): Promise<void> {
    await dexieStorage.updateMessageInTopic(topicId, messageId, updatedMessage);
  }

  /**
   * 从话题中删除消息
   * @param topicId 话题ID
   * @param messageId 消息ID
   */
  async deleteMessageFromTopic(topicId: string, messageId: string): Promise<void> {
    await dexieStorage.deleteMessageFromTopic(topicId, messageId);
  }

  /**
   * 保存设置 (原名 setSetting)
   * @param key 设置的键
   * @param value 设置的值
   */
  async saveSetting(key: string, value: any): Promise<void> {
    await dexieStorage.saveSetting(key, value);
  }

  /**
   * 获取设置
   * @param key 设置的键
   */
  async getSetting(key: string): Promise<any> {
    try {
      return await dexieStorage.getSetting(key);
    } catch (error) {
      console.error('StorageService: 获取设置失败', error);
      return null;
    }
  }

  /**
   * 保存图片及其元数据
   * @param blob 图片Blob数据
   * @param metadata 图片元数据
   */
  async saveImage(blob: Blob, metadata: any): Promise<string> {
    return await dexieStorage.saveImage(blob, metadata);
  }
}

// 创建并导出单例实例
export const storageService = new StorageService();

// 重命名以下函数以避免重名问题
export const saveTopicToDatabase = saveTopicToDB;

export default StorageService;

/**
 * Capacitor存储服务
 * 使用Capacitor Preferences API提供更可靠的移动端存储解决方案
 * 用于存储小型配置数据，不适合存储大型数据
 */
export class CapacitorStorageService {
  /**
   * 设置存储项
   * @param key 键名
   * @param value 值（将被转换为JSON字符串）
   */
  static async setItem(key: string, value: any): Promise<void> {
    try {
      const jsonValue = typeof value === 'string' ? value : JSON.stringify(value);
      await Preferences.set({
        key,
        value: jsonValue
      });
    } catch (error) {
      console.error('CapacitorStorageService.setItem 失败:', error);
      throw error;
    }
  }

  /**
   * 获取存储项
   * @param key 键名
   * @param defaultValue 默认值（如果未找到项）
   * @returns 解析后的值或默认值
   */
  static async getItem<T>(key: string, defaultValue: T | null = null): Promise<T | null> {
    try {
      const { value } = await Preferences.get({ key });

      if (value === null || value === undefined) {
        return defaultValue;
      }

      try {
        return JSON.parse(value) as T;
      } catch {
        // 如果不是有效的JSON，返回原始字符串
        return value as unknown as T;
      }
    } catch (error) {
      console.error('CapacitorStorageService.getItem 失败:', error);
      return defaultValue;
    }
  }

  /**
   * 移除存储项
   * @param key 键名
   */
  static async removeItem(key: string): Promise<void> {
    try {
      await Preferences.remove({ key });
    } catch (error) {
      console.error('CapacitorStorageService.removeItem 失败:', error);
      throw error;
    }
  }

  /**
   * 清除所有存储项
   */
  static async clear(): Promise<void> {
    try {
      await Preferences.clear();
    } catch (error) {
      console.error('CapacitorStorageService.clear 失败:', error);
      throw error;
    }
  }

  /**
   * 获取所有键名
   */
  static async keys(): Promise<string[]> {
    try {
      const { keys } = await Preferences.keys();
      return keys;
    } catch (error) {
      console.error('CapacitorStorageService.keys 失败:', error);
      return [];
    }
  }

  /**
   * 批量设置多个存储项
   * @param items 键值对
   */
  static async setItems(items: Record<string, any>): Promise<void> {
    try {
      for (const [key, value] of Object.entries(items)) {
        await CapacitorStorageService.setItem(key, value);
      }
    } catch (error) {
      console.error('CapacitorStorageService.setItems 失败:', error);
      throw error;
    }
  }
}