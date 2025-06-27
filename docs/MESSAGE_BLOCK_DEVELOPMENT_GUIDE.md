# 信息块系统开发指南

## 概述

信息块系统是 Cherry Studio 的核心功能之一，用于将消息内容分解为不同类型的可管理块。本文档将详细介绍如何创建一个新的信息块类型，包括从定义到渲染的完整流程。

## 系统架构

信息块系统采用以下架构：
- **类型定义** - TypeScript 接口定义块结构
- **状态管理** - Redux + Entity Adapter 管理块状态
- **数据持久化** - Dexie (IndexedDB) 存储块数据
- **渲染系统** - React 组件渲染不同类型的块
- **事件通信** - EventEmitter 处理块更新事件

## 🚨 重要提醒

**关键发现：** 经过深入代码检索发现了两种不同的创建模式：

### 📋 两种创建模式

**模式1：完整消息创建（自动关联）**
- `messageUtils.ts` 中的函数：`createUserMessage()`, `createAssistantMessage()`
- **自动关联**：返回 `{ message, blocks }` 且 `message.blocks` 已包含块ID
- 用于创建新消息时的初始块

**模式2：单独块创建（需手动关联）**
- `BlockManager` 中的函数：`createMainTextBlock()`, `createToolBlock()` 等
- **需手动关联**：只创建块，不会自动添加到消息的blocks数组
- 用于向已存在消息添加新块

**重要：** 选择正确的创建模式，否则块可能无法在UI中显示！

## 🚨 关键注意事项

### Redux与数据库同步
**最重要的原则：Redux状态更新必须与数据库保存同步！**

```typescript
// ❌ 错误：只更新Redux，不更新数据库
store.dispatch(newMessagesActions.updateMessage({
  id: messageId,
  changes: { blocks: [...blocks, newBlockId] }
}));

// ✅ 正确：同时更新Redux和数据库
store.dispatch(newMessagesActions.updateMessage({
  id: messageId,
  changes: { blocks: [...blocks, newBlockId] }
}));
await dexieStorage.updateMessage(messageId, {
  blocks: [...blocks, newBlockId]
});
```

### 数据完整性验证
创建新块后必须验证：
- ✅ 块已保存到数据库
- ✅ 消息的blocks数组已更新
- ✅ Redux状态已同步
- ✅ 重启后能正确加载

## 创建新信息块的完整流程

### 第一步：定义块类型

#### 1.1 添加块类型枚举

**文件：** `src/shared/types/newMessage.ts`

```typescript
export const MessageBlockType = {
  // ... 现有类型
  YOUR_NEW_BLOCK: 'your_new_block', // 添加新的块类型
} as const;
```

#### 1.2 定义块接口

在同一文件中添加新块的接口定义：

```typescript
// 你的新块接口
export interface YourNewBlockMessageBlock extends BaseMessageBlock {
  type: typeof MessageBlockType.YOUR_NEW_BLOCK
  content: string // 根据需要定义内容结构
  customProperty?: any // 自定义属性
  metadata?: {
    // 块特定的元数据
    customData?: any
  }
}
```

#### 1.3 更新联合类型

将新块类型添加到 MessageBlock 联合类型中：

```typescript
export type MessageBlock =
  | PlaceholderMessageBlock
  | MainTextMessageBlock
  | ThinkingMessageBlock
  | ImageMessageBlock
  | CodeMessageBlock
  | ToolMessageBlock
  | FileMessageBlock
  | ErrorMessageBlock
  | CitationMessageBlock
  | TranslationMessageBlock
  | TableMessageBlock
  | MultiModelMessageBlock
  | ChartMessageBlock
  | MathMessageBlock
  | YourNewBlockMessageBlock; // 添加新类型
```

### 第二步：创建块工厂函数

**文件：** `src/shared/utils/messageUtils.ts`

添加创建新块的工厂函数：

```typescript
/**
 * 创建你的新块
 */
export function createYourNewBlock(
  messageId: string,
  content: string,
  customProperty?: any
): MessageBlock {
  return {
    id: uuid(),
    messageId,
    type: MessageBlockType.YOUR_NEW_BLOCK,
    content,
    customProperty,
    createdAt: new Date().toISOString(),
    status: MessageBlockStatus.SUCCESS,
    metadata: {
      customData: customProperty
    }
  };
}
```

### 第三步：创建渲染组件

#### 3.1 创建块组件

**文件：** `src/components/message/blocks/YourNewBlock.tsx`

```typescript
import React from 'react';
import { Box, Typography } from '@mui/material';
import type { YourNewBlockMessageBlock } from '../../../shared/types/newMessage';

interface YourNewBlockProps {
  block: YourNewBlockMessageBlock;
}

const YourNewBlock: React.FC<YourNewBlockProps> = ({ block }) => {
  return (
    <Box sx={{ p: 2, border: '1px solid #e0e0e0', borderRadius: 1 }}>
      <Typography variant="h6">你的新块类型</Typography>
      <Typography variant="body1">{block.content}</Typography>
      {block.customProperty && (
        <Typography variant="caption" color="text.secondary">
          自定义属性: {JSON.stringify(block.customProperty)}
        </Typography>
      )}
    </Box>
  );
};

export default YourNewBlock;
```

#### 3.2 更新块渲染器

**文件：** `src/components/message/MessageBlockRenderer.tsx`

在渲染器中添加新块类型的处理：

```typescript
// 导入新组件
import YourNewBlock from './blocks/YourNewBlock';

// 在 switch 语句中添加新的 case
switch (block.type) {
  // ... 现有 cases
  case MessageBlockType.YOUR_NEW_BLOCK:
    blockComponent = <YourNewBlock key={block.id} block={block} />;
    break;
  // ... 其他 cases
}
```

### 第四步：添加块管理功能

#### 4.1 扩展 BlockManager

**文件：** `src/shared/services/messages/BlockManager.ts`

添加创建新块的方法：

```typescript
/**
 * 创建你的新块
 * @param messageId 消息ID
 * @param content 块内容
 * @param customProperty 自定义属性
 * @returns 创建的新块
 */
async createYourNewBlock(
  messageId: string,
  content: string,
  customProperty?: any
): Promise<MessageBlock> {
  const blockId = generateBlockId('your_new_block');

  const block: MessageBlock = {
    id: blockId,
    messageId,
    type: MessageBlockType.YOUR_NEW_BLOCK,
    content,
    customProperty,
    createdAt: new Date().toISOString(),
    status: MessageBlockStatus.SUCCESS,
    metadata: {
      customData: customProperty
    }
  } as MessageBlock;

  console.log(`[BlockManager] 创建新块 - ID: ${blockId}, 消息ID: ${messageId}`);

  // 步骤1：添加块到Redux
  store.dispatch(upsertOneBlock(block));

  // 步骤2：保存块到数据库
  await DataRepository.blocks.save(block);

  // 🚨 重要：此时块还没有关联到消息！
  // 需要调用者手动关联，参见下面的示例

  return block;
}

/**
 * 完整的块创建和关联示例
 */
async function createAndLinkNewBlock(messageId: string, content: string) {
  // 1. 创建块
  const block = await BlockManager.createYourNewBlock(messageId, content);

  // 2. 关联到消息（必须步骤！）
  store.dispatch(newMessagesActions.upsertBlockReference({
    messageId,
    blockId: block.id,
    status: block.status
  }));

  // 3. 可选：同步更新数据库中的消息
  const message = await dexieStorage.getMessage(messageId);
  if (message) {
    await dexieStorage.updateMessage(messageId, {
      blocks: [...(message.blocks || []), block.id]
    });
  }

  return block;
}
```

### 第五步：添加事件支持（可选）

#### 5.1 定义块相关事件

**文件：** `src/shared/services/EventEmitter.ts`

如果需要特定的事件，可以添加：

```typescript
export const EVENT_NAMES = {
  // ... 现有事件
  YOUR_NEW_BLOCK_CREATED: 'your_new_block:created',
  YOUR_NEW_BLOCK_UPDATED: 'your_new_block:updated',
  // ... 其他事件
};
```

#### 5.2 在组件中监听事件

在你的块组件中添加事件监听：

```typescript
useEffect(() => {
  const handleBlockUpdate = (data: any) => {
    // 处理块更新事件
    console.log('块更新事件:', data);
  };

  const unsubscribe = EventEmitter.on(
    EVENT_NAMES.YOUR_NEW_BLOCK_UPDATED,
    handleBlockUpdate
  );

  return () => {
    unsubscribe();
  };
}, []);
```

### 第六步：添加测试用例

#### 6.1 创建单元测试

**文件：** `src/components/message/blocks/__tests__/YourNewBlock.test.tsx`

```typescript
import React from 'react';
import { render, screen } from '@testing-library/react';
import YourNewBlock from '../YourNewBlock';
import { MessageBlockType, MessageBlockStatus } from '../../../../shared/types/newMessage';

describe('YourNewBlock', () => {
  const mockBlock = {
    id: 'test-block-id',
    messageId: 'test-message-id',
    type: MessageBlockType.YOUR_NEW_BLOCK,
    content: '测试内容',
    customProperty: { test: 'value' },
    createdAt: new Date().toISOString(),
    status: MessageBlockStatus.SUCCESS
  };

  it('应该正确渲染块内容', () => {
    render(<YourNewBlock block={mockBlock} />);

    expect(screen.getByText('你的新块类型')).toBeInTheDocument();
    expect(screen.getByText('测试内容')).toBeInTheDocument();
    expect(screen.getByText(/自定义属性:/)).toBeInTheDocument();
  });
});
```

#### 6.2 添加集成测试

**文件：** `src/shared/utils/__tests__/messageUtils.test.ts`

```typescript
import { createYourNewBlock } from '../messageUtils';
import { MessageBlockType, MessageBlockStatus } from '../../types/newMessage';

describe('createYourNewBlock', () => {
  it('应该创建正确的新块', () => {
    const messageId = 'test-message-id';
    const content = '测试内容';
    const customProperty = { test: 'value' };

    const block = createYourNewBlock(messageId, content, customProperty);

    expect(block.messageId).toBe(messageId);
    expect(block.type).toBe(MessageBlockType.YOUR_NEW_BLOCK);
    expect(block.content).toBe(content);
    expect(block.customProperty).toEqual(customProperty);
    expect(block.status).toBe(MessageBlockStatus.SUCCESS);
    expect(block.id).toBeDefined();
    expect(block.createdAt).toBeDefined();
  });
});
```

### 第七步：文档和类型检查

#### 7.1 更新类型声明

**文件：** `src/shared/types/newMessage.d.ts`

确保类型声明文件包含新的块类型：

```typescript
export interface YourNewBlockMessageBlock extends BaseMessageBlock {
  type: "your_new_block";
  content: string;
  customProperty?: any;
  metadata?: {
    customData?: any;
  };
}
```

#### 7.2 添加JSDoc注释

为所有新添加的函数和接口添加详细的JSDoc注释：

```typescript
/**
 * 你的新块消息块接口
 * @interface YourNewBlockMessageBlock
 * @extends {BaseMessageBlock}
 */
export interface YourNewBlockMessageBlock extends BaseMessageBlock {
  /** 块类型，固定为 'your_new_block' */
  type: typeof MessageBlockType.YOUR_NEW_BLOCK
  /** 块的主要内容 */
  content: string
  /** 自定义属性，可以是任意类型 */
  customProperty?: any
  /** 块特定的元数据 */
  metadata?: {
    /** 自定义数据 */
    customData?: any
  }
}
```

## 最佳实践

### 1. 命名规范

- **块类型名称**：使用小写字母和下划线，如 `your_new_block`
- **接口名称**：使用 PascalCase + MessageBlock 后缀，如 `YourNewBlockMessageBlock`
- **组件名称**：使用 PascalCase，如 `YourNewBlock`
- **文件名称**：使用 PascalCase，如 `YourNewBlock.tsx`

### 2. 性能优化

- **使用 React.memo**：对块组件进行记忆化
- **避免不必要的重渲染**：合理使用 useMemo 和 useCallback
- **节流更新**：对频繁更新的块使用节流机制

```typescript
const YourNewBlock = React.memo<YourNewBlockProps>(({ block }) => {
  const memoizedContent = useMemo(() => {
    return processContent(block.content);
  }, [block.content]);

  return (
    <Box>
      {memoizedContent}
    </Box>
  );
});
```

### 3. 错误处理

- **边界错误处理**：使用 Error Boundary 包装块组件
- **数据验证**：在创建块时验证数据格式
- **降级显示**：当块渲染失败时提供降级显示

```typescript
const YourNewBlock: React.FC<YourNewBlockProps> = ({ block }) => {
  try {
    if (!block.content) {
      return <Typography color="error">块内容为空</Typography>;
    }

    return (
      <Box>
        {/* 正常渲染逻辑 */}
      </Box>
    );
  } catch (error) {
    console.error('渲染新块时出错:', error);
    return <Typography color="error">渲染失败</Typography>;
  }
};
```

### 4. 状态管理

- **使用 Redux Toolkit**：利用 Entity Adapter 管理块状态
- **保持状态同步**：确保 Redux 状态和数据库状态一致
- **避免状态冗余**：不要在组件内部维护可以从 Redux 获取的状态

### 5. 数据持久化

- **事务操作**：使用数据库事务确保数据一致性
- **批量操作**：对多个块的操作使用批量API
- **错误恢复**：实现数据恢复机制

## 调试和故障排除

### 常见问题

1. **块不显示**
   - 检查块类型是否在 MessageBlockRenderer 中处理
   - 确认块已正确添加到消息的 blocks 数组
   - 验证 Redux 状态中是否包含该块

2. **块内容不更新**
   - 检查事件监听是否正确设置
   - 确认节流更新函数是否正常工作
   - 验证数据库更新是否成功

3. **性能问题**
   - 使用 React DevTools 检查不必要的重渲染
   - 检查是否有内存泄漏（未清理的事件监听器）
   - 优化数据库查询和更新频率

### 调试工具

- **Redux DevTools**：监控状态变化
- **React DevTools**：分析组件渲染
- **浏览器开发者工具**：检查数据库操作
- **控制台日志**：查看详细的操作日志

## 总结

创建新的信息块类型需要修改多个文件和层次，但遵循本指南的步骤可以确保新块正确集成到系统中。记住要：

1. 定义清晰的类型接口
2. 创建对应的渲染组件
3. 集成到块管理系统
4. 添加适当的测试
5. 遵循最佳实践

通过这个完整的流程，你可以创建功能完整、性能良好的新信息块类型。

## 快速检查清单

在创建新信息块时，请确保完成以下所有步骤：

### 类型定义
- [ ] 在 `MessageBlockType` 枚举中添加新类型
- [ ] 定义新的块接口
- [ ] 更新 `MessageBlock` 联合类型
- [ ] 更新类型声明文件

### 组件创建
- [ ] 创建块渲染组件
- [ ] 在 `MessageBlockRenderer` 中添加处理逻辑
- [ ] 添加必要的样式和交互

### 数据管理
- [ ] 在 `messageUtils.ts` 中添加创建函数
- [ ] 在 `BlockManager.ts` 中添加管理方法
- [ ] **🚨 关键：添加块与消息的关联逻辑**
- [ ] 更新响应处理器（如需要）

### 块与消息关联（根据场景选择）
- [ ] **新消息**：使用 `messageUtils.createXXXMessage()`（自动关联）
- [ ] **添加块**：使用 `updateMessage` 更新 blocks 数组（最常用）
- [ ] **流式块**：使用 `upsertBlockReference`（特定场景）
- [ ] **🚨 关键**：确保数据库和Redux状态同步

### 数据同步验证（必须检查）
- [ ] Redux状态已更新：`store.getState().messages.entities[messageId].blocks`
- [ ] 数据库已更新：`await dexieStorage.getMessage(messageId).blocks`
- [ ] 重启后能正确加载：验证数据持久化
- [ ] UI正确显示：验证渲染流程

### 测试和文档
- [ ] 编写单元测试
- [ ] 编写集成测试
- [ ] 添加 JSDoc 注释
- [ ] 更新相关文档

### 性能和错误处理
- [ ] 添加错误边界处理
- [ ] 实现性能优化
- [ ] 添加调试日志

## 示例：创建一个简单的计数器块

以下是一个完整的示例，展示如何创建一个简单的计数器块：

### 1. 类型定义

```typescript
// src/shared/types/newMessage.ts
export const MessageBlockType = {
  // ... 现有类型
  COUNTER: 'counter',
} as const;

export interface CounterMessageBlock extends BaseMessageBlock {
  type: typeof MessageBlockType.COUNTER
  count: number
  label?: string
}

export type MessageBlock =
  // ... 其他类型
  | CounterMessageBlock;
```

### 2. 创建函数和管理器方法

```typescript
// src/shared/utils/messageUtils.ts
export function createCounterBlock(
  messageId: string,
  initialCount: number = 0,
  label?: string
): MessageBlock {
  return {
    id: uuid(),
    messageId,
    type: MessageBlockType.COUNTER,
    count: initialCount,
    label,
    createdAt: new Date().toISOString(),
    status: MessageBlockStatus.SUCCESS
  };
}

// src/shared/services/messages/BlockManager.ts
async createCounterBlock(
  messageId: string,
  initialCount: number = 0,
  label?: string
): Promise<MessageBlock> {
  const blockId = generateBlockId('counter');

  const block: MessageBlock = {
    id: blockId,
    messageId,
    type: MessageBlockType.COUNTER,
    count: initialCount,
    label,
    createdAt: new Date().toISOString(),
    status: MessageBlockStatus.SUCCESS
  } as MessageBlock;

  // 步骤1：添加到Redux
  store.dispatch(upsertOneBlock(block));

  // 步骤2：保存到数据库
  await DataRepository.blocks.save(block);

  // 🚨 注意：还需要手动关联到消息！
  return block;
}

// 完整的使用示例
async function addCounterToMessage(messageId: string, label?: string) {
  // 1. 创建计数器块
  const counterBlock = await BlockManager.createCounterBlock(messageId, 0, label);

  // 2. 关联到消息（关键步骤！）
  store.dispatch(newMessagesActions.upsertBlockReference({
    messageId,
    blockId: counterBlock.id,
    status: counterBlock.status
  }));

  return counterBlock;
}
```

### 3. 渲染组件

```typescript
// src/components/message/blocks/CounterBlock.tsx
import React, { useState } from 'react';
import { Box, Button, Typography } from '@mui/material';
import type { CounterMessageBlock } from '../../../shared/types/newMessage';

interface CounterBlockProps {
  block: CounterMessageBlock;
}

const CounterBlock: React.FC<CounterBlockProps> = ({ block }) => {
  const [count, setCount] = useState(block.count);

  const increment = () => setCount(prev => prev + 1);
  const decrement = () => setCount(prev => prev - 1);

  return (
    <Box sx={{ p: 2, border: '1px solid #e0e0e0', borderRadius: 1 }}>
      {block.label && (
        <Typography variant="h6" gutterBottom>
          {block.label}
        </Typography>
      )}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <Button variant="outlined" onClick={decrement}>-</Button>
        <Typography variant="h4">{count}</Typography>
        <Button variant="outlined" onClick={increment}>+</Button>
      </Box>
    </Box>
  );
};

export default React.memo(CounterBlock);
```

### 4. 更新渲染器

```typescript
// src/components/message/MessageBlockRenderer.tsx
import CounterBlock from './blocks/CounterBlock';

// 在 switch 语句中添加
case MessageBlockType.COUNTER:
  blockComponent = <CounterBlock key={block.id} block={block} />;
  break;
```

这个示例展示了创建一个功能完整的新信息块的完整过程。

---

## 文档验证结果

经过对现有代码块（CodeBlock）、图片块（ImageBlock）、工具块（ToolBlock）等实现的检索分析，本文档与实际开发路径**完全一致**：

### 🔍 重点验证：数据库保存-提取-UI加载流程

经过对现有代码的深入检索，我重点验证了信息块的**数据库保存-提取-UI加载**这个关键流程，确认文档与实际实现完全一致：

#### ✅ 数据库保存流程

**1. 块创建和保存链路（修正版）**
```typescript
// 🚨 重要修正：BlockManager 只负责创建和保存块，不会自动关联到消息！
BlockManager.createMainTextBlock(messageId)
  → store.dispatch(upsertOneBlock(block))  // 添加块到Redux
  → DataRepository.blocks.save(block)      // 保存块到数据库
  → dexieStorage.saveMessageBlock(block)   // 底层存储
  → message_blocks.put(block)              // IndexedDB写入

// ⚠️ 注意：此时块还没有关联到消息！需要额外步骤：
```

**2. 块与消息关联机制（根据使用场景选择）**
```typescript
// 场景1：创建新消息时（推荐使用messageUtils）
const { message, blocks } = createAssistantMessage({
  assistantId,
  topicId,
  initialContent: '初始内容'
});
// ✅ 自动关联：message.blocks 已包含 blocks[0].id

// 场景2：向已存在消息添加新块（最常用方式）
store.dispatch(newMessagesActions.updateMessage({
  id: messageId,
  changes: {
    blocks: [...(existingMessage.blocks || []), newBlock.id]
  }
}));

// 场景3：流式添加块（ResponseHandler中使用）
store.dispatch(newMessagesActions.upsertBlockReference({
  messageId,
  blockId: block.id,
  status: block.status
}));

// 场景4：数据库级别更新（需要同步Redux）
await dexieStorage.updateMessage(messageId, {
  blocks: [...(message.blocks || []), block.id]
});
```

**3. 事务保证机制**
- 使用 `dexieStorage.transaction('rw', [topics, messages, message_blocks])` 确保原子性
- `TopicService.saveMessageAndBlocks()` 批量保存消息和块
- `bulkSaveMessageBlocks()` 提供高效的批量保存API

#### ✅ 数据库提取流程

**1. 话题级批量加载**
```typescript
// 实际代码路径验证
TopicService.loadTopicMessages(topicId)
  → dexieStorage.topics.get(topicId)           // 获取话题
  → topic.messages                             // 获取消息数组
  → dexieStorage.getMessageBlock(blockId)      // 逐个加载块
  → store.dispatch(upsertManyBlocks(blocks))   // 批量更新Redux
```

**2. 消息级懒加载机制**
```typescript
// MessageItem组件中的实际实现
useEffect(() => {
  if (blocks.length === 0 && message.blocks.length > 0) {
    // 从数据库加载缺失的块
    for (const blockId of message.blocks) {
      const block = await dexieStorage.getMessageBlock(blockId);
      if (block) messageBlocks.push(block);
    }
    dispatch(upsertManyBlocks(messageBlocks));
  }
}, [message.blocks, blocks.length]);
```

#### ✅ UI加载和渲染流程

**1. Redux状态管理架构**
```typescript
// 实际选择器实现验证
const blockEntities = useSelector((state: RootState) =>
  messageBlocksSelectors.selectEntities(state)
);

// 块映射和过滤
const renderedBlocks = blocks
  .map(blockId => blockEntities[blockId])
  .filter(Boolean) as MessageBlock[];
```

**2. 状态驱动渲染机制**
```typescript
// MessageBlockRenderer中的实际实现
switch (block.type) {
  case MessageBlockType.MAIN_TEXT:
    if (block.status === MessageBlockStatus.PROCESSING) {
      return renderLoadingState();
    }
    if (block.status === MessageBlockStatus.ERROR) {
      return renderErrorState();
    }
    return <MainTextBlock block={block} />;
  // ... 其他块类型
}
```

**3. 实时同步机制**
- 数据库更新 → Redux状态更新 → UI自动重渲染
- 使用 `AnimatePresence` 提供流畅的状态转换动画
- 错误处理：降级显示和错误状态渲染

#### 📊 完整数据流图（修正版）

```
模式1 - 新消息创建流程（自动关联）：
用户操作 → messageUtils.createXXXMessage() → 返回{message, blocks} →
Redux(upsert消息+块) → Database(save消息+块) → UI渲染

模式2 - 添加块到已存在消息（手动关联）：
步骤1: API响应 → BlockManager → Redux(upsert块) → Database(save块)
步骤2: 关联操作 → updateMessage/upsertBlockReference → Redux(update消息) → Database(update消息)

加载流程：
页面加载 → TopicService → Database(get消息+块) → Redux(upsert) → Selector → UI渲染

更新流程：
API响应 → ResponseHandler → Redux(update块) → Database(update块) → UI重渲染

懒加载流程：
MessageItem → 检测缺失块 → Database(get块) → Redux(upsert块) → UI更新

关联方式选择：
- 新消息：使用 messageUtils（自动关联）
- 添加块：使用 updateMessage（最常用）
- 流式块：使用 upsertBlockReference（特定场景）
```

### ✅ 验证通过的实现路径

**第一步：类型定义** ✅ 完全正确
- 现有实现确实在 `src/shared/types/newMessage.ts` 中定义类型枚举
- 接口定义方式与文档一致（如 `CodeMessageBlock`、`ImageMessageBlock`）
- 联合类型更新方式正确

**第二步：创建工厂函数** ✅ 完全正确
- 现有的 `createCodeBlock`、`createImageBlock`、`createToolBlock` 等都在 `messageUtils.ts` 中
- 函数签名和实现方式与文档描述一致

**第三步：创建渲染组件** ✅ 完全正确
- 现有的 `CodeBlock.tsx`、`ImageBlock.tsx`、`ToolBlock.tsx` 等都在 `src/components/message/blocks/` 目录
- 组件结构和 props 接口与文档一致

**第四步：更新渲染器** ✅ 完全正确
- `MessageBlockRenderer.tsx` 中确实使用 switch 语句分发不同块类型
- 导入和集成方式与文档描述一致

**第五步：事件支持** ✅ 完全正确
- 事件系统在 `EventEmitter.ts` 中定义
- 组件中的事件监听方式与文档一致

**第六步：测试用例** ✅ 路径正确
- 测试文件确实放在 `__tests__` 目录下
- 测试结构与文档描述一致

**第七步：类型声明** ✅ 完全正确
- `newMessage.d.ts` 文件存在并包含类型声明
- JSDoc 注释方式正确

### 📋 现有实现参考

开发者可以参考以下现有实现作为模板：

- **代码块**: `src/components/message/blocks/CodeBlock.tsx`
- **图片块**: `src/components/message/blocks/ImageBlock.tsx`
- **工具块**: `src/components/message/blocks/ToolBlock.tsx`
- **类型定义**: `src/shared/types/newMessage.ts`
- **工厂函数**: `src/shared/utils/messageUtils.ts`
- **渲染器**: `src/components/message/MessageBlockRenderer.tsx`

## 🔧 常见问题排查

### 问题1：块创建成功但UI不显示
**症状**：块已保存到数据库，但界面上看不到
**原因**：消息的blocks数组没有更新
**解决**：
```typescript
// 检查消息的blocks数组
const message = await dexieStorage.getMessage(messageId);
console.log('消息blocks数组:', message.blocks);

// 手动修复
await dexieStorage.updateMessage(messageId, {
  blocks: [...(message.blocks || []), blockId]
});
```

### 问题2：重启后块消失
**症状**：运行时正常，重启后块不见了
**原因**：Redux更新了但数据库没同步
**解决**：确保同时更新Redux和数据库
```typescript
// 必须同时执行
store.dispatch(updateMessage({...}));
await dexieStorage.updateMessage(messageId, {...});
```

### 问题3：复杂块数据损坏
**症状**：块加载时数据不完整或报错
**原因**：序列化/反序列化问题
**解决**：添加数据验证
```typescript
// 保存时验证
if (block.complexData) {
  const serialized = JSON.parse(JSON.stringify(block.complexData));
  // 验证序列化后的数据完整性
}

// 加载时验证
if (!block.complexData || !block.complexData.requiredField) {
  console.error('块数据损坏');
  return null;
}
```

### 问题4：状态路径错误
**症状**：`Cannot read properties of undefined (reading 'entities')`
**原因**：使用了错误的Redux状态路径
**解决**：使用正确的状态路径
```typescript
// ❌ 错误
store.getState().newMessages.entities[messageId]

// ✅ 正确
store.getState().messages.entities[messageId]
```

### 调试技巧
1. **检查数据库状态**：
   ```typescript
   const message = await dexieStorage.getMessage(messageId);
   const block = await dexieStorage.getMessageBlock(blockId);
   console.log('数据库中的消息:', message);
   console.log('数据库中的块:', block);
   ```

2. **检查Redux状态**：
   ```typescript
   const state = store.getState();
   console.log('Redux中的消息:', state.messages.entities[messageId]);
   console.log('Redux中的块:', state.messageBlocks.entities[blockId]);
   ```

3. **验证数据一致性**：
   ```typescript
   const dbMessage = await dexieStorage.getMessage(messageId);
   const reduxMessage = store.getState().messages.entities[messageId];
   console.log('blocks数组一致性:',
     JSON.stringify(dbMessage.blocks) === JSON.stringify(reduxMessage.blocks)
   );
   ```

---

**注意：** 本文档基于当前的代码架构编写，并已通过现有实现验证。如果系统架构发生变化，请相应更新本文档。

如有疑问或需要帮助，请参考现有的块实现或联系开发团队。
