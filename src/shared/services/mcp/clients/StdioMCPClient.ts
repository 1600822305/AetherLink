/**
 * Stdio MCP 客户端适配器（Tauri 桌面端专用）
 *
 * 使用 Tauri Shell 插件 spawn 子进程，通过标准输入/输出与 MCP 服务器通信。
 * 此传输类型仅在 Tauri 桌面端可用（Windows/macOS/Linux）。
 *
 * 工作原理：
 * 1. 使用 tauri_plugin_shell 的 Command API spawn 子进程
 * 2. 通过 stdin 发送 JSON-RPC 请求
 * 3. 通过 stdout 接收 JSON-RPC 响应
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import type { JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js';
import type { MCPClientOptions, MCPTool, MCPCallToolResponse } from './MCPClientAdapter';
import { isTauri, isDesktop, isWindows } from '../../../utils/platformDetection';

// Tauri Shell 类型定义
interface TauriChild {
  pid: number;
  write(data: string | Uint8Array | number[]): Promise<void>;
  kill(): Promise<void>;
}

/**
 * Stdio 传输层实现
 */
/**
 * 将用户提供的命令映射到 Tauri scope 中定义的命令名称
 * Tauri 2.0 要求使用预定义的命令名称而非完整路径
 */
function mapCommandToScopeName(command: string, args: string[] = []): { scopeName: string; executable: string[] } {
  const lowerCommand = command.toLowerCase();
  const baseName = lowerCommand.split(/[/\\]/).pop() || '';

  // 根据命令名称或路径推断使用哪个预定义的命令
  if (baseName.includes('node') || lowerCommand.includes('node')) {
    return { scopeName: 'run-node', executable: 'node' };
  }
  if (baseName.includes('npx') || lowerCommand.includes('npx')) {
    // Windows 上 npx 实际是 npx.cmd，优先使用 run-npx-cmd
    if (isWindows()) {
      return { scopeName: 'run-npx-cmd', executable: 'npx.cmd' };
    }
    return { scopeName: 'run-npx', executable: 'npx' };
  }
  if (baseName.includes('python') || lowerCommand.includes('python')) {
    return { scopeName: 'run-python', executable: 'python' };
  }
  if (baseName.includes('uvx') || lowerCommand.includes('uvx')) {
    return { scopeName: 'run-uvx', executable: 'uvx' };
  }
  // 未知命令：统一走 cmd，支持任意 exe 路径输入
  if (isWindows()) {
    return { scopeName: 'run-cmd', executable: ['/c', command, ...args] };
  }

  // 默认尝试使用原始命令
  return { scopeName: command, executable: args };
}

class StdioTransport implements Transport {
  private command: string;
  private args: string[];
  private env: Record<string, string>;
  private cwd?: string;
  private child: TauriChild | null = null;
  private buffer: string = '';
  private isRunning: boolean = false;

  onmessage?: (message: JSONRPCMessage) => void;
  onerror?: (error: Error) => void;
  onclose?: () => void;
  /** 子进程退出时的回调，用于通知上层清理缓存 */
  onProcessExit?: (code: number | null) => void;

  constructor(command: string, args: string[] = [], env: Record<string, string> = {}, cwd?: string) {
    this.command = command;
    this.args = args;
    this.env = env;
    this.cwd = cwd;
    console.log(`[Stdio Transport] 创建传输，命令: ${command} ${args.join(' ')}${cwd ? `, 工作目录: ${cwd}` : ''}`);
  }

  async start(): Promise<void> {
    console.log('[Stdio Transport] 启动子进程...');

    try {
      // 动态导入 Tauri Shell API
      const { Command } = await import('@tauri-apps/plugin-shell');

      // 将命令映射到 Tauri scope 中定义的名称
      const { scopeName, executable } = mapCommandToScopeName(this.command, this.args);
      console.log(`[Stdio Transport] 使用 scope 命令: ${scopeName}`);

      // 创建命令 - 使用 scope 名称
      const spawnOptions: Record<string, any> = {
        env: this.env
      };
      if (this.cwd) {
        spawnOptions.cwd = this.cwd;
      }
      const cmd = Command.create(scopeName, executable, spawnOptions);

      // 监听 close 事件
      cmd.on('close', (data) => {
        console.log(`[Stdio Transport] 子进程退出，代码: ${data.code}`);
        this.isRunning = false;
        this.child = null;
        if (this.onProcessExit) {
          this.onProcessExit(data.code);
        }
        if (this.onclose) {
          this.onclose();
        }
      });

      // 监听 error 事件
      cmd.on('error', (error) => {
        console.error('[Stdio Transport] 子进程错误:', error);
        if (this.onerror) {
          this.onerror(new Error(error));
        }
      });

      // 监听 stdout 数据 - Tauri 2.0 使用事件监听器
      cmd.stdout.on('data', (line: string) => {
        this.handleStdoutData(line);
      });

      // 监听 stderr - 显示 npx 下载进度等信息
      cmd.stderr.on('data', (line: string) => {
        console.log('[Stdio Transport] stderr:', line);
        // npx 下载进度通常输出到 stderr，这是正常的
      });

      // Spawn 子进程 - Tauri 2.0 spawn() 返回 Child 对象
      this.child = await cmd.spawn();
      this.isRunning = true;

      console.log(`[Stdio Transport] 子进程已启动, PID: ${this.child.pid}`);

    } catch (error) {
      console.error('[Stdio Transport] 启动失败:', error);
      throw error;
    }
  }

  private handleStdoutData(data: string): void {
    // 累积数据到缓冲区
    this.buffer += data;

    // 尝试解析完整的 JSON-RPC 消息（按换行分割）
    const lines = this.buffer.split('\n');
    this.buffer = lines.pop() || ''; // 保留最后一个不完整的行

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      try {
        const message = JSON.parse(trimmed) as JSONRPCMessage;
        console.log('[Stdio Transport] 收到消息:', message);
        if (this.onmessage) {
          this.onmessage(message);
        }
      } catch (parseError) {
        console.warn('[Stdio Transport] 无法解析行:', trimmed);
      }
    }
  }

  /** 检查传输层是否存活 */
  isAlive(): boolean {
    return this.isRunning && this.child !== null;
  }

  async send(message: JSONRPCMessage): Promise<void> {
    if (!this.child || !this.isRunning) {
      throw new Error('子进程未运行');
    }

    const json = JSON.stringify(message) + '\n';
    console.log('[Stdio Transport] 发送消息:', message);

    // Tauri 2.0 的 write 方法接受 string 或 number[]
    await this.child.write(json);
  }

  async close(): Promise<void> {
    console.log('[Stdio Transport] 关闭连接');
    this.isRunning = false;

    if (this.child) {
      try {
        await this.child.kill();
      } catch (e) {
        console.warn('[Stdio Transport] 终止子进程失败:', e);
      }
      this.child = null;
    }
  }
}

/**
 * Stdio 传输选项
 */
export interface StdioMCPClientOptions extends Omit<MCPClientOptions, 'baseUrl' | 'type'> {
  command: string;  // 要执行的命令
  args?: string[];  // 命令参数
  env?: Record<string, string>; // 环境变量
  cwd?: string; // 工作目录
}

/**
 * Stdio MCP 客户端（Tauri 桌面端专用）
 */
export class StdioMCPClient {
  private client: Client | null = null;
  private transport: StdioTransport | null = null;
  private options: StdioMCPClientOptions;
  /** 子进程退出时的回调，用于通知 MCPService 清理缓存 */
  onProcessExit?: (code: number | null) => void;

  constructor(options: StdioMCPClientOptions) {
    this.options = options;

    // 验证平台
    if (!isTauri() || !isDesktop()) {
      throw new Error('Stdio 传输仅在 Tauri 桌面端可用');
    }

    console.log(`[Stdio MCP Client] 创建客户端`);
    console.log(`[Stdio MCP Client] 命令: ${options.command}`);
    console.log(`[Stdio MCP Client] 参数: ${options.args?.join(' ') || ''}`);
  }

  /**
   * 检查 stdio 传输是否可用
   */
  static isAvailable(): boolean {
    return isTauri() && isDesktop();
  }

  /**
   * 检查连接是否存活
   */
  isAlive(): boolean {
    return this.transport !== null && this.transport.isAlive();
  }

  /**
   * 初始化连接
   */
  async initialize(): Promise<void> {
    console.log('[Stdio MCP Client] 开始初始化连接');

    try {
      // 创建客户端
      this.client = new Client(
        {
          name: 'AetherLink Desktop',
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

      console.log('[Stdio MCP Client] 客户端创建完成');

      // 创建 stdio 传输
      this.transport = new StdioTransport(
        this.options.command,
        this.options.args || [],
        this.options.env || {},
        this.options.cwd
      );

      // 监听子进程退出事件，通知上层清理
      this.transport.onProcessExit = (code) => {
        console.log(`[Stdio MCP Client] 子进程退出，code: ${code}`);
        if (this.onProcessExit) {
          this.onProcessExit(code);
        }
      };

      // 连接
      await this.client.connect(this.transport);

      console.log('[Stdio MCP Client] 连接成功');
    } catch (error) {
      console.error('[Stdio MCP Client] 初始化失败:', error);
      throw error;
    }
  }

  /**
   * 列出工具
   */
  async listTools(): Promise<MCPTool[]> {
    if (!this.client) {
      throw new Error('客户端未初始化');
    }

    console.log('[Stdio MCP Client] 列出工具');
    const result = await this.client.listTools();
    console.log(`[Stdio MCP Client] 找到 ${result.tools.length} 个工具`);

    return result.tools as MCPTool[];
  }

  /**
   * 调用工具
   */
  async callTool(name: string, arguments_: Record<string, any>): Promise<MCPCallToolResponse> {
    if (!this.client) {
      throw new Error('客户端未初始化');
    }

    console.log(`[Stdio MCP Client] 调用工具: ${name}`, arguments_);

    const result = await this.client.callTool({
      name,
      arguments: arguments_
    });

    console.log(`[Stdio MCP Client] 工具调用完成: ${name}`);

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

    console.log('[Stdio MCP Client] 列出提示词');
    const result = await this.client.listPrompts();
    console.log(`[Stdio MCP Client] 找到 ${result.prompts?.length || 0} 个提示词`);

    return result.prompts || [];
  }

  /**
   * 获取提示词
   */
  async getPrompt(name: string, arguments_?: Record<string, any>): Promise<any> {
    if (!this.client) {
      throw new Error('客户端未初始化');
    }

    console.log(`[Stdio MCP Client] 获取提示词: ${name}`);
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

    console.log('[Stdio MCP Client] 列出资源');
    const result = await this.client.listResources();
    console.log(`[Stdio MCP Client] 找到 ${result.resources?.length || 0} 个资源`);

    return result.resources || [];
  }

  /**
   * 读取资源
   */
  async readResource(uri: string): Promise<any> {
    if (!this.client) {
      throw new Error('客户端未初始化');
    }

    console.log(`[Stdio MCP Client] 读取资源: ${uri}`);
    const result = await this.client.readResource({ uri });

    return result;
  }

  /**
   * 关闭连接
   */
  async close(): Promise<void> {
    if (this.client) {
      console.log('[Stdio MCP Client] 关闭连接');
      await this.client.close();
      this.client = null;
      this.transport = null;
    }
  }
}
