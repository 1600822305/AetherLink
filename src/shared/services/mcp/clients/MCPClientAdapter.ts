/**
 * MCP 客户端适配器
 * 基于官方 @modelcontextprotocol/sdk
 * 支持 SSE 和 HTTP Stream 传输
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import { universalFetch } from '../../../utils/universalFetch';
import { Capacitor } from '@capacitor/core';
import { MobileSSETransport } from './MobileSSETransport';
import { createLogger } from '../../infra/logger';

const logger = createLogger('MCP Client');


export interface MCPClientOptions {
  baseUrl: string;
  headers?: Record<string, string>;
  timeout?: number;
  type?: 'sse' | 'streamableHttp';
}

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: any;
}

export interface MCPCallToolResponse {
  content: Array<{
    type: 'text' | 'image' | 'resource';
    text?: string;
    data?: string;
    mimeType?: string;
  }>;
  isError: boolean;
}

export class MCPClientAdapter {
  private client: Client | null = null;
  private transport: Transport | null = null;
  private options: MCPClientOptions;

  constructor(options: MCPClientOptions) {
    this.options = options;
    logger.debug(`创建客户端适配器`);
    logger.debug(`基础URL: ${options.baseUrl}`);
    logger.debug(`类型: ${options.type || 'sse'}`);
    logger.debug(`平台: ${Capacitor.isNativePlatform() ? '移动端' : 'Web端'}`);
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
          name: 'AetherLink',
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

      // 创建传输层
      this.transport = await this.createTransport();

      // 连接
      await this.client.connect(this.transport);

      logger.debug(`连接成功`);
    } catch (error) {
      logger.error('初始化失败:', error);
      throw error;
    }
  }

  /**
   * 创建传输层
   */
  private async createTransport(): Promise<Transport> {
    const { baseUrl, headers, type } = this.options;

    // 创建自定义 fetch 函数，完全模仿 Cherry Studio 的方式
    const customFetch = async (url: string | URL, init?: RequestInit) => {
      const urlString = typeof url === 'string' ? url : url.toString();
      logger.debug(`Fetch: ${urlString}`);
      logger.debug(`Fetch init:`, init);
      
      // 直接传递所有参数给 universalFetch，不修改
      return universalFetch(urlString, init);
    };

    // 准备 headers（添加 MCP 协议版本）
    const prepareHeaders = () => ({
      'mcp-protocol-version': '2025-03-26',  // MCP 协议版本（必需）
      ...headers
    });

    // StreamableHTTP 传输
    if (type === 'streamableHttp') {
      logger.debug('使用 StreamableHTTP 传输');
      logger.debug('Headers:', JSON.stringify(prepareHeaders()));
      
      const transport = new StreamableHTTPClientTransport(new URL(baseUrl), {
        fetch: customFetch,
        requestInit: {
          headers: prepareHeaders()
        }
      });
      
      logger.debug('StreamableHTTP 传输创建完成');
      return transport;
    }

    // SSE 传输（默认）
    logger.debug('使用 SSE 传输');
    logger.debug('Headers:', JSON.stringify(prepareHeaders()));
    logger.debug('平台检测:', Capacitor.isNativePlatform() ? '移动端（MobileSSETransport）' : 'Web 端（SSEClientTransport）');
    
    // 移动端：使用自定义的 MobileSSETransport（基于 CorsBypass.startSSE）
    // Web 端：使用标准的 SSEClientTransport
    if (Capacitor.isNativePlatform()) {
      logger.debug('移动端：使用 MobileSSETransport（CorsBypass.startSSE）');
      const headers = prepareHeaders();
      logger.debug('准备传递给 MobileSSETransport 的 headers:', JSON.stringify(headers));
      
      return new MobileSSETransport(new URL(baseUrl), {
        headers,
        fetch: customFetch  // 用于发送消息（HTTP POST）
      });
    } else {
      logger.debug('Web 端：使用标准 SSE 配置');
      return new SSEClientTransport(new URL(baseUrl), {
        fetch: customFetch,
        eventSourceInit: {
          fetch: customFetch
        },
        requestInit: {
          headers: prepareHeaders()
        }
      });
    }
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
