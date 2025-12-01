/**
 * Clients 模块导出
 * 
 * 使用方式:
 * import { BaseApiClient, ApiClientFactory, registerClient } from '@/shared/aiCore/clients';
 */

// 导出 base 模块
export * from './base';

// 导出注册表
export { ClientRegistry, type ClientCreator } from './registry';

// 导出工厂
export {
  ApiClientFactory,
  initializeDefaultClients,
  registerClient,
  addProviderMapping,
  resetFactory,
  isFactoryInitialized,
} from './factory';

// 导出具体客户端
export { OpenAIClient } from './openai';
export { GeminiClient } from './gemini';

// 导出模型组合
export {
  ComboExecutor,
  type ComboModelConfig,
  type ComboStrategy,
  type ModelComboConfig,
  type ComboExecutionResult,
} from './combo';
