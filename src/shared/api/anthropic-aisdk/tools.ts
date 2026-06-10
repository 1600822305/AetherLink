/**
 * AI SDK Anthropic 工具调用模块
 * 将 MCP 工具转换为 AI SDK 格式，支持 Claude 内置工具
 */
import type { MCPTool, MCPToolResponse, MCPCallToolResponse, Model } from '../../types';
import { splitMcpToolContent, buildAISDKToolOutput, toImageDataUrl } from '../../utils/mcpToolResultContent';

/**
 * Claude 内置工具类型
 */
export type ClaudeBuiltinToolType = 
  | 'web_search'
  | 'web_fetch'
  | 'computer'
  | 'bash'
  | 'text_editor'
  | 'code_execution';

/**
 * 将 MCP 工具转换为 AI SDK 工具格式
 * AI SDK 期望的格式是对象映射: { toolName: { description, inputSchema } }
 */
export function convertMcpToolsToAISDK(mcpTools: MCPTool[]): Record<string, any> {
  const tools: Record<string, any> = {};
  
  for (const mcpTool of mcpTools) {
    let toolName = mcpTool.name || mcpTool.id || '';
    if (!toolName) continue;

    // 清理工具名称（确保符合 AI SDK 命名规则）
    if (/^\d/.test(toolName)) {
      toolName = `mcp_${toolName}`;
    }
    toolName = toolName.replace(/[^a-zA-Z0-9_.-]/g, '_');
    if (toolName.length > 64) {
      toolName = toolName.substring(0, 64);
    }

    tools[toolName] = {
      description: mcpTool.description || '',
      parameters: mcpTool.inputSchema || { type: 'object', properties: {} }
    };
  }
  
  return tools;
}

/**
 * 将 MCP 工具转换为 Anthropic 原生格式
 */
export function convertMcpToolsToAnthropic<T = any>(mcpTools: MCPTool[]): T[] {
  return mcpTools.map(mcpTool => {
    // 清理工具名称
    let toolName = mcpTool.id || mcpTool.name;

    // 如果名称以数字开头，添加前缀
    if (/^\d/.test(toolName)) {
      toolName = `mcp_${toolName}`;
    }

    // 移除不允许的字符
    toolName = toolName.replace(/[^a-zA-Z0-9_.-]/g, '_');

    // 确保名称不超过64个字符
    if (toolName.length > 64) {
      toolName = toolName.substring(0, 64);
    }

    return {
      name: toolName,
      description: mcpTool.description || '',
      input_schema: mcpTool.inputSchema || { type: 'object', properties: {} }
    };
  }) as T[];
}

/**
 * 将 AI SDK 工具调用转换为 MCP 工具响应格式
 */
export function convertToolCallsToMcpResponses(
  toolCalls: any[],
  mcpTools: MCPTool[]
): MCPToolResponse[] {
  return toolCalls.map(toolCall => {
    const toolName = toolCall.function?.name || toolCall.toolName || toolCall.name || '';
    const toolId = toolCall.id || toolCall.toolCallId || toolCall.toolUseId || '';
    
    // 解析参数
    let args: Record<string, unknown> = {};
    try {
      if (typeof toolCall.function?.arguments === 'string') {
        args = JSON.parse(toolCall.function.arguments);
      } else if (toolCall.args) {
        args = toolCall.args;
      } else if (toolCall.input) {
        args = toolCall.input;
      }
    } catch (e) {
      console.warn(`[Anthropic SDK Tools] 解析工具参数失败: ${e}`);
      args = toolCall.function?.arguments || toolCall.args || toolCall.input || {};
    }

    // 查找对应的 MCP 工具
    const mcpTool = mcpTools.find(t => t.name === toolName || t.id === toolName);

    return {
      id: toolId,
      tool: mcpTool || { name: toolName, serverName: '', serverId: '' },
      arguments: args,
      status: 'pending' as const,
      toolCallId: toolId,
      toolUseId: toolId  // Anthropic 兼容
    };
  });
}

/**
 * 将 MCP 工具调用响应转换为消息格式
 * 支持两种模式：
 * - AI SDK 格式：{ role: 'tool', content: [{ type: 'tool-result', ... }] }
 * - XML 提示词格式：{ role: 'user', content: '<tool_use_result>...</tool_use_result>' }
 */
export function mcpToolCallResponseToAnthropicMessage(
  mcpToolResponse: MCPToolResponse,
  resp: MCPCallToolResponse,
  _model: Model,
  useXmlFormat: boolean = false
): any {
  const toolCallId = mcpToolResponse.id || mcpToolResponse.toolCallId || mcpToolResponse.toolUseId;
  const toolName = mcpToolResponse.tool?.name || '';

  // 拆分文本与图片，避免图片被丢弃
  const { text, images } = splitMcpToolContent(resp);
  const displayText = resp.isError ? `Error: ${text || 'Unknown error'}` : text;

  // XML 提示词模式：返回 user 角色的消息（user 角色允许带图）
  if (useXmlFormat) {
    const xmlResult = `<tool_use_result>
  <name>${toolName}</name>
  <result>${displayText}</result>
</tool_use_result>`;
    if (images.length > 0) {
      return {
        role: 'user',
        content: [
          { type: 'text', text: xmlResult },
          ...images.map((img) => ({ type: 'image', image: toImageDataUrl(img) }))
        ]
      };
    }
    return {
      role: 'user',
      content: xmlResult
    };
  }

  // AI SDK 格式：返回 ToolModelMessage 格式（v6 使用 output: ToolResultOutput）
  // Anthropic 原生 tool_result 支持图片，AI SDK 会把 media 部件转成 image 块
  return {
    role: 'tool',
    content: [{
      type: 'tool-result',
      toolCallId: toolCallId,
      toolName: toolName,
      output: buildAISDKToolOutput(text, images, resp.isError || false)
    }]
  };
}

/**
 * 根据名称查找 MCP 工具
 */
export function findMcpToolByName(mcpTools: MCPTool[], toolName: string): MCPTool | undefined {
  return mcpTools.find(tool => {
    // 检查原始名称
    if (tool.id === toolName || tool.name === toolName) {
      return true;
    }

    // 检查转换后的名称
    let convertedName = tool.id || tool.name;
    if (/^\d/.test(convertedName)) {
      convertedName = `mcp_${convertedName}`;
    }
    convertedName = convertedName.replace(/[^a-zA-Z0-9_.-]/g, '_');
    if (convertedName.length > 64) {
      convertedName = convertedName.substring(0, 64);
    }

    return convertedName === toolName;
  });
}

/**
 * 创建 Claude Web Search 工具配置
 * @param maxUses 最大搜索次数
 * @param options 可选配置
 */
export function createWebSearchToolConfig(
  maxUses: number = 5,
  options?: {
    allowedDomains?: string[];
    blockedDomains?: string[];
    userLocation?: {
      type: 'approximate';
      country?: string;
      region?: string;
      city?: string;
      timezone?: string;
    };
  }
): Record<string, any> {
  return {
    type: 'web_search_20250305',
    max_uses: maxUses,
    ...(options?.allowedDomains && { allowed_domains: options.allowedDomains }),
    ...(options?.blockedDomains && { blocked_domains: options.blockedDomains }),
    ...(options?.userLocation && { user_location: options.userLocation })
  };
}

/**
 * 创建 Claude Web Fetch 工具配置
 * @param maxUses 最大获取次数
 */
export function createWebFetchToolConfig(maxUses: number = 1): Record<string, any> {
  return {
    type: 'web_fetch_20250910',
    max_uses: maxUses
  };
}

/**
 * 创建 Claude Computer Use 工具配置
 * @param displayWidth 显示宽度
 * @param displayHeight 显示高度
 * @param displayNumber X11 显示编号（可选）
 */
export function createComputerToolConfig(
  displayWidth: number = 1920,
  displayHeight: number = 1080,
  displayNumber?: number
): Record<string, any> {
  return {
    type: 'computer_20250124',
    display_width_px: displayWidth,
    display_height_px: displayHeight,
    ...(displayNumber !== undefined && { display_number: displayNumber })
  };
}

/**
 * 创建 Claude Bash 工具配置
 */
export function createBashToolConfig(): Record<string, any> {
  return {
    type: 'bash_20241022'
  };
}

/**
 * 创建 Claude Text Editor 工具配置
 * @param maxCharacters 最大字符数（可选）
 */
export function createTextEditorToolConfig(maxCharacters?: number): Record<string, any> {
  return {
    type: 'text_editor_20250728',
    ...(maxCharacters && { max_characters: maxCharacters })
  };
}

/**
 * 创建 Claude Code Execution 工具配置
 */
export function createCodeExecutionToolConfig(): Record<string, any> {
  return {
    type: 'code_execution_20250825'
  };
}

/**
 * 检查是否为 Claude 内置工具
 */
export function isClaudeBuiltinTool(toolName: string): boolean {
  const builtinTools = [
    'web_search',
    'web_fetch',
    'computer',
    'bash',
    'str_replace_based_edit_tool',
    'code_execution'
  ];
  return builtinTools.includes(toolName);
}

/**
 * Claude 内置工具配置接口
 */
export interface ClaudeBuiltinToolsConfig {
  webSearch?: {
    enabled: boolean;
    maxUses?: number;
    allowedDomains?: string[];
    blockedDomains?: string[];
  };
  webFetch?: {
    enabled: boolean;
    maxUses?: number;
  };
  computer?: {
    enabled: boolean;
    displayWidth?: number;
    displayHeight?: number;
    displayNumber?: number;
  };
  bash?: {
    enabled: boolean;
  };
  textEditor?: {
    enabled: boolean;
    maxCharacters?: number;
  };
  codeExecution?: {
    enabled: boolean;
  };
}

/**
 * 创建 Claude 内置工具列表
 * 根据配置生成对应的工具配置
 */
export function createClaudeBuiltinTools(config: ClaudeBuiltinToolsConfig): Record<string, any>[] {
  const tools: Record<string, any>[] = [];

  if (config.webSearch?.enabled) {
    tools.push(createWebSearchToolConfig(
      config.webSearch.maxUses,
      {
        allowedDomains: config.webSearch.allowedDomains,
        blockedDomains: config.webSearch.blockedDomains
      }
    ));
  }

  if (config.webFetch?.enabled) {
    tools.push(createWebFetchToolConfig(config.webFetch.maxUses));
  }

  if (config.computer?.enabled) {
    tools.push(createComputerToolConfig(
      config.computer.displayWidth,
      config.computer.displayHeight,
      config.computer.displayNumber
    ));
  }

  if (config.bash?.enabled) {
    tools.push(createBashToolConfig());
  }

  if (config.textEditor?.enabled) {
    tools.push(createTextEditorToolConfig(config.textEditor.maxCharacters));
  }

  if (config.codeExecution?.enabled) {
    tools.push(createCodeExecutionToolConfig());
  }

  return tools;
}

/**
 * Computer Use 动作类型
 */
export type ComputerAction = 
  | 'key'
  | 'type'
  | 'mouse_move'
  | 'left_click'
  | 'left_click_drag'
  | 'right_click'
  | 'middle_click'
  | 'double_click'
  | 'screenshot'
  | 'cursor_position'
  | 'scroll';

/**
 * Computer Use 工具执行结果处理
 * 将截图等结果转换为模型可理解的格式
 */
export function processComputerToolResult(
  _action: ComputerAction,
  result: string | { type: 'image'; data: string }
): { type: 'content'; value: any[] } {
  // action 参数保留用于未来扩展（如根据不同动作类型返回不同格式）
  if (typeof result === 'string') {
    return {
      type: 'content',
      value: [{ type: 'text', text: result }]
    };
  }

  // 处理图像结果（如截图）
  return {
    type: 'content',
    value: [{
      type: 'media',
      mediaType: 'image/png',
      data: result.data
    }]
  };
}

/**
 * 合并 MCP 工具和 Claude 内置工具
 * @param mcpTools MCP 工具列表（已转换为 AI SDK 格式）
 * @param builtinTools Claude 内置工具配置
 */
export function mergeToolsWithBuiltin(
  mcpTools: Record<string, any>,
  builtinConfig?: ClaudeBuiltinToolsConfig
): { tools: Record<string, any>; builtinTools: Record<string, any>[] } {
  const builtinTools = builtinConfig ? createClaudeBuiltinTools(builtinConfig) : [];
  
  return {
    tools: mcpTools,
    builtinTools
  };
}
