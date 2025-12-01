/**
 * API客户端工厂
 * 负责根据Provider配置创建对应的客户端实例
 */
import type { Provider } from '../types/provider';
import type { BaseApiClient } from './base';
import { ClientRegistry, type ClientCreator } from './registry';

/** 是否已初始化 */
let initialized = false;

/** 初始化Promise（防止重复初始化） */
let initPromise: Promise<void> | null = null;

/**
 * API客户端工厂类
 */
export class ApiClientFactory {
  /**
   * 创建客户端实例
   * @param provider Provider配置
   * @returns 对应的API客户端
   * @throws 如果找不到对应的客户端
   */
  public static create(provider: Provider): BaseApiClient {
    console.log(`[ApiClientFactory] 创建客户端 - ID: ${provider.id}, Type: ${provider.type}`);

    // 从注册表获取创建器
    const creator = ClientRegistry.getCreator(provider);

    if (creator) {
      const client = creator(provider);
      console.log(`[ApiClientFactory] 使用客户端: ${client.constructor.name}`);
      return client;
    }

    // 如果没有找到对应的客户端，尝试使用默认的OpenAI兼容客户端
    const defaultCreator = ClientRegistry.getCreator({
      ...provider,
      type: 'openai',
    } as Provider);

    if (defaultCreator) {
      console.log(`[ApiClientFactory] 回退到默认OpenAI兼容客户端`);
      return defaultCreator(provider);
    }

    throw new Error(
      `未找到Provider "${provider.id}" (type: ${provider.type}) 对应的客户端。` +
      `请确保已调用 initializeDefaultClients() 或手动注册客户端。`
    );
  }

  /**
   * 安全创建客户端（不抛出异常）
   */
  public static safeCreate(provider: Provider): BaseApiClient | null {
    try {
      return ApiClientFactory.create(provider);
    } catch (error) {
      console.error(`[ApiClientFactory] 创建客户端失败:`, error);
      return null;
    }
  }

  /**
   * 检查是否支持该Provider
   */
  public static isSupported(provider: Provider): boolean {
    return ClientRegistry.hasClient(provider);
  }

  /**
   * 获取Provider对应的客户端类型名称
   */
  public static getClientTypeName(provider: Provider): string | undefined {
    try {
      const client = ApiClientFactory.create(provider);
      return client.constructor.name;
    } catch {
      return undefined;
    }
  }

  /**
   * 获取工厂统计信息
   */
  public static getStats(): {
    initialized: boolean;
    registeredIds: string[];
    registeredTypes: string[];
  } {
    return {
      initialized: ClientRegistry.isInitialized(),
      registeredIds: ClientRegistry.getRegisteredIds(),
      registeredTypes: ClientRegistry.getRegisteredTypes(),
    };
  }
}

/**
 * 初始化默认客户端
 * 动态导入各个客户端实现以避免循环依赖
 * 
 * 注意：这个函数会在首次调用时执行，后续调用会直接返回
 */
export async function initializeDefaultClients(): Promise<void> {
  // 防止重复初始化
  if (initialized) {
    return;
  }

  // 如果正在初始化，等待完成
  if (initPromise) {
    return initPromise;
  }

  initPromise = doInitialize();
  await initPromise;
}

/**
 * 实际执行初始化
 */
async function doInitialize(): Promise<void> {
  console.log('[ApiClientFactory] 开始初始化默认客户端...');

  try {
    // 动态导入客户端实现
    const [
      { OpenAIClient },
      { GeminiClient },
      { AnthropicClient },
    ] = await Promise.all([
      import('./openai/OpenAIClient'),
      import('./gemini/GeminiClient'),
      import('./anthropic/AnthropicClient'),
    ]);

    // 注册客户端
    ClientRegistry.registerMultiple({
      byType: {
        'openai': (p) => new OpenAIClient(p),
        'openai-response': (p) => new OpenAIClient(p), // 暂时用 OpenAI
        'gemini': (p) => new GeminiClient(p),
        'anthropic': (p) => new AnthropicClient(p),
        'claude': (p) => new AnthropicClient(p),
      },
      byId: {
        // OpenAI 兼容供应商
        'deepseek': (p) => new OpenAIClient(p),
        'zhipu': (p) => new OpenAIClient(p),
        'siliconflow': (p) => new OpenAIClient(p),
        'moonshot': (p) => new OpenAIClient(p),
        'groq': (p) => new OpenAIClient(p),
        'ollama': (p) => new OpenAIClient(p),
        'lmstudio': (p) => new OpenAIClient(p),
      },
    });

    ClientRegistry.markInitialized();
    initialized = true;

    console.log('[ApiClientFactory] 默认客户端初始化完成');
    console.log('[ApiClientFactory] 已注册Types:', ClientRegistry.getRegisteredTypes());
    console.log('[ApiClientFactory] 已注册IDs:', ClientRegistry.getRegisteredIds());
  } catch (error) {
    console.error('[ApiClientFactory] 初始化失败:', error);
    throw error;
  }
}

/**
 * 注册自定义客户端
 * 供外部扩展使用
 * 
 * @example
 * ```typescript
 * registerClient({
 *   providerId: 'my-custom-provider',
 *   creator: (provider) => new MyCustomClient(provider),
 * });
 * ```
 */
export function registerClient(options: {
  /** Provider ID（精确匹配） */
  providerId?: string;
  /** Provider Type（类型匹配） */
  providerType?: string;
  /** 客户端创建器 */
  creator: ClientCreator;
  /** 优先级（数字越大越优先） */
  priority?: number;
  /** 描述 */
  description?: string;
}): void {
  const { providerId, providerType, creator, priority, description } = options;

  if (providerId) {
    ClientRegistry.registerById(providerId, creator, { priority, description });
  }

  if (providerType) {
    ClientRegistry.registerByType(providerType, creator, { priority, description });
  }

  if (!providerId && !providerType) {
    console.warn('[registerClient] 必须提供 providerId 或 providerType');
  }
}

/**
 * 添加Provider ID到Type的映射
 * 
 * @example
 * ```typescript
 * // 让 'my-provider' 使用 openai 类型的客户端
 * addProviderMapping('my-provider', 'openai');
 * ```
 */
export function addProviderMapping(providerId: string, targetType: string): void {
  ClientRegistry.addIdMapping(providerId, targetType);
}

/**
 * 重置工厂状态（用于测试）
 */
export function resetFactory(): void {
  ClientRegistry.clear();
  initialized = false;
  initPromise = null;
  console.log('[ApiClientFactory] 工厂已重置');
}

/**
 * 检查是否已初始化
 */
export function isFactoryInitialized(): boolean {
  return initialized && ClientRegistry.isInitialized();
}
