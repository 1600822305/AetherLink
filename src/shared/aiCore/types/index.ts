/**
 * AiCore 类型统一导出
 * 
 * 使用方式:
 * import { Provider, ProviderType, Chunk, ChunkType } from '@/shared/aiCore/types';
 */

// ==================== Provider Types ====================
export {
  // Schemas
  ProviderTypeSchema,
  ServiceTierSchema,
  ProviderModelSchema,
  ProviderSchema,
  SystemProviderIdSchema,
  
  // Types
  type ProviderType,
  type ProviderApiOptions,
  type ServiceTier,
  type ProviderModel,
  type Provider,
  type SystemProviderId,
  type SystemProvider,
  type AzureOpenAIProvider,
  type VertexAIProvider,
  type GeminiProvider,
  
  // Type Guards
  isSystemProviderId,
  isSystemProvider,
  isAzureOpenAIProvider,
  isVertexAIProvider,
  isGeminiProvider,
  
  // Validation Functions
  validateProvider,
  safeValidateProvider,
  getValidationErrorMessages,
  
  // Utility Functions
  createDefaultProvider,
  mergeProvider,
} from './provider';

// ==================== Chunk Types ====================
export {
  // Enum
  ChunkType,
  
  // Types (re-exported from shared/types/chunk)
  type Chunk,
  type LLMResponseCreatedChunk,
  type LLMResponseInProgressChunk,
  type TextDeltaChunk,
  type TextCompleteChunk,
  type AudioDeltaChunk,
  type AudioCompleteChunk,
  type ImageCreatedChunk,
  type ImageDeltaChunk,
  type ImageCompleteChunk,
  type ThinkingDeltaChunk,
  type ThinkingCompleteChunk,
  type WebSearchInProgressChunk,
  type WebSearchCompleteChunk,
  type LLMWebSearchInProgressChunk,
  type LLMWebSearchCompleteChunk,
  type ExternalToolInProgressChunk,
  type ExternalToolCompleteChunk,
  type LLMResponseCompleteChunk,
  type ErrorChunk,
  type BlockCreatedChunk,
  type BlockInProgressChunk,
  type BlockCompleteChunk,
  type MCPToolCreatedChunk,
  type MCPToolInProgressChunk,
  type MCPToolCompleteChunk,
  type MCPToolResponse,
  
  // Type Guards
  isTextDeltaChunk,
  isTextCompleteChunk,
  isThinkingDeltaChunk,
  isThinkingCompleteChunk,
  isBlockCompleteChunk,
  isErrorChunk,
  isMcpToolChunk,
  isWebSearchChunk,
  isLLMResponseChunk,
  
  // Factory Functions
  createTextDeltaChunk,
  createTextCompleteChunk,
  createThinkingDeltaChunk,
  createThinkingCompleteChunk,
  createErrorChunk,
  createLLMResponseCreatedChunk,
  createBlockCompleteChunk,
  
  // Utility Functions
  extractTextFromChunks,
  extractThinkingFromChunks,
  getChunkTypeName,
} from './chunk';

// ==================== SDK Types ====================
export {
  // Message Types
  type MessageRole,
  type SdkTextContent,
  type SdkImageUrlContent,
  type SdkImageContent,
  type SdkMessageContent,
  type SdkMessageParam,
  
  // Tool Types
  type SdkFunctionDefinition,
  type SdkTool,
  type SdkToolCall,
  type SdkToolChoice,
  
  // Request Types
  type SdkRequestParams,
  type RequestOptions,
  
  // Response Types
  type SdkUsage,
  type SdkChoice,
  type SdkResponse,
  type SdkStreamChunk,
  
  // Model Types
  type SdkModel,
  type SdkModelsResponse,
  
  // Error Types
  type SdkError,
  type SdkErrorResponse,
  
  // Embedding Types
  type SdkEmbeddingRequest,
  type SdkEmbeddingData,
  type SdkEmbeddingResponse,
  
  // Image Generation Types
  type SdkImageGenerationRequest,
  type SdkImageData,
  type SdkImageGenerationResponse,
  
  // Type Guards
  isSdkStreamChunk,
  isSdkResponse,
  isSdkErrorResponse,
  
  // Utility Types
  type SdkInstance,
  type SdkRawOutput,
  type SdkRawChunk,
} from './sdk';
