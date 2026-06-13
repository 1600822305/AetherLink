import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { getBuiltinMCPServers, isBuiltinServer, getBuiltinServerConfig } from '../../../config/builtinMCPServers';
import { TimeServer } from '../servers/TimeServer';
import { FetchServer } from '../servers/FetchServer';
import { CalculatorServer } from '../servers/CalculatorServer';
import { CalendarServer } from '../servers/CalendarServer';
import { AlarmServer } from '../servers/AlarmServer';
import { MetasoSearchServer } from '../servers/MetasoSearchServer';
import { FileEditorServer } from '../servers/FileEditorServer';
import { DexEditorServer } from '../servers/DexEditorServer';
import { SearXNGServer } from '../servers/SearXNGServer';
import { AiSearchServer } from '../servers/AiSearchServer';
import { SettingsServer } from '../servers/settings/SettingsServer';
import { createLogger } from '../../infra/logger';

const logger = createLogger('MCP');


/**
 * 创建内存 MCP 服务器
 * 工厂函数用于创建内置的 MCP 服务器实例
 */
export function createInMemoryMCPServer(name: string, args: string[] = [], envs: Record<string, string> = {}): Server {
  logger.debug(`创建内存 MCP 服务器: ${name}，参数: ${args}，环境变量: ${JSON.stringify(envs)}`);

  switch (name) {
    case '@aether/time': {
      return new TimeServer().server;
    }

    case '@aether/fetch': {
      return new FetchServer().server;
    }

    case '@aether/calculator': {
      return new CalculatorServer().server;
    }

    case '@aether/calendar': {
      return new CalendarServer().server;
    }

    case '@aether/alarm': {
      return new AlarmServer().server;
    }

    case '@aether/metaso-search': {
      const apiKey = envs.METASO_API_KEY || '';
      const metasoServer = new MetasoSearchServer(apiKey);
      return metasoServer.server;
    }

    case '@aether/file-editor': {
      return new FileEditorServer().server;
    }

    case '@aether/dex-editor': {
      return new DexEditorServer().server;
    }

    case '@aether/searxng': {
      const searxngBaseUrl = envs.SEARXNG_BASE_URL || 'http://154.37.208.52:39281';
      const searxngServer = new SearXNGServer(searxngBaseUrl);
      return searxngServer.server;
    }

    case '@aether/grok-search': {
      return new AiSearchServer(envs).server;
    }

    case '@aether/settings': {
      return new SettingsServer().server;
    }

    default:
      throw new Error(`未知的内置 MCP 服务器: ${name}`);
  }
}

// 导出配置文件中的函数，保持向后兼容
export { getBuiltinMCPServers, isBuiltinServer, getBuiltinServerConfig };
