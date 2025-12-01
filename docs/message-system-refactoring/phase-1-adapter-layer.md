# Phase 1: 适配器层重构

> **优先级**：P0 (必须)  
> **预计工时**：2-3天  
> **依赖**：无

## 🎯 目标

创建统一的 SDK 到 Chunk 适配器层，使所有 Provider 通过同一接口发送标准化的 Chunk 事件。

---

## 📋 当前问题

### 问题描述
每个 Provider 直接构建和发送 Chunk，导致：
1. 实现不一致（OpenAI、Gemini、Anthropic 各自处理）
2. 新增 Provider 需要重复实现流处理逻辑
3. 无法统一处理 SDK 特定的事件格式

### 当前代码示例
```typescript
// OpenAIClient.ts - 直接构建 Chunk
for await (const chunk of stream) {
  if (chunk.choices[0]?.delta?.content) {
    onChunk({
      type: ChunkType.TEXT_DELTA,
      text: chunk.choices[0].delta.content
    })
  }
}

// GeminiClient.ts - 另一种实现
for await (const chunk of stream) {
  const text = chunk.text()
  onChunk({
    type: ChunkType.TEXT_DELTA,
    text: text
  })
}
```

---

## 🏗️ 目标架构

### Cherry Studio 参考
```typescript
// AiSdkToChunkAdapter.ts
export class AiSdkToChunkAdapter {
  constructor(
    private onChunk: (chunk: Chunk) => void,
    mcpTools: MCPTool[] = [],
    accumulate?: boolean,
    enableWebSearch?: boolean
  ) {}

  async processStream(aiSdkResult: any): Promise<string> {
    if (aiSdkResult.fullStream) {
      await this.readFullStream(aiSdkResult.fullStream)
    }
    return await aiSdkResult.text
  }

  private convertAndEmitChunk(chunk: TextStreamPart) {
    switch (chunk.type) {
      case 'text-start':
        this.onChunk({ type: ChunkType.TEXT_START })
        break
      case 'text-delta':
        this.onChunk({ type: ChunkType.TEXT_DELTA, text: chunk.text })
        break
      // ...
    }
  }
}
```

### AetherLink 目标结构
```
src/shared/aiCore/adapters/
├── index.ts                    # 导出入口
├── BaseChunkAdapter.ts         # 抽象基类
├── OpenAIChunkAdapter.ts       # OpenAI 适配器
├── GeminiChunkAdapter.ts       # Gemini 适配器
├── AnthropicChunkAdapter.ts    # Anthropic 适配器
└── types.ts                    # 适配器类型定义
```

---

## 📝 详细任务

### Task 1.1: 创建适配器接口和基类

**文件**：`src/shared/aiCore/adapters/types.ts`

```typescript
import type { Chunk } from '../../types/chunk';
import type { MCPTool } from '../../types';

/**
 * Chunk 适配器配置
 */
export interface ChunkAdapterConfig {
  /** Chunk 回调函数 */
  onChunk: (chunk: Chunk) => void;
  /** MCP 工具列表 */
  mcpTools?: MCPTool[];
  /** 是否累积文本（true=累积模式，false=增量模式）*/
  accumulate?: boolean;
  /** 是否启用 Web 搜索 */
  enableWebSearch?: boolean;
  /** 会话更新回调 */
  onSessionUpdate?: (sessionId: string) => void;
}

/**
 * 流处理结果
 */
export interface StreamProcessResult {
  /** 最终文本内容 */
  text: string;
  /** 推理内容 */
  reasoning?: string;
  /** 使用统计 */
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * Chunk 适配器接口
 */
export interface IChunkAdapter {
  /**
   * 处理流式响应
   * @param stream 原始流
   * @returns 处理结果
   */
  processStream(stream: any): Promise<StreamProcessResult>;
  
  /**
   * 处理非流式响应
   * @param response 完整响应
   * @returns 处理结果
   */
  processResponse?(response: any): Promise<StreamProcessResult>;
}
```

**文件**：`src/shared/aiCore/adapters/BaseChunkAdapter.ts`

```typescript
import type { Chunk } from '../../types/chunk';
import { ChunkType } from '../../types/chunk';
import type { ChunkAdapterConfig, IChunkAdapter, StreamProcessResult } from './types';

/**
 * Chunk 适配器基类
 * 提供通用的流处理逻辑和状态管理
 */
export abstract class BaseChunkAdapter implements IChunkAdapter {
  protected config: ChunkAdapterConfig;
  protected accumulatedText = '';
  protected accumulatedReasoning = '';
  protected isFirstChunk = true;
  protected responseStartTime: number | null = null;
  protected firstTokenTime: number | null = null;

  constructor(config: ChunkAdapterConfig) {
    this.config = config;
  }

  /**
   * 发送 Chunk 事件
   */
  protected emit(chunk: Chunk): void {
    this.config.onChunk(chunk);
  }

  /**
   * 发送文本开始事件
   */
  protected emitTextStart(): void {
    this.emit({ type: ChunkType.TEXT_START });
  }

  /**
   * 发送文本增量事件
   */
  protected emitTextDelta(text: string): void {
    if (!text) return;
    
    if (this.config.accumulate) {
      this.accumulatedText += text;
      this.emit({ type: ChunkType.TEXT_DELTA, text: this.accumulatedText });
    } else {
      this.accumulatedText += text;
      this.emit({ type: ChunkType.TEXT_DELTA, text });
    }
    
    this.markFirstToken();
  }

  /**
   * 发送文本完成事件
   */
  protected emitTextComplete(text?: string): void {
    const finalText = text ?? this.accumulatedText;
    this.emit({ type: ChunkType.TEXT_COMPLETE, text: finalText });
  }

  /**
   * 发送思考开始事件
   */
  protected emitThinkingStart(): void {
    this.emit({ type: ChunkType.THINKING_START });
  }

  /**
   * 发送思考增量事件
   */
  protected emitThinkingDelta(text: string, thinkingMillsec?: number): void {
    if (!text) return;
    this.accumulatedReasoning = text; // 思考内容通常是累积的
    this.emit({ 
      type: ChunkType.THINKING_DELTA, 
      text: this.accumulatedReasoning,
      thinking_millsec: thinkingMillsec 
    });
    this.markFirstToken();
  }

  /**
   * 发送思考完成事件
   */
  protected emitThinkingComplete(text?: string, thinkingMillsec?: number): void {
    const finalText = text ?? this.accumulatedReasoning;
    this.emit({ 
      type: ChunkType.THINKING_COMPLETE, 
      text: finalText,
      thinking_millsec: thinkingMillsec
    });
  }

  /**
   * 发送错误事件
   */
  protected emitError(error: Error | string): void {
    const errorObj = typeof error === 'string' ? new Error(error) : error;
    this.emit({ 
      type: ChunkType.ERROR, 
      error: { message: errorObj.message } 
    });
  }

  /**
   * 发送块完成事件
   */
  protected emitBlockComplete(response?: any): void {
    this.emit({ 
      type: ChunkType.BLOCK_COMPLETE,
      response 
    });
  }

  /**
   * 发送 LLM 响应创建事件
   */
  protected emitLLMResponseCreated(): void {
    this.emit({ type: ChunkType.LLM_RESPONSE_CREATED });
  }

  /**
   * 发送 LLM 响应完成事件
   */
  protected emitLLMResponseComplete(response?: any): void {
    this.emit({ type: ChunkType.LLM_RESPONSE_COMPLETE, response });
  }

  /**
   * 标记响应开始时间
   */
  protected markResponseStart(): void {
    this.responseStartTime = Date.now();
  }

  /**
   * 标记首个 token 时间
   */
  protected markFirstToken(): void {
    if (this.firstTokenTime === null && this.responseStartTime !== null) {
      this.firstTokenTime = Date.now();
    }
  }

  /**
   * 构建性能指标
   */
  protected buildMetrics(completionTokens: number = 0): any {
    const now = Date.now();
    const start = this.responseStartTime ?? now;
    const firstToken = this.firstTokenTime;
    
    return {
      completion_tokens: completionTokens,
      time_first_token_millsec: firstToken ? firstToken - start : 0,
      time_completion_millsec: now - start
    };
  }

  /**
   * 重置状态
   */
  protected reset(): void {
    this.accumulatedText = '';
    this.accumulatedReasoning = '';
    this.isFirstChunk = true;
    this.responseStartTime = null;
    this.firstTokenTime = null;
  }

  /**
   * 子类实现：处理流式响应
   */
  abstract processStream(stream: any): Promise<StreamProcessResult>;
}
```

---

### Task 1.2: 实现 OpenAI 适配器

**文件**：`src/shared/aiCore/adapters/OpenAIChunkAdapter.ts`

```typescript
import { ChunkType } from '../../types/chunk';
import { BaseChunkAdapter } from './BaseChunkAdapter';
import type { ChunkAdapterConfig, StreamProcessResult } from './types';

/**
 * OpenAI 流式响应 Chunk 类型
 */
interface OpenAIStreamChunk {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    delta: {
      role?: string;
      content?: string;
      reasoning_content?: string;
      tool_calls?: Array<{
        index: number;
        id?: string;
        type?: string;
        function?: {
          name?: string;
          arguments?: string;
        };
      }>;
    };
    finish_reason: string | null;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * OpenAI Chunk 适配器
 * 将 OpenAI SDK 的流式响应转换为标准 Chunk 格式
 */
export class OpenAIChunkAdapter extends BaseChunkAdapter {
  private hasEmittedTextStart = false;
  private hasEmittedThinkingStart = false;
  private toolCallsBuffer: Map<number, any> = new Map();

  constructor(config: ChunkAdapterConfig) {
    super(config);
  }

  async processStream(stream: AsyncIterable<OpenAIStreamChunk>): Promise<StreamProcessResult> {
    this.reset();
    this.markResponseStart();
    this.emitLLMResponseCreated();

    let usage: StreamProcessResult['usage'];

    try {
      for await (const chunk of stream) {
        this.processChunk(chunk);
        
        if (chunk.usage) {
          usage = chunk.usage;
        }
      }

      // 发送完成事件
      if (this.accumulatedText) {
        this.emitTextComplete();
      }
      if (this.accumulatedReasoning) {
        this.emitThinkingComplete();
      }

      const response = {
        text: this.accumulatedText,
        reasoning_content: this.accumulatedReasoning,
        usage,
        metrics: this.buildMetrics(usage?.completion_tokens)
      };

      this.emitBlockComplete(response);
      this.emitLLMResponseComplete(response);

      return {
        text: this.accumulatedText,
        reasoning: this.accumulatedReasoning,
        usage
      };
    } catch (error) {
      this.emitError(error as Error);
      throw error;
    }
  }

  private processChunk(chunk: OpenAIStreamChunk): void {
    const choice = chunk.choices[0];
    if (!choice) return;

    const delta = choice.delta;

    // 处理思考内容 (reasoning_content)
    if (delta.reasoning_content) {
      if (!this.hasEmittedThinkingStart) {
        this.emitThinkingStart();
        this.hasEmittedThinkingStart = true;
      }
      this.emitThinkingDelta(delta.reasoning_content);
    }

    // 处理文本内容
    if (delta.content) {
      if (!this.hasEmittedTextStart) {
        // 如果有思考内容，先完成思考
        if (this.hasEmittedThinkingStart && this.accumulatedReasoning) {
          this.emitThinkingComplete();
        }
        this.emitTextStart();
        this.hasEmittedTextStart = true;
      }
      this.emitTextDelta(delta.content);
    }

    // 处理工具调用
    if (delta.tool_calls) {
      this.processToolCalls(delta.tool_calls);
    }

    // 处理结束原因
    if (choice.finish_reason) {
      this.handleFinishReason(choice.finish_reason);
    }
  }

  private processToolCalls(toolCalls: NonNullable<OpenAIStreamChunk['choices'][0]['delta']['tool_calls']>): void {
    for (const tc of toolCalls) {
      let existing = this.toolCallsBuffer.get(tc.index);
      
      if (!existing) {
        existing = {
          id: tc.id || '',
          type: tc.type || 'function',
          function: { name: '', arguments: '' }
        };
        this.toolCallsBuffer.set(tc.index, existing);
      }

      if (tc.id) existing.id = tc.id;
      if (tc.function?.name) existing.function.name += tc.function.name;
      if (tc.function?.arguments) existing.function.arguments += tc.function.arguments;
    }
  }

  private handleFinishReason(reason: string): void {
    if (reason === 'tool_calls') {
      // 发送工具调用事件
      const toolCalls = Array.from(this.toolCallsBuffer.values());
      if (toolCalls.length > 0) {
        this.emit({
          type: ChunkType.MCP_TOOL_IN_PROGRESS,
          responses: toolCalls.map(tc => ({
            id: tc.id,
            name: tc.function.name,
            arguments: JSON.parse(tc.function.arguments || '{}'),
            status: 'pending'
          }))
        });
      }
    }
  }

  protected reset(): void {
    super.reset();
    this.hasEmittedTextStart = false;
    this.hasEmittedThinkingStart = false;
    this.toolCallsBuffer.clear();
  }
}
```

---

### Task 1.3: 实现 Gemini 适配器

**文件**：`src/shared/aiCore/adapters/GeminiChunkAdapter.ts`

```typescript
import { BaseChunkAdapter } from './BaseChunkAdapter';
import type { ChunkAdapterConfig, StreamProcessResult } from './types';

/**
 * Gemini Chunk 适配器
 */
export class GeminiChunkAdapter extends BaseChunkAdapter {
  private hasEmittedTextStart = false;
  private hasEmittedThinkingStart = false;

  constructor(config: ChunkAdapterConfig) {
    super(config);
  }

  async processStream(stream: AsyncIterable<any>): Promise<StreamProcessResult> {
    this.reset();
    this.markResponseStart();
    this.emitLLMResponseCreated();

    try {
      for await (const chunk of stream) {
        this.processChunk(chunk);
      }

      // 发送完成事件
      if (this.accumulatedText) {
        this.emitTextComplete();
      }
      if (this.accumulatedReasoning) {
        this.emitThinkingComplete();
      }

      const response = {
        text: this.accumulatedText,
        reasoning_content: this.accumulatedReasoning,
        metrics: this.buildMetrics()
      };

      this.emitBlockComplete(response);
      this.emitLLMResponseComplete(response);

      return {
        text: this.accumulatedText,
        reasoning: this.accumulatedReasoning
      };
    } catch (error) {
      this.emitError(error as Error);
      throw error;
    }
  }

  private processChunk(chunk: any): void {
    // Gemini 的响应格式
    const text = chunk.text?.() || chunk.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (text) {
      if (!this.hasEmittedTextStart) {
        this.emitTextStart();
        this.hasEmittedTextStart = true;
      }
      this.emitTextDelta(text);
    }

    // 处理思考内容（如果 Gemini 支持）
    const thought = chunk.candidates?.[0]?.content?.parts?.find((p: any) => p.thought)?.thought;
    if (thought) {
      if (!this.hasEmittedThinkingStart) {
        this.emitThinkingStart();
        this.hasEmittedThinkingStart = true;
      }
      this.emitThinkingDelta(thought);
    }

    // 处理函数调用
    const functionCall = chunk.candidates?.[0]?.content?.parts?.find((p: any) => p.functionCall);
    if (functionCall) {
      this.processFunctionCall(functionCall.functionCall);
    }
  }

  private processFunctionCall(fc: { name: string; args: any }): void {
    this.emit({
      type: 'mcp_tool_in_progress' as any,
      responses: [{
        id: `fc_${Date.now()}`,
        name: fc.name,
        arguments: fc.args,
        status: 'pending'
      }]
    });
  }

  protected reset(): void {
    super.reset();
    this.hasEmittedTextStart = false;
    this.hasEmittedThinkingStart = false;
  }
}
```

---

### Task 1.4: 创建适配器工厂

**文件**：`src/shared/aiCore/adapters/index.ts`

```typescript
import { OpenAIChunkAdapter } from './OpenAIChunkAdapter';
import { GeminiChunkAdapter } from './GeminiChunkAdapter';
import type { ChunkAdapterConfig, IChunkAdapter } from './types';

export * from './types';
export * from './BaseChunkAdapter';
export * from './OpenAIChunkAdapter';
export * from './GeminiChunkAdapter';

/**
 * Provider 类型
 */
export type ProviderType = 'openai' | 'gemini' | 'anthropic' | 'ollama' | 'openrouter';

/**
 * 创建 Chunk 适配器
 * @param providerType Provider 类型
 * @param config 适配器配置
 * @returns Chunk 适配器实例
 */
export function createChunkAdapter(
  providerType: ProviderType,
  config: ChunkAdapterConfig
): IChunkAdapter {
  switch (providerType) {
    case 'openai':
    case 'ollama':
    case 'openrouter':
      return new OpenAIChunkAdapter(config);
    
    case 'gemini':
      return new GeminiChunkAdapter(config);
    
    case 'anthropic':
      // Anthropic 使用 OpenAI 兼容格式
      return new OpenAIChunkAdapter(config);
    
    default:
      console.warn(`[ChunkAdapter] 未知的 Provider 类型: ${providerType}，使用 OpenAI 适配器`);
      return new OpenAIChunkAdapter(config);
  }
}
```

---

### Task 1.5: 集成到 Provider

**修改文件**：`src/shared/services/messages/ApiProvider.ts`

```typescript
// 添加导入
import { createChunkAdapter, type ChunkAdapterConfig } from '../../aiCore/adapters';

// 修改 sendChatMessage 方法
async sendChatMessage(messages: any[], options: SendOptions): Promise<any> {
  const { onChunk, enableTools, mcpTools, abortSignal } = options;
  
  // 创建适配器
  const adapterConfig: ChunkAdapterConfig = {
    onChunk,
    mcpTools,
    accumulate: this.model.supported_text_delta !== false
  };
  
  const adapter = createChunkAdapter(this.getProviderType(), adapterConfig);
  
  // 获取原始流
  const stream = await this.client.createChatCompletion(messages, {
    stream: true,
    signal: abortSignal
  });
  
  // 使用适配器处理流
  const result = await adapter.processStream(stream);
  
  return {
    content: result.text,
    reasoning: result.reasoning,
    usage: result.usage
  };
}
```

---

## ✅ 验收标准

### 功能验收
- [ ] OpenAI 流式响应正确转换为 Chunk
- [ ] Gemini 流式响应正确转换为 Chunk
- [ ] 思考内容正确处理 THINKING_START/DELTA/COMPLETE
- [ ] 工具调用正确触发 MCP_TOOL_* 事件
- [ ] 错误正确转换为 ERROR Chunk

### 代码验收
- [ ] 所有适配器继承 BaseChunkAdapter
- [ ] 统一使用 createChunkAdapter 工厂函数
- [ ] 添加完整的 TypeScript 类型定义
- [ ] 添加关键路径日志

### 测试验收
- [ ] OpenAI 普通对话测试通过
- [ ] OpenAI 深度思考测试通过
- [ ] Gemini 普通对话测试通过
- [ ] 工具调用测试通过
- [ ] 中断/取消测试通过

---

## 📅 里程碑

| 日期 | 任务 | 状态 |
|------|------|------|
| Day 1 | Task 1.1-1.2: 基类和 OpenAI 适配器 | ⏳ |
| Day 2 | Task 1.3-1.4: Gemini 适配器和工厂 | ⏳ |
| Day 3 | Task 1.5: 集成和测试 | ⏳ |

---

## ⚠️ 风险和注意事项

1. **向后兼容**：保留原有的直接 Chunk 发送方式作为 fallback
2. **性能影响**：适配器层会增加少量开销，需要监控
3. **特殊格式**：某些 Provider 可能有特殊的响应格式，需要特别处理
