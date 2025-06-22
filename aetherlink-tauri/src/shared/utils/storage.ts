/**
 * Dexie.js 存储工具类
 * 提供对应用存储的统一封装，完全替代 localStorage 和直接的 IndexedDB 操作
 */
import { dexieStorage } from '../services/storage/DexieStorageService';

// 🚀 性能优化：减少开发模式下的冗余日志
const isDevelopment = import.meta.env.DEV;
const enableVerboseLogging = false; // 设置为 true 可启用详细日志

/**
 * 从数据库获取数据
 * @param key 键名
 * @returns 解析后的数据，如果键不存在则返回 null
 */
export async function getStorageItem<T>(key: string): Promise<T | null> {
  try {
    if (enableVerboseLogging && isDevelopment) {
      console.log(`[storage] 开始获取数据: ${key}`);
    }
    const value = await dexieStorage.getSetting(key);

    if (value === null || value === undefined) {
      if (enableVerboseLogging && isDevelopment) {
        console.log(`[storage] 数据不存在: ${key}`);
      }
      return null;
    }

    if (enableVerboseLogging && isDevelopment) {
      console.log(`[storage] 数据获取成功: ${key}`);
    }
    return value;
  } catch (error) {
    console.error(`[storage] Error getting item "${key}" from database:`, error);

    // 记录更详细的错误信息
    if (error instanceof Error) {
      console.error('[storage] 错误类型:', error.name);
      console.error('[storage] 错误消息:', error.message);
      console.error('[storage] 错误堆栈:', error.stack);
    }

    return null;
  }
}

/**
 * 向数据库保存数据
 * @param key 键名
 * @param value 要保存的值
 * @returns 保存是否成功
 */
export async function setStorageItem<T>(key: string, value: T): Promise<boolean> {
  try {
    if (enableVerboseLogging && isDevelopment) {
      console.log(`[storage] 开始保存数据: ${key}`);
    }
    await dexieStorage.saveSetting(key, value);
    if (enableVerboseLogging && isDevelopment) {
      console.log(`[storage] 数据保存成功: ${key}`);
    }
    return true;
  } catch (error) {
    console.error(`[storage] Error setting item "${key}" to database:`, error);

    // 记录更详细的错误信息
    if (error instanceof Error) {
      console.error('[storage] 错误类型:', error.name);
      console.error('[storage] 错误消息:', error.message);
      console.error('[storage] 错误堆栈:', error.stack);
    }

    return false;
  }
}

/**
 * 从数据库移除数据
 * @param key 键名
 */
export async function removeStorageItem(key: string): Promise<void> {
  try {
    await dexieStorage.deleteSetting(key);
  } catch (error) {
    console.error(`Error removing item "${key}" from database:`, error);
  }
}

/**
 * 清空数据库中的所有设置数据
 * 注意：此操作会移除设置表中的所有数据，请谨慎使用
 */
export async function clearStorage(): Promise<void> {
  try {
    // 使用Dexie提供的clear方法清空设置表
    await dexieStorage.settings.clear();
    console.log('Settings store has been cleared.');
  } catch (error) {
    console.error('Error clearing settings store:', error);
  }
}

/**
 * 获取数据库中所有键名
 * @returns 键名数组
 */
export async function getAllStorageKeys(): Promise<string[]> {
  try {
    // 获取所有设置对象
    const settings = await dexieStorage.settings.toArray();
    // 返回所有id作为键名
    return settings.map(setting => String(setting.id));
  } catch (error) {
    console.error('Error getting all keys from database:', error);
    return [];
  }
}

/**
 * 批量设置多个键值对
 * @param items 键值对对象
 * @returns 保存是否成功
 */
export async function setStorageItems(items: Record<string, any>): Promise<boolean> {
  try {
    if (enableVerboseLogging && isDevelopment) {
      console.log(`[storage] 开始批量保存数据，键数量: ${Object.keys(items).length}`);
    }

    // 使用Dexie事务批量保存设置
    await dexieStorage.transaction('rw', dexieStorage.settings, async () => {
      for (const [key, value] of Object.entries(items)) {
        if (enableVerboseLogging && isDevelopment) {
          console.log(`[storage] 批量保存 - 处理键: ${key}`);
        }
        await dexieStorage.saveSetting(key, value);
      }
    });

    if (enableVerboseLogging && isDevelopment) {
      console.log('[storage] 批量保存数据成功');
    }
    return true;
  } catch (error) {
    console.error('[storage] Error setting multiple items to database:', error);

    // 记录更详细的错误信息
    if (error instanceof Error) {
      console.error('[storage] 错误类型:', error.name);
      console.error('[storage] 错误消息:', error.message);
      console.error('[storage] 错误堆栈:', error.stack);
    }

    // 尝试逐个保存，避免一个失败导致全部失败
    if (enableVerboseLogging && isDevelopment) {
      console.log('[storage] 尝试逐个保存项目...');
    }
    let allSuccess = true;

    for (const [key, value] of Object.entries(items)) {
      try {
        if (enableVerboseLogging && isDevelopment) {
          console.log(`[storage] 单独保存键: ${key}`);
        }
        await dexieStorage.saveSetting(key, value);
      } catch (itemError) {
        console.error(`[storage] 保存键 ${key} 失败:`, itemError);
        allSuccess = false;
      }
    }

    return allSuccess;
  }
}

// 提供与旧版localStorage接口兼容的方法，以便平稳迁移
export const getLocalStorageItem = getStorageItem;
export const setLocalStorageItem = setStorageItem;
export const removeLocalStorageItem = removeStorageItem;
export const clearLocalStorage = clearStorage;
export const getAllLocalStorageKeys = getAllStorageKeys;

// 获取所有localStorage的键
// v1.0.1 - Minor change to force re-evaluation
/*
export function getAllKeys(): string[] {
  try {
    return Object.keys(localStorage);
  } catch (error) {
    console.error('从localStorage获取所有键失败:', error);
    return [];
  }
}
*/