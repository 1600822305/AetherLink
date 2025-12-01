# Phase 3: 队列控制系统

> **优先级**：P1 (建议)  
> **预计工时**：1-2天  
> **依赖**：无

## 🎯 目标

实现 Topic 级别的消息队列控制，确保同一话题的消息按顺序处理，避免并发竞态条件。

---

## 📋 当前问题

### 问题描述
当前 AetherLink 直接 `await` 处理助手响应，没有队列控制：

```typescript
// sendMessage.ts - 直接 await
await processAssistantResponse(dispatch, getState, assistantMessage, topicId, model, toolsEnabled);
```

**问题**：
1. 快速连续发送多条消息时可能出现竞态条件
2. 消息顺序可能错乱
3. 无法优雅地取消排队中的请求

---

## 🏗️ 目标架构

### Cherry Studio 参考
```typescript
// messageThunk.ts
const queue = getTopicQueue(topicId)
queue.add(async () => {
  await fetchAndProcessAssistantResponseImpl(dispatch, getState, topicId, assistant, assistantMessage)
})

// utils/queue.ts
import PQueue from 'p-queue'

const topicQueues = new Map<string, PQueue>()

export function getTopicQueue(topicId: string): PQueue {
  if (!topicQueues.has(topicId)) {
    topicQueues.set(topicId, new PQueue({ concurrency: 1 }))
  }
  return topicQueues.get(topicId)!
}

export async function waitForTopicQueue(topicId: string): Promise<void> {
  const queue = topicQueues.get(topicId)
  if (queue) {
    await queue.onIdle()
  }
}
```

### AetherLink 目标结构
```
src/shared/utils/
├── queue/
│   ├── index.ts           # 导出入口
│   ├── TopicQueue.ts      # Topic 队列类
│   └── types.ts           # 类型定义
```

---

## 📝 详细任务

### Task 3.1: 实现 TopicQueue 类

**文件**：`src/shared/utils/queue/types.ts`

```typescript
/**
 * 队列任务
 */
export interface QueueTask<T = any> {
  /** 任务 ID */
  id: string;
  /** 任务执行函数 */
  execute: () => Promise<T>;
  /** 优先级（数字越小优先级越高）*/
  priority?: number;
  /** 创建时间 */
  createdAt: number;
}

/**
 * 队列配置
 */
export interface QueueConfig {
  /** 并发数 */
  concurrency: number;
  /** 超时时间（毫秒）*/
  timeout?: number;
  /** 任务失败重试次数 */
  retries?: number;
}

/**
 * 队列状态
 */
export interface QueueStatus {
  /** 排队中的任务数 */
  pending: number;
  /** 正在执行的任务数 */
  running: number;
  /** 队列是否暂停 */
  isPaused: boolean;
  /** 队列是否空闲 */
  isIdle: boolean;
}
```

**文件**：`src/shared/utils/queue/TopicQueue.ts`

```typescript
import type { QueueConfig, QueueTask, QueueStatus } from './types';

/**
 * Topic 消息队列
 * 确保同一话题的消息按顺序处理
 */
export class TopicQueue {
  private queue: QueueTask[] = [];
  private running: Set<string> = new Set();
  private config: QueueConfig;
  private isPaused = false;
  private idlePromise: Promise<void> | null = null;
  private idleResolve: (() => void) | null = null;

  constructor(config: Partial<QueueConfig> = {}) {
    this.config = {
      concurrency: 1,
      timeout: 60000,
      retries: 0,
      ...config
    };
  }

  /**
   * 添加任务到队列
   */
  async add<T>(
    execute: () => Promise<T>,
    options?: { id?: string; priority?: number }
  ): Promise<T> {
    const task: QueueTask<T> = {
      id: options?.id || `task_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      execute,
      priority: options?.priority ?? 0,
      createdAt: Date.now()
    };

    return new Promise((resolve, reject) => {
      const wrappedExecute = async () => {
        try {
          const result = await this.executeWithTimeout(execute);
          resolve(result);
          return result;
        } catch (error) {
          reject(error);
          throw error;
        }
      };

      this.queue.push({ ...task, execute: wrappedExecute });
      this.sortQueue();
      this.processNext();
    });
  }

  /**
   * 按优先级排序队列
   */
  private sortQueue(): void {
    this.queue.sort((a, b) => {
      if (a.priority !== b.priority) {
        return (a.priority ?? 0) - (b.priority ?? 0);
      }
      return a.createdAt - b.createdAt;
    });
  }

  /**
   * 处理下一个任务
   */
  private async processNext(): Promise<void> {
    if (this.isPaused) return;
    if (this.running.size >= this.config.concurrency) return;
    if (this.queue.length === 0) {
      this.checkIdle();
      return;
    }

    const task = this.queue.shift()!;
    this.running.add(task.id);

    try {
      await task.execute();
    } catch (error) {
      console.error(`[TopicQueue] 任务 ${task.id} 执行失败:`, error);
    } finally {
      this.running.delete(task.id);
      this.processNext();
    }
  }

  /**
   * 带超时的任务执行
   */
  private async executeWithTimeout<T>(execute: () => Promise<T>): Promise<T> {
    if (!this.config.timeout) {
      return execute();
    }

    return Promise.race([
      execute(),
      new Promise<T>((_, reject) => {
        setTimeout(() => reject(new Error('Task timeout')), this.config.timeout);
      })
    ]);
  }

  /**
   * 检查是否空闲
   */
  private checkIdle(): void {
    if (this.queue.length === 0 && this.running.size === 0 && this.idleResolve) {
      this.idleResolve();
      this.idlePromise = null;
      this.idleResolve = null;
    }
  }

  /**
   * 等待队列空闲
   */
  async onIdle(): Promise<void> {
    if (this.queue.length === 0 && this.running.size === 0) {
      return;
    }

    if (!this.idlePromise) {
      this.idlePromise = new Promise(resolve => {
        this.idleResolve = resolve;
      });
    }

    return this.idlePromise;
  }

  /**
   * 暂停队列
   */
  pause(): void {
    this.isPaused = true;
  }

  /**
   * 恢复队列
   */
  resume(): void {
    this.isPaused = false;
    this.processNext();
  }

  /**
   * 清空队列
   */
  clear(): void {
    this.queue = [];
    this.checkIdle();
  }

  /**
   * 获取队列状态
   */
  getStatus(): QueueStatus {
    return {
      pending: this.queue.length,
      running: this.running.size,
      isPaused: this.isPaused,
      isIdle: this.queue.length === 0 && this.running.size === 0
    };
  }

  /**
   * 获取排队中的任务数
   */
  get size(): number {
    return this.queue.length;
  }

  /**
   * 获取正在执行的任务数
   */
  get pending(): number {
    return this.running.size;
  }
}
```

---

### Task 3.2: 实现队列管理器

**文件**：`src/shared/utils/queue/index.ts`

```typescript
import { TopicQueue } from './TopicQueue';
import type { QueueConfig, QueueStatus } from './types';

export * from './types';
export { TopicQueue } from './TopicQueue';

// 全局队列管理
const topicQueues = new Map<string, TopicQueue>();

/**
 * 获取 Topic 队列
 * 如果不存在则创建新队列
 */
export function getTopicQueue(topicId: string, config?: Partial<QueueConfig>): TopicQueue {
  if (!topicQueues.has(topicId)) {
    topicQueues.set(topicId, new TopicQueue({
      concurrency: 1,
      timeout: 120000, // 2分钟超时
      ...config
    }));
  }
  return topicQueues.get(topicId)!;
}

/**
 * 等待 Topic 队列空闲
 */
export async function waitForTopicQueue(topicId: string): Promise<void> {
  const queue = topicQueues.get(topicId);
  if (queue) {
    await queue.onIdle();
  }
}

/**
 * 清除 Topic 队列
 */
export function clearTopicQueue(topicId: string): void {
  const queue = topicQueues.get(topicId);
  if (queue) {
    queue.clear();
    topicQueues.delete(topicId);
  }
}

/**
 * 暂停 Topic 队列
 */
export function pauseTopicQueue(topicId: string): void {
  const queue = topicQueues.get(topicId);
  if (queue) {
    queue.pause();
  }
}

/**
 * 恢复 Topic 队列
 */
export function resumeTopicQueue(topicId: string): void {
  const queue = topicQueues.get(topicId);
  if (queue) {
    queue.resume();
  }
}

/**
 * 获取所有队列状态
 */
export function getAllQueueStatus(): Map<string, QueueStatus> {
  const statuses = new Map<string, QueueStatus>();
  topicQueues.forEach((queue, topicId) => {
    statuses.set(topicId, queue.getStatus());
  });
  return statuses;
}

/**
 * 清除所有队列
 */
export function clearAllQueues(): void {
  topicQueues.forEach(queue => queue.clear());
  topicQueues.clear();
}
```

---

### Task 3.3: 集成到 sendMessage

**修改文件**：`src/shared/store/thunks/message/sendMessage.ts`

```typescript
import { getTopicQueue, waitForTopicQueue } from '../../../utils/queue';

export const sendMessage = (
  content: string,
  topicId: string,
  model: Model,
  images?: Array<{ url: string }>,
  toolsEnabled?: boolean,
  files?: FileType[]
) => async (dispatch: AppDispatch, getState: () => RootState) => {
  try {
    // ... 创建用户消息的代码保持不变 ...

    // 4. 创建助手消息
    const { message: assistantMessage, blocks: assistantBlocks } = createAssistantMessage({
      assistantId,
      topicId,
      modelId: getModelIdentityKey({ id: model.id, provider: model.provider }),
      model,
      askId: userMessage.id,
      status: AssistantMessageStatus.PENDING
    });

    // 5. 保存助手消息到数据库
    await saveMessageAndBlocksToDB(assistantMessage, assistantBlocks);

    // 6. 更新Redux状态
    dispatch(newMessagesActions.addMessage({ topicId, message: assistantMessage }));
    if (assistantBlocks.length > 0) {
      dispatch(upsertManyBlocks(assistantBlocks));
    }

    // 7. 设置加载状态
    dispatch(newMessagesActions.setTopicLoading({ topicId, loading: true }));
    dispatch(newMessagesActions.setTopicStreaming({ topicId, streaming: true }));

    // 8. 🔧 使用队列处理助手响应
    const queue = getTopicQueue(topicId);
    queue.add(async () => {
      await processAssistantResponse(dispatch, getState, assistantMessage, topicId, model, toolsEnabled);
    }, {
      id: `msg_${assistantMessage.id}`,
      priority: 0
    });

    return userMessage.id;
  } catch (error) {
    console.error('发送消息失败:', error);
    dispatch(newMessagesActions.setTopicLoading({ topicId, loading: false }));
    dispatch(newMessagesActions.setTopicStreaming({ topicId, streaming: false }));
    throw error;
  } finally {
    // 等待队列完成后再清除加载状态
    await waitForTopicQueue(topicId);
    dispatch(newMessagesActions.setTopicLoading({ topicId, loading: false }));
  }
};
```

---

### Task 3.4: 处理消息取消

**修改文件**：`src/shared/utils/abortController.ts`

```typescript
import { pauseTopicQueue, resumeTopicQueue, clearTopicQueue } from './queue';

/**
 * 取消当前话题的所有请求
 */
export function cancelTopicRequests(topicId: string): void {
  // 暂停队列
  pauseTopicQueue(topicId);
  
  // 取消当前运行的请求
  const controller = activeControllers.get(topicId);
  if (controller) {
    controller.abort();
    activeControllers.delete(topicId);
  }
  
  // 清空排队中的请求
  clearTopicQueue(topicId);
}

/**
 * 仅取消当前请求，保留队列
 */
export function cancelCurrentRequest(topicId: string): void {
  const controller = activeControllers.get(topicId);
  if (controller) {
    controller.abort();
    activeControllers.delete(topicId);
  }
}
```

---

## ✅ 验收标准

### 功能验收
- [ ] 同一话题的消息严格按顺序处理
- [ ] 快速连续发送多条消息不会出现竞态
- [ ] 可以取消排队中的请求
- [ ] 队列暂停和恢复正常工作

### 代码验收
- [ ] TopicQueue 类可独立测试
- [ ] 队列状态可查询
- [ ] 超时处理正确

### 测试验收
- [ ] 并发消息测试
- [ ] 队列取消测试
- [ ] 超时测试
- [ ] 压力测试

---

## 📅 里程碑

| 日期 | 任务 | 状态 |
|------|------|------|
| Day 1 | Task 3.1-3.2: TopicQueue 和管理器 | ⏳ |
| Day 2 | Task 3.3-3.4: 集成和测试 | ⏳ |

---

## ⚠️ 注意事项

1. **内存管理**：长时间不活跃的队列应自动清理
2. **错误隔离**：单个任务失败不应影响队列其他任务
3. **状态同步**：队列状态需要与 Redux 状态保持一致
