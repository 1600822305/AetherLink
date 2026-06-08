/**
 * OpenAI API模块
 * 导出非聊天能力（图像/视频/模型列表/多模态/客户端/工具格式）。
 * 聊天实现已统一迁移到 AI SDK（见 api/openai-aisdk）；官方 SDK 聊天实现已删除。
 */

// 导出客户端模块
export {
  createClient,
  supportsMultimodal,
  supportsWebSearch,
  supportsReasoning,
  getWebSearchParams,
  testConnection,
  isAzureOpenAI
} from './client';

// 导出模型管理模块
export {
  fetchModels,
  fetchModelsWithSDK,
  parseModelsResponse,
  normalizeModel
} from './models';

// 导出多模态处理模块
export {
  convertToOpenAIMessages,
  hasImages,
  hasOpenAIFormatImages,
  type MessageContentItem
} from './multimodal';

// 导出工具调用模块
export {
  WEB_SEARCH_TOOL
} from './tools';

// 导出图像生成模块
export {
  generateImage,
  generateImageByChat
} from './image';

// 导出视频生成模块
export {
  generateVideo,
  type VideoGenerationParams,
  type GeneratedVideo
} from './video';

// 导出统一参数适配器（推荐使用）
export {
  OpenAIParameterAdapter,
  createOpenAIAdapter,
  type ReasoningParameters as UnifiedReasoningParameters,
  type ResponsesAPIReasoningParameters,
  type BaseAPIParameters,
  type CompleteAPIParameters as UnifiedCompleteAPIParameters
} from '../parameters';
