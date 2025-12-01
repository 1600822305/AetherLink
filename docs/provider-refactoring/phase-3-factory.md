# Phase 3: 工厂模式升级

> 预计工时：2天
> 前置依赖：Phase 2 (抽象基类)
> 参考文件：`cherry-studio-main/src/renderer/src/aiCore/legacy/clients/ApiClientFactory.ts`

## 🎯 目标

1. 创建统一的 `ApiClientFactory` 工厂类
2. 支持根据Provider配置自动选择客户端
3. 实现Provider ID到客户端的映射
4. 支持动态注册新的客户端

## 📁 需要创建的文件

```
src/shared/aiCore/
└── clients/
    ├── base/                    # Phase 2已创建
    ├── factory.ts               # 客户端工厂
    └── registry.ts              # 客户端注册表
```

## 📝 详细实现

### 3.1 客户端注册表 (`clients/registry.ts`)

```typescript
import type { Provider } from '../types';
import type { BaseApiClient } from './base';

/**
 * 客户端创建器类型
 */
export type ClientCreator = (provider: Provider) => BaseApiClient;

/**
 * 客户端注册表
 * 管理所有可用的API客户端，支持动态注册
 */
class ClientRegistry {
  private static instance: ClientRegistry;
  
  /** 按Provider ID注册的客户端 */
  private clientsById: Map<string, ClientCreator> = new Map();
  
  /** 按Provider Type注册的客户端 */
  private clientsByType: Map<string, ClientCreator> = new Map();
  
  /** Provider ID到Type的映射 */
  private idToTypeMapping: Map<string, string> = new Map();

  private constructor() {
    this.initializeDefaultMappings();
  }

  public static getInstance(): ClientRegistry {
    if (!ClientRegistry.instance) {
      ClientRegistry.instance = new ClientRegistry();
    }
    return ClientRegistry.instance;
  }

  /**
   * 初始化默认的ID到Type映射
   */
  private initializeDefaultMappings(): void {
    // Cherry Studio风格的映射
    this.idToTypeMapping.set('gemini', 'google');
    this.idToTypeMapping.set('azure-openai', 'azure');
    this.idToTypeMapping.set('grok', 'xai');
    
    // OpenAI兼容的供应商
    const openaiCompatible = [
      'deepseek', 'zhipu', 'siliconflow', 'volcengine', 
      'moonshot', 'groq', 'together', 'fireworks'
    ];
    openaiCompatible.forEach(id => {
      this.idToTypeMapping.set(id, 'openai');
    });
  }

  /**
   * 注册客户端创建器（按Provider ID）
   */
  public registerById(providerId: string, creator: ClientCreator): void {
    this.clientsById.set(providerId, creator);
    console.log(`[ClientRegistry] 注册客户端 (ID): ${providerId}`);
  }

  /**
   * 注册客户端创建器（按Provider Type）
   */
  public registerByType(providerType: string, creator: ClientCreator): void {
    this.clientsByType.set(providerType, creator);
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
   */
  public getCreator(provider: Provider): ClientCreator | undefined {
    // 1. 优先按ID查找
    if (this.clientsById.has(provider.id)) {
      return this.clientsById.get(provider.id);
    }

    // 2. 检查ID映射
    const mappedType = this.idToTypeMapping.get(provider.id);
    if (mappedType && this.clientsByType.has(mappedType)) {
      return this.clientsByType.get(mappedType);
    }

    // 3. 按Type查找
    if (this.clientsByType.has(provider.type)) {
      return this.clientsByType.get(provider.type);
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
  }
}

// 导出单例
export const clientRegistry = ClientRegistry.getInstance();

// 导出类型
export { ClientRegistry, ClientCreator };
```

### 3.2 客户端工厂 (`clients/factory.ts`)

```typescript
import type { Provider } from '../types';
import type { BaseApiClient } from './base';
import { clientRegistry } from './registry';

/**
 * API客户端工厂
 * 负责根据Provider配置创建对应的客户端实例
 */
export class ApiClientFactory {
  /**
   * 创建客户端实例
   * @param provider Provider配置
   * @returns 对应的API客户端
   */
  public static create(provider: Provider): BaseApiClient {
    console.log(`[ApiClientFactory] 创建客户端 - ID: ${provider.id}, Type: ${provider.type}`);

    // 从注册表获取创建器
    const creator = clientRegistry.getCreator(provider);
    
    if (creator) {
      const client = creator(provider);
      console.log(`[ApiClientFactory] 使用注册的客户端: ${client.constructor.name}`);
      return client;
    }

    // 如果没有找到对应的客户端，尝试使用默认的OpenAI兼容客户端
    const defaultCreator = clientRegistry.getCreator({ 
      ...provider, 
      type: 'openai' 
    } as Provider);

    if (defaultCreator) {
      console.log(`[ApiClientFactory] 使用默认OpenAI兼容客户端`);
      return defaultCreator(provider);
    }

    throw new Error(`未找到Provider "${provider.id}" (type: ${provider.type}) 对应的客户端`);
  }

  /**
   * 检查是否支持该Provider
   */
  public static isSupported(provider: Provider): boolean {
    return clientRegistry.hasClient(provider);
  }

  /**
   * 获取Provider对应的客户端类型名称
   */
  public static getClientTypeName(provider: Provider): string | undefined {
    const creator = clientRegistry.getCreator(provider);
    if (creator) {
      // 创建一个临时实例来获取类名
      const tempClient = creator(provider);
      return tempClient.constructor.name;
    }
    return undefined;
  }
}

/**
 * 初始化默认客户端
 * 在应用启动时调用
 */
export async function initializeDefaultClients(): Promise<void> {
  console.log('[ApiClientFactory] 初始化默认客户端...');
  
  // 动态导入各个客户端以避免循环依赖
  const [
    { OpenAIClient },
    { OpenAIResponseClient },
    { GeminiClient },
    { AnthropicClient }
  ] = await Promise.all([
    import('./openai/OpenAIClient'),
    import('./openai/OpenAIResponseClient'),
    import('./gemini/GeminiClient'),
    import('./anthropic/AnthropicClient')
  ]);

  // 注册客户端
  clientRegistry.registerMultiple({
    byType: {
      'openai': (p) => new OpenAIClient(p),
      'openai-response': (p) => new OpenAIResponseClient(p),
      'gemini': (p) => new GeminiClient(p),
      'anthropic': (p) => new AnthropicClient(p),
    },
    byId: {
      // 特殊ID映射
      'azure-openai': (p) => new OpenAIResponseClient(p),
    }
  });

  console.log('[ApiClientFactory] 默认客户端初始化完成');
  console.log('[ApiClientFactory] 已注册Types:', clientRegistry.getRegisteredTypes());
  console.log('[ApiClientFactory] 已注册IDs:', clientRegistry.getRegisteredIds());
}

/**
 * 注册自定义客户端
 * 供外部扩展使用
 */
export function registerClient(
  options: {
    providerId?: string;
    providerType?: string;
    creator: (provider: Provider) => BaseApiClient;
  }
): void {
  if (options.providerId) {
    clientRegistry.registerById(options.providerId, options.creator);
  }
  if (options.providerType) {
    clientRegistry.registerByType(options.providerType, options.creator);
  }
}
```

### 3.3 使用示例

```typescript
// 在应用入口初始化
import { initializeDefaultClients } from '@/shared/aiCore/clients/factory';

async function bootstrap() {
  // 初始化默认客户端
  await initializeDefaultClients();
  
  // ... 其他初始化逻辑
}

// 使用工厂创建客户端
import { ApiClientFactory } from '@/shared/aiCore/clients/factory';

const provider = {
  id: 'openai',
  type: 'openai',
  name: 'OpenAI',
  apiKey: 'sk-xxx',
  apiHost: 'https://api.openai.com/v1',
  models: []
};

const client = ApiClientFactory.create(provider);
const response = await client.createCompletions(params);
```

### 3.4 与现有代码的桥接

```typescript
// services/ProviderFactory.ts - 修改现有文件

import { ApiClientFactory, initializeDefaultClients } from '@/shared/aiCore/clients/factory';
import type { Model, Provider } from '@/shared/types';

// 初始化标志
let initialized = false;

/**
 * 确保客户端已初始化
 */
async function ensureInitialized(): Promise<void> {
  if (!initialized) {
    await initializeDefaultClients();
    initialized = true;
  }
}

/**
 * 获取供应商API - 新版本
 * 保持向后兼容，同时使用新的工厂模式
 */
export async function getProviderApiV2(provider: Provider): Promise<any> {
  await ensureInitialized();
  
  try {
    const client = ApiClientFactory.create(provider);
    
    // 返回兼容旧接口的包装
    return {
      sendChatRequest: async (messages: any[], model: Model) => {
        // 转换为新的调用方式
        const result = await client.createCompletions({
          model: model.id,
          messages: messages,
          stream: false
        });
        return result;
      },
      // 其他方法...
    };
  } catch (error) {
    console.error('[getProviderApiV2] 创建客户端失败:', error);
    throw error;
  }
}
```

## ✅ 完成标准

1. [ ] `ClientRegistry` 单例实现完成
2. [ ] `ApiClientFactory` 工厂类实现完成
3. [ ] 支持按ID和Type两种方式注册客户端
4. [ ] 默认客户端初始化逻辑完成
5. [ ] 与现有 `ProviderFactory` 桥接完成

## 🧪 测试用例

```typescript
// tests/clients/factory.test.ts
import { ApiClientFactory, initializeDefaultClients, registerClient } from '@/shared/aiCore/clients/factory';
import { clientRegistry } from '@/shared/aiCore/clients/registry';
import { BaseApiClient } from '@/shared/aiCore/clients/base';

describe('ApiClientFactory', () => {
  beforeAll(async () => {
    await initializeDefaultClients();
  });

  test('should create OpenAI client', () => {
    const provider = {
      id: 'openai',
      type: 'openai' as const,
      name: 'OpenAI',
      apiKey: 'test',
      apiHost: 'https://api.openai.com/v1',
      models: []
    };
    
    const client = ApiClientFactory.create(provider);
    expect(client).toBeDefined();
    expect(client.getClientCompatibilityType()).toContain('OpenAIClient');
  });

  test('should use OpenAI compatible for unknown providers', () => {
    const provider = {
      id: 'custom-provider',
      type: 'custom' as const,
      name: 'Custom',
      apiKey: 'test',
      apiHost: 'https://custom.api.com',
      models: []
    };
    
    // 应该回退到OpenAI兼容客户端
    const client = ApiClientFactory.create(provider);
    expect(client).toBeDefined();
  });

  test('should support custom client registration', () => {
    class CustomClient extends BaseApiClient {
      // 实现必要的方法...
    }

    registerClient({
      providerId: 'my-custom',
      creator: (p) => new CustomClient(p) as any
    });

    expect(clientRegistry.getRegisteredIds()).toContain('my-custom');
  });
});
```

## 📊 架构对比

```
旧架构:
getProviderApi(model) → switch(type) → return api模块

新架构:
ApiClientFactory.create(provider) 
  → ClientRegistry.getCreator(provider)
  → creator(provider)
  → BaseApiClient实例
```

## ➡️ 下一步

完成Phase 3后，继续 [Phase 4: 中间件系统](./phase-4-middleware.md)
