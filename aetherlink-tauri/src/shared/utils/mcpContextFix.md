# MCP 工具结果上下文修复

## 问题描述

移动端的 MCP 工具调用结果没有被正确添加到对话上下文中，导致 AI 无法看到工具的执行结果，影响后续对话的连贯性。

## 最佳实例 vs 移动端对比

### 最佳实例（正确的行为）
```json
{
  "role": "user",
  "content": [
    {
      "type": "text",
      "text": "Here is the result of mcp tool use `sequentialthinking`:"
    },
    {
      "type": "text", 
      "text": "{\n  \"thoughtNumber\": 1,\n  \"totalThoughts\": 3,\n  \"nextThoughtNeeded\": true,\n  \"branches\": [],\n  \"thoughtHistoryLength\": 1\n}"
    }
  ]
}
```

### 移动端（修复前）
工具调用结果没有添加到对话上下文中，AI 看不到工具执行结果。

## 修复内容

### 1. 修复工具结果上下文添加逻辑
- 修复了 `handleMCPToolCalls` 函数中的工具结果处理
- 确保工具调用结果正确添加到对话上下文中
- 与最佳实例保持一致的消息格式

### 2. 格式化函数优化
- 更新 `formatToolResultForContext` 函数
- 与最佳实例格式完全一致
- 正确处理单个和多个内容项

### 3. 参数传递修复
- 修复 `getState` 函数的传递问题
- 确保能正确获取当前状态

## 修复后的效果

现在移动端的 MCP 工具调用结果会正确添加到对话上下文中，格式与最佳实例完全一致：

```
Here is the result of mcp tool use `toolName`:

{工具执行结果}
```

这样 AI 就能看到工具的执行结果，并基于这些结果进行后续的对话和推理。

## 测试建议

1. 启用 MCP 工具
2. 让 AI 调用工具（如 sequentialthinking）
3. 检查对话历史中是否包含工具结果消息
4. 验证 AI 能否基于工具结果进行后续对话
