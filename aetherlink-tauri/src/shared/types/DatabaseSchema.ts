/**
 * 数据库架构类型定义
 * 重新导出新的数据库配置，保持向后兼容性
 */

// 重新导出数据库配置（从新的数据库模块）
export { DB_CONFIG, VERSION_CONFIGS } from '../database/config';

// 重新导出类型（避免重复定义）
export type { AetherLinkDB, ImageMetadata } from '../database/config';

// 图片引用接口（保留这个，因为它在新配置中没有）
export interface ImageReference {
  id: string;
  mimeType: string;
  width?: number;
  height?: number;
}