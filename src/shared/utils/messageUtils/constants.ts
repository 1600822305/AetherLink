/**
 * 消息工具常量定义
 */

// 缓存相关常量
export const CACHE_TTL = 5000; // 缓存5秒

// 消息相关常量
export const NEW_MESSAGE_THRESHOLD = 5000; // 5秒内的新消息判断阈值

// 默认内容
export const DEFAULT_EMPTY_CONTENT = '[消息内容为空]';
export const DEFAULT_HELLO_CONTENT = '你好';

// 块ID前缀
export const BLOCK_ID_PREFIXES = {
  DEFAULT: 'default-block-',
  ERROR: 'error-block-'
} as const;

// 图片MIME类型映射
export const IMAGE_MIME_TYPES = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml'
} as const;

// 默认MIME类型
export const DEFAULT_IMAGE_MIME_TYPE = 'image/jpeg';
export const DEFAULT_VIDEO_MIME_TYPE = 'video/mp4';
export const DEFAULT_FILE_MIME_TYPE = 'application/octet-stream';

// 正则表达式
export const CODE_BLOCK_REGEX = /```([a-zA-Z0-9]*)\n([\s\S]*?)```/g;
export const IMAGE_REGEX = /!\[([^\]]*)\]\(([^)]+)\)/g;
