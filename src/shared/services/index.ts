import { storageService } from './storage/storageService';
import { AssistantService } from './assistant';
import { dexieStorage } from './storage/DexieStorageService';
import { EventEmitter, EVENT_NAMES } from './infra/EventService';
import { EnhancedNetworkService } from './network';
import { createLogger } from './infra/logger';

const logger = createLogger('Services');

// 导出核心服务
export {
  storageService,
  AssistantService,
  dexieStorage,
  EventEmitter,
  EVENT_NAMES
};

// 导出数据管理（已提取到独立模块）
export { DataManager } from './storage/DataManager';

// 导出状态栏服务
export { statusBarService, StatusBarService } from './platform/StatusBarService';

// 导出所有服务模块
export * from './messages';
export * from './network';
export * from './knowledge';
export * from './topics';

/**
 * 初始化所有服务
 * 应在应用启动时调用
 */
export async function initializeServices(): Promise<void> {
  try {
    // 初始化开发者工具服务
    try {
      // 阶段6：日志查看器改读统一 logger 的内存缓冲；
      // 噪音过滤与全局错误捕获从旧 EnhancedConsoleService 迁入新日志系统
      const { installConsoleNoiseFilter } = await import('./infra/logger/consoleNoiseFilter');
      const { installGlobalErrorCapture } = await import('./infra/logger/globalErrorCapture');
      installConsoleNoiseFilter();
      installGlobalErrorCapture();
      logger.debug('日志查看器与全局错误捕获初始化完成');

      EnhancedNetworkService.getInstance();
      logger.debug('网络拦截服务初始化完成');
    } catch (devToolsError) {
      logger.warn('开发者工具服务初始化失败:', devToolsError);
    }

    // 初始化TTS服务（逻辑已提取到 tts-v2/initTTS.ts）
    try {
      const { initTTS } = await import('./tts-v2/initTTS');
      await initTTS();
    } catch (ttsError) {
      logger.warn('TTS服务配置初始化失败:', ttsError);
    }

    // 系统提示词服务现在通过Redux thunk初始化
    logger.debug('服务初始化完成');
  } catch (error) {
    logger.error('服务初始化失败:', error);
  }
}