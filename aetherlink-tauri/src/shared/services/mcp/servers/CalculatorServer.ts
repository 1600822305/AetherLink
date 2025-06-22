import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';

// 工具定义
const CALCULATOR_TOOL: Tool = {
  name: 'calculate',
  description: '执行基本数学计算（加减乘除）',
  inputSchema: {
    type: 'object',
    properties: {
      expression: {
        type: 'string',
        description: '数学表达式，如 "2 + 3 * 4"'
      }
    },
    required: ['expression']
  }
};

const ADVANCED_CALCULATOR_TOOL: Tool = {
  name: 'advanced_calculate',
  description: '执行高级数学计算（包括三角函数、对数、幂运算等）',
  inputSchema: {
    type: 'object',
    properties: {
      expression: {
        type: 'string',
        description: '高级数学表达式，支持 sin, cos, tan, log, ln, sqrt, pow 等函数'
      }
    },
    required: ['expression']
  }
};

// 安全的数学表达式计算函数
function safeCalculate(expression: string): number {
  // 只允许数字、基本运算符和括号
  const sanitized = expression.replace(/[^0-9+\-*/().\s]/g, '');
  
  if (!sanitized) {
    throw new Error('无效的数学表达式');
  }
  
  try {
    // 使用 Function 构造器安全计算
    return Function(`"use strict"; return (${sanitized})`)();
  } catch (error) {
    throw new Error('计算错误: ' + (error instanceof Error ? error.message : '未知错误'));
  }
}

// 高级数学计算函数
function advancedCalculate(expression: string): number {
  // 替换数学函数为 JavaScript Math 对象的方法
  let processedExpression = expression
    .replace(/\bsin\(/g, 'Math.sin(')
    .replace(/\bcos\(/g, 'Math.cos(')
    .replace(/\btan\(/g, 'Math.tan(')
    .replace(/\blog\(/g, 'Math.log10(')
    .replace(/\bln\(/g, 'Math.log(')
    .replace(/\bsqrt\(/g, 'Math.sqrt(')
    .replace(/\babs\(/g, 'Math.abs(')
    .replace(/\bfloor\(/g, 'Math.floor(')
    .replace(/\bceil\(/g, 'Math.ceil(')
    .replace(/\bround\(/g, 'Math.round(')
    .replace(/\bpow\(/g, 'Math.pow(')
    .replace(/\bpi\b/g, 'Math.PI')
    .replace(/\be\b/g, 'Math.E');

  // 只允许安全的字符和 Math 对象
  const allowedPattern = /^[0-9+\-*/().\s,MathsincotaglqrtbsfloceipowPIE]+$/;
  
  if (!allowedPattern.test(processedExpression)) {
    throw new Error('表达式包含不允许的字符');
  }
  
  try {
    // 使用 Function 构造器安全计算
    return Function(`"use strict"; return (${processedExpression})`)();
  } catch (error) {
    throw new Error('计算错误: ' + (error instanceof Error ? error.message : '未知错误'));
  }
}

// 参数类型检查
interface CalculateArgs {
  expression: string;
}

function isCalculateArgs(args: any): args is CalculateArgs {
  return args && typeof args.expression === 'string';
}

export class CalculatorServer {
  public server: Server;

  constructor() {
    this.server = new Server(
      {
        name: 'calculator-server',
        version: '1.0.0'
      },
      {
        capabilities: {
          tools: {}
        }
      }
    );

    this.initialize();
  }

  initialize() {
    // 工具列表处理器
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [CALCULATOR_TOOL, ADVANCED_CALCULATOR_TOOL]
    }));

    // 工具调用处理器
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      try {
        const { name, arguments: args } = request.params;

        if (!args || !isCalculateArgs(args)) {
          throw new Error('需要提供 expression 参数');
        }

        const { expression } = args;

        if (name === 'calculate') {
          const result = safeCalculate(expression);
          return {
            content: [
              {
                type: 'text',
                text: `计算结果: ${expression} = ${result}`
              }
            ],
            isError: false
          };
        } else if (name === 'advanced_calculate') {
          const result = advancedCalculate(expression);
          return {
            content: [
              {
                type: 'text',
                text: `高级计算结果: ${expression} = ${result}`
              }
            ],
            isError: false
          };
        } else {
          return {
            content: [{ type: 'text', text: `未知工具: ${name}` }],
            isError: true
          };
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `计算失败: ${error instanceof Error ? error.message : '未知错误'}`
            }
          ],
          isError: true
        };
      }
    });
  }
}
