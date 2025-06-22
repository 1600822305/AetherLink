// FileSystem MCP Server
// 移植自最佳实例的 FileSystem 服务器（移动端版本）

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';

// 工具定义
const READ_FILE_TOOL: Tool = {
  name: 'read_file',
  description: '读取文件内容（移动端版本，使用 File API）',
  inputSchema: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: '文件路径或文件名'
      }
    },
    required: ['path']
  }
};

const WRITE_FILE_TOOL: Tool = {
  name: 'write_file',
  description: '写入文件内容（移动端版本，下载文件）',
  inputSchema: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: '文件路径或文件名'
      },
      content: {
        type: 'string',
        description: '要写入的内容'
      }
    },
    required: ['path', 'content']
  }
};

const LIST_FILES_TOOL: Tool = {
  name: 'list_files',
  description: '列出本地存储的文件（移动端版本）',
  inputSchema: {
    type: 'object',
    properties: {
      pattern: {
        type: 'string',
        description: '文件名模式（可选）'
      }
    }
  }
};

const DELETE_FILE_TOOL: Tool = {
  name: 'delete_file',
  description: '删除文件（移动端版本）',
  inputSchema: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: '文件路径或文件名'
      }
    },
    required: ['path']
  }
};

// 移动端文件系统管理器
class MobileFileSystemManager {
  private storagePrefix = 'mcp_filesystem_';

  // 读取文件
  async readFile(path: string): Promise<string> {
    try {
      // 尝试从 localStorage 读取
      const content = localStorage.getItem(this.storagePrefix + path);
      if (content !== null) {
        return content;
      }

      // 如果 localStorage 中没有，提示用户这是移动端限制
      throw new Error(`文件 "${path}" 不存在。移动端版本只能访问通过此工具创建的文件。`);
    } catch (error) {
      throw new Error(`读取文件失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  // 写入文件
  async writeFile(path: string, content: string): Promise<string> {
    try {
      // 保存到 localStorage
      localStorage.setItem(this.storagePrefix + path, content);

      // 同时提供下载功能
      this.downloadFile(path, content);

      return `文件 "${path}" 已保存到本地存储并提供下载。`;
    } catch (error) {
      throw new Error(`写入文件失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  // 下载文件
  private downloadFile(filename: string, content: string): void {
    try {
      const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.style.display = 'none';

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('下载文件失败:', error);
    }
  }

  // 列出文件
  async listFiles(pattern?: string): Promise<string[]> {
    try {
      const files: string[] = [];

      // 遍历 localStorage 查找文件
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(this.storagePrefix)) {
          const filename = key.substring(this.storagePrefix.length);

          // 如果有模式，进行匹配
          if (pattern) {
            const regex = new RegExp(pattern.replace(/\*/g, '.*'), 'i');
            if (regex.test(filename)) {
              files.push(filename);
            }
          } else {
            files.push(filename);
          }
        }
      }

      return files.sort();
    } catch (error) {
      throw new Error(`列出文件失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  // 删除文件
  async deleteFile(path: string): Promise<string> {
    try {
      const key = this.storagePrefix + path;

      if (localStorage.getItem(key) === null) {
        throw new Error(`文件 "${path}" 不存在`);
      }

      localStorage.removeItem(key);
      return `文件 "${path}" 已删除。`;
    } catch (error) {
      throw new Error(`删除文件失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  // 获取文件信息
  async getFileInfo(path: string): Promise<{ name: string; size: number; exists: boolean }> {
    const key = this.storagePrefix + path;
    const content = localStorage.getItem(key);

    return {
      name: path,
      size: content ? new Blob([content]).size : 0,
      exists: content !== null
    };
  }
}

export class FileSystemServer {
  public server: Server;
  private fileManager: MobileFileSystemManager;

  constructor(allowedPaths: string[] = []) {
    this.fileManager = new MobileFileSystemManager();

    this.server = new Server(
      {
        name: 'filesystem-server',
        version: '1.0.0'
      },
      {
        capabilities: {
          tools: {}
        }
      }
    );

    this.initialize();

    // 移动端版本忽略 allowedPaths 参数，因为我们使用 localStorage
    if (allowedPaths.length > 0) {
      console.log('[FileSystem] 移动端版本不支持路径限制，所有操作都在本地存储中进行');
    }
  }

  initialize() {
    // 工具处理器
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [READ_FILE_TOOL, WRITE_FILE_TOOL, LIST_FILES_TOOL, DELETE_FILE_TOOL]
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      try {
        const { name, arguments: args } = request.params;

        if (!args) {
          throw new Error('未提供参数');
        }

        switch (name) {
          case 'read_file': {
            if (typeof args.path !== 'string') {
              throw new Error('read_file 需要 path 字符串参数');
            }
            const content = await this.fileManager.readFile(args.path);
            return {
              content: [{ type: 'text', text: content }],
              isError: false
            };
          }

          case 'write_file': {
            if (typeof args.path !== 'string' || typeof args.content !== 'string') {
              throw new Error('write_file 需要 path 和 content 字符串参数');
            }
            const result = await this.fileManager.writeFile(args.path, args.content);
            return {
              content: [{ type: 'text', text: result }],
              isError: false
            };
          }

          case 'list_files': {
            const pattern = typeof args.pattern === 'string' ? args.pattern : undefined;
            const files = await this.fileManager.listFiles(pattern);
            const result = files.length > 0
              ? `找到 ${files.length} 个文件:\n${files.join('\n')}`
              : '没有找到文件';
            return {
              content: [{ type: 'text', text: result }],
              isError: false
            };
          }

          case 'delete_file': {
            if (typeof args.path !== 'string') {
              throw new Error('delete_file 需要 path 字符串参数');
            }
            const result = await this.fileManager.deleteFile(args.path);
            return {
              content: [{ type: 'text', text: result }],
              isError: false
            };
          }

          default:
            return {
              content: [{ type: 'text', text: `未知工具: ${name}` }],
              isError: true
            };
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: 'text', text: `错误: ${errorMessage}` }],
          isError: true
        };
      }
    });
  }
}
