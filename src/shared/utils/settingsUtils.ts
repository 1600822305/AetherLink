/**
 * 设置工具函数
 * 提供读取和保存应用设置的工具函数
 */
import { getStorageItem, setStorageItem } from './storage';
import { createLogger } from '../services/infra/logger';
const logger = createLogger('Settings');

// 默认设置配置
const DEFAULT_SETTINGS = {
  streamOutput: true,
  showMessageDivider: true,
  copyableCodeBlocks: true,
  contextLength: 16000,
  contextCount: 20,
  mathRenderer: 'KaTeX',
  defaultThinkingEffort: 'medium',
  thinkingBudget: 1024,
  enableMaxOutputTokens: true
};

// 内存缓存，避免频繁异步读取
let settingsCache: Record<string, any> | null = null;
let cacheLoaded = false;

/**
 * 初始化设置缓存（应用启动时调用）
 */
export async function initSettingsCache(): Promise<void> {
  try {
    const stored = await getStorageItem<Record<string, any>>('appSettings');
    settingsCache = stored || { ...DEFAULT_SETTINGS };
    cacheLoaded = true;
  } catch (error) {
    logger.error('初始化设置缓存失败:', error);
    settingsCache = { ...DEFAULT_SETTINGS };
    cacheLoaded = true;
  }
}

/**
 * 获取设置值（同步，使用缓存）
 */
function getSettingValue<T>(key: string, defaultValue: T): T {
  if (!cacheLoaded || !settingsCache) {
    return defaultValue;
  }
  return settingsCache[key] !== undefined ? settingsCache[key] : defaultValue;
}

/**
 * 从Dexie读取流式输出设置
 * @returns 流式输出是否启用，默认为true
 */
export function getStreamOutputSetting(): boolean {
  return getSettingValue('streamOutput', true);
}

/**
 * 保存流式输出设置到Dexie
 * @param enabled 是否启用流式输出
 */
export async function setStreamOutputSetting(enabled: boolean): Promise<void> {
  try {
    const appSettings = await getAppSettingsAsync();
    appSettings.streamOutput = enabled;
    await saveAppSettings(appSettings);
    logger.debug(`流式输出设置已保存: ${enabled}`);
  } catch (error) {
    logger.error('保存流式输出设置失败:', error);
  }
}

/**
 * 从Dexie读取对话分割线设置
 * @returns 对话分割线是否启用，默认为true
 */
export function getMessageDividerSetting(): boolean {
  return getSettingValue('showMessageDivider', true);
}

/**
 * 保存消息分割线设置到Dexie
 * @param enabled 是否启用消息分割线
 */
export async function setMessageDividerSetting(enabled: boolean): Promise<void> {
  try {
    const appSettings = await getAppSettingsAsync();
    appSettings.showMessageDivider = enabled;
    await saveAppSettings(appSettings);
    logger.debug(`消息分割线设置已保存: ${enabled}`);
  } catch (error) {
    logger.error('保存消息分割线设置失败:', error);
  }
}

/**
 * 从Dexie读取所有应用设置（同步版本，使用缓存）
 * @returns 应用设置对象
 */
export function getAppSettings(): Record<string, any> {
  if (cacheLoaded && settingsCache) {
    return { ...settingsCache };
  }
  return { ...DEFAULT_SETTINGS };
}

/**
 * 从Dexie读取所有应用设置（异步版本）
 * @returns 应用设置对象
 */
export async function getAppSettingsAsync(): Promise<Record<string, any>> {
  try {
    const stored = await getStorageItem<Record<string, any>>('appSettings');
    if (stored) {
      settingsCache = stored;
      return stored;
    }
  } catch (error) {
    logger.error('读取应用设置失败:', error);
  }
  return { ...DEFAULT_SETTINGS };
}

/**
 * 保存应用设置到Dexie
 * @param settings 要保存的设置
 */
export async function saveAppSettings(settings: Record<string, any>): Promise<void> {
  try {
    await setStorageItem('appSettings', settings);
    settingsCache = settings; // 更新缓存
    logger.debug('应用设置已保存:', settings);
  } catch (error) {
    logger.error('保存应用设置失败:', error);
  }
}

/**
 * 获取默认思维链长度设置
 * @returns 思维链长度选项
 */
export function getDefaultThinkingEffort(): string {
  try {
    const appSettings = getAppSettings();
    return appSettings.defaultThinkingEffort || 'medium';
  } catch (error) {
    logger.error('读取思维链长度设置失败:', error);
    return 'medium';
  }
}

/**
 * 获取思考预算设置
 * @returns 思考预算值
 */
export function getThinkingBudget(): number {
  try {
    const appSettings = getAppSettings();
    return appSettings.thinkingBudget || 1024;
  } catch (error) {
    logger.error('读取思考预算设置失败:', error);
    return 1024;
  }
}

/**
 * 识别对话轮次结束
 * 判断当前消息是否是一轮对话的最后一条消息
 * @param messages 所有消息
 * @param currentIndex 当前消息的索引
 * @returns 是否应该显示对话分割线
 */
export function shouldShowConversationDivider(messages: any[], currentIndex: number): boolean {
  const currentMessage = messages[currentIndex];
  if (!currentMessage) return false;

  // 如果是最后一条消息，不显示分割线
  if (currentIndex === messages.length - 1) return false;

  // 如果当前消息是AI回复
  if (currentMessage.role === 'assistant') {
    // 检查下一条消息是否是用户消息（新的对话轮次开始）
    const nextMessage = messages[currentIndex + 1];
    if (nextMessage && nextMessage.role === 'user') {
      return true; // 在AI回复后，用户开始新对话时显示分割线
    }
  }

  return false;
}
