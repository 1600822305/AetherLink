/**
 * Chunk 适配器类型定义
 * 完全参考 Cherry Studio 实现
 * 
 * 注意：主要类型定义已移至对应的适配器文件中
 * 此文件保留用于向后兼容
 */

// 从 ToolCallChunkHandler 重新导出类型
export type { MCPTool, BaseTool, MCPToolResponse, ToolcallsMap } from './ToolCallChunkHandler';

// 从 AiSdkToChunkAdapter 重新导出类型
export type { AiSdkStreamResult, AISDKWebSearchResult, WebSearchResults } from './AiSdkToChunkAdapter';
export { WebSearchSource } from './AiSdkToChunkAdapter';

/**
 * 流处理结果
 */
export interface StreamProcessResult {
  /** 最终文本内容 */
  text: string;
  /** 推理/思考内容 */
  reasoning?: string;
  /** 使用统计 */
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  /** 性能指标 */
  metrics?: {
    completion_tokens: number;
    time_first_token_millsec: number;
    time_completion_millsec: number;
  };
}

/**
 * Provider 类型
 */
export type ProviderType = 
  | 'openai' 
  | 'gemini' 
  | 'anthropic' 
  | 'ollama' 
  | 'openrouter'
  | 'deepseek'
  | 'siliconflow'
  | 'zhipu'
  | 'moonshot'
  | 'qwen'
  | 'groq'
  | 'together'
  | 'custom';
