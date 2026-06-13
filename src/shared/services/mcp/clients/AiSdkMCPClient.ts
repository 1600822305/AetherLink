/**
 * AI SDK MCP 客户端适配器（移动端专用）
 * 
 * 移动端特点：
 * - 使用 @modelcontextprotocol/sdk 底层客户端
 * - 通过 universalFetch（包含 CorsBypass 插件）绕过 CORS
 * - 移动端 WebView 仍然有 CORS 限制，需要插件支持
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import { universalFetch } from '../../../utils/universalFetch';
import { MCP_PROTOCOL_VERSION } from '../types/constants';
import type { MCPClientOptions, MCPTool, MCPCallToolResponse } from './MCPClientAdapter';
import { createLogger } from '../../infra/logger';

const logger = createLogger('Mobile MCP Client');


export class AiSdkMCPClient {
  private client: Client | null = null;
  private transport: Transport | null = null;
  private options: MCPClientOptions;

  constructor(options: MCPClientOptions) {
    this.options = options;
    
    logger.debug(`创建客户端适配器（移动端 - CorsBypass 插件）`);
    logger.debug(`基础URL: ${options.baseUrl}`);
    logger.debug(`类型: ${options.type || 'streamableHttp'}`);
    logger.debug(`让 SDK 自动管理 session`);
  }

  /**
   * 初始化连接
   */
  async initialize(): Promise<void> {
    logger.debug(`开始初始化连接`);

    try {
      // 创建客户端
      this.client = new Client(
        {
          name: 'AetherLink Mobile',
          version: '1.0.0'
        },
        {
          capabilities: {
            sampling: {},
            roots: {
              listChanged: false
            }
          }
        }
      );
      
      logger.debug('客户端创建完成');

      // 创建传输层（移动端直接使用原生 fetch，无需 CORS 处理）
      this.transport = await this.createTransport();

      // 连接（会自动发送初始化请求，不带 sessionId）
      await this.client.connect(this.transport);

      logger.debug(`连接成功（已发送初始化请求）`);
    } catch (error) {
      logger.error('初始化失败:', error);
      throw error;
    }
  }

  /**
   * 创建传输层（移动端专用，使用 universalFetch + CorsBypass）
   */
  private async createTransport(): Promise<Transport> {
    const { baseUrl, headers, type } = this.options;

    // 移动端使用 universalFetch（自动使用 CorsBypass 插件绕过 CORS）
    logger.debug('使用 universalFetch + CorsBypass 插件');

    // 创建自定义 fetch 函数（完全模仿 Web 端的 MCPClientAdapter）
    const customFetch = async (url: string | URL, init?: RequestInit) => {
      const urlString = typeof url === 'string' ? url : url.toString();
      logger.debug(`Fetch: ${urlString}`);
      logger.debug(`Fetch init:`, init);
      
      // 直接传递所有参数给 universalFetch，不修改（与 Web 端完全一致）
      return universalFetch(urlString, init);
    };

    // 准备 headers（与 MCPClientAdapter 保持一致，包含协议版本）
    const prepareHeaders = () => ({
      ...headers,
      'mcp-protocol-version': MCP_PROTOCOL_VERSION,
    });

    // StreamableHTTP 传输
    if (type === 'streamableHttp') {
      logger.debug('使用 StreamableHTTP 传输（CorsBypass）');
      logger.debug(`SDK 将自动管理 session（初始化请求不带 sessionId）`);
      logger.debug('Headers:', JSON.stringify(headers || {}));
      
      return new StreamableHTTPClientTransport(new URL(baseUrl), {
        fetch: customFetch,  // 使用自定义 fetch
        // 不提供 sessionId - SDK 会在初始化后自动生成和使用
        requestInit: {
          headers: prepareHeaders()
        }
      });
    }

    // SSE 传输（默认）
    logger.debug('使用 SSE 传输（CorsBypass）');
    
    return new SSEClientTransport(new URL(baseUrl), {
      fetch: customFetch,  // 使用自定义 fetch（用于消息发送）
      eventSourceInit: {
        fetch: customFetch  // EventSource 也使用自定义 fetch
      },
      requestInit: {
        headers: prepareHeaders()
      }
    });
  }

  /**
   * 列出工具
   */
  async listTools(): Promise<MCPTool[]> {
    if (!this.client) {
      throw new Error('客户端未初始化');
    }

    logger.debug('列出工具');
    const result = await this.client.listTools();
    logger.debug(`找到 ${result.tools.length} 个工具`);
    
    return result.tools as MCPTool[];
  }

  /**
   * 调用工具
   */
  async callTool(name: string, arguments_: Record<string, any>): Promise<MCPCallToolResponse> {
    if (!this.client) {
      throw new Error('客户端未初始化');
    }

    logger.debug(`调用工具: ${name}`, arguments_);
    
    const result = await this.client.callTool({
      name,
      arguments: arguments_
    });

    logger.debug(`工具调用完成: ${name}`);
    
    return {
      content: (result.content || []) as Array<{
        type: 'text' | 'image' | 'resource';
        text?: string;
        data?: string;
        mimeType?: string;
      }>,
      isError: Boolean(result.isError)
    };
  }

  /**
   * 列出提示词
   */
  async listPrompts(): Promise<any[]> {
    if (!this.client) {
      throw new Error('客户端未初始化');
    }

    logger.debug('列出提示词');
    const result = await this.client.listPrompts();
    logger.debug(`找到 ${result.prompts?.length || 0} 个提示词`);
    
    return result.prompts || [];
  }

  /**
   * 获取提示词
   */
  async getPrompt(name: string, arguments_?: Record<string, any>): Promise<any> {
    if (!this.client) {
      throw new Error('客户端未初始化');
    }

    logger.debug(`获取提示词: ${name}`);
    const result = await this.client.getPrompt({
      name,
      arguments: arguments_
    });
    
    return result;
  }

  /**
   * 列出资源
   */
  async listResources(): Promise<any[]> {
    if (!this.client) {
      throw new Error('客户端未初始化');
    }

    logger.debug('列出资源');
    const result = await this.client.listResources();
    logger.debug(`找到 ${result.resources?.length || 0} 个资源`);
    
    return result.resources || [];
  }

  /**
   * 读取资源
   */
  async readResource(uri: string): Promise<any> {
    if (!this.client) {
      throw new Error('客户端未初始化');
    }

    logger.debug(`读取资源: ${uri}`);
    const result = await this.client.readResource({ uri });
    
    return result;
  }

  /**
   * 关闭连接
   */
  async close(): Promise<void> {
    if (this.client) {
      logger.debug('关闭连接');
      await this.client.close();
      this.client = null;
      this.transport = null;
    }
  }
}
