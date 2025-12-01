# Phase 6: 测试与优化

> **优先级**：P0 (必须)  
> **预计工时**：2-3天  
> **依赖**：Phase 1-5 完成

## 🎯 目标

对重构后的消息处理系统进行全面测试和性能优化，确保稳定性和性能达标。

---

## 📝 详细任务

### Task 6.1: 单元测试

#### 适配器测试
```typescript
// __tests__/adapters/OpenAIChunkAdapter.test.ts
describe('OpenAIChunkAdapter', () => {
  it('should emit TEXT_START before TEXT_DELTA', async () => {})
  it('should accumulate text in accumulate mode', async () => {})
  it('should emit THINKING events correctly', async () => {})
  it('should handle tool calls', async () => {})
  it('should emit error on stream failure', async () => {})
})
```

#### 回调测试
```typescript
// __tests__/callbacks/textCallbacks.test.ts
describe('textCallbacks', () => {
  it('should create text block on TEXT_START', async () => {})
  it('should update content on TEXT_DELTA', async () => {})
  it('should complete block on TEXT_COMPLETE', async () => {})
  it('should reuse placeholder block', async () => {})
})
```

#### 队列测试
```typescript
// __tests__/queue/TopicQueue.test.ts
describe('TopicQueue', () => {
  it('should process tasks in order', async () => {})
  it('should respect concurrency limit', async () => {})
  it('should handle task timeout', async () => {})
  it('should pause and resume', async () => {})
})
```

### Task 6.2: 集成测试

#### 端到端消息流程
```typescript
describe('Message Flow Integration', () => {
  it('should complete simple text response', async () => {})
  it('should handle thinking + text response', async () => {})
  it('should handle tool call response', async () => {})
  it('should handle multiple consecutive messages', async () => {})
  it('should handle abort correctly', async () => {})
})
```

### Task 6.3: 性能测试

#### 测试场景
1. **流式渲染性能**：监控 TEXT_DELTA 处理延迟
2. **内存使用**：长对话场景的内存占用
3. **并发处理**：多话题同时对话的性能
4. **节流效果**：验证节流策略是否有效减少更新频率

#### 性能指标
| 指标 | 目标值 | 测试方法 |
|------|--------|----------|
| TEXT_DELTA 延迟 | < 16ms | Performance.now() |
| 内存增长 | < 50MB/100条消息 | Chrome DevTools |
| Redux 更新频率 | < 10次/秒 | Redux DevTools |
| 首字符延迟 | < 500ms | 用户感知测试 |

### Task 6.4: 回归测试

确保重构不影响现有功能：
- [ ] 普通文本对话
- [ ] 深度思考对话
- [ ] 图像生成
- [ ] MCP 工具调用
- [ ] 消息中断/取消
- [ ] 消息重发
- [ ] 消息编辑
- [ ] 多模型对比

### Task 6.5: 优化调整

根据测试结果进行优化：

1. **节流间隔调优**
```typescript
// 根据设备性能动态调整
const throttleInterval = isLowEndDevice ? 200 : 100;
```

2. **内存优化**
```typescript
// 及时清理不需要的状态
callbacks.cleanup = () => {
  accumulatedText = '';
  toolCallsMap.clear();
};
```

3. **错误恢复**
```typescript
// 添加重试机制
const retryableErrors = ['NETWORK_ERROR', 'TIMEOUT'];
if (retryableErrors.includes(error.code)) {
  await retry(task, { maxAttempts: 3 });
}
```

---

## ✅ 验收标准

### 测试覆盖率
- [ ] 适配器模块 > 80%
- [ ] 回调模块 > 80%
- [ ] 队列模块 > 90%
- [ ] StreamProcessor > 80%

### 性能达标
- [ ] TEXT_DELTA 延迟 < 16ms
- [ ] 无明显内存泄漏
- [ ] 节流有效减少更新

### 功能完整
- [ ] 所有回归测试通过
- [ ] 新功能正常工作
- [ ] 错误处理完善

---

## 📅 里程碑

| 日期 | 任务 | 状态 |
|------|------|------|
| Day 1 | Task 6.1: 单元测试 | ⏳ |
| Day 2 | Task 6.2-6.3: 集成和性能测试 | ⏳ |
| Day 3 | Task 6.4-6.5: 回归测试和优化 | ⏳ |

---

## 📊 测试报告模板

```markdown
# 消息系统重构测试报告

## 概述
- 测试日期：YYYY-MM-DD
- 测试版本：x.x.x
- 测试环境：Chrome xx / macOS xx

## 单元测试
- 总用例：xxx
- 通过：xxx
- 失败：xxx
- 覆盖率：xx%

## 性能测试
| 指标 | 目标 | 实际 | 状态 |
|------|------|------|------|
| TEXT_DELTA 延迟 | < 16ms | xxms | ✅/❌ |
| 内存增长 | < 50MB | xxMB | ✅/❌ |

## 回归测试
- [ ] 普通对话
- [ ] 深度思考
- [ ] 工具调用
- ...

## 问题列表
1. [问题描述]
   - 严重程度：高/中/低
   - 状态：已修复/待修复

## 结论
[通过/不通过]，[原因说明]
```
