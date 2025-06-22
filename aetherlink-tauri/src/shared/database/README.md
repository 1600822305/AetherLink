# 数据库迁移系统

这个文件夹包含了移动端应用的数据库迁移管理系统，用于统一管理数据库版本升级。

## 文件结构

```
src/shared/database/
├── migrations/
│   ├── index.ts                    // 迁移管理器和所有迁移逻辑
│   └── types.ts                    // 迁移相关类型定义
├── config.ts                       // 数据库配置和版本定义
├── index.ts                        // 数据库模块入口
└── README.md                       // 本文档
```

## 主要组件

### 1. 迁移管理器 (DatabaseMigrationManager)

统一管理所有数据库版本迁移的核心组件。

**主要功能：**
- **连续迁移**：按版本顺序执行迁移，不跳过中间版本
- 错误处理和日志记录
- 迁移状态跟踪
- 超时控制

**迁移机制：**
- 从版本3升级到版本7：会依次执行 v4 → v5 → v6 → v7
- 从版本5升级到版本7：会依次执行 v6 → v7
- 确保每个版本的数据变更都被正确应用

### 2. 数据库配置 (config.ts)

包含数据库的基本配置和各版本的表结构定义。

**配置内容：**
- 数据库名称和版本
- 数据表名称常量
- 各版本的表结构配置
- 数据库架构类型定义

### 3. 迁移类型定义 (types.ts)

定义迁移相关的TypeScript类型。

## 如何添加新的数据库版本

### 步骤1：更新配置文件

在 `config.ts` 中添加新版本的配置：

```typescript
// 在 VERSION_CONFIGS 中添加新版本
7: {
  stores: {
    // 定义新版本的表结构
    // 包含所有现有表 + 新增表
  },
  description: '版本7的变更描述'
}
```

### 步骤2：添加迁移逻辑

在 `migrations/index.ts` 中添加新的迁移方法：

```typescript
/**
 * 迁移到版本7：[描述变更内容]
 */
private async migrateToV7(db: any): Promise<void> {
  this.log('开始升级到数据库版本7: [变更描述]...');
  
  try {
    // 在这里添加迁移逻辑
    // 例如：数据转换、新表初始化等
    
    this.log('数据库升级到版本7完成');
  } catch (error) {
    this.log(`版本7迁移失败: ${error}`, 'error');
    throw error;
  }
}
```

### 步骤3：注册新版本

在 `executeSingleMigration` 方法的 switch 语句中添加新版本：

```typescript
case 7:
  await this.migrateToV7(db);
  break;
```

### 步骤4：更新DexieStorageService

在 `DexieStorageService.ts` 的构造函数中添加新版本：

```typescript
this.version(7).stores(VERSION_CONFIGS[7].stores)
  .upgrade(async () => {
    const result = await databaseMigrationManager.executeSingleMigration(this, 7);
    if (!result.success) {
      throw new Error(`版本7迁移失败: ${result.error}`);
    }
  });
```

### 步骤5：更新版本历史

在 `index.ts` 的 `DATABASE_VERSION_HISTORY` 中添加版本记录：

```typescript
{
  version: 7,
  date: '2025-06-01',
  description: '版本7的变更描述',
  changes: [
    '变更1',
    '变更2',
    '变更3'
  ]
}
```

## 迁移最佳实践

### 1. 向后兼容
- 新版本应该包含所有旧版本的表结构
- 避免删除现有字段，使用标记废弃的方式
- 提供数据迁移路径

### 2. 错误处理
- 每个迁移步骤都要有适当的错误处理
- 记录详细的日志信息
- 在迁移失败时提供清晰的错误信息

### 3. 性能考虑
- 大量数据迁移时要考虑分批处理
- 避免在迁移过程中阻塞UI
- 提供迁移进度反馈

### 4. 测试
- 在不同的数据状态下测试迁移
- 验证迁移后的数据完整性
- 测试迁移失败的回滚机制

## 使用示例

```typescript
import { databaseMigrationManager } from '../database/migrations';

// 执行迁移
const results = await databaseMigrationManager.executeMigrations(db, 5, 7);

// 检查迁移结果
for (const result of results) {
  if (result.success) {
    console.log(`版本 ${result.version} 迁移成功，耗时 ${result.duration}ms`);
  } else {
    console.error(`版本 ${result.version} 迁移失败: ${result.error}`);
  }
}
```

## 注意事项

1. **版本号必须连续**：不能跳过版本号，必须按顺序递增
2. **迁移是单向的**：目前不支持回滚，请谨慎设计迁移逻辑
3. **数据备份**：重要数据迁移前建议先备份
4. **测试充分**：在生产环境部署前要充分测试迁移逻辑
