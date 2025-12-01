/**
 * 客户端注册表
 * 管理所有可用的API客户端，支持动态注册
 */
import type { Provider } from '../types/provider';
import type { BaseApiClient } from './base';

/**
 * 客户端创建器类型
 */
export type ClientCreator = (provider: Provider) => BaseApiClient;

/**
 * 注册信息
 */
interface RegistrationInfo {
  creator: ClientCreator;
  priority: number;
  description?: string;
}

/**
 * 客户端注册表类
 * 单例模式，管理所有客户端的注册和获取
 */
class ClientRegistryClass {
  /** 按Provider ID注册的客户端 */
  private clientsById: Map<string, RegistrationInfo> = new Map();

  /** 按Provider Type注册的客户端 */
  private clientsByType: Map<string, RegistrationInfo> = new Map();

  /** Provider ID到Type的映射 */
  private idToTypeMapping: Map<string, string> = new Map();

  /** 是否已初始化 */
  private initialized = false;

  constructor() {
    this.initializeDefaultMappings();
  }

  /**
   * 初始化默认的ID到Type映射
   * 用于将特定的Provider ID映射到对应的客户端类型
   */
  private initializeDefaultMappings(): void {
    // Gemini 映射
    this.idToTypeMapping.set('gemini', 'gemini');
    this.idToTypeMapping.set('google', 'gemini');

    // Azure 映射
    this.idToTypeMapping.set('azure-openai', 'azure-openai');
    this.idToTypeMapping.set('azure', 'azure-openai');

    // OpenAI兼容的供应商 -> openai 类型
    const openaiCompatible = [
      'deepseek',
      'zhipu',
      'siliconflow',
      'volcengine',
      'moonshot',
      'groq',
      'together',
      'fireworks',
      'openrouter',
      'ollama',
      'lmstudio',
    ];
    openaiCompatible.forEach(id => {
      this.idToTypeMapping.set(id, 'openai');
    });
  }

  /**
   * 注册客户端创建器（按Provider ID）
   * @param providerId Provider ID
   * @param creator 创建器函数
   * @param options 可选配置
   */
  public registerById(
    providerId: string,
    creator: ClientCreator,
    options?: { priority?: number; description?: string }
  ): void {
    this.clientsById.set(providerId, {
      creator,
      priority: options?.priority ?? 0,
      description: options?.description,
    });
    console.log(`[ClientRegistry] 注册客户端 (ID): ${providerId}`);
  }

  /**
   * 注册客户端创建器（按Provider Type）
   * @param providerType Provider类型
   * @param creator 创建器函数
   * @param options 可选配置
   */
  public registerByType(
    providerType: string,
    creator: ClientCreator,
    options?: { priority?: number; description?: string }
  ): void {
    this.clientsByType.set(providerType, {
      creator,
      priority: options?.priority ?? 0,
      description: options?.description,
    });
    console.log(`[ClientRegistry] 注册客户端 (Type): ${providerType}`);
  }

  /**
   * 批量注册
   */
  public registerMultiple(registrations: {
    byId?: Record<string, ClientCreator>;
    byType?: Record<string, ClientCreator>;
  }): void {
    if (registrations.byId) {
      Object.entries(registrations.byId).forEach(([id, creator]) => {
        this.registerById(id, creator);
      });
    }
    if (registrations.byType) {
      Object.entries(registrations.byType).forEach(([type, creator]) => {
        this.registerByType(type, creator);
      });
    }
  }

  /**
   * 获取客户端创建器
   * 查找优先级：1. ID精确匹配 -> 2. ID映射 -> 3. Type匹配
   */
  public getCreator(provider: Provider): ClientCreator | undefined {
    // 1. 优先按ID精确查找
    const byId = this.clientsById.get(provider.id);
    if (byId) {
      return byId.creator;
    }

    // 2. 检查ID映射
    const mappedType = this.idToTypeMapping.get(provider.id);
    if (mappedType) {
      const byMappedType = this.clientsByType.get(mappedType);
      if (byMappedType) {
        return byMappedType.creator;
      }
    }

    // 3. 按Type查找
    const byType = this.clientsByType.get(provider.type);
    if (byType) {
      return byType.creator;
    }

    return undefined;
  }

  /**
   * 检查是否有对应的客户端
   */
  public hasClient(provider: Provider): boolean {
    return this.getCreator(provider) !== undefined;
  }

  /**
   * 获取所有已注册的Provider ID
   */
  public getRegisteredIds(): string[] {
    return Array.from(this.clientsById.keys());
  }

  /**
   * 获取所有已注册的Provider Type
   */
  public getRegisteredTypes(): string[] {
    return Array.from(this.clientsByType.keys());
  }

  /**
   * 添加ID到Type的映射
   */
  public addIdMapping(providerId: string, targetType: string): void {
    this.idToTypeMapping.set(providerId, targetType);
    console.log(`[ClientRegistry] 添加ID映射: ${providerId} -> ${targetType}`);
  }

  /**
   * 移除注册（按ID）
   */
  public unregisterById(providerId: string): boolean {
    const result = this.clientsById.delete(providerId);
    if (result) {
      console.log(`[ClientRegistry] 移除客户端 (ID): ${providerId}`);
    }
    return result;
  }

  /**
   * 移除注册（按Type）
   */
  public unregisterByType(providerType: string): boolean {
    const result = this.clientsByType.delete(providerType);
    if (result) {
      console.log(`[ClientRegistry] 移除客户端 (Type): ${providerType}`);
    }
    return result;
  }

  /**
   * 清空所有注册
   */
  public clear(): void {
    this.clientsById.clear();
    this.clientsByType.clear();
    this.initialized = false;
    console.log(`[ClientRegistry] 已清空所有注册`);
  }

  /**
   * 获取注册统计
   */
  public getStats(): {
    byIdCount: number;
    byTypeCount: number;
    mappingsCount: number;
  } {
    return {
      byIdCount: this.clientsById.size,
      byTypeCount: this.clientsByType.size,
      mappingsCount: this.idToTypeMapping.size,
    };
  }

  /**
   * 标记为已初始化
   */
  public markInitialized(): void {
    this.initialized = true;
  }

  /**
   * 检查是否已初始化
   */
  public isInitialized(): boolean {
    return this.initialized;
  }
}

// 导出单例实例
export const ClientRegistry = new ClientRegistryClass();
