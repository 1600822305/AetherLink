/**
 * 抽象基类 - 所有供应商客户端的基础
 * 
 * 设计原则：
 * 1. 定义统一接口契约
 * 2. 提供通用功能的默认实现
 * 3. 支持泛型以适应不同SDK
 * 4. 保持职责单一，复杂逻辑放到中间件
 */
import type { Provider } from '../../types/provider';
import type {
  SdkRequestParams,
  SdkMessageParam,
  SdkTool,
  SdkToolCall,
  SdkModel,
  RequestOptions,
} from '../../types/sdk';
import type {
  ApiClient,
  RequestTransformer,
  ResponseChunkTransformer,
  CompletionsContext,
  GenerateImageParams,
  MCPTool,
  MCPToolResponse,
  MCPCallToolResponse,
  Model,
  AssistantConfig,
} from './types';

// AbortController 注册表（用于管理多个请求的中断）
const abortControllerRegistry = new Map<string, AbortController>();

/**
 * 抽象基类
 * 所有供应商客户端都应该继承此类
 */
export abstract class BaseApiClient<
  TSdkInstance = unknown,
  TSdkParams = unknown,
  TRawOutput = unknown,
  TRawChunk = unknown,
  TMessageParam = unknown,
  TToolCall = unknown,
  TSdkTool = unknown
> implements ApiClient<TSdkInstance, TSdkParams, TRawOutput, TRawChunk, TMessageParam, TToolCall, TSdkTool> {

  public provider: Provider;
  protected host: string;
  protected sdkInstance?: TSdkInstance;

  /** API Key 轮询索引 */
  private keyIndex = 0;

  constructor(provider: Provider) {
    this.provider = provider;
    this.host = this.getBaseURL();
  }

  // ==================== 抽象方法（子类必须实现）====================

  /**
   * 创建对话完成请求
   */
  abstract createCompletions(payload: TSdkParams, options?: RequestOptions): Promise<TRawOutput>;

  /**
   * 获取SDK实例
   */
  abstract getSdkInstance(): Promise<TSdkInstance> | TSdkInstance;

  /**
   * 获取模型列表
   */
  abstract listModels(): Promise<SdkModel[]>;

  /**
   * 获取嵌入维度
   */
  abstract getEmbeddingDimensions(model?: Model): Promise<number>;

  /**
   * 生成图像
   */
  abstract generateImage(params: GenerateImageParams): Promise<string[]>;

  /**
   * 获取请求转换器
   */
  abstract getRequestTransformer(): RequestTransformer<TSdkParams, TMessageParam>;

  /**
   * 获取响应块转换器
   */
  abstract getResponseChunkTransformer(ctx: CompletionsContext): ResponseChunkTransformer<TRawChunk>;

  /**
   * 将MCP工具转换为SDK工具格式
   */
  abstract convertMcpToolsToSdkTools(mcpTools: MCPTool[]): TSdkTool[];

  /**
   * 将SDK工具调用转换为MCP格式
   */
  abstract convertSdkToolCallToMcp(toolCall: TToolCall, mcpTools: MCPTool[]): MCPTool | undefined;

  /**
   * 将SDK工具调用转换为MCP工具响应
   */
  abstract convertSdkToolCallToMcpToolResponse(toolCall: TToolCall, mcpTool: MCPTool): MCPToolResponse;

  /**
   * 将MCP工具响应转换为SDK消息参数
   */
  abstract convertMcpToolResponseToSdkMessageParam(
    mcpToolResponse: MCPToolResponse,
    resp: MCPCallToolResponse,
    model: Model
  ): TMessageParam | undefined;

  /**
   * 构建SDK消息
   */
  abstract buildSdkMessages(
    currentReqMessages: TMessageParam[],
    output: TRawOutput | string | undefined,
    toolResults: TMessageParam[],
    toolCalls?: TToolCall[]
  ): TMessageParam[];

  /**
   * 从SDK载荷中提取消息数组
   */
  abstract extractMessagesFromSdkPayload(sdkPayload: TSdkParams): TMessageParam[];

  /**
   * 估算消息token数量
   */
  abstract estimateMessageTokens(message: TMessageParam): number;

  // ==================== 通用方法（默认实现）====================

  /**
   * 获取基础URL
   */
  public getBaseURL(): string {
    return this.provider.apiHost || '';
  }

  /**
   * 获取API密钥 - 支持多密钥轮询
   */
  public getApiKey(): string {
    const apiKey = this.provider.apiKey || '';
    const keys = apiKey.split(',').map(key => key.trim()).filter(Boolean);

    if (keys.length === 0) {
      console.warn(`[BaseApiClient] Provider ${this.provider.id} 没有配置API密钥`);
      return '';
    }

    if (keys.length === 1) {
      return keys[0];
    }

    // 多密钥轮询
    const key = keys[this.keyIndex % keys.length];
    this.keyIndex = (this.keyIndex + 1) % keys.length;

    console.log(`[BaseApiClient] 使用API Key ${this.keyIndex + 1}/${keys.length}`);
    return key;
  }

  /**
   * 获取所有可用的API密钥
   */
  public getAllApiKeys(): string[] {
    const apiKey = this.provider.apiKey || '';
    return apiKey.split(',').map(key => key.trim()).filter(Boolean);
  }

  /**
   * 获取客户端兼容性类型
   */
  public getClientCompatibilityType(_model?: Model): string[] {
    return [this.constructor.name];
  }

  /**
   * 获取默认请求头
   */
  public getDefaultHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // 添加Authorization头
    const apiKey = this.getApiKey();
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    // 添加自定义请求头
    if (this.provider.extraHeaders) {
      Object.assign(headers, this.provider.extraHeaders);
    }

    return headers;
  }

  /**
   * 创建AbortController
   */
  public createAbortController(messageId?: string): {
    abortController: AbortController;
    cleanup: () => void;
  } {
    const abortController = new AbortController();

    // 注册到全局注册表
    if (messageId) {
      // 先清理旧的
      const existing = abortControllerRegistry.get(messageId);
      if (existing) {
        existing.abort();
      }
      abortControllerRegistry.set(messageId, abortController);
    }

    const cleanup = () => {
      if (messageId) {
        abortControllerRegistry.delete(messageId);
      }
    };

    return { abortController, cleanup };
  }

  /**
   * 根据messageId中断请求
   */
  public static abortRequest(messageId: string): boolean {
    const controller = abortControllerRegistry.get(messageId);
    if (controller) {
      controller.abort();
      abortControllerRegistry.delete(messageId);
      return true;
    }
    return false;
  }

  /**
   * 配置工具
   */
  public setupToolsConfig(params: {
    mcpTools?: MCPTool[];
    model: Model;
    enableToolUse?: boolean;
    mcpMode?: 'prompt' | 'function';
  }): { tools: TSdkTool[]; useSystemPrompt: boolean } {
    const { mcpTools, model, enableToolUse, mcpMode = 'function' } = params;
    let tools: TSdkTool[] = [];
    let useSystemPrompt = false;

    if (!mcpTools?.length) {
      return { tools, useSystemPrompt };
    }

    // 工具数量阈值：超过此数量强制使用系统提示词模式
    const SYSTEM_PROMPT_THRESHOLD = 128;

    // 如果用户选择提示词模式或工具数量超过阈值
    if (mcpMode === 'prompt' || mcpTools.length > SYSTEM_PROMPT_THRESHOLD) {
      console.log(`[BaseApiClient] 使用系统提示词模式注入工具`);
      useSystemPrompt = true;
      return { tools, useSystemPrompt };
    }

    // 检查模型是否支持函数调用
    if (this.isFunctionCallingSupported(model) && enableToolUse) {
      tools = this.convertMcpToolsToSdkTools(mcpTools);
      console.log(`[BaseApiClient] 使用函数调用模式，${tools.length} 个工具`);
    } else {
      useSystemPrompt = true;
      console.log(`[BaseApiClient] 模型不支持函数调用，回退到系统提示词模式`);
    }

    return { tools, useSystemPrompt };
  }

  // ==================== 受保护的辅助方法 ====================

  /**
   * 检查模型是否支持函数调用
   * 🔧 修复：大多数现代模型都支持函数调用，默认返回 true
   */
  protected isFunctionCallingSupported(model: Model): boolean {
    // 检查是否明确禁用函数调用
    if (model.capabilities?.functionCalling === false) {
      return false;
    }

    // 检查 Provider 配置是否明确禁用
    if (this.provider.apiOptions?.isSupportFunctionCalling === false) {
      return false;
    }

    // 检查不支持函数调用的模型模式
    const modelId = model.id.toLowerCase();
    const unsupportedPatterns = [
      'text-davinci', 'davinci', 'curie', 'babbage', 'ada',  // 旧版 GPT
      'embedding', 'whisper', 'tts', 'dall-e',  // 非对话模型
      'o1-preview', 'o1-mini'  // 推理模型暂不支持工具
    ];

    if (unsupportedPatterns.some(pattern => modelId.includes(pattern))) {
      return false;
    }

    // 🔧 默认认为支持函数调用（现代模型基本都支持）
    return true;
  }

  /**
   * 获取温度参数
   */
  protected getTemperature(assistant: AssistantConfig, model: Model): number | undefined {
    const settings = assistant?.settings;
    if (settings?.temperature !== undefined) {
      return settings.temperature;
    }
    return model.temperature;
  }

  /**
   * 获取TopP参数
   */
  protected getTopP(assistant: AssistantConfig, _model: Model): number | undefined {
    const settings = assistant?.settings;
    return settings?.topP;
  }

  /**
   * 获取最大Token数
   */
  protected getMaxTokens(assistant: AssistantConfig, model: Model): number {
    return assistant?.settings?.maxTokens ||
      model.maxTokens ||
      4096;
  }

  /**
   * 获取上下文消息数量
   */
  protected getContextCount(assistant: AssistantConfig): number {
    return assistant?.settings?.contextCount || 10;
  }

  /**
   * 检查是否启用流式输出
   */
  protected isStreamEnabled(assistant: AssistantConfig): boolean {
    return assistant?.settings?.streamOutput !== false;
  }

  /**
   * 获取请求超时时间（毫秒）
   */
  protected getTimeout(_model: Model): number {
    return 60 * 1000; // 默认60秒
  }

  /**
   * 清理工具名称（确保符合API要求）
   */
  protected sanitizeToolName(name: string): string {
    let sanitized = name;

    // 不能以数字开头
    if (/^\d/.test(sanitized)) {
      sanitized = `tool_${sanitized}`;
    }

    // 只保留字母、数字、下划线和连字符
    sanitized = sanitized.replace(/[^a-zA-Z0-9_-]/g, '_');

    // 限制长度
    if (sanitized.length > 64) {
      sanitized = sanitized.substring(0, 64);
    }

    // 确保以字母或下划线开头
    if (!/^[a-zA-Z_]/.test(sanitized)) {
      sanitized = `tool_${sanitized}`;
    }

    return sanitized;
  }

  /**
   * 日志输出
   */
  protected log(level: 'debug' | 'info' | 'warn' | 'error', message: string, ...args: unknown[]): void {
    const prefix = `[${this.constructor.name}]`;
    switch (level) {
      case 'debug':
        console.debug(prefix, message, ...args);
        break;
      case 'info':
        console.log(prefix, message, ...args);
        break;
      case 'warn':
        console.warn(prefix, message, ...args);
        break;
      case 'error':
        console.error(prefix, message, ...args);
        break;
    }
  }
}

/**
 * 获取全局 AbortController 注册表
 * 用于外部管理请求中断
 */
export function getAbortControllerRegistry(): Map<string, AbortController> {
  return abortControllerRegistry;
}

/**
 * 中断指定消息的请求
 */
export function abortRequest(messageId: string): boolean {
  return BaseApiClient.abortRequest(messageId);
}
