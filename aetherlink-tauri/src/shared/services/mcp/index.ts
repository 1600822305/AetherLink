/**
 * MCP (Model Context Protocol) 模块统一导出
 * 
 * 这个文件统一导出所有MCP相关的组件，包括：
 * - 核心服务 (core)
 * - 客户端实现 (clients) 
 * - 内置服务器 (servers)
 */

// 核心服务
export { MCPService, mcpService } from './core/MCPService';
export { createInMemoryMCPServer } from './core/MCPServerFactory';

// 客户端实现
export { HttpStreamMCPClient } from './clients/HttpStreamMCPClient';
export { CapacitorCorsMCPClient } from './clients/CapacitorCorsMCPClient';

// 内置服务器
export { BraveSearchServer } from './servers/BraveSearchServer';
export { CalculatorServer } from './servers/CalculatorServer';
export { DifyKnowledgeServer } from './servers/DifyKnowledgeServer';
export { FetchServer } from './servers/FetchServer';
export { FileSystemServer } from './servers/FileSystemServer';
export { LocalGoogleSearchServer } from './servers/LocalGoogleSearchServer';
export { MemoryServer } from './servers/MemoryServer';
export { ThinkingServer } from './servers/ThinkingServer';
export { WebScoutServer } from './servers/WebScoutServer';

// 类型定义 (从共享类型中重新导出)
export type {
  MCPServer,
  MCPTool,
  MCPPrompt,
  MCPResource,
  MCPCallToolResponse,
  MCPToolResponse,
  MCPServerType
} from '../../types';
