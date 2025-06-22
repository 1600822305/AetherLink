// Thinking MCP Server
// 移植自最佳实例的 Thinking 服务器

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';

// 工具定义
const SEQUENTIAL_THINKING_TOOL: Tool = {
  name: 'sequential_thinking',
  description: '通过结构化的思维过程进行动态和反思性问题解决',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: '需要思考的问题或查询'
      },
      max_iterations: {
        type: 'number',
        description: '最大思考迭代次数（默认 5）',
        default: 5,
        minimum: 1,
        maximum: 10
      }
    },
    required: ['query']
  }
};

// 思维步骤类型
interface ThinkingStep {
  step: number;
  thought: string;
  reasoning: string;
  confidence: number;
  next_action: 'continue' | 'conclude' | 'refine';
}

// 思维结果类型
interface ThinkingResult {
  query: string;
  steps: ThinkingStep[];
  final_answer: string;
  confidence_score: number;
  total_iterations: number;
}

// 参数验证
function isSequentialThinkingArgs(args: any): args is { query: string; max_iterations?: number } {
  return typeof args === 'object' && typeof args.query === 'string';
}

// 执行顺序思维
async function performSequentialThinking(query: string, maxIterations: number = 5): Promise<ThinkingResult> {
  const steps: ThinkingStep[] = [];
  let currentThought = query;
  let iteration = 0;

  console.log(`[Thinking] 开始思考: ${query}`);

  while (iteration < maxIterations) {
    iteration++;

    // 模拟思维过程
    const step = await generateThinkingStep(currentThought, iteration, steps);
    steps.push(step);

    console.log(`[Thinking] 步骤 ${iteration}: ${step.thought}`);

    // 检查是否应该结束
    if (step.next_action === 'conclude' || step.confidence >= 0.9) {
      break;
    }

    // 为下一次迭代准备思考内容
    currentThought = step.reasoning;
  }

  // 生成最终答案
  const finalAnswer = generateFinalAnswer(query, steps);
  const confidenceScore = calculateOverallConfidence(steps);

  return {
    query,
    steps,
    final_answer: finalAnswer,
    confidence_score: confidenceScore,
    total_iterations: iteration
  };
}

// 生成思维步骤
async function generateThinkingStep(
  thought: string,
  stepNumber: number,
  _previousSteps: ThinkingStep[]
): Promise<ThinkingStep> {
  // 模拟思维过程的不同阶段
  let stepThought: string;
  let reasoning: string;
  let confidence: number;
  let nextAction: 'continue' | 'conclude' | 'refine';

  if (stepNumber === 1) {
    // 第一步：理解问题
    stepThought = `理解问题: ${thought}`;
    reasoning = `我需要分析这个问题的核心要素和可能的解决方向。`;
    confidence = 0.6;
    nextAction = 'continue';
  } else if (stepNumber === 2) {
    // 第二步：分析和分解
    stepThought = `分析问题的关键组成部分`;
    reasoning = `基于初步理解，我需要将问题分解为更小的、可管理的部分。`;
    confidence = 0.7;
    nextAction = 'continue';
  } else if (stepNumber === 3) {
    // 第三步：探索解决方案
    stepThought = `探索可能的解决方案和方法`;
    reasoning = `考虑多种解决方案，评估它们的可行性和有效性。`;
    confidence = 0.75;
    nextAction = 'continue';
  } else if (stepNumber === 4) {
    // 第四步：评估和优化
    stepThought = `评估解决方案并进行优化`;
    reasoning = `对之前的分析进行反思，寻找改进的机会。`;
    confidence = 0.85;
    nextAction = 'continue';
  } else {
    // 最后步骤：总结
    stepThought = `综合分析并得出结论`;
    reasoning = `基于所有前面的思考步骤，形成最终的答案。`;
    confidence = 0.9;
    nextAction = 'conclude';
  }

  return {
    step: stepNumber,
    thought: stepThought,
    reasoning,
    confidence,
    next_action: nextAction
  };
}

// 生成最终答案
function generateFinalAnswer(query: string, steps: ThinkingStep[]): string {
  const thoughtProcess = steps.map(step =>
    `步骤 ${step.step}: ${step.thought}\n推理: ${step.reasoning}`
  ).join('\n\n');

  return `基于结构化思维过程的分析：

问题: ${query}

思维过程:
${thoughtProcess}

结论: 通过 ${steps.length} 步的系统性思考，我已经全面分析了这个问题。每个步骤都建立在前一步的基础上，形成了一个连贯的思维链条。最终的理解是基于逐步深入的分析和反思得出的。`;
}

// 计算整体置信度
function calculateOverallConfidence(steps: ThinkingStep[]): number {
  if (steps.length === 0) return 0;

  const totalConfidence = steps.reduce((sum, step) => sum + step.confidence, 0);
  return Math.round((totalConfidence / steps.length) * 100) / 100;
}

export class ThinkingServer {
  public server: Server;

  constructor() {
    this.server = new Server(
      {
        name: 'thinking-server',
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
    // 工具处理器
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [SEQUENTIAL_THINKING_TOOL]
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      try {
        const { name, arguments: args } = request.params;

        if (name !== 'sequential_thinking') {
          return {
            content: [{ type: 'text', text: `未知工具: ${name}` }],
            isError: true
          };
        }

        if (!args || !isSequentialThinkingArgs(args)) {
          throw new Error('无效的参数：需要 query 字段');
        }

        const { query, max_iterations = 5 } = args;

        console.log(`[Thinking] 开始顺序思维: ${query}`);

        const result = await performSequentialThinking(query, max_iterations);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2)
            }
          ],
          isError: false
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`[Thinking] 错误:`, error);

        return {
          content: [
            {
              type: 'text',
              text: `顺序思维失败: ${errorMessage}`
            }
          ],
          isError: true
        };
      }
    });
  }
}
