# OpenAI AI SDK Provider

这是一个基于 `@ai-sdk/openai` 的 OpenAI 供应商实现，专门解决浏览器环境下的流式响应延迟问题。

## 特性

✅ **真正的流式响应** - 文字逐字显示，无延迟  
✅ **CORS友好** - 无需 `x-stainless-timeout` 头部，避免浏览器限制  
✅ **完全兼容** - 与现有信息块系统无缝集成  
✅ **推理支持** - 支持推理内容分离和显示  
✅ **工具调用** - 支持MCP工具和函数调用  
✅ **中断功能** - 支持AbortSignal中断流式响应  

## 与标准OpenAI库的对比

| 特性 | 标准OpenAI库 | AI SDK版本 |
|------|-------------|-----------|
| 流式响应 | ⚠️ 可能延迟 | ✅ 真正实时 |
| CORS支持 | ❌ 需要特殊头部 | ✅ 原生支持 |
| 浏览器兼容 | ⚠️ 需要配置 | ✅ 开箱即用 |
| 包大小 | 较大 | 较小 |
| 多供应商 | 仅OpenAI兼容 | 统一接口 |

## 使用方法

### 1. 添加供应商

在设置页面中：
1. 点击"添加供应商"
2. 选择"OpenAI (AI SDK) - 流式优化"
3. 配置API密钥和Base URL
4. 添加模型

### 2. 选择模型

在聊天界面中选择任何AI SDK供应商下的模型即可享受优化的流式响应。

## 技术实现

### 核心文件

- `client.ts` - AI SDK客户端创建和配置
- `stream.ts` - 流式响应处理逻辑
- `provider.ts` - Provider类实现
- `index.ts` - 模块导出

### 关键特性

1. **无缝集成** - 继承自 `BaseOpenAIProvider`，保持接口一致
2. **智能适配** - 自动处理消息格式和参数转换
3. **推理分离** - 支持推理内容的提取和分离显示
4. **错误处理** - 完整的错误处理和日志记录

## 配置示例

```typescript
// 创建AI SDK供应商
const provider = new OpenAIAISDKProvider({
  id: 'gpt-4o',
  provider: 'openai-aisdk',
  apiKey: 'your-api-key',
  baseUrl: 'https://api.openai.com/v1'
});

// 发送消息
const result = await provider.sendChatMessage(messages, {
  onUpdate: (content, reasoning) => {
    // 实时更新信息块
    updateMessageBlock(content, reasoning);
  },
  enableTools: true,
  abortSignal: controller.signal
});
```

## 兼容性

- ✅ 支持所有OpenAI兼容的API端点
- ✅ 支持DeepSeek、智谱AI等第三方供应商
- ✅ 支持推理模型（o1、DeepSeek-R1等）
- ✅ 支持多模态模型（GPT-4V等）
- ✅ 支持工具调用和函数调用

## 故障排除

### 常见问题

1. **流式响应仍然延迟**
   - 检查网络连接
   - 确认API端点支持流式响应
   - 查看控制台日志

2. **API调用失败**
   - 检查API密钥是否正确
   - 确认Base URL格式正确
   - 检查模型ID是否支持

3. **推理内容不显示**
   - 确认模型支持推理功能
   - 检查推理标签配置

### 调试日志

AI SDK Provider会输出详细的调试日志，可以在浏览器控制台中查看：

```
[AI SDK createClient] 创建客户端, 模型ID: gpt-4o
[AI SDK streamCompletion] 开始流式响应...
[AI SDK streamCompletion] 流式响应完成，总长度: 1234
```

## 贡献

如果发现问题或有改进建议，请：
1. 查看控制台日志
2. 记录复现步骤
3. 提交Issue或PR
