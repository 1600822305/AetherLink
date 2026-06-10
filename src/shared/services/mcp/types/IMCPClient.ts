/**
 * MCP 客户端接口定义
 * 统一所有 MCP 客户端实现的类型约束，消除 `as unknown as Client` 类型断言
 *
 * SDK 的 Client 类有 60+ 私有属性，无法由手工构造的 compatClient 满足。
 * 此接口仅描述项目实际调用的方法子集，SDK Client 和 compatClient 均可自然实现。
 */

/**
 * listTools 返回的单个工具描述
 */
export interface IMCPToolInfo {
  name: string;
  description?: string;
  inputSchema: Record<string, unknown>;
}

/**
 * callTool 返回的内容项
 */
export interface IMCPContentItem {
  type: string;
  text?: string;
  data?: string;
  mimeType?: string;
  [key: string]: unknown;
}

/**
 * MCP 客户端接口 — 项目实际使用的方法子集
 */
export interface IMCPClient {
  connect(...args: unknown[]): Promise<unknown>;
  close(): Promise<void>;
  ping(...args: unknown[]): Promise<unknown>;

  listTools(...args: unknown[]): Promise<{ tools: IMCPToolInfo[] }>;

  callTool(
    params: { name: string; arguments: Record<string, unknown> },
    resultSchema?: unknown,
    options?: { timeout?: number }
  ): Promise<{ content: IMCPContentItem[]; isError?: boolean }>;

  listPrompts(...args: unknown[]): Promise<{
    prompts: Array<{
      name: string;
      description?: string;
      arguments?: unknown[];
    }>;
  }>;

  listResources(...args: unknown[]): Promise<{
    resources: Array<{
      uri: string;
      name: string;
      description?: string;
      mimeType?: string;
    }>;
  }>;
}
