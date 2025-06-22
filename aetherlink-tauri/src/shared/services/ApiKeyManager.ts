/**
 * API Key 管理服务
 * 负责多 Key 的负载均衡、故障转移和状态管理
 */

import type { ApiKeyConfig } from '../config/defaultModels';

export type LoadBalanceStrategy = 'round_robin' | 'priority' | 'least_used' | 'random';

export interface KeySelectionResult {
  key: ApiKeyConfig | null;
  reason: string;
}

export class ApiKeyManager {
  private static instance: ApiKeyManager;
  private keyUsageMap = new Map<string, number>(); // 记录每个 Key 的使用次数
  private roundRobinIndexMap = new Map<string, number>(); // 记录每个供应商的轮询索引

  static getInstance(): ApiKeyManager {
    if (!ApiKeyManager.instance) {
      ApiKeyManager.instance = new ApiKeyManager();
    }
    return ApiKeyManager.instance;
  }

  /**
   * 根据策略选择可用的 API Key
   */
  selectApiKey(
    keys: ApiKeyConfig[],
    strategy: LoadBalanceStrategy = 'round_robin'
  ): KeySelectionResult {
    // 过滤出可用的 Key
    const availableKeys = keys.filter(key => 
      key.isEnabled && 
      key.status === 'active' &&
      !this.isKeyInCooldown(key)
    );

    if (availableKeys.length === 0) {
      return {
        key: null,
        reason: '没有可用的 API Key'
      };
    }

    let selectedKey: ApiKeyConfig;

    switch (strategy) {
      case 'priority':
        selectedKey = this.selectByPriority(availableKeys);
        break;
      case 'least_used':
        selectedKey = this.selectByLeastUsed(availableKeys);
        break;
      case 'random':
        selectedKey = this.selectByRandom(availableKeys);
        break;
      case 'round_robin':
      default:
        selectedKey = this.selectByRoundRobin(availableKeys);
        break;
    }

    return {
      key: selectedKey,
      reason: `使用 ${strategy} 策略选择`
    };
  }

  /**
   * 按优先级选择 Key
   */
  private selectByPriority(keys: ApiKeyConfig[]): ApiKeyConfig {
    return keys.sort((a, b) => a.priority - b.priority)[0];
  }

  /**
   * 按使用次数最少选择 Key
   */
  private selectByLeastUsed(keys: ApiKeyConfig[]): ApiKeyConfig {
    return keys.sort((a, b) => a.usage.totalRequests - b.usage.totalRequests)[0];
  }

  /**
   * 随机选择 Key
   */
  private selectByRandom(keys: ApiKeyConfig[]): ApiKeyConfig {
    const randomIndex = Math.floor(Math.random() * keys.length);
    return keys[randomIndex];
  }

  /**
   * 轮询选择 Key - 真正的轮询实现，类似 Python 的 itertools.cycle()
   */
  private selectByRoundRobin(keys: ApiKeyConfig[]): ApiKeyConfig {
    // 按 ID 排序确保一致性
    const sortedKeys = keys.sort((a, b) => a.id.localeCompare(b.id));

    if (sortedKeys.length === 0) {
      throw new Error('没有可用的 Key');
    }

    // 生成一个唯一的键组标识符
    const keyGroupId = sortedKeys.map(k => k.id).join('|');

    // 获取当前轮询索引
    let currentIndex = this.roundRobinIndexMap.get(keyGroupId) || 0;

    // 选择当前索引对应的 Key
    const selectedKey = sortedKeys[currentIndex];

    // 更新索引到下一个位置（循环）
    const nextIndex = (currentIndex + 1) % sortedKeys.length;
    this.roundRobinIndexMap.set(keyGroupId, nextIndex);

    console.log(`[ApiKeyManager] 🔄 轮询选择: ${selectedKey.name || selectedKey.id.substring(0, 8)}... (索引: ${currentIndex}/${sortedKeys.length - 1}, 下次索引: ${nextIndex})`);

    return selectedKey;
  }

  /**
   * 记录 Key 使用
   */
  recordKeyUsage(keyId: string, success: boolean, error?: string): void {
    const currentUsage = this.keyUsageMap.get(keyId) || 0;
    this.keyUsageMap.set(keyId, currentUsage + 1);

    // 记录使用统计
    const statusText = success ? '✅ 成功' : '❌ 失败';
    const errorText = error ? ` - ${error}` : '';
    console.log(`[ApiKeyManager] Key 使用记录: ${keyId.substring(0, 8)}... ${statusText}${errorText}`);
  }

  /**
   * 更新 Key 状态
   */
  updateKeyStatus(key: ApiKeyConfig, success: boolean, error?: string): ApiKeyConfig {
    const now = Date.now();
    const updatedKey = { ...key };

    // 更新使用统计
    updatedKey.usage = {
      ...key.usage,
      totalRequests: key.usage.totalRequests + 1,
      lastUsed: now,
    };

    if (success) {
      updatedKey.usage.successfulRequests += 1;
      updatedKey.usage.consecutiveFailures = 0;
      updatedKey.status = 'active';
      updatedKey.lastError = undefined;
    } else {
      updatedKey.usage.failedRequests += 1;
      updatedKey.usage.consecutiveFailures += 1;
      updatedKey.lastError = error;

      // 根据连续失败次数决定是否禁用 Key
      if (updatedKey.usage.consecutiveFailures >= 3) {
        updatedKey.status = 'error';
      }
    }

    updatedKey.updatedAt = now;
    return updatedKey;
  }

  /**
   * 检查 Key 是否在冷却期
   */
  private isKeyInCooldown(key: ApiKeyConfig): boolean {
    if (key.status !== 'error') return false;
    
    const cooldownTime = 5 * 60 * 1000; // 5分钟冷却期
    const timeSinceLastError = Date.now() - key.updatedAt;
    
    return timeSinceLastError < cooldownTime;
  }

  /**
   * 创建新的 API Key 配置
   */
  createApiKeyConfig(key: string, name?: string, priority: number = 5): ApiKeyConfig {
    return {
      id: this.generateKeyId(),
      key,
      name: name || `API Key ${Date.now()}`,
      isEnabled: true,
      priority,
      usage: {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        consecutiveFailures: 0,
      },
      status: 'active',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
  }

  /**
   * 生成唯一的 Key ID
   */
  private generateKeyId(): string {
    return `key_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 重置轮询状态 - 当 Key 配置发生变化时调用
   */
  resetRoundRobinState(providerId?: string): void {
    if (providerId) {
      // 重置特定供应商的轮询状态
      const keysToRemove = Array.from(this.roundRobinIndexMap.keys()).filter(key =>
        key.includes(providerId)
      );
      keysToRemove.forEach(key => this.roundRobinIndexMap.delete(key));
      console.log(`[ApiKeyManager] 重置供应商 ${providerId} 的轮询状态`);
    } else {
      // 重置所有轮询状态
      this.roundRobinIndexMap.clear();
      console.log(`[ApiKeyManager] 重置所有轮询状态`);
    }
  }

  /**
   * 验证 API Key 格式
   */
  validateApiKey(key: string, providerType: string): boolean {
    if (!key || key.trim().length === 0) return false;

    // 根据不同供应商验证 Key 格式
    switch (providerType) {
      case 'openai':
      case 'openai-aisdk':
        return key.startsWith('sk-') && key.length > 20;
      case 'anthropic':
        return key.startsWith('sk-ant-') && key.length > 30;
      case 'gemini':
        return key.length > 20; // Gemini Key 没有固定前缀
      case 'deepseek':
        return key.startsWith('sk-') && key.length > 20;
      case 'zhipu':
        return key.includes('.') && key.length > 30; // 智谱 Key 包含点号
      case 'siliconflow':
        return key.startsWith('sk-') && key.length > 20;
      case 'volcengine':
        return key.length > 20;
      default:
        return key.length > 10; // 通用验证
    }
  }

  /**
   * 获取 Key 使用统计
   */
  getKeyStats(keys: ApiKeyConfig[]): {
    total: number;
    active: number;
    disabled: number;
    error: number;
    totalRequests: number;
    successRate: number;
  } {
    const stats = {
      total: keys.length,
      active: 0,
      disabled: 0,
      error: 0,
      totalRequests: 0,
      successRate: 0,
    };

    let totalSuccessful = 0;

    keys.forEach(key => {
      switch (key.status) {
        case 'active':
          stats.active++;
          break;
        case 'disabled':
          stats.disabled++;
          break;
        case 'error':
          stats.error++;
          break;
      }

      stats.totalRequests += key.usage.totalRequests;
      totalSuccessful += key.usage.successfulRequests;
    });

    stats.successRate = stats.totalRequests > 0 
      ? Math.round((totalSuccessful / stats.totalRequests) * 100) 
      : 0;

    return stats;
  }
}

export default ApiKeyManager;
