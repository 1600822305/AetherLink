/**
 * 内置 MCP 服务器配置
 * 集中管理所有内置 MCP 工具的配置信息
 */

import type { MCPServer } from '../types';

/**
 * 内置 MCP 服务器配置列表
 * 添加新的内置 MCP 工具时，只需要在这里添加配置即可
 */
export const BUILTIN_MCP_SERVERS: MCPServer[] = [
  {
    id: 'builtin-fetch',
    name: '@aether/fetch',
    type: 'inMemory',
    description: '用于获取 URL 网页内容的 MCP 服务器',
    isActive: false,
    provider: 'AetherAI',
    logoUrl: '',
    tags: ['网页', '抓取']
  },
  {
    id: 'builtin-thinking',
    name: '@aether/sequentialthinking',
    type: 'inMemory',
    description: '一个 MCP 服务器实现，提供了通过结构化思维过程进行动态和反思性问题解决的工具',
    isActive: false,
    provider: 'AetherAI',
    logoUrl: '',
    tags: ['思维', '推理']
  },
  {
    id: 'builtin-memory',
    name: '@aether/memory',
    type: 'inMemory',
    description: '基于本地知识图谱的持久性记忆基础实现。这使得模型能够在不同对话间记住用户的相关信息。需要配置 MEMORY_FILE_PATH 环境变量。',
    isActive: false,
    env: {
      MEMORY_FILE_PATH: 'memory.json'
    },
    provider: 'AetherAI',
    logoUrl: '',
    tags: ['记忆', '知识图谱']
  },
  {
    id: 'builtin-brave-search',
    name: '@aether/brave-search',
    type: 'inMemory',
    description: '一个集成了 Brave 搜索 API 的 MCP 服务器实现，提供网页与本地搜索双重功能。需要配置 BRAVE_API_KEY 环境变量',
    isActive: false,
    env: {
      BRAVE_API_KEY: 'YOUR_API_KEY'
    },
    provider: 'AetherAI',
    logoUrl: '',
    tags: ['搜索', 'Brave']
  },
  {
    id: 'builtin-filesystem',
    name: '@aether/filesystem',
    type: 'inMemory',
    description: '实现文件系统操作的模型上下文协议（MCP）的 Node.js 服务器',
    isActive: false,
    provider: 'AetherAI',
    logoUrl: '',
    tags: ['文件系统', '文件操作']
  },
  {
    id: 'builtin-dify-knowledge',
    name: '@aether/dify-knowledge',
    type: 'inMemory',
    description: 'Dify 知识库集成服务器，提供知识库搜索功能。需要配置 DIFY_KEY 环境变量',
    isActive: false,
    env: {
      DIFY_KEY: 'YOUR_DIFY_KEY'
    },
    provider: 'AetherAI',
    logoUrl: '',
    tags: ['Dify', '知识库']
  },
  {
    id: 'builtin-local-google-search',
    name: '@aether/local-google-search',
    type: 'inMemory',
    description: '本地 Google 和 Bing 搜索服务器，提供免费的网络搜索功能，无需 API 密钥暂不可用',
    isActive: false,
    provider: 'AetherAI',
    logoUrl: '',
    tags: ['搜索', 'Google', 'Bing', '免费']
  },
  {
    id: 'builtin-calculator',
    name: '@aether/calculator',
    type: 'inMemory',
    description: '数学计算器，支持基本四则运算和高级数学函数（三角函数、对数、幂运算等）',
    isActive: false,
    provider: 'AetherAI',
    logoUrl: '',
    tags: ['计算', '数学', '工具', '函数']
  },
  {
    id: 'builtin-web-scout',
    name: '@aether/web-scout',
    type: 'inMemory',
    description: '基于 DuckDuckGo 的免费网页搜索和内容提取服务器，无需 API 密钥。支持网页搜索和批量内容提取',
    isActive: false,
    provider: 'AetherAI',
    logoUrl: '',
    tags: ['搜索', 'DuckDuckGo', '免费', '内容提取', '网页抓取']
  }
];

/**
 * 获取内置 MCP 服务器列表
 */
export function getBuiltinMCPServers(): MCPServer[] {
  return [...BUILTIN_MCP_SERVERS];
}

/**
 * 检查服务器是否为内置服务器
 */
export function isBuiltinServer(serverName: string): boolean {
  return BUILTIN_MCP_SERVERS.some(server => server.name === serverName);
}

/**
 * 获取内置服务器的默认配置
 */
export function getBuiltinServerConfig(serverName: string): MCPServer | undefined {
  return BUILTIN_MCP_SERVERS.find(server => server.name === serverName);
}

/**
 * 获取所有内置服务器的名称列表
 */
export function getBuiltinServerNames(): string[] {
  return BUILTIN_MCP_SERVERS.map(server => server.name);
}

/**
 * 根据 ID 获取内置服务器配置
 */
export function getBuiltinServerById(id: string): MCPServer | undefined {
  return BUILTIN_MCP_SERVERS.find(server => server.id === id);
}

/**
 * 根据标签筛选内置服务器
 */
export function getBuiltinServersByTag(tag: string): MCPServer[] {
  return BUILTIN_MCP_SERVERS.filter(server => 
    server.tags && server.tags.includes(tag)
  );
}

/**
 * 获取所有内置服务器的标签
 */
export function getAllBuiltinServerTags(): string[] {
  const tags = new Set<string>();
  BUILTIN_MCP_SERVERS.forEach(server => {
    if (server.tags) {
      server.tags.forEach(tag => tags.add(tag));
    }
  });
  return Array.from(tags);
}
