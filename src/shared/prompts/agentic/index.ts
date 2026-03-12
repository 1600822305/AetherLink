/**
 * Agentic Mode 提示词系统
 * 模块化设计，为 Agentic 模式提供完整的提示词支持
 */

import type { MCPTool } from '../../types/index';
import { getToolUseSection } from './sections/tool-use';
import { getCapabilitiesSection } from './sections/capabilities';
import { getRulesSection } from './sections/rules';
import { getObjectiveSection } from './sections/objective';
import { getToolsCatalogSection } from './sections/tools-catalog';

/** 工作区信息 */
export interface WorkspaceInfo {
  id: string;
  name: string;
  path: string;
}

export interface AgenticPromptConfig {
  /** 用户自定义系统提示词 */
  userSystemPrompt?: string;
  /** MCP 工具列表 */
  tools: MCPTool[];
  /** 工作目录 */
  cwd?: string;
  /** 操作系统类型 */
  osType?: string;
  /** 是否支持浏览器操作 */
  supportsBrowserUse?: boolean;
  /** 最大工具调用次数 */
  maxToolCalls?: number;
  /** 最大连续错误次数 */
  maxConsecutiveErrors?: number;
  /** 工作区列表（直接注入提示词，无需 AI 调用 list_workspaces） */
  workspaces?: WorkspaceInfo[];
}

/**
 * 构建 Agentic 模式的完整系统提示词
 */
export function buildAgenticSystemPrompt(config: AgenticPromptConfig): string {
  const {
    userSystemPrompt = '',
    tools,
    cwd = '.',
    osType = 'Unknown',
    supportsBrowserUse = false,
    maxToolCalls = 25,
    maxConsecutiveErrors = 3,
    workspaces = [],
  } = config;

  const hasFileEditorTools = checkHasFileEditorTools(tools);

  const sections: string[] = [
    // 1. 角色定义
    `You are an autonomous AI agent. You accomplish tasks by using tools step-by-step, verifying each result before proceeding. Every response must include exactly one tool call.`,

    // 2. 工具调用格式
    getToolUseSection(),

    // 3. 工具目录
    getToolsCatalogSection(tools),

    // 4. 能力说明
    getCapabilitiesSection({ supportsBrowserUse, hasFileEditorTools }),

    // 5. 规则约束
    getRulesSection({ cwd, osType, hasFileEditorTools, supportsBrowserUse, workspaces }),

    // 6. 目标与完成协议
    getObjectiveSection({ maxToolCalls, maxConsecutiveErrors }),
  ];

  // 7. 用户自定义指令
  if (userSystemPrompt.trim()) {
    sections.push(`# User Instructions\n\n${userSystemPrompt}`);
  }

  return sections.filter(s => s.trim()).join('\n\n');
}

/**
 * 文件编辑工具名称列表
 * 与 @aether/file-editor MCP 服务器的工具定义保持同步
 */
export const FILE_EDITOR_TOOL_NAMES = [
  // 工作区工具
  'list_workspaces',
  'get_workspace_files',
  // 文件读写工具
  'read_file',
  'write_to_file',
  'list_files',
  'get_file_info',
  'create_file',
  'rename_file',
  'move_file',
  'copy_file',
  'delete_file',
  // 编辑工具
  'insert_content',
  'replace_in_file',
  'apply_diff',
  // 搜索工具
  'search_files',
  // 完成工具
  'attempt_completion'
];

/**
 * 检查是否包含文件编辑工具
 */
export function checkHasFileEditorTools(tools: MCPTool[]): boolean {
  if (!tools || tools.length === 0) return false;
  
  return tools.some(tool => 
    FILE_EDITOR_TOOL_NAMES.includes(tool.name) || 
    tool.serverName === '@aether/file-editor'
  );
}

/**
 * 检查是否为 Agentic 模式（包含 attempt_completion 工具）
 */
export function isAgenticMode(tools: MCPTool[]): boolean {
  if (!tools || tools.length === 0) return false;
  return tools.some(tool => 
    tool.name === 'attempt_completion' || 
    tool.serverName === '@aether/file-editor'
  );
}
