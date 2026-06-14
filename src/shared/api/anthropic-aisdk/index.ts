/**
 * AI SDK Anthropic 模块导出
 * 提供基于 @ai-sdk/anthropic 的 Claude 供应商实现
 */

// 导出客户端模块
export {
  createClient,
  supportsMultimodal,
  supportsExtendedThinking,
  supportsComputerUse,
  supportsPdfInput,
  isClaudeReasoningModel,
  testConnection,
  getExtendedThinkingConfig,
  getInterleavedThinkingHeaders
} from './client';

// 导出流式处理模块
export {
  streamCompletion,
  nonStreamCompletion,
  type StreamResult,
  type StreamParams
} from './stream';

// 导出工具模块
export {
  convertMcpToolsToAISDK,
  convertMcpToolsToAnthropic,
  convertToolCallsToMcpResponses,
  mcpToolCallResponseToAnthropicMessage,
  findMcpToolByName,
  // Claude 内置工具配置
  createWebSearchToolConfig,
  createWebFetchToolConfig,
  createComputerToolConfig,
  createBashToolConfig,
  createTextEditorToolConfig,
  createCodeExecutionToolConfig,
  isClaudeBuiltinTool,
  // Computer Use 支持
  createClaudeBuiltinTools,
  processComputerToolResult,
  mergeToolsWithBuiltin,
  type ClaudeBuiltinToolType,
  type ClaudeBuiltinToolsConfig,
  type ComputerAction
} from './tools';

// 导出 Provider 类
export {
  BaseAnthropicAISDKProvider,
  BaseAnthropicProvider,
  AnthropicAISDKProvider,
  type AnthropicParameters,
  type ThinkingParameters
} from './provider';

// 重新导出类型
export type { Model, Message, MCPTool } from '../../types';

// 导入 universalFetch 用于 fetchModels
import { universalFetch } from '../../utils/universalFetch';
import { createLogger } from '../../services/infra/logger';

const logger = createLogger('anthropic-aisdk');


/**
 * 获取 Claude 模型列表
 * @param provider 供应商配置
 * @returns 模型列表
 */
export async function fetchModels(provider: any): Promise<any[]> {
  logger.debug(`获取Claude模型列表`);
  
  try {
    const baseUrl = provider.baseUrl || 'https://api.anthropic.com';
    const apiKey = provider.apiKey;
    
    if (!apiKey) {
      logger.warn('未提供 API Key，返回预设模型列表');
      return getDefaultModels();
    }

    // 尝试获取模型列表
    const response = await universalFetch(`${baseUrl}/v1/models`, {
      method: 'GET',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`API请求失败: ${response.status}`);
    }

    const data = await response.json();

    if (data.data && Array.isArray(data.data)) {
      return data.data.map((model: any) => ({
        id: model.id,
        name: model.name || model.id,
        description: model.description || '',
        object: 'model',
        created: Date.now(),
        owned_by: 'anthropic'
      }));
    }

    throw new Error('未找到模型数据');
  } catch (error) {
    logger.error('获取模型列表失败:', error);
    return getDefaultModels();
  }
}

/**
 * 获取默认模型列表
 */
function getDefaultModels(): any[] {
  return [
    // Claude 4.5 系列 (最新)
    { id: 'claude-sonnet-4-5-20250929', name: 'Claude Sonnet 4.5', description: 'Claude Sonnet 4.5 - 最强编程模型，SWE-bench 77.2%', owned_by: 'anthropic' },
    { id: 'claude-opus-4-5-20251120', name: 'Claude Opus 4.5', description: 'Claude Opus 4.5 - 最强旗舰，长时间自主任务', owned_by: 'anthropic' },
    { id: 'claude-haiku-4-5-20251001', name: 'Claude Haiku 4.5', description: 'Claude Haiku 4.5 - 最快模型，高并发', owned_by: 'anthropic' },
    // Claude 4.1 系列
    { id: 'claude-opus-4-1-20250805', name: 'Claude Opus 4.1', description: 'Claude Opus 4.1 - 特殊推理任务', owned_by: 'anthropic' },
    // Claude 4 系列
    { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4', description: 'Claude Sonnet 4 - 编程和推理能力强', owned_by: 'anthropic' },
    { id: 'claude-opus-4-20250514', name: 'Claude Opus 4', description: 'Claude Opus 4 - 持续7小时+任务', owned_by: 'anthropic' },
    // Claude 3.7 系列
    { id: 'claude-3-7-sonnet-20250219', name: 'Claude 3.7 Sonnet', description: 'Claude 3.7 Sonnet - 支持Extended Thinking', owned_by: 'anthropic' },
    // Claude 3.5 系列
    { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', description: 'Claude 3.5 Sonnet - 高性能模型', owned_by: 'anthropic' },
    { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku', description: 'Claude 3.5 Haiku - 快速高效', owned_by: 'anthropic' },
    // Claude 3 系列 (旧版)
    { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus', description: 'Claude 3 Opus - 强大的推理能力', owned_by: 'anthropic' },
    { id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku', description: 'Claude 3 Haiku - 快速且经济', owned_by: 'anthropic' }
  ];
}
