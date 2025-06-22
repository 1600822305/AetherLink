// import { saveTopicToDB, saveAssistantToDB } from '../../../../shared/services/storageService';
import type { ChatTopic } from '../../../../shared/types';
import type { Assistant } from '../../../../shared/types/Assistant';
import { CURRENT_BACKUP_VERSION } from './backupUtils';
import { importExternalBackup, type ImportMode } from './externalBackupUtils';
import { dexieStorage } from '../../../../shared/services/storage/DexieStorageService';
import { getStorageItem, setStorageItem, setStorageItems } from '../../../../shared/utils/storage';
import { getMainTextContent } from '../../../../shared/utils/messageUtils';

/**
 * 从文件中读取JSON内容
 */
export function readJSONFromFile(file: File): Promise<any> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const data = JSON.parse(content);
        resolve(data);
      } catch (error) {
        reject(new Error('无法解析备份文件，JSON格式无效'));
      }
    };

    reader.onerror = () => {
      reject(new Error('读取文件失败，请检查文件是否损坏'));
    };

    reader.readAsText(file);
  });
}

/**
 * 从文件中读取文本内容
 */
export function readTextFromFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        resolve(content);
      } catch (error) {
        reject(new Error('无法读取文本文件'));
      }
    };

    reader.onerror = () => {
      reject(new Error('读取文件失败，请检查文件是否损坏'));
    };

    reader.readAsText(file, 'utf-8');
  });
}

/**
 * 验证备份数据结构
 */
export function validateBackupData(data: any): boolean {
  if (!data) return false;

  // 检查基本数据结构
  const hasTopics = Array.isArray(data.topics);
  const hasAssistants = Array.isArray(data.assistants);
  const hasSettings = typeof data.settings === 'object' && data.settings !== null;

  // 检查选择性备份数据结构
  const hasModelConfig = typeof data.modelConfig === 'object' && data.modelConfig !== null;

  // 至少需要包含以下字段之一
  const hasRequiredFields = hasTopics || hasAssistants || hasSettings || hasModelConfig;

  // 检查appInfo信息
  const hasAppInfo = typeof data.appInfo === 'object' && data.appInfo !== null;

  // 基本验证通过
  if (hasRequiredFields && hasAppInfo) {
    console.log('备份数据基本验证通过');

    // 如果是选择性备份，记录备份类型
    if (data.appInfo.backupType === 'selective') {
      console.log('检测到选择性备份数据');
    }

    return true;
  }

  console.warn('备份数据验证失败，缺少必要字段');
  return false;
}

/**
 * 处理备份版本兼容性
 * 根据备份版本号处理可能的数据格式差异
 */
export function processBackupDataForVersion(data: any): any {
  const processedData = { ...data };

  // 获取备份版本
  const backupVersion =
    data.appInfo &&
    typeof data.appInfo.backupVersion === 'number' ?
    data.appInfo.backupVersion : 1;

  console.log(`处理备份数据，备份版本: ${backupVersion}`);

  // 处理旧版本备份数据升级
  if (backupVersion < CURRENT_BACKUP_VERSION) {
    console.log(`将备份数据从版本 ${backupVersion} 升级到 ${CURRENT_BACKUP_VERSION}`);

    // 处理话题数据
    if (Array.isArray(processedData.topics)) {
      processedData.topics = processedData.topics.map((topic: ChatTopic) => {
        // 创建话题的深拷贝，避免修改原始数据
        const processedTopic = { ...topic };

        // 确保消息数组存在
        if (Array.isArray(processedTopic.messages)) {
          // 处理消息数组 - 修复可能的状态问题
          processedTopic.messages = processedTopic.messages.map((msg: any) => {
            // 首先处理消息内容
            const mainTextContent = getMainTextContent(msg);
            const processedMsg = {
              ...msg,
              status: 'success', // 使用'success'替代'complete'
              // 确保使用块系统
              blocks: msg.blocks || [{
                id: `block-restore-${Math.random().toString(36).substring(2, 10)}`,
                messageId: msg.id,
                type: 'main_text',
                content: (!mainTextContent ||
                  mainTextContent === '很抱歉，请求处理失败，请稍后再试。' ||
                  mainTextContent === '网络连接问题，请检查网络并重试' ||
                  mainTextContent === 'API密钥无效或已过期，请更新API密钥' ||
                  mainTextContent === '请求超时，服务器响应时间过长' ||
                  mainTextContent.includes('请求失败') ||
                  mainTextContent.includes('错误')
                )
                  ? '恢复成功，以前的内容不可见，继续聊天吧...'
                  : mainTextContent,
                createdAt: msg.createdAt || (msg as any).timestamp || new Date().toISOString(),
                status: 'success'
              }]
            };

            // 移除不兼容的字段
            delete processedMsg.alternateVersions;
            delete processedMsg.version;
            delete processedMsg.isCurrentVersion;
            delete processedMsg.content; // 删除旧的content字段，仅使用blocks

            return processedMsg as any; // 使用类型断言避免严格类型检查
          });
        } else {
          // 如果消息数组不存在，初始化为空数组
          processedTopic.messages = [];
        }

        // 确保话题有标题
        if (!processedTopic.title) {
          processedTopic.title = '未命名对话';
        }

        // 如果没有最后消息时间，使用当前时间
        if (!processedTopic.lastMessageTime) {
          processedTopic.lastMessageTime = new Date().toISOString();
        }

        return processedTopic;
      });
    }

    // 标准化设置对象（如果存在）
    if (processedData.settings) {
      processedData.settings = {
        ...processedData.settings,
        providers: processedData.settings.providers || [],
        models: processedData.settings.models || [],
        defaultModelId: processedData.settings.defaultModelId,
        currentModelId: processedData.settings.currentModelId,
        theme: processedData.settings.theme || 'system',
        fontSize: processedData.settings.fontSize || 16,
        language: processedData.settings.language || 'zh-CN',
        sendWithEnter: processedData.settings.sendWithEnter !== undefined ?
          processedData.settings.sendWithEnter : true,
        enableNotifications: processedData.settings.enableNotifications !== undefined ?
          processedData.settings.enableNotifications : true,
        generatedImages: processedData.settings.generatedImages || [],
      };
    }

    // 更新备份版本信息
    if (processedData.appInfo) {
      processedData.appInfo.backupVersion = CURRENT_BACKUP_VERSION;
      processedData.appInfo.migratedFrom = backupVersion;
      processedData.appInfo.migrationDate = new Date().toISOString();
    }
  }

  return processedData;
}

/**
 * 清除所有话题
 */
export async function clearTopics(): Promise<void> {
  try {
    console.log('开始清除所有话题...');
    await dexieStorage.topics.clear();
    console.log('所有话题已清除');
  } catch (error) {
    console.error('清除话题时出错:', error);
    throw new Error(`清除话题时出错: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * 清除所有助手
 */
export async function clearAssistants(): Promise<void> {
  try {
    console.log('开始清除所有助手...');
    await dexieStorage.assistants.clear();
    console.log('所有助手已清除');
  } catch (error) {
    console.error('清除助手时出错:', error);
    throw new Error(`清除助手时出错: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * 恢复话题数据
 * @param topics 要恢复的话题数组
 * @returns 恢复成功的话题数量
 */
export async function restoreTopics(topics: ChatTopic[]): Promise<number> {
  try {
    if (!Array.isArray(topics) || topics.length === 0) {
      console.log('没有话题需要恢复');
      return 0;
    }

    console.log(`开始恢复 ${topics.length} 个话题...`);
    let successCount = 0;

    for (const topic of topics) {
      if (!topic.id) {
        console.warn('跳过无效话题: 缺少ID');
        continue;
      }
      try {
        // 保存话题
        await dexieStorage.saveTopic(topic);

        // 如果话题包含消息，也要保存到messages表
        if (topic.messages && Array.isArray(topic.messages) && topic.messages.length > 0) {
          console.log(`保存话题 ${topic.id} 的 ${topic.messages.length} 条消息到messages表...`);
          for (const message of topic.messages) {
            try {
              await dexieStorage.saveMessage(message);
            } catch (messageError) {
              console.error(`保存消息 ${message.id} 时出错:`, messageError);
            }
          }
        }

        successCount++;
      } catch (error) {
        console.error(`保存话题 ${topic.id} 时出错:`, error);
      }
    }

    console.log(`话题恢复完成，成功: ${successCount}/${topics.length}`);
    return successCount;
  } catch (error) {
    console.error('恢复话题时出错:', error);
    throw new Error(`恢复话题时出错: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * 恢复助手数据
 * @param assistants 要恢复的助手数组
 * @returns 恢复成功的助手数量
 */
export async function restoreAssistants(assistants: Assistant[]): Promise<number> {
  try {
    if (!Array.isArray(assistants) || assistants.length === 0) {
      console.log('没有助手需要恢复');
      return 0;
    }

    console.log(`开始恢复 ${assistants.length} 个助手...`);
    let successCount = 0;

    for (const assistant of assistants) {
      if (!assistant.id) {
        console.warn('跳过无效助手: 缺少ID');
        continue;
      }
      try {
        await dexieStorage.saveAssistant(assistant);
        successCount++;
      } catch (error) {
        console.error(`保存助手 ${assistant.id} 时出错:`, error);
      }
    }

    console.log(`助手恢复完成，成功: ${successCount}/${assistants.length}`);
    return successCount;
  } catch (error) {
    console.error('恢复助手时出错:', error);
    throw new Error(`恢复助手时出错: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * 恢复设置
 */
export async function restoreSettings(
  backupSettings: any,
  currentSettings: any = {}
): Promise<boolean> {
  try {
    if (!backupSettings) {
      console.warn('没有设置需要恢复');
      return false;
    }

    console.log('开始恢复设置...');

    // 合并当前设置和备份设置
    const mergedSettings = {
      ...currentSettings,
      ...backupSettings
    };

    // 确保关键字段存在
    const finalSettings = {
      ...mergedSettings,
      providers: mergedSettings.providers || [],
      models: mergedSettings.models || [],
      theme: mergedSettings.theme || 'system',
      fontSize: mergedSettings.fontSize || 16,
      language: mergedSettings.language || 'zh-CN',
      sendWithEnter: mergedSettings.sendWithEnter !== undefined ? mergedSettings.sendWithEnter : true
    };

    // 保存设置到数据库
    await setStorageItem('settings', finalSettings);

    console.log('设置恢复完成');
    return true;
  } catch (error) {
    console.error('恢复设置时出错:', error);
    return false;
  }
}

/**
 * 恢复模型配置（选择性备份专用）
 */
export async function restoreModelConfig(
  modelConfigData: any,
  currentSettings: any = {}
): Promise<boolean> {
  try {
    if (!modelConfigData) {
      console.warn('没有模型配置需要恢复');
      return false;
    }

    console.log('开始恢复模型配置...');

    // 合并当前设置和模型配置
    const mergedSettings = {
      ...currentSettings,
      // 恢复模型相关配置
      providers: modelConfigData.providers || currentSettings.providers || [],
      models: modelConfigData.models || currentSettings.models || [],
      defaultModelId: modelConfigData.defaultModelId || currentSettings.defaultModelId,
      currentModelId: modelConfigData.currentModelId || currentSettings.currentModelId,
      webSearch: modelConfigData.webSearch || currentSettings.webSearch,
    };

    // 如果有模型类型规则，也恢复
    if (modelConfigData.modelTypeRules) {
      mergedSettings.modelTypeRules = modelConfigData.modelTypeRules;
    }

    // 保存设置到数据库
    await setStorageItem('settings', mergedSettings);

    console.log('模型配置恢复完成');
    return true;
  } catch (error) {
    console.error('恢复模型配置时出错:', error);
    return false;
  }
}

/**
 * 恢复备份设置
 */
export async function restoreBackupSettings(backupSettings: { location?: string; storageType?: string }): Promise<boolean> {
  try {
    if (!backupSettings) {
      console.warn('没有备份设置需要恢复');
      return false;
    }

    console.log('开始恢复备份设置...');

    // 保存备份位置
    if (backupSettings.location) {
      await setStorageItem('backup-location', backupSettings.location);
    }

    // 保存备份存储类型
    if (backupSettings.storageType) {
      await setStorageItem('backup-storage-type', backupSettings.storageType);
    }

    console.log('备份设置恢复完成');
    return true;
  } catch (error) {
    console.error('恢复备份设置时出错:', error);
    return false;
  }
}

/**
 * 恢复LocalStorage项
 */
export async function restoreLocalStorageItems(items: Record<string, any>): Promise<number> {
  try {
    if (!items || Object.keys(items).length === 0) {
      console.warn('没有LocalStorage项需要恢复');
      return 0;
    }

    console.log(`开始恢复 ${Object.keys(items).length} 个本地存储项...`);

    // 排除一些不应恢复的敏感键
    const excludeKeys = [
      // 敏感信息不恢复
      'apiKey', 'openaiKey', 'anthropicKey', 'googleAiKey', 'siliconstudioKey',
      'azureApiKey', 'awsAccessKey', 'awsSecretKey',

      // 设置相关项（已单独恢复）
      'settings', 'backup-location', 'backup-storage-type',

      // 临时状态
      'currentChatId', '_sessionData', '_topicsLoaded', '_lastSaved'
    ];

    // 过滤排除项
    const filteredItems: Record<string, any> = {};
    let count = 0;

    for (const [key, value] of Object.entries(items)) {
      if (!excludeKeys.includes(key)) {
        filteredItems[key] = value;
        count++;
      }
    }

    // 批量保存到数据库
    await setStorageItems(filteredItems);

    console.log(`${count} 个本地存储项恢复完成`);
    return count;
  } catch (error) {
    console.error('恢复LocalStorage项时出错:', error);
    return 0;
  }
}

/**
 * 执行完整备份恢复（支持选择性备份）
 */
export async function performFullRestore(
  backupData: any,
  onProgress?: (stage: string, progress: number) => void
): Promise<{
  success: boolean;
  topicsCount: number;
  assistantsCount: number;
  settingsRestored: boolean;
  modelConfigRestored: boolean;
  localStorageCount: number;
  backupType: string;
  error?: string;
}> {
  try {
    // 验证备份数据
    if (!validateBackupData(backupData)) {
      throw new Error('备份数据格式无效');
    }

    onProgress?.('处理备份数据', 0.15);

    // 检测备份类型
    const backupType = backupData.appInfo?.backupType || 'full';
    const isSelectiveBackup = backupType === 'selective';

    // 处理备份数据的版本兼容性
    const processedData = processBackupDataForVersion(backupData);

    // 获取当前设置
    const currentSettings = await getStorageItem('settings') || {};

    let topicsCount = 0;
    let assistantsCount = 0;
    let settingsRestored = false;
    let modelConfigRestored = false;

    if (isSelectiveBackup) {
      // 选择性备份恢复逻辑
      console.log('执行选择性备份恢复');

      if (processedData.modelConfig) {
        onProgress?.('恢复模型配置', 0.5);
        modelConfigRestored = await restoreModelConfig(processedData.modelConfig, currentSettings);
      }

      // 选择性备份可能包含其他数据类型
      if (processedData.topics) {
        onProgress?.('恢复话题数据', 0.3);
        topicsCount = await restoreTopics(processedData.topics);
      }

      if (processedData.assistants) {
        onProgress?.('恢复助手数据', 0.4);
        assistantsCount = await restoreAssistants(processedData.assistants);
      }
    } else {
      // 完整备份恢复逻辑
      console.log('执行完整备份恢复');

      onProgress?.('恢复话题数据', 0.2);
      topicsCount = await restoreTopics(processedData.topics);

      onProgress?.('恢复助手数据', 0.4);
      assistantsCount = await restoreAssistants(processedData.assistants);

      onProgress?.('恢复设置数据', 0.6);
      settingsRestored = processedData.settings ?
        await restoreSettings(processedData.settings, currentSettings) :
        false;
    }

    onProgress?.('恢复备份设置', 0.7);

    // 恢复备份设置
    if (processedData.backupSettings) {
      await restoreBackupSettings(processedData.backupSettings);
    }

    onProgress?.('恢复其他数据', 0.8);

    // 恢复其他localStorage项
    const localStorageCount = processedData.localStorage ?
      await restoreLocalStorageItems(processedData.localStorage) :
      0;

    onProgress?.('完成恢复', 0.95);

    // 延迟一下以确保所有异步操作完成
    await new Promise(resolve => setTimeout(resolve, 200));

    // 恢复完成
    onProgress?.('恢复完成', 1.0);

    return {
      success: true,
      topicsCount,
      assistantsCount,
      settingsRestored,
      modelConfigRestored,
      localStorageCount,
      backupType
    };
  } catch (error) {
    console.error('执行完整恢复时出错:', error);
    return {
      success: false,
      topicsCount: 0,
      assistantsCount: 0,
      settingsRestored: false,
      modelConfigRestored: false,
      localStorageCount: 0,
      backupType: 'unknown',
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * 从文件中读取外部AI软件的内容并导入
 */
export async function importExternalBackupFromFile(
  file: File,
  importMode: ImportMode = 'separate'
): Promise<{
  success: boolean;
  topicsCount: number;
  assistantsCount: number;
  source: string;
  error?: string;
}> {
  try {
    let data: any;

    // 根据文件类型读取数据
    if (file.name.toLowerCase().endsWith('.txt')) {
      // 读取 TXT 文件
      data = await readTextFromFile(file);
    } else {
      // 读取 JSON 文件
      data = await readJSONFromFile(file);
    }

    // 尝试识别并导入外部备份
    const { topics, assistants, source, messageBlocks } = await importExternalBackup(data, importMode);

    // 恢复消息块（必须在话题之前）
    if (messageBlocks && messageBlocks.length > 0) {
      console.log(`开始恢复 ${messageBlocks.length} 个消息块...`);
      await dexieStorage.bulkSaveMessageBlocks(messageBlocks);
      console.log('消息块恢复完成');
    }

    // 恢复话题
    const topicsCount = await restoreTopics(topics);

    // 恢复助手
    const assistantsCount = await restoreAssistants(assistants);

    return {
      success: true,
      topicsCount,
      assistantsCount,
      source
    };
  } catch (error) {
    console.error('导入外部备份失败:', error);
    return {
      success: false,
      topicsCount: 0,
      assistantsCount: 0,
      source: 'unknown',
      error: error instanceof Error ? error.message : '导入外部备份失败'
    };
  }
}

/**
 * 清空所有数据
 * 非常危险，请谨慎使用
 */
export async function clearAllData(): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    console.log('开始清空所有数据...');

    // 清空所有表
    await dexieStorage.clearDatabase();

    console.log('所有数据库数据已清空');
    return {
      success: true
    };
  } catch (error) {
    console.error('清空数据时出错:', error);
    return {
      success: false,
      error: `清空数据时出错: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}