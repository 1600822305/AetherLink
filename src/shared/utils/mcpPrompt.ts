import type { MCPTool } from '../types/index';
import { buildAgenticSystemPrompt, isAgenticMode } from '../prompts/agentic';
import type { AgenticPromptConfig } from '../prompts/agentic';

export const SYSTEM_PROMPT = `You are a helpful assistant with access to external tools. Use them when needed to fulfill the user's request.

# Tool Calling Protocol

You may call **one tool per response**. After calling a tool, wait for the result before proceeding.

## Format

To call a tool, output the following XML block:

<tool_use>
<name>TOOL_NAME</name>
<arguments>JSON_OBJECT</arguments>
</tool_use>

- **TOOL_NAME**: Must exactly match one of the available tool names listed below.
- **JSON_OBJECT**: A valid JSON object with the required parameters.

Tool results will be returned as:

<tool_use_result>
<name>TOOL_NAME</name>
<result>RESULT_CONTENT</result>
</tool_use_result>

Use the result to inform your next step: call another tool or provide a final answer.

## Available Tools
{{ AVAILABLE_TOOLS }}

## Rules

1. **Only call tools listed above.** Never invent tool names or call tools that are not in the list.
2. **One tool call per message.** Do not output multiple \`<tool_use>\` blocks in a single response.
3. **Use correct argument types.** Pass actual values, not variable names or placeholders.
4. **Do not repeat identical calls.** If you already called a tool with the same parameters, use the previous result.
5. **Call tools only when necessary.** If you can answer directly from your knowledge, do so without calling a tool.
6. **Always use the exact XML format.** Any deviation will cause a parsing failure.
7. **When providing a final answer after tool use, do not include \`<tool_use>\` tags.**

## Examples
{{ TOOL_USE_EXAMPLES }}

## User Instructions
{{ USER_SYSTEM_PROMPT }}
`

export const ToolUseExamples = `
Below are illustrative examples using hypothetical tools. Your actual available tools are listed in the "Available Tools" section.

### Example 1: Single tool call

User: What is 1024 * 768?

Assistant: 
<tool_use>
<name>calculator</name>
<arguments>{"expression": "1024 * 768"}</arguments>
</tool_use>

User:
<tool_use_result>
<name>calculator</name>
<result>786432</result>
</tool_use_result>

Assistant: 1024 × 768 = 786,432.

### Example 2: Multi-step tool use

User: Compare the weather in Beijing and Tokyo.

Assistant: Let me check Beijing's weather first.
<tool_use>
<name>get_weather</name>
<arguments>{"city": "Beijing"}</arguments>
</tool_use>

User:
<tool_use_result>
<name>get_weather</name>
<result>Beijing: 22°C, sunny</result>
</tool_use_result>

Assistant: Now let me check Tokyo.
<tool_use>
<name>get_weather</name>
<arguments>{"city": "Tokyo"}</arguments>
</tool_use>

User:
<tool_use_result>
<name>get_weather</name>
<result>Tokyo: 18°C, cloudy</result>
</tool_use_result>

Assistant: Beijing is 22°C and sunny, while Tokyo is 18°C and cloudy. Beijing is warmer today.

### Example 3: No tool needed

User: What is the capital of France?

Assistant: The capital of France is Paris.
`

// 注意：Agentic Mode 提示词已移至 src/shared/prompts/agentic/ 目录
// 使用 buildAgenticSystemPrompt() 或 isAgenticMode() 来处理 Agentic 模式

// hasFileEditorTools 和 isAgenticMode 已移至 src/shared/prompts/agentic/index.ts
// 这里保留一个简单的重导出以保持向后兼容
export { checkHasFileEditorTools as hasFileEditorTools } from '../prompts/agentic';

export const AvailableTools = (tools: MCPTool[]) => {
  const availableTools = tools
    .map((tool) => {
      const toolName = tool.id || tool.name;
      const schema = tool.inputSchema;
      let paramsBlock = '';
      if (schema?.properties) {
        const required = new Set(schema.required || []);
        const params = Object.entries(schema.properties).map(([key, val]: [string, any]) => {
          const reqTag = required.has(key) ? ' (required)' : ' (optional)';
          return `    - ${key}${reqTag}: ${val.description || val.type || 'any'}`;
        });
        paramsBlock = `\n  <parameters>\n${params.join('\n')}\n  </parameters>`;
      }
      return `<tool>\n  <name>${toolName}</name>\n  <description>${tool.description || 'No description'}</description>${paramsBlock}\n</tool>`;
    })
    .join('\n')
  return `<tools>\n${availableTools}\n</tools>`
}

/** 工作区信息 */
export interface WorkspaceInfo {
  id: string;
  name: string;
  path: string;
}

export interface BuildSystemPromptOptions {
  /** 是否使用 Agentic 模式的完整提示词 */
  useAgenticPrompt?: boolean;
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

export const buildSystemPrompt = (
  userSystemPrompt: string, 
  tools?: MCPTool[],
  options?: BuildSystemPromptOptions
): string => {
  if (tools && tools.length > 0) {
    // 检查是否为 Agentic 模式（包含 attempt_completion 工具）
    const isAgentic = isAgenticMode(tools);
    
    // 如果是 Agentic 模式且启用了 Agentic 提示词，使用新的提示词系统
    if (isAgentic && options?.useAgenticPrompt !== false) {
      const agenticConfig: AgenticPromptConfig = {
        userSystemPrompt,
        tools,
        cwd: options?.cwd || '.',
        osType: options?.osType || 'Unknown',
        supportsBrowserUse: options?.supportsBrowserUse || false,
        maxToolCalls: options?.maxToolCalls || 25,
        maxConsecutiveErrors: options?.maxConsecutiveErrors || 3,
        workspaces: options?.workspaces || [],
      };
      return buildAgenticSystemPrompt(agenticConfig);
    }
    
    // 非 Agentic 模式，使用简化的提示词系统
    return SYSTEM_PROMPT.replace('{{ USER_SYSTEM_PROMPT }}', userSystemPrompt)
      .replace('{{ TOOL_USE_EXAMPLES }}', ToolUseExamples)
      .replace('{{ AVAILABLE_TOOLS }}', AvailableTools(tools))
  }

  return userSystemPrompt
}

// 重新导出 Agentic 相关函数，方便外部使用
export { buildAgenticSystemPrompt, isAgenticMode, type AgenticPromptConfig } from '../prompts/agentic';
