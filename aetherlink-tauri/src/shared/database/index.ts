/**
 * 数据库模块入口
 * 统一导出数据库相关的配置、类型和服务
 */

// 导出配置
export { DB_CONFIG, VERSION_CONFIGS, type AetherLinkDB, type ImageMetadata } from './config';

// 导出迁移相关
export { databaseMigrationManager, DatabaseMigrationManager } from './migrations';
export type { Migration, MigrationResult, MigrationStatus } from './migrations/types';

/**
 * 数据库版本历史记录
 */
export const DATABASE_VERSION_HISTORY = [
  {
    version: 4,
    date: '2024-01-01',
    description: '规范化消息存储：将消息从topics.messages数组移动到独立的messages表',
    changes: [
      '创建独立的messages表',
      '将topic.messages迁移到messages表',
      '在topic中使用messageIds数组引用消息'
    ]
  },
  {
    version: 5,
    date: '2024-01-15',
    description: '将消息直接存储在topics表中：从独立的messages表回到topics.messages数组',
    changes: [
      '将messages表中的消息迁移回topics.messages数组',
      '移除topic中的messageIds字段',
      '恢复原版的存储方式'
    ]
  },
  {
    version: 6,
    date: '2024-02-01',
    description: '添加文件存储表、知识库相关表和快捷短语表',
    changes: [
      '添加files表用于文件存储',
      '添加knowledge_bases表用于知识库管理',
      '添加knowledge_documents表用于知识库文档',
      '添加quick_phrases表用于快捷短语'
    ]
  }
];

/**
 * 获取数据库版本信息
 */
export function getDatabaseVersionInfo(version: number) {
  return DATABASE_VERSION_HISTORY.find(v => v.version === version);
}

/**
 * 获取所有版本信息
 */
export function getAllVersionHistory() {
  return DATABASE_VERSION_HISTORY;
}

/**
 * 检查版本是否支持
 */
export function isSupportedVersion(version: number): boolean {
  return DATABASE_VERSION_HISTORY.some(v => v.version === version);
}

/**
 * 获取下一个版本号
 */
export function getNextVersion(): number {
  const maxVersion = Math.max(...DATABASE_VERSION_HISTORY.map(v => v.version));
  return maxVersion + 1;
}
