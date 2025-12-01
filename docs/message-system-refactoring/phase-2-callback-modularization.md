# Phase 2: 回调系统模块化

> **优先级**：P0 (必须)  
> **预计工时**：3-4天  
> **依赖**：Phase 1 (适配器层)

## 🎯 目标

将 ResponseHandler 中的集中式回调处理拆分为独立的回调模块，实现按功能分离、易于扩展的回调架构。

---

## 📋 当前问题

### 问题描述
当前 `ResponseHandler.ts` 是一个 292 行的大文件，所有 Chunk 类型的处理逻辑都集中在一起：

```typescript
// ResponseHandler.ts - 集中式处理
async handleChunk(chunk: Chunk): Promise<void> {
  switch (chunk.type) {
    case ChunkType.THINKING_START:
    case ChunkType.THINKING_DELTA:
    case ChunkType.THINKING_COMPLETE:
      await chunkProcessor.handleChunk(chunk);
      break;
    case ChunkType.TEXT_DELTA:
    case ChunkType.TEXT_COMPLETE:
      await this.handleTextWithToolExtraction(chunk);
      break;
    case ChunkType.MCP_TOOL_IN_PROGRESS:
    case ChunkType.MCP_TOOL_COMPLETE:
      await toolHandler.handleChunk(chunk);
      break;
    // ... 更多类型
  }
}
```

**问题**：
1. 添加新类型需要修改核心文件
2. 难以单独测试某一类型的处理逻辑
3. 代码耦合度高，不利于维护

---

## 🏗️ 目标架构

### Cherry Studio 参考
```typescript
// callbacks/index.ts
export const createCallbacks = (deps) => {
  const baseCallbacks = createBaseCallbacks(deps)
  const textCallbacks = createTextCallbacks(deps)
  const thinkingCallbacks = createThinkingCallbacks(deps)
  const toolCallbacks = createToolCallbacks(deps)
  const imageCallbacks = createImageCallbacks(deps)
  const citationCallbacks = createCitationCallbacks(deps)
  
  return {
    ...baseCallbacks,
    ...textCallbacks,
    ...thinkingCallbacks,
    ...toolCallbacks,
    ...imageCallbacks,
    ...citationCallbacks,
    cleanup: () => { ... }
  }
}
```

### AetherLink 目标结构
```
src/shared/services/streaming/
├── index.ts                    # 导出入口
├── StreamProcessor.ts          # 流处理分发器
├── BlockManager.ts             # 块管理器（从现有移动）
├── callbacks/
│   ├── index.ts               # 回调组合器
│   ├── types.ts               # 回调类型定义
│   ├── baseCallbacks.ts       # 基础生命周期回调
│   ├── textCallbacks.ts       # 文本处理回调
│   ├── thinkingCallbacks.ts   # 思考链回调
│   ├── toolCallbacks.ts       # 工具调用回调
│   ├── imageCallbacks.ts      # 图像处理回调
│   └── errorCallbacks.ts      # 错误处理回调
└── processors/
    ├── ContentAccumulator.ts  # 内容累积器
    └── BlockStateManager.ts   # 块状态管理器
```

---

## 📝 详细任务

### Task 2.1: 定义回调接口和类型

**文件**：`src/shared/services/streaming/callbacks/types.ts`

```typescript
import type { Chunk } from '../../../types/chunk';
import type { MessageBlock } from '../../../types/newMessage';
import type { MCPTool, Assistant } from '../../../types';
import type { AppDispatch, RootState } from '../../../store';

/**
 * 回调依赖注入接口
 */
export interface CallbackDependencies {
  /** Redux dispatch */
  dispatch: AppDispatch;
  /** 获取 Redux 状态 */
  getState: () => RootState;
  /** 消息 ID */
  messageId: string;
  /** 主题 ID */
  topicId: string;
  /** 块管理器 */
  blockManager: IBlockManager;
  /** 助手配置 */
  assistant?: Assistant;
  /** MCP 工具列表 */
  mcpTools?: MCPTool[];
  /** 保存更新到数据库 */
  saveUpdatesToDB: (
    messageId: string,
    topicId: string,
    messageUpdates: any,
    blocksToUpdate: MessageBlock[]
  ) => Promise<void>;
}

/**
 * 块管理器接口
 */
export interface IBlockManager {
  /** 当前活跃块信息 */
  activeBlockInfo: { id: string; type: string } | null;
  /** 最后的块类型 */
  lastBlockType: string | null;
  /** 初始占位符块 ID */
  initialPlaceholderBlockId: string | null;
  /** 是否有初始占位符 */
  hasInitialPlaceholder: boolean;
  /** 智能更新块 */
  smartBlockUpdate(
    blockId: string,
    changes: Partial<MessageBlock>,
    blockType: string,
    isComplete?: boolean
  ): void;
  /** 处理块转换 */
  handleBlockTransition(newBlock: MessageBlock, newBlockType: string): Promise<void>;
}

/**
 * 流处理器回调接口
 */
export interface StreamProcessorCallbacks {
  // ===== 生命周期回调 =====
  /** LLM 响应创建 */
  onLLMResponseCreated?: () => void | Promise<void>;
  /** LLM 响应完成 */
  onLLMResponseComplete?: (response?: any) => void | Promise<void>;
  /** 处理完成 */
  onComplete?: (status: string, response?: any) => void | Promise<void>;
  /** 错误处理 */
  onError?: (error: any) => void | Promise<void>;

  // ===== 文本回调 =====
  /** 文本开始 */
  onTextStart?: () => void | Promise<void>;
  /** 文本增量 */
  onTextChunk?: (text: string) => void | Promise<void>;
  /** 文本完成 */
  onTextComplete?: (text: string) => void | Promise<void>;

  // ===== 思考链回调 =====
  /** 思考开始 */
  onThinkingStart?: () => void | Promise<void>;
  /** 思考增量 */
  onThinkingChunk?: (text: string, thinkingMillsec?: number) => void | Promise<void>;
  /** 思考完成 */
  onThinkingComplete?: (text: string, thinkingMillsec?: number) => void | Promise<void>;

  // ===== 工具回调 =====
  /** 工具调用等待 */
  onToolCallPending?: (toolResponse: any) => void | Promise<void>;
  /** 工具调用进行中 */
  onToolCallInProgress?: (toolResponse: any) => void | Promise<void>;
  /** 工具调用完成 */
  onToolCallComplete?: (toolResponse: any) => void | Promise<void>;

  // ===== 图像回调 =====
  /** 图像创建 */
  onImageCreated?: () => void | Promise<void>;
  /** 图像增量 */
  onImageDelta?: (imageData: any) => void | Promise<void>;
  /** 图像生成完成 */
  onImageGenerated?: (imageData?: any) => void | Promise<void>;

  // ===== 其他回调 =====
  /** 块创建 */
  onBlockCreated?: () => void | Promise<void>;
  /** 原始数据 */
  onRawData?: (content: unknown, metadata?: Record<string, any>) => void | Promise<void>;
  /** 清理资源 */
  cleanup?: () => void;
}
```

---

### Task 2.2: 实现基础回调模块

**文件**：`src/shared/services/streaming/callbacks/baseCallbacks.ts`

```typescript
import { MessageBlockStatus, MessageBlockType, AssistantMessageStatus } from '../../../types/newMessage';
import { newMessagesActions } from '../../../store/slices/newMessagesSlice';
import { EventEmitter, EVENT_NAMES } from '../../EventService';
import { createBaseMessageBlock, createErrorBlock } from '../../../utils/messageUtils';
import type { CallbackDependencies, StreamProcessorCallbacks } from './types';

/**
 * 创建基础回调
 * 处理 LLM 响应生命周期和错误
 */
export function createBaseCallbacks(deps: CallbackDependencies): Partial<StreamProcessorCallbacks> {
  const { dispatch, getState, messageId, topicId, blockManager, saveUpdatesToDB, assistant } = deps;
  
  const startTime = Date.now();

  return {
    /**
     * LLM 响应创建
     * 创建初始占位符块
     */
    onLLMResponseCreated: async () => {
      const baseBlock = createBaseMessageBlock(messageId, MessageBlockType.UNKNOWN, {
        status: MessageBlockStatus.PROCESSING
      });
      await blockManager.handleBlockTransition(baseBlock, MessageBlockType.UNKNOWN);
    },

    /**
     * 错误处理
     */
    onError: async (error: any) => {
      console.error('[BaseCallbacks] 错误:', error);
      
      const isAbortError = error?.name === 'AbortError' || error?.message?.includes('aborted');
      const serializedError = {
        message: isAbortError ? 'pause_placeholder' : (error?.message || '未知错误'),
        type: error?.name || 'Error'
      };

      // 更新当前块状态为错误
      const activeBlock = blockManager.activeBlockInfo;
      if (activeBlock) {
        blockManager.smartBlockUpdate(
          activeBlock.id,
          { status: isAbortError ? MessageBlockStatus.PAUSED : MessageBlockStatus.ERROR },
          activeBlock.type,
          true
        );
      }

      // 创建错误块
      const errorBlock = createErrorBlock(messageId, serializedError, {
        status: MessageBlockStatus.SUCCESS
      });
      await blockManager.handleBlockTransition(errorBlock, MessageBlockType.ERROR);

      // 更新消息状态
      const messageStatus = isAbortError ? AssistantMessageStatus.SUCCESS : AssistantMessageStatus.ERROR;
      dispatch(newMessagesActions.updateMessage({
        id: messageId,
        changes: { status: messageStatus }
      }));
      
      await saveUpdatesToDB(messageId, topicId, { status: messageStatus }, []);

      // 发送完成事件
      EventEmitter.emit(EVENT_NAMES.MESSAGE_COMPLETE, {
        id: messageId,
        topicId,
        status: isAbortError ? 'pause' : 'error',
        error: error?.message
      });
    },

    /**
     * 处理完成
     */
    onComplete: async (status: string, response?: any) => {
      const finalState = getState();
      const finalMessage = finalState.messages.entities[messageId];

      if (status === 'success' && finalMessage) {
        // 更新活跃块状态为成功
        const activeBlock = blockManager.activeBlockInfo;
        if (activeBlock) {
          blockManager.smartBlockUpdate(
            activeBlock.id,
            { status: MessageBlockStatus.SUCCESS },
            activeBlock.type,
            true
          );
        }

        const duration = Date.now() - startTime;
        console.log(`[BaseCallbacks] 消息完成，耗时: ${duration}ms`);
      }

      // 更新消息状态和指标
      const messageUpdates = {
        status,
        metrics: response?.metrics,
        usage: response?.usage
      };
      
      dispatch(newMessagesActions.updateMessage({
        id: messageId,
        changes: messageUpdates
      }));
      
      await saveUpdatesToDB(messageId, topicId, messageUpdates, []);

      // 发送完成事件
      EventEmitter.emit(EVENT_NAMES.MESSAGE_COMPLETE, {
        id: messageId,
        topicId,
        status
      });

      // 设置加载状态
      dispatch(newMessagesActions.setTopicLoading({ topicId, loading: false }));
      dispatch(newMessagesActions.setTopicStreaming({ topicId, streaming: false }));
    }
  };
}
```

---

### Task 2.3: 实现文本回调模块

**文件**：`src/shared/services/streaming/callbacks/textCallbacks.ts`

```typescript
import { MessageBlockStatus, MessageBlockType } from '../../../types/newMessage';
import { createMainTextBlock } from '../../../utils/messageUtils';
import type { CallbackDependencies, StreamProcessorCallbacks } from './types';

/**
 * 创建文本处理回调
 */
export function createTextCallbacks(deps: CallbackDependencies): Partial<StreamProcessorCallbacks> {
  const { messageId, blockManager } = deps;
  
  // 内部状态
  let mainTextBlockId: string | null = null;
  let accumulatedText = '';

  return {
    /**
     * 文本开始
     */
    onTextStart: async () => {
      console.log('[TextCallbacks] 文本开始');
      
      if (blockManager.hasInitialPlaceholder) {
        // 复用占位符块
        mainTextBlockId = blockManager.initialPlaceholderBlockId!;
        blockManager.smartBlockUpdate(
          mainTextBlockId,
          {
            type: MessageBlockType.MAIN_TEXT,
            content: '',
            status: MessageBlockStatus.STREAMING
          },
          MessageBlockType.MAIN_TEXT,
          false
        );
      } else if (!mainTextBlockId) {
        // 创建新文本块
        const newBlock = createMainTextBlock(messageId, '', {
          status: MessageBlockStatus.STREAMING
        });
        mainTextBlockId = newBlock.id;
        await blockManager.handleBlockTransition(newBlock, MessageBlockType.MAIN_TEXT);
      }
      
      accumulatedText = '';
    },

    /**
     * 文本增量
     */
    onTextChunk: async (text: string) => {
      if (!text) return;
      
      // 如果还没有文本块，先创建
      if (!mainTextBlockId) {
        if (blockManager.hasInitialPlaceholder) {
          mainTextBlockId = blockManager.initialPlaceholderBlockId!;
          blockManager.smartBlockUpdate(
            mainTextBlockId,
            {
              type: MessageBlockType.MAIN_TEXT,
              content: '',
              status: MessageBlockStatus.STREAMING
            },
            MessageBlockType.MAIN_TEXT,
            false
          );
        } else {
          const newBlock = createMainTextBlock(messageId, '', {
            status: MessageBlockStatus.STREAMING
          });
          mainTextBlockId = newBlock.id;
          await blockManager.handleBlockTransition(newBlock, MessageBlockType.MAIN_TEXT);
        }
      }
      
      accumulatedText = text; // 累积模式下 text 已经是完整内容
      
      blockManager.smartBlockUpdate(
        mainTextBlockId!,
        {
          content: accumulatedText,
          status: MessageBlockStatus.STREAMING
        },
        MessageBlockType.MAIN_TEXT,
        false
      );
    },

    /**
     * 文本完成
     */
    onTextComplete: async (finalText: string) => {
      console.log('[TextCallbacks] 文本完成');
      
      if (mainTextBlockId) {
        blockManager.smartBlockUpdate(
          mainTextBlockId,
          {
            content: finalText || accumulatedText,
            status: MessageBlockStatus.SUCCESS
          },
          MessageBlockType.MAIN_TEXT,
          true
        );
        
        // 重置状态，允许下一轮创建新块
        mainTextBlockId = null;
        accumulatedText = '';
      } else {
        console.warn('[TextCallbacks] 收到 TEXT_COMPLETE 但没有活跃的文本块');
      }
    },

    // 暴露内部状态的 getter（供外部查询）
    getCurrentTextBlockId: () => mainTextBlockId,
    getAccumulatedText: () => accumulatedText,
    resetTextBlock: () => {
      mainTextBlockId = null;
      accumulatedText = '';
    }
  } as any;
}
```

---

### Task 2.4: 实现思考链回调模块

**文件**：`src/shared/services/streaming/callbacks/thinkingCallbacks.ts`

```typescript
import { MessageBlockStatus, MessageBlockType } from '../../../types/newMessage';
import { createThinkingBlock } from '../../../utils/messageUtils';
import type { CallbackDependencies, StreamProcessorCallbacks } from './types';

/**
 * 创建思考链回调
 */
export function createThinkingCallbacks(deps: CallbackDependencies): Partial<StreamProcessorCallbacks> {
  const { messageId, blockManager } = deps;
  
  // 内部状态
  let thinkingBlockId: string | null = null;
  let accumulatedThinking = '';

  return {
    /**
     * 思考开始
     */
    onThinkingStart: async () => {
      console.log('[ThinkingCallbacks] 思考开始');
      
      // 重置状态，准备新一轮思考
      thinkingBlockId = null;
      accumulatedThinking = '';
    },

    /**
     * 思考增量
     */
    onThinkingChunk: async (text: string, thinkingMillsec?: number) => {
      if (!text) return;
      
      // 如果还没有思考块，创建一个
      if (!thinkingBlockId) {
        if (blockManager.hasInitialPlaceholder) {
          // 复用占位符块
          thinkingBlockId = blockManager.initialPlaceholderBlockId!;
          blockManager.smartBlockUpdate(
            thinkingBlockId,
            {
              type: MessageBlockType.THINKING,
              content: '',
              status: MessageBlockStatus.STREAMING,
              thinking_millsec: 0
            },
            MessageBlockType.THINKING,
            false
          );
        } else {
          // 创建新思考块
          const newBlock = createThinkingBlock(messageId, '', {
            status: MessageBlockStatus.STREAMING
          });
          thinkingBlockId = newBlock.id;
          await blockManager.handleBlockTransition(newBlock, MessageBlockType.THINKING);
        }
      }
      
      accumulatedThinking = text; // 思考内容通常是累积的
      
      blockManager.smartBlockUpdate(
        thinkingBlockId!,
        {
          content: accumulatedThinking,
          status: MessageBlockStatus.STREAMING,
          thinking_millsec: thinkingMillsec
        },
        MessageBlockType.THINKING,
        false
      );
    },

    /**
     * 思考完成
     */
    onThinkingComplete: async (finalText: string, thinkingMillsec?: number) => {
      console.log('[ThinkingCallbacks] 思考完成');
      
      if (thinkingBlockId) {
        blockManager.smartBlockUpdate(
          thinkingBlockId,
          {
            content: finalText || accumulatedThinking,
            status: MessageBlockStatus.SUCCESS,
            thinking_millsec: thinkingMillsec
          },
          MessageBlockType.THINKING,
          true
        );
        
        // 重置状态
        thinkingBlockId = null;
        accumulatedThinking = '';
      } else {
        console.warn('[ThinkingCallbacks] 收到 THINKING_COMPLETE 但没有活跃的思考块');
      }
    },

    // 暴露内部状态
    getCurrentThinkingBlockId: () => thinkingBlockId,
    getAccumulatedThinking: () => accumulatedThinking
  } as any;
}
```

---

### Task 2.5: 实现工具调用回调模块

**文件**：`src/shared/services/streaming/callbacks/toolCallbacks.ts`

```typescript
import { MessageBlockStatus, MessageBlockType } from '../../../types/newMessage';
import { createToolBlock } from '../../../utils/messageUtils';
import { mcpService } from '../../mcp';
import type { CallbackDependencies, StreamProcessorCallbacks } from './types';

/**
 * 创建工具调用回调
 */
export function createToolCallbacks(deps: CallbackDependencies): Partial<StreamProcessorCallbacks> {
  const { dispatch, messageId, blockManager, mcpTools = [] } = deps;
  
  // 工具调用状态缓存
  const toolCallsMap = new Map<string, {
    blockId: string;
    status: string;
    result?: any;
  }>();

  return {
    /**
     * 工具调用等待（可选）
     */
    onToolCallPending: async (toolResponse: any) => {
      console.log('[ToolCallbacks] 工具等待:', toolResponse.name);
      
      // 创建工具块（等待状态）
      const toolBlock = createToolBlock(messageId, {
        toolName: toolResponse.name,
        toolId: toolResponse.id,
        arguments: toolResponse.arguments,
        status: 'pending'
      });
      
      await blockManager.handleBlockTransition(toolBlock, MessageBlockType.TOOL);
      
      toolCallsMap.set(toolResponse.id, {
        blockId: toolBlock.id,
        status: 'pending'
      });
    },

    /**
     * 工具调用进行中
     */
    onToolCallInProgress: async (toolResponse: any) => {
      console.log('[ToolCallbacks] 工具执行中:', toolResponse.name);
      
      let cached = toolCallsMap.get(toolResponse.id);
      
      if (!cached) {
        // 如果没有等待状态，直接创建块
        const toolBlock = createToolBlock(messageId, {
          toolName: toolResponse.name,
          toolId: toolResponse.id,
          arguments: toolResponse.arguments,
          status: 'running'
        });
        
        await blockManager.handleBlockTransition(toolBlock, MessageBlockType.TOOL);
        
        cached = {
          blockId: toolBlock.id,
          status: 'running'
        };
        toolCallsMap.set(toolResponse.id, cached);
      } else {
        // 更新状态为运行中
        blockManager.smartBlockUpdate(
          cached.blockId,
          { status: MessageBlockStatus.PROCESSING },
          MessageBlockType.TOOL,
          false
        );
        cached.status = 'running';
      }

      // 执行工具调用
      try {
        const tool = mcpTools.find(t => t.name === toolResponse.name);
        if (tool) {
          const result = await mcpService.callTool(tool.serverId!, toolResponse.name, toolResponse.arguments);
          cached.result = result;
        }
      } catch (error) {
        console.error('[ToolCallbacks] 工具执行失败:', error);
        cached.result = { error: (error as Error).message };
      }
    },

    /**
     * 工具调用完成
     */
    onToolCallComplete: async (toolResponse: any) => {
      console.log('[ToolCallbacks] 工具完成:', toolResponse.name);
      
      const cached = toolCallsMap.get(toolResponse.id);
      
      if (cached) {
        blockManager.smartBlockUpdate(
          cached.blockId,
          {
            status: MessageBlockStatus.SUCCESS,
            result: toolResponse.result || cached.result
          },
          MessageBlockType.TOOL,
          true
        );
        
        cached.status = 'done';
      }
    },

    // 清理
    cleanup: () => {
      toolCallsMap.clear();
    }
  };
}
```

---

### Task 2.6: 实现回调组合器

**文件**：`src/shared/services/streaming/callbacks/index.ts`

```typescript
import { createBaseCallbacks } from './baseCallbacks';
import { createTextCallbacks } from './textCallbacks';
import { createThinkingCallbacks } from './thinkingCallbacks';
import { createToolCallbacks } from './toolCallbacks';
import type { CallbackDependencies, StreamProcessorCallbacks } from './types';

export * from './types';
export { createBaseCallbacks } from './baseCallbacks';
export { createTextCallbacks } from './textCallbacks';
export { createThinkingCallbacks } from './thinkingCallbacks';
export { createToolCallbacks } from './toolCallbacks';

/**
 * 创建完整的回调集合
 * 组合所有功能模块的回调
 */
export function createCallbacks(deps: CallbackDependencies): StreamProcessorCallbacks {
  // 创建各模块回调
  const baseCallbacks = createBaseCallbacks(deps);
  const textCallbacks = createTextCallbacks(deps);
  const thinkingCallbacks = createThinkingCallbacks(deps);
  const toolCallbacks = createToolCallbacks(deps);

  // 组合所有回调
  const callbacks: StreamProcessorCallbacks = {
    ...baseCallbacks,
    ...textCallbacks,
    ...thinkingCallbacks,
    ...toolCallbacks,

    // 清理方法
    cleanup: () => {
      toolCallbacks.cleanup?.();
    }
  };

  return callbacks;
}

/**
 * 创建精简的回调集合（用于特定场景）
 */
export function createMinimalCallbacks(deps: CallbackDependencies): StreamProcessorCallbacks {
  const baseCallbacks = createBaseCallbacks(deps);
  const textCallbacks = createTextCallbacks(deps);

  return {
    ...baseCallbacks,
    ...textCallbacks,
    cleanup: () => {}
  };
}
```

---

### Task 2.7: 实现 StreamProcessor

**文件**：`src/shared/services/streaming/StreamProcessor.ts`

```typescript
import type { Chunk } from '../../types/chunk';
import { ChunkType } from '../../types/chunk';
import { AssistantMessageStatus } from '../../types/newMessage';
import type { StreamProcessorCallbacks } from './callbacks/types';

/**
 * 创建流处理器
 * 将 Chunk 分发到对应的回调处理
 */
export function createStreamProcessor(callbacks: StreamProcessorCallbacks) {
  return async (chunk: Chunk) => {
    try {
      switch (chunk.type) {
        // ===== 生命周期 =====
        case ChunkType.LLM_RESPONSE_CREATED:
          await callbacks.onLLMResponseCreated?.();
          break;

        case ChunkType.LLM_RESPONSE_COMPLETE:
          await callbacks.onLLMResponseComplete?.((chunk as any).response);
          break;

        case ChunkType.BLOCK_COMPLETE:
          await callbacks.onComplete?.(AssistantMessageStatus.SUCCESS, (chunk as any).response);
          break;

        // ===== 文本 =====
        case ChunkType.TEXT_START:
          await callbacks.onTextStart?.();
          break;

        case ChunkType.TEXT_DELTA:
          await callbacks.onTextChunk?.((chunk as any).text);
          break;

        case ChunkType.TEXT_COMPLETE:
          await callbacks.onTextComplete?.((chunk as any).text);
          break;

        // ===== 思考链 =====
        case ChunkType.THINKING_START:
          await callbacks.onThinkingStart?.();
          break;

        case ChunkType.THINKING_DELTA:
          await callbacks.onThinkingChunk?.((chunk as any).text, (chunk as any).thinking_millsec);
          break;

        case ChunkType.THINKING_COMPLETE:
          await callbacks.onThinkingComplete?.((chunk as any).text, (chunk as any).thinking_millsec);
          break;

        // ===== 工具调用 =====
        case ChunkType.MCP_TOOL_IN_PROGRESS:
          const inProgressResponses = (chunk as any).responses || [];
          for (const resp of inProgressResponses) {
            await callbacks.onToolCallInProgress?.(resp);
          }
          break;

        case ChunkType.MCP_TOOL_COMPLETE:
          const completeResponses = (chunk as any).responses || [];
          for (const resp of completeResponses) {
            await callbacks.onToolCallComplete?.(resp);
          }
          break;

        // ===== 图像 =====
        case ChunkType.IMAGE_CREATED:
          await callbacks.onImageCreated?.();
          break;

        case ChunkType.IMAGE_DELTA:
          await callbacks.onImageDelta?.((chunk as any).image);
          break;

        case ChunkType.IMAGE_COMPLETE:
          await callbacks.onImageGenerated?.((chunk as any).image);
          break;

        // ===== 错误 =====
        case ChunkType.ERROR:
          await callbacks.onError?.((chunk as any).error);
          break;

        // ===== 其他 =====
        case ChunkType.BLOCK_CREATED:
          await callbacks.onBlockCreated?.();
          break;

        default:
          console.log(`[StreamProcessor] 未处理的 Chunk 类型: ${chunk.type}`);
      }
    } catch (error) {
      console.error('[StreamProcessor] 处理 Chunk 错误:', error);
      await callbacks.onError?.(error);
    }
  };
}
```

---

## ✅ 验收标准

### 功能验收
- [ ] 所有现有 Chunk 类型正确分发到对应回调
- [ ] 文本流式更新正常工作
- [ ] 思考链显示正常
- [ ] 工具调用正常执行
- [ ] 错误正确处理和显示

### 代码验收
- [ ] 每个回调模块独立可测试
- [ ] 添加新 Chunk 类型只需新增回调模块
- [ ] 类型定义完整
- [ ] 向后兼容现有 ResponseHandler

### 测试验收
- [ ] 各回调模块单元测试
- [ ] StreamProcessor 集成测试
- [ ] 端到端对话测试

---

## 📅 里程碑

| 日期 | 任务 | 状态 |
|------|------|------|
| Day 1 | Task 2.1-2.2: 类型定义和基础回调 | ⏳ |
| Day 2 | Task 2.3-2.4: 文本和思考回调 | ⏳ |
| Day 3 | Task 2.5-2.6: 工具回调和组合器 | ⏳ |
| Day 4 | Task 2.7: StreamProcessor 和集成测试 | ⏳ |
