/**
 * 工具类型定义
 * 包含工具调用相关的类型定义
 */

/**
 * 工具输入模式定义
 */
export interface ToolInputSchema {
  type: string;
  title: string;
  description?: string;
  required?: string[];
  properties: Record<string, object>;
}

/**
 * 工具定义
 */
export interface Tool {
  id: string;
  name: string;
  description?: string;
  inputSchema: ToolInputSchema;
  provider?: string;
}

/**
 * 工具调用响应内容
 */
export interface ToolResultContent {
  type: 'text' | 'image' | 'audio' | 'resource';
  text?: string;
  data?: string;
  mimeType?: string;
  resource?: {
    uri?: string;
    text?: string;
    mimeType?: string;
    blob?: string;
  };
}

/**
 * 工具调用响应
 */
export interface ToolCallResponse {
  content: ToolResultContent[];
  isError?: boolean;
}

/**
 * 基础工具响应
 */
interface BaseToolResponse {
  id: string; // 唯一ID
  tool: Tool;
  arguments: Record<string, unknown> | undefined;
  status: 'pending' | 'running' | 'completed' | 'error';
  response?: any;
}

/**
 * 工具使用响应
 */
export interface ToolUseResponse extends BaseToolResponse {
  toolUseId: string;
}

/**
 * 工具调用响应
 */
export interface ToolCallResult extends BaseToolResponse {
  toolCallId?: string; // 某些模型的工具调用ID可能为undefined
}

/**
 * 工具响应类型
 */
export type ToolResponse = ToolUseResponse | ToolCallResult;

/**
 * 内置工具类型
 */
export const ToolType = {
  THINKING: 'thinking',
  WEB_SEARCH: 'web_search',
  CODE: 'code',
  IMAGE_ANALYSIS: 'image_analysis',
  CALCULATOR: 'calculator',
  FILE_SEARCH: 'file_search',
  KNOWLEDGE_SEARCH: 'knowledge_search'
} as const;

export type ToolTypeValue = typeof ToolType[keyof typeof ToolType];

/**
 * 思考工具定义
 */
export const THINKING_TOOL = {
  type: "function",
  function: {
    name: "thinking",
    description: "Display the step-by-step thinking process before answering a question",
    parameters: {
      type: "object",
      properties: {
        thinking: {
          type: "string",
          description: "The step-by-step reasoning process"
        }
      },
      required: ["thinking"]
    }
  }
};

/**
 * 网页搜索工具定义
 */
export const WEB_SEARCH_TOOL = {
  type: "function",
  function: {
    name: "web_search",
    description: "Search the web for current information",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "The search query"
        }
      },
      required: ["query"]
    }
  }
};

/**
 * 代码工具定义
 */
export const CODE_TOOL = {
  type: "function",
  function: {
    name: "write_code",
    description: "Write code in a specified programming language",
    parameters: {
      type: "object",
      properties: {
        language: {
          type: "string",
          description: "Programming language (e.g. python, javascript, java)"
        },
        code: {
          type: "string",
          description: "The code implementation"
        },
        explanation: {
          type: "string",
          description: "Brief explanation of how the code works"
        }
      },
      required: ["language", "code"]
    }
  }
};
