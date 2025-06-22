import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { FileOpener } from '@capacitor-community/file-opener';
import { Capacitor } from '@capacitor/core';
import type { ChatTopic } from '../../../../shared/types';
import type { Assistant } from '../../../../shared/types/Assistant';
import { dexieStorage } from '../../../../shared/services/storage/DexieStorageService';
import { getStorageItem, getAllStorageKeys } from '../../../../shared/utils/storage';
import { TopicStatsService } from '../../../../shared/services/topics/TopicStatsService';
// 使用统一的话题验证服务，不再重复实现验证逻辑

// 默认备份目录
export const DEFAULT_BACKUP_DIRECTORY = 'AetherLink/backups';

// 备份版本
export const CURRENT_BACKUP_VERSION = 5;

/**
 * 获取备份存储类型（external或documents）
 */
export async function getBackupStorageType(): Promise<'external' | 'documents'> {
  const storageType = await getStorageItem<string>('backup-storage-type');
  return storageType === 'external' ? 'external' : 'documents';
}

/**
 * 获取备份位置
 */
export async function getBackupLocation(): Promise<string> {
  const location = await getStorageItem<string>('backup-location');
  return location || DEFAULT_BACKUP_DIRECTORY;
}

/**
 * 确保备份目录存在
 */
export async function ensureBackupDirectory(): Promise<boolean> {
  try {
    const backupLocation = await getBackupLocation();
    const backupStorageType = await getBackupStorageType();

    try {
      await Filesystem.mkdir({
        path: backupLocation,
        directory: backupStorageType === 'external' ? Directory.External : Directory.Documents,
        recursive: true
      });
    } catch (error) {
      // 忽略"目录已存在"错误，这是正常情况
      const errorMsg = error instanceof Error ? error.message : String(error);
      if (errorMsg.includes('Directory exists')) {
        console.log('备份目录已存在，继续备份流程');
        return true;
      }
      throw error; // 其他错误则继续抛出
    }
    return true;
  } catch (error) {
    console.error('创建备份目录失败:', error);
    return false;
  }
}

/**
 * 复制文本到剪贴板
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  // 首先尝试使用Capacitor剪贴板API
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch (clipboardError) {
        console.warn('使用navigator.clipboard复制失败，尝试备用方法:', clipboardError);
        // 继续尝试其他方法
      }
    }

    // 备用方法1: 使用document.execCommand
    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.left = '-999999px';
      textarea.style.top = '-999999px';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      const success = document.execCommand('copy');
      document.body.removeChild(textarea);
      if (success) return true;
    } catch (execCommandError) {
      console.warn('使用document.execCommand复制失败:', execCommandError);
    }

    // 如果上述方法都失败，返回false
    console.warn('所有剪贴板方法都失败');
    return false;
  } catch (error) {
    console.error('复制到剪贴板操作失败:', error);
    return false;
  }
}

/**
 * 保存到下载目录
 */
export async function saveToDownloadDirectory(
  fileName: string,
  jsonString: string,
  onSuccess: (uri?: string, copied?: boolean) => void,
  onError: (error: Error) => void
): Promise<void> {
  try {
    // 确保下载目录存在
    const downloadDir = "Download";
    try {
      await Filesystem.mkdir({
        path: downloadDir,
        directory: Directory.External,
        recursive: true
      });
    } catch (mkdirError) {
      // 忽略"目录已存在"错误
      const errorMsg = mkdirError instanceof Error ? mkdirError.message : String(mkdirError);
      if (!errorMsg.includes('Directory exists')) {
        console.error('创建下载目录失败:', mkdirError);
      }
    }

    // 写入文件到下载目录
    const filePath = `${downloadDir}/${fileName}`;
    await Filesystem.writeFile({
      path: filePath,
      data: jsonString,
      directory: Directory.External,
      encoding: Encoding.UTF8
    });

    // 获取完整URI以显示
    const uriResult = await Filesystem.getUri({
      path: filePath,
      directory: Directory.External
    });

    if (uriResult && uriResult.uri) {
      // 尝试使用FileOpener打开文件所在目录
      try {
        await FileOpener.open({
          filePath: uriResult.uri,
          contentType: 'application/json'
        });

        const copied = await copyToClipboard(uriResult.uri);
        onSuccess(uriResult.uri, copied);
      } catch (openError) {
        console.error('打开文件失败，但文件已保存:', openError);

        let copied = false;
        try {
          copied = await copyToClipboard(uriResult.uri);
        } catch (clipboardError) {
          console.error('复制到剪贴板失败:', clipboardError);
        }

        // 即使FileOpener失败，仍然提示成功，但告知用户手动查找文件
        onSuccess(
          uriResult.uri,
          copied,
        );
      }
    } else {
      onSuccess();
    }
  } catch (error) {
    console.error('保存到下载目录失败:', error);

    // 回退到保存到内部存储根目录
    try {
      await Filesystem.writeFile({
        path: fileName,
        data: jsonString,
        directory: Directory.External,
        encoding: Encoding.UTF8
      });

      const uriResult = await Filesystem.getUri({
        path: fileName,
        directory: Directory.External
      });

      if (uriResult && uriResult.uri) {
        let copied = false;
        try {
          copied = await copyToClipboard(uriResult.uri);
        } catch (clipboardError) {
          console.error('复制到剪贴板失败:', clipboardError);
        }
        onSuccess(uriResult.uri, copied);
      } else {
        onSuccess();
      }
    } catch (fallbackError) {
      console.error('保存到内部存储根目录也失败:', fallbackError);
      onError(fallbackError instanceof Error ? fallbackError : new Error(String(fallbackError)));
    }
  }
}

/**
 * 处理话题数据，修复可能的问题并去重 - 使用统一的去重逻辑
 * @param topics 原始话题数组
 * @returns 处理后的话题数组
 */
function processTopics(topics: ChatTopic[]): ChatTopic[] {
  // 使用统一的话题验证和过滤逻辑
  return TopicStatsService.getValidTopics(topics);
}

/**
 * 从Dexie.js获取所有localStorage键值对
 * @param excludeKeys 排除的键
 * @returns 键值对对象
 */
export async function getLocalStorageItems(excludeKeys: string[] = []): Promise<Record<string, any>> {
  try {
    // 获取所有键
    const allKeys = await getAllStorageKeys();

    // 过滤排除的键
    const filteredKeys = allKeys.filter(key => !excludeKeys.includes(key));

    // 构建结果对象
    const result: Record<string, any> = {};

    // 遍历键并获取值
    for (const key of filteredKeys) {
      result[key] = await getStorageItem(key);
    }

    return result;
  } catch (error) {
    console.error('获取所有localStorage项失败:', error);
    return {};
  }
}

/**
 * 准备基础备份数据
 */
export async function prepareBasicBackupData(): Promise<{
  topics: ChatTopic[];
  assistants: Assistant[];
  timestamp: number;
  appInfo: {
    version: string;
    name: string;
    backupVersion: number;
    error?: string;
  };
}> {
  try {
    // 获取话题数据
    console.log('开始获取话题数据...');
    const topics = await dexieStorage.getAllTopics();
    console.log(`获取到 ${topics.length} 个话题`);

    // 获取助手数据
    console.log('开始获取助手数据...');
    const assistants = await dexieStorage.getAllAssistants();
    console.log(`获取到 ${assistants.length} 个助手`);

    // 处理话题数据 - 确保数据一致性
    const processedTopics = processTopics(topics);
    console.log(`处理后话题数量: ${processedTopics.length}`);

    // 构建备份数据
    const backupData = {
      topics: processedTopics,
      assistants,
      timestamp: Date.now(),
      appInfo: {
        version: '1.0.0', // 暂时硬编码，后续可从配置文件中读取
        name: 'AetherLink',
        backupVersion: CURRENT_BACKUP_VERSION
      }
    };

    return backupData;
  } catch (error) {
    console.error('准备备份数据时出错:', error);

    // 即使出错也返回空的备份结构
    return {
      topics: [],
      assistants: [],
      timestamp: Date.now(),
      appInfo: {
        version: '1.0.0',
        name: 'AetherLink',
        backupVersion: CURRENT_BACKUP_VERSION,
        error: error instanceof Error ? error.message : String(error)
      }
    };
  }
}

/**
 * 准备完整备份数据
 */
export async function prepareFullBackupData(): Promise<{
  topics: ChatTopic[];
  assistants: Assistant[];
  settings: any;
  backupSettings: any;
  localStorage: Record<string, any>;
  timestamp: number;
  appInfo: any;
}> {
  try {
    // 获取基础备份数据
    const basicData = await prepareBasicBackupData();

    // 获取设置数据
    const appSettings = await getStorageItem('settings') || {};

    // 获取备份设置
    const backupSettings = {
      location: await getBackupLocation(),
      storageType: await getBackupStorageType()
    };

    // 获取LocalStorage数据，排除一些敏感和不必要的项
    const excludeKeys = [
      // 排除敏感信息
      'apiKey', 'openaiKey', 'anthropicKey', 'googleAiKey', 'siliconstudioKey',
      'azureApiKey', 'awsAccessKey', 'awsSecretKey',

      // 排除临时性数据
      'currentChatId', '_lastSaved', '_sessionData', 'temp_', 'debug_',
      '_topicsLoaded',

      // 排除设置和备份设置（已单独保存）
      'settings', 'backup-location', 'backup-storage-type'
    ];

    const localStorageItems = await getLocalStorageItems(excludeKeys);

    // 构建完整备份数据
    const fullBackupData = {
      ...basicData,
      settings: appSettings,
      backupSettings,
      localStorage: localStorageItems,
      appInfo: {
        ...basicData.appInfo,
        fullBackup: true
      }
    };

    return fullBackupData;
  } catch (error) {
    console.error('准备完整备份数据时出错:', error);

    // 创建基础备份数据
    const basicData = await prepareBasicBackupData();

    // 即使出错也返回部分备份数据
    return {
      ...basicData,
      settings: {},
      backupSettings: {},
      localStorage: {},
      appInfo: {
        ...basicData.appInfo,
        fullBackup: true,
        error: error instanceof Error ? error.message : String(error)
      }
    };
  }
}

/**
 * Web端直接下载备份文件
 */
async function downloadBackupFileForWeb(
  fileName: string,
  jsonData: any,
  onSuccess: (message: string) => void,
  onError: (error: Error) => void,
  onBackupComplete?: () => void
): Promise<void> {
  try {
    const jsonString = JSON.stringify(jsonData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    // 创建下载链接
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.style.display = 'none';

    // 添加到DOM并触发下载
    document.body.appendChild(link);
    link.click();

    // 清理
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    // 通知成功
    onSuccess(`备份文件 ${fileName} 已下载到浏览器默认下载目录`);

    // 备份完成回调
    if (onBackupComplete) {
      setTimeout(() => {
        onBackupComplete();
      }, 500);
    }
  } catch (error) {
    console.error('Web端下载失败:', error);
    onError(error instanceof Error ? error : new Error('下载失败'));
  }
}

/**
 * 创建备份文件并共享
 */
export async function createAndShareBackupFile(
  fileName: string,
  jsonData: any,
  onSuccess: (message: string) => void,
  onError: (error: Error) => void,
  onBackupComplete?: () => void
): Promise<void> {
  // 检查是否为Web端，如果是则使用直接下载
  if (Capacitor.getPlatform() === 'web') {
    return downloadBackupFileForWeb(fileName, jsonData, onSuccess, onError, onBackupComplete);
  }

  // 移动端使用原有的分享逻辑
  try {
    console.log(`开始创建备份文件: ${fileName}`);
    const jsonString = JSON.stringify(jsonData, null, 2); // 使用格式化的JSON便于调试
    const tempPath = fileName;

    // 创建临时文件
    await Filesystem.writeFile({
      path: tempPath,
      data: jsonString,
      directory: Directory.Cache,
      encoding: Encoding.UTF8
    });
    console.log('已创建临时备份文件');

    // 获取临时文件URI
    const tempFileResult = await Filesystem.getUri({
      path: tempPath,
      directory: Directory.Cache
    });

    if (tempFileResult && tempFileResult.uri) {
      console.log(`临时文件URI: ${tempFileResult.uri}`);
      try {
        // 使用Share API调用系统的分享功能，确保提示用户选择位置
        await Share.share({
          title: '保存备份文件',
          text: '请选择位置保存备份文件',
          url: tempFileResult.uri,
          dialogTitle: '选择保存位置'
        });
        console.log('系统分享对话框已显示');

        // 备份完成后，通知调用者刷新文件列表
        if (onBackupComplete) {
          setTimeout(() => {
            onBackupComplete();
          }, 1000); // 稍微延迟以确保文件已保存
        }

        onSuccess('请在系统分享菜单中选择"保存到设备"或文件管理器应用');
      } catch (shareError) {
        // 分享可能被用户取消或失败
        console.error('分享文件失败:', shareError);
        const errorMsg = shareError instanceof Error ? shareError.message : String(shareError);

        // 如果是用户取消分享，不要视为错误，直接尝试其他方法
        if (errorMsg.includes('canceled') || errorMsg.includes('cancelled')) {
          console.log('用户取消了分享，尝试备用方法');

          // 备份完成后，仍然通知调用者刷新文件列表
          if (onBackupComplete) {
            onBackupComplete();
          }
        } else {
          // 其他错误则向用户显示
          onSuccess('分享功能不可用，尝试其他保存方法...');
        }

        // 尝试使用文件打开器
        try {
          await FileOpener.open({
            filePath: tempFileResult.uri,
            contentType: 'application/json'
          });
          console.log('已使用文件打开器打开文件');

          // 备份完成后，通知调用者刷新文件列表
          if (onBackupComplete) {
            setTimeout(() => {
              onBackupComplete();
            }, 1000);
          }

          onSuccess('文件已打开，请使用"另存为"保存到您想要的位置');
        } catch (openError) {
          console.error('打开文件失败:', openError);
          // 回退到保存到下载目录
          await saveToDownloadDirectory(
            fileName,
            jsonString,
            (uri, copied) => {
              if (uri) {
                onSuccess(`备份已保存到下载目录: ${uri}${copied ? '\n(已复制到剪贴板)' : '\n(请手动浏览文件管理器查看文件)'}`);
              } else {
                onSuccess('备份已保存到下载目录，请查看您的文件管理器');
              }

              // 备份完成后，通知调用者刷新文件列表
              if (onBackupComplete) {
                setTimeout(() => {
                  onBackupComplete();
                }, 1000);
              }
            },
            onError
          );
        }
      }
    } else {
      console.warn('无法获取临时文件URI，尝试直接保存到下载目录');
      // 无法获取临时文件URI，回退到下载目录
      await saveToDownloadDirectory(
        fileName,
        jsonString,
        (uri, copied) => {
          if (uri) {
            onSuccess(`备份已保存到下载目录: ${uri}${copied ? '\n(已复制到剪贴板)' : '\n(请手动浏览文件管理器查看文件)'}`);
          } else {
            onSuccess('备份已保存到下载目录，请查看您的文件管理器');
          }

          // 备份完成后，通知调用者刷新文件列表
          if (onBackupComplete) {
            setTimeout(() => {
              onBackupComplete();
            }, 1000);
          }
        },
        onError
      );
    }
  } catch (error) {
    console.error('创建备份文件失败:', error);
    onError(error instanceof Error ? error : new Error(String(error)));
  }
}

/**
 * 从Download目录获取备份文件列表
 */
export async function getBackupFilesList(): Promise<{name: string, path: string, uri: string, ctime: number}[]> {
  try {
    const downloadDir = "Download";

    // 检查目录是否存在
    try {
      const result = await Filesystem.readdir({
        path: downloadDir,
        directory: Directory.External
      });

      // 过滤只保留JSON备份文件
      const backupFiles = result.files.filter(file =>
        file.name.startsWith('AetherLink_Backup') &&
        file.name.endsWith('.json')
      );

      // 获取每个文件的详细信息和URI
      const fileDetailsPromises = backupFiles.map(async (file) => {
        try {
          const uriResult = await Filesystem.getUri({
            path: `${downloadDir}/${file.name}`,
            directory: Directory.External
          });

          const stat = await Filesystem.stat({
            path: `${downloadDir}/${file.name}`,
            directory: Directory.External
          });

          return {
            name: file.name,
            path: `${downloadDir}/${file.name}`,
            uri: uriResult.uri,
            ctime: stat.ctime || Date.now()
          };
        } catch (error) {
          console.error(`获取文件 ${file.name} 详情失败:`, error);
          return {
            name: file.name,
            path: `${downloadDir}/${file.name}`,
            uri: '',
            ctime: 0
          };
        }
      });

      const fileDetails = await Promise.all(fileDetailsPromises);

      // 按创建时间倒序排序
      return fileDetails.sort((a, b) => b.ctime - a.ctime);
    } catch (error) {
      // 目录可能不存在
      console.warn('读取备份目录失败，可能是目录不存在:', error);
      return [];
    }
  } catch (error) {
    console.error('获取备份文件列表失败:', error);
    return [];
  }
}