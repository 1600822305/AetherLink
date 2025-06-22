import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { BraveSearchServer } from '../servers/BraveSearchServer';
import { FetchServer } from '../servers/FetchServer';
import { MemoryServer } from '../servers/MemoryServer';
import { ThinkingServer } from '../servers/ThinkingServer';
import { FileSystemServer } from '../servers/FileSystemServer';
import { DifyKnowledgeServer } from '../servers/DifyKnowledgeServer';
import { LocalGoogleSearchServer } from '../servers/LocalGoogleSearchServer';
import { CalculatorServer } from '../servers/CalculatorServer';
import { WebScoutServer } from '../servers/WebScoutServer';
import { getBuiltinMCPServers, isBuiltinServer, getBuiltinServerConfig } from '../../../config/builtinMCPServers';

/**
 * 创建内存 MCP 服务器
 * 移植自最佳实例的内置服务器工厂
 */
export function createInMemoryMCPServer(name: string, args: string[] = [], envs: Record<string, string> = {}): Server {
  console.log(`[MCP] 创建内存 MCP 服务器: ${name}，参数: ${args}，环境变量: ${JSON.stringify(envs)}`);

  switch (name) {
    case '@aether/memory': {
      const envPath = envs.MEMORY_FILE_PATH;
      return new MemoryServer(envPath).server;
    }

    case '@aether/sequentialthinking': {
      return new ThinkingServer().server;
    }

    case '@aether/brave-search': {
      return new BraveSearchServer(envs.BRAVE_API_KEY).server;
    }

    case '@aether/fetch': {
      return new FetchServer().server;
    }

    case '@aether/filesystem': {
      return new FileSystemServer(args).server;
    }

    case '@aether/dify-knowledge': {
      const difyKey = envs.DIFY_KEY;
      return new DifyKnowledgeServer(difyKey, args).server;
    }

    case '@aether/local-google-search': {
      return new LocalGoogleSearchServer().server;
    }

    case '@aether/calculator': {
      return new CalculatorServer().server;
    }

    case '@aether/web-scout': {
      return new WebScoutServer().server;
    }

    default:
      throw new Error(`未知的内置 MCP 服务器: ${name}`);
  }
}

// 导出配置文件中的函数，保持向后兼容
export { getBuiltinMCPServers, isBuiltinServer, getBuiltinServerConfig };
