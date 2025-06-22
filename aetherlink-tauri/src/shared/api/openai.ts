/**
 * OpenAI API重定向模块
 * 为了保持兼容性，将导入重定向到新的模块化结构
 */

// 导出所有模块化API
export * from './openai/index';

// 导入并重新导出具体函数，以保持向后兼容性
import { sendChatRequest } from './openai/chat';
import { testConnection } from './openai/client';

// 重新导出主要函数
export { sendChatRequest, testConnection };
