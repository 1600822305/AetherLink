# Phase 3: MCP 工具调用完善

> **目标**：实现完整的 MCP 工具调用系统，支持递归调用
> **预计工时**：2 天
> **核心参考**：Cherry Studio `McpToolChunkMiddleware.ts`

---

## 1. 当前问题

当前 MCP 工具调用存在以下问题：

1. **递归调用在 AiProvider 层**：工具调用循环在入口层处理，应该移入中间件
2. **缺少深度控制**：没有最大递归深度限制机制
3. **工具结果格式不统一**：不同供应商的工具结果格式处理不一致
4. **提示词注入模式不完善**：`<tool_use>` 标签解析不够健壮

---

## 2. 目标架构

### 2.1 McpToolChunkMiddleware

**职责**：
- 监听工具调用 Chunk
- 执行工具调用
- 构建工具结果消息
- 递归调用 LLM

```typescript
/**
 * MCP 工具调用中间件
 * 对标 Cherry Studio McpToolChunkMiddleware
 */
export const MIDDLEWARE_NAME = 'McpToolChunkMiddleware';

export const McpToolChunkMiddleware: CompletionsMiddleware = (api) => (next) => 
  async (context, params) => {
    const { apiClientInstance, _internal } = context;
    const { mcpTools, onChunk } = params;
    
    // 如果没有工具，直接跳过
    if (!mcpTools?.length) {
      return next(context, params);
    }
    
    // 获取递归深度
    const { recursionDepth, isRecursiveCall } = _internal.toolProcessingState;
    const MAX_RECURSION_DEPTH = 10;
    
    if (recursionDepth >= MAX_RECURSION_DEPTH) {
      console.warn(`[McpToolChunkMiddleware] Max recursion depth reached: ${recursionDepth}`);
      return next(context, params);
    }
    
    // 收集工具调用
    const toolCalls: ToolCallData[] = [];
    let hasToolCalls = false;
    
    // 包装 onChunk 以拦截工具调用
    const wrappedOnChunk = async (chunk: Chunk) => {
      if (chunk.type === ChunkType.MCP_TOOL_IN_PROGRESS) {
        // 收集工具调用
        toolCalls.push(chunk.tool);
        hasToolCalls = true;
      } else if (chunk.type === ChunkType.MCP_TOOL_COMPLETE) {
        // 工具调用完成，准备执行
        hasToolCalls = true;
      }
      
      // 转发给原始回调
      if (onChunk) {
        await onChunk(chunk);
      }
    };
    
    // 修改参数，使用包装后的回调
    const modifiedParams = { ...params, onChunk: wrappedOnChunk };
    
    // 执行下游中间件
    const result = await next(context, modifiedParams);
    
    // 如果有工具调用，执行并递归
    if (hasToolCalls && toolCalls.length > 0) {
      return await handleToolCalls(
        context,
        params,
        toolCalls,
        result,
        recursionDepth
      );
    }
    
    return result;
  };

/**
 * 处理工具调用
 */
async function handleToolCalls(
  context: CompletionsContext,
  params: CompletionsParams,
  toolCalls: ToolCallData[],
  previousResult: CompletionsResult,
  currentDepth: number
): Promise<CompletionsResult> {
  const { apiClientInstance, _internal } = context;
  const { mcpTools, onChunk } = params;
  
  console.log(`[McpToolChunkMiddleware] Executing ${toolCalls.length} tool calls at depth ${currentDepth}`);
  
  // 发送工具调用开始事件
  if (onChunk) {
    for (const toolCall of toolCalls) {
      await onChunk({
        type: ChunkType.MCP_TOOL_CALL_BEGIN,
        tool: toolCall,
      });
    }
  }
  
  // 并行执行所有工具调用
  const toolResults = await Promise.all(
    toolCalls.map(async (toolCall) => {
      try {
        const mcpTool = mcpTools?.find(t => t.name === toolCall.name || t.id === toolCall.name);
        if (!mcpTool) {
          throw new Error(`Tool not found: ${toolCall.name}`);
        }
        
        // 执行 MCP 工具
        const result = await executeMcpTool(mcpTool, toolCall.arguments);
        
        // 发送工具结果事件
        if (onChunk) {
          await onChunk({
            type: ChunkType.MCP_TOOL_CALL_RESPONSE,
            tool: toolCall,
            result,
          });
        }
        
        return {
          toolCall,
          result,
          success: true,
        };
      } catch (error) {
        console.error(`[McpToolChunkMiddleware] Tool execution failed:`, error);
        
        if (onChunk) {
          await onChunk({
            type: ChunkType.MCP_TOOL_CALL_ERROR,
            tool: toolCall,
            error: error instanceof Error ? error.message : String(error),
          });
        }
        
        return {
          toolCall,
          result: { error: error instanceof Error ? error.message : String(error) },
          success: false,
        };
      }
    })
  );
  
  // 构建新的消息列表
  const currentMessages = apiClientInstance.extractMessagesFromSdkPayload(
    context._internal.sdkPayload
  );
  
  // 添加助手消息（包含工具调用）
  const assistantMessage = buildAssistantMessageWithToolCalls(
    previousResult,
    toolCalls,
    apiClientInstance
  );
  
  // 添加工具结果消息
  const toolResultMessages = toolResults.map(({ toolCall, result }) => 
    apiClientInstance.convertMcpToolResponseToSdkMessageParam(
      { id: toolCall.id, tool: mcpTools?.find(t => t.name === toolCall.name)!, arguments: toolCall.arguments },
      result,
      params.assistant?.model!
    )
  ).filter(Boolean);
  
  const newMessages = apiClientInstance.buildSdkMessages(
    currentMessages,
    previousResult.rawOutput,
    toolResultMessages,
    toolCalls
  );
  
  // 递归调用
  const recursiveParams = {
    ...params,
    messages: newMessages,
  };
  
  // 更新递归状态
  context._internal.toolProcessingState = {
    recursionDepth: currentDepth + 1,
    isRecursiveCall: true,
  };
  
  // 使用 enhancedDispatch 进行递归（避免重新构建中间件链）
  if (context._internal.enhancedDispatch) {
    return context._internal.enhancedDispatch(context, recursiveParams);
  }
  
  // Fallback：返回当前结果
  return previousResult;
}

/**
 * 执行 MCP 工具
 */
async function executeMcpTool(
  tool: MCPTool,
  args: Record<string, unknown>
): Promise<MCPCallToolResponse> {
  // 调用 MCP 服务执行工具
  const mcpService = getMcpService();
  return mcpService.callTool(tool.serverId!, tool.name, args);
}
```

### 2.2 ToolUseExtractionMiddleware

**职责**：从文本中提取 `<tool_use>` 标签（提示词注入模式）

```typescript
/**
 * 工具使用提取中间件
 * 处理提示词注入模式的工具调用
 */
export const MIDDLEWARE_NAME = 'ToolUseExtractionMiddleware';

export const ToolUseExtractionMiddleware: CompletionsMiddleware = (api) => (next) =>
  async (context, params) => {
    const { mcpTools, mcpMode, onChunk } = params;
    
    // 只在提示词注入模式下启用
    if (mcpMode !== 'prompt' || !mcpTools?.length) {
      return next(context, params);
    }
    
    let accumulatedText = '';
    
    // 包装 onChunk
    const wrappedOnChunk = async (chunk: Chunk) => {
      if (chunk.type === ChunkType.TEXT_DELTA && 'text' in chunk) {
        accumulatedText += chunk.text;
        
        // 尝试解析工具调用
        const toolUses = parseToolUseTags(accumulatedText, mcpTools);
        
        if (toolUses.length > 0) {
          // 发送工具调用事件
          for (const toolUse of toolUses) {
            if (onChunk) {
              await onChunk({
                type: ChunkType.MCP_TOOL_IN_PROGRESS,
                tool: {
                  id: toolUse.id,
                  name: toolUse.name,
                  arguments: toolUse.arguments,
                },
              });
            }
          }
        }
      }
      
      // 转发原始 chunk
      if (onChunk) {
        await onChunk(chunk);
      }
    };
    
    return next(context, { ...params, onChunk: wrappedOnChunk });
  };

/**
 * 解析 <tool_use> 标签
 */
function parseToolUseTags(text: string, mcpTools: MCPTool[]): ToolUseData[] {
  const toolUses: ToolUseData[] = [];
  
  // 匹配 <tool_use> 标签
  const regex = /<tool_use>\s*<name>(.*?)<\/name>\s*<arguments>([\s\S]*?)<\/arguments>\s*<\/tool_use>/g;
  
  let match;
  while ((match = regex.exec(text)) !== null) {
    const [, name, argsStr] = match;
    
    // 查找对应的 MCP 工具
    const tool = mcpTools.find(t => t.name === name.trim());
    if (tool) {
      try {
        const args = JSON.parse(argsStr.trim());
        toolUses.push({
          id: `tool_${Date.now()}_${toolUses.length}`,
          name: name.trim(),
          arguments: args,
        });
      } catch {
        console.warn(`[ToolUseExtraction] Failed to parse arguments for tool: ${name}`);
      }
    }
  }
  
  return toolUses;
}
```

---

## 3. Chunk 类型增强

需要增加以下 Chunk 类型：

```typescript
// types/chunk.ts

export enum ChunkType {
  // ... 现有类型
  
  // MCP 工具相关
  MCP_TOOL_IN_PROGRESS = 'mcp_tool_in_progress',   // 工具调用进行中
  MCP_TOOL_COMPLETE = 'mcp_tool_complete',         // 工具调用完成
  MCP_TOOL_CALL_BEGIN = 'mcp_tool_call_begin',     // 开始执行工具
  MCP_TOOL_CALL_RESPONSE = 'mcp_tool_call_response', // 工具执行结果
  MCP_TOOL_CALL_ERROR = 'mcp_tool_call_error',     // 工具执行错误
}

export interface McpToolInProgressChunk {
  type: ChunkType.MCP_TOOL_IN_PROGRESS;
  tool: {
    id: string;
    name: string;
    arguments: Record<string, unknown>;
  };
}

export interface McpToolCompleteChunk {
  type: ChunkType.MCP_TOOL_COMPLETE;
  responses: McpToolResponse[];
}

export interface McpToolCallResponseChunk {
  type: ChunkType.MCP_TOOL_CALL_RESPONSE;
  tool: { id: string; name: string };
  result: MCPCallToolResponse;
}
```

---

## 4. 实施步骤

### 4.1 创建中间件文件结构
```
middleware/
├── core/
│   └── McpToolChunkMiddleware.ts   # 主要工具处理
└── feat/
    └── ToolUseExtractionMiddleware.ts  # 标签提取
```

### 4.2 实现 McpToolChunkMiddleware
- [ ] 工具调用收集
- [ ] 工具执行逻辑
- [ ] 递归调用机制
- [ ] 深度限制

### 4.3 实现 ToolUseExtractionMiddleware
- [ ] 标签解析
- [ ] 参数提取
- [ ] 工具匹配

### 4.4 增强 Chunk 类型
- [ ] 添加新 ChunkType
- [ ] 定义对应接口
- [ ] 更新类型导出

### 4.5 集成测试
- [ ] 函数调用模式
- [ ] 提示词注入模式
- [ ] 递归调用
- [ ] 错误处理

---

## 5. 验收标准

- [ ] 函数调用模式正常工作
- [ ] 提示词注入模式正常工作
- [ ] 递归深度限制生效
- [ ] 工具执行错误正确处理
- [ ] Chunk 事件正确发送
