/**
 * 增强的 API 提供商服务
 * 支持多 Key 负载均衡、故障转移和智能重试
 */

import type { Model } from '../../types';
import type { ApiKeyConfig, ModelProvider } from '../../config/defaultModels';
import ApiKeyManager from '../ai/ApiKeyManager';
import { createLogger } from '../infra/logger';

const logger = createLogger('EnhancedApiProvider');
// import { ApiProviderRegistry } from './messages/ApiProvider'; // 暂时注释掉未使用的导入

export interface EnhancedApiCallOptions {
  maxRetries?: number;
  retryDelay?: number;
  enableFallback?: boolean;
  onKeyUsed?: (keyId: string, success: boolean, error?: string) => void;
}

export interface ApiCallResult {
  success: boolean;
  data?: any;
  error?: string;
  keyUsed?: string;
  retryCount?: number;
}

export class EnhancedApiProvider {
  private keyManager: ApiKeyManager;

  constructor() {
    this.keyManager = ApiKeyManager.getInstance();
  }

  /**
   * 增强的 API 调用方法，支持多 Key 负载均衡
   */
  async callWithMultiKey(
    provider: ModelProvider,
    model: Model,
    apiCall: (apiKey: string) => Promise<any>,
    options: EnhancedApiCallOptions = {}
  ): Promise<ApiCallResult> {
    const {
      maxRetries = 3,
      retryDelay = 1000,
      enableFallback = true,
      onKeyUsed
    } = options;

    // 如果没有配置多 Key，使用传统的单 Key 模式
    if (!provider.apiKeys || provider.apiKeys.length === 0) {
      return this.callWithSingleKey(model, apiCall, options);
    }

    let lastError: string = '';
    let retryCount = 0;

    // 尝试使用多个 Key
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      // 选择一个可用的 Key
      const keySelection = this.keyManager.selectApiKey(
        provider.apiKeys,
        provider.keyManagement?.strategy || 'round_robin'
      );

      if (!keySelection.key) {
        lastError = keySelection.reason;
        break;
      }

      const selectedKey = keySelection.key;

      try {
        logger.debug(`尝试使用 Key: ${selectedKey.name || selectedKey.id} (${keySelection.reason})`);
        
        // 执行 API 调用
        const result = await apiCall(selectedKey.key);
        
        // 更新 Key 使用统计
        const updatedKey = this.keyManager.updateKeyStatus(selectedKey, true);
        this.updateProviderKey(provider, updatedKey);
        
        // 记录成功使用
        this.keyManager.recordKeyUsage(selectedKey.id, true);
        onKeyUsed?.(selectedKey.id, true);

        logger.debug(`API 调用成功，使用 Key: ${selectedKey.name || selectedKey.id}`);
        
        return {
          success: true,
          data: result,
          keyUsed: selectedKey.id,
          retryCount: attempt
        };

      } catch (error) {
        retryCount = attempt + 1;
        lastError = error instanceof Error ? error.message : String(error);
        
        logger.error(`API 调用失败 (尝试 ${attempt + 1}/${maxRetries}):`, lastError);
        
        // 更新 Key 失败统计
        const updatedKey = this.keyManager.updateKeyStatus(selectedKey, false, lastError);
        this.updateProviderKey(provider, updatedKey);
        
        // 记录失败使用
        this.keyManager.recordKeyUsage(selectedKey.id, false, lastError);
        onKeyUsed?.(selectedKey.id, false, lastError);

        // 如果不是最后一次尝试，等待一段时间后重试
        if (attempt < maxRetries - 1) {
          await this.delay(retryDelay * (attempt + 1)); // 指数退避
        }
      }
    }

    // 如果启用了回退机制且有单个 Key 配置，尝试使用单个 Key
    if (enableFallback && provider.apiKey) {
      logger.debug('多 Key 调用失败，尝试回退到单 Key 模式');
      return this.callWithSingleKey(model, apiCall, options);
    }

    return {
      success: false,
      error: `所有 API Key 调用失败。最后错误: ${lastError}`,
      retryCount
    };
  }

  /**
   * 传统的单 Key API 调用
   */
  private async callWithSingleKey(
    model: Model,
    apiCall: (apiKey: string) => Promise<any>,
    options: EnhancedApiCallOptions = {}
  ): Promise<ApiCallResult> {
    const { maxRetries = 3, retryDelay = 1000, onKeyUsed } = options;

    if (!model.apiKey) {
      return {
        success: false,
        error: '未配置 API Key'
      };
    }

    let lastError: string = '';

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        logger.debug(`单 Key 模式调用 (尝试 ${attempt + 1}/${maxRetries})`);
        
        const result = await apiCall(model.apiKey);
        
        onKeyUsed?.('single-key', true);
        
        return {
          success: true,
          data: result,
          keyUsed: 'single-key',
          retryCount: attempt
        };

      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
        
        logger.error(`单 Key 调用失败 (尝试 ${attempt + 1}/${maxRetries}):`, lastError);
        
        onKeyUsed?.('single-key', false, lastError);

        if (attempt < maxRetries - 1) {
          await this.delay(retryDelay * (attempt + 1));
        }
      }
    }

    return {
      success: false,
      error: `API 调用失败: ${lastError}`,
      retryCount: maxRetries
    };
  }

  /**
   * 更新供应商中的 Key 配置
   */
  private updateProviderKey(provider: ModelProvider, updatedKey: ApiKeyConfig): void {
    if (provider.apiKeys) {
      const keyIndex = provider.apiKeys.findIndex(k => k.id === updatedKey.id);
      if (keyIndex !== -1) {
        // 创建新的数组，避免修改只读属性
        const newApiKeys = [...provider.apiKeys];
        newApiKeys[keyIndex] = updatedKey;

        // 创建新的供应商对象
        const updatedProvider = {
          ...provider,
          apiKeys: newApiKeys
        };

        // 更新 Redux store 中的供应商配置
        this.updateProviderInStore(updatedProvider);
      }
    }
  }

  /**
   * 更新 Redux store 中的供应商配置
   * 注意：这里不直接导入 store 以避免循环依赖，而是通过回调方式处理
   */
  private updateProviderInStore(provider: ModelProvider): void {
    try {
      // 通过事件系统或回调方式通知外部更新 store，避免直接导入
      // 这里可以发出一个自定义事件，由外部监听并处理 store 更新
      const updateEvent = new CustomEvent('provider-config-update', {
        detail: {
          providerId: provider.id,
          updates: {
            apiKeys: provider.apiKeys,
            keyManagement: provider.keyManagement
          }
        }
      });

      // 如果在浏览器环境中，发出事件
      if (typeof window !== 'undefined') {
        window.dispatchEvent(updateEvent);
      }

      logger.debug('已发出供应商配置更新事件:', provider.id);
    } catch (error) {
      logger.error('更新供应商配置失败:', error);
    }
  }

  /**
   * 延迟函数
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 获取供应商的 Key 统计信息
   */
  getProviderKeyStats(provider: ModelProvider): {
    totalKeys: number;
    activeKeys: number;
    errorKeys: number;
    totalRequests: number;
    successRate: number;
  } {
    if (!provider.apiKeys || provider.apiKeys.length === 0) {
      return {
        totalKeys: 0,
        activeKeys: 0,
        errorKeys: 0,
        totalRequests: 0,
        successRate: 0
      };
    }

    const stats = this.keyManager.getKeyStats(provider.apiKeys);
    return {
      totalKeys: stats.total,
      activeKeys: stats.active,
      errorKeys: stats.error,
      totalRequests: stats.totalRequests,
      successRate: stats.successRate
    };
  }

  /**
   * 检查供应商是否有可用的 Key
   */
  hasAvailableKeys(provider: ModelProvider): boolean {
    if (!provider.apiKeys || provider.apiKeys.length === 0) {
      return !!provider.apiKey; // 回退到单 Key 模式
    }

    return provider.apiKeys.some(key => 
      key.isEnabled && 
      key.status === 'active'
    );
  }

  /**
   * 获取下一个可用的 Key
   */
  getNextAvailableKey(provider: ModelProvider): ApiKeyConfig | null {
    if (!provider.apiKeys || provider.apiKeys.length === 0) {
      return null;
    }

    const keySelection = this.keyManager.selectApiKey(
      provider.apiKeys,
      provider.keyManagement?.strategy || 'round_robin'
    );

    return keySelection.key;
  }

  /**
   * 重置所有 Key 的错误状态（用于手动恢复）
   */
  resetKeyErrors(provider: ModelProvider): void {
    if (provider.apiKeys) {
      provider.apiKeys.forEach(key => {
        if (key.status === 'error') {
          key.status = 'active';
          key.usage.consecutiveFailures = 0;
          key.lastError = undefined;
          key.updatedAt = Date.now();
        }
      });
    }
  }


}

export default EnhancedApiProvider;
