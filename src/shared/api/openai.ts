/**
 * OpenAI API 重定向模块
 * 为保持兼容性，将导入定向到模块化的实现
 */

// 导出所有模块化 API
export * from './openai/index';

// 重新导出连接测试函数（来自 client）
export { testConnection } from './openai/client';
