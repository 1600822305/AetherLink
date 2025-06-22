/**
 * 增强的 API 提供商服务
 * 支持多 Key 负载均衡、故障转移和智能重试
 */

import type { Model } from '../../types';
import type { ApiKeyConfig, ModelProvider } from '../../config/defaultModels';
import ApiKeyManager from '../ApiKeyManager';
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
        console.log(`[EnhancedApiProvider] 尝试使用 Key: ${selectedKey.name || selectedKey.id} (${keySelection.reason})`);
        
        // 执行 API 调用
        const result = await apiCall(selectedKey.key);
        
        // 更新 Key 使用统计
        const updatedKey = this.keyManager.updateKeyStatus(selectedKey, true);
        this.updateProviderKey(provider, updatedKey);
        
        // 记录成功使用
        this.keyManager.recordKeyUsage(selectedKey.id, true);
        onKeyUsed?.(selectedKey.id, true);

        console.log(`[EnhancedApiProvider] API 调用成功，使用 Key: ${selectedKey.name || selectedKey.id}`);
        
        return {
          success: true,
          data: result,
          keyUsed: selectedKey.id,
          retryCount: attempt
        };

      } catch (error) {
        retryCount = attempt + 1;
        lastError = error instanceof Error ? error.message : String(error);
        
        console.error(`[EnhancedApiProvider] API 调用失败 (尝试 ${attempt + 1}/${maxRetries}):`, lastError);
        
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
      console.log('[EnhancedApiProvider] 多 Key 调用失败，尝试回退到单 Key 模式');
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
        console.log(`[EnhancedApiProvider] 单 Key 模式调用 (尝试 ${attempt + 1}/${maxRetries})`);
        
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
        
        console.error(`[EnhancedApiProvider] 单 Key 调用失败 (尝试 ${attempt + 1}/${maxRetries}):`, lastError);
        
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
   */
  private updateProviderInStore(provider: ModelProvider): void {
    try {
      // 动态导入 store 和 action 以避免循环依赖
      Promise.all([
        import('../../store'),
        import('../../store/settingsSlice')
      ]).then(([storeModule, settingsModule]) => {
        const store = storeModule.default; // store 是默认导出
        const { updateProvider } = settingsModule;

        store.dispatch(updateProvider({
          id: provider.id,
          updates: {
            apiKeys: provider.apiKeys,
            keyManagement: provider.keyManagement
          }
        }));
      }).catch(error => {
        console.error('[EnhancedApiProvider] 动态导入失败:', error);
      });
    } catch (error) {
      console.error('[EnhancedApiProvider] 更新 Redux store 失败:', error);
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
