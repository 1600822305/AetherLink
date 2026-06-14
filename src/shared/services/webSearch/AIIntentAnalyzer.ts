/**
 * 统一搜索意图分析器
 * 
 * 复刻 Cherry Studio 的 searchOrchestrationPlugin 架构：
 * - 统一分析 web 搜索、知识库搜索、记忆搜索三种意图
 * - 根据启用的搜索类型动态选择提示词（web-only / knowledge-only / combined）
 * - 支持多关键词提取、URL 链接提取、知识库查询重写
 * - 使用 XML 格式输出，可扩展新的搜索类型
 */

import { sendChatRequest } from '../../api';
import store from '../../store';
import type { ExtractedSearchKeywords } from './WebSearchTool';
import { createLogger } from '../infra/logger';

const logger = createLogger('IntentAnalyzer');

// ==================== 类型定义 ====================

/**
 * 知识库搜索关键词
 */
export interface ExtractedKnowledgeKeywords {
  /** 搜索问题列表 */
  question: string[];
  /** 重写的查询（用于语义搜索，保留原始意图的替代表述） */
  rewrite?: string;
}

/**
 * 统一意图分析配置
 * 调用方通过此配置告诉分析器需要分析哪些搜索类型
 */
export interface IntentAnalysisOptions {
  /** 是否分析 web 搜索意图 */
  shouldWebSearch?: boolean;
  /** 是否分析知识库搜索意图 */
  shouldKnowledgeSearch?: boolean;
  /** 是否分析记忆搜索意图（预留） */
  shouldMemorySearch?: boolean;
}

/**
 * 统一意图分析结果
 * 每个搜索类型独立判断，互不干扰
 */
export interface UnifiedIntentResult {
  /** Web 搜索：提取的关键词，undefined 表示不需要搜索 */
  websearch?: ExtractedSearchKeywords;
  /** 知识库搜索：提取的关键词，undefined 表示不需要搜索 */
  knowledge?: ExtractedKnowledgeKeywords;
  /** 记忆搜索：预留，undefined 表示不需要搜索 */
  memory?: { question: string[] };
}

// 保留旧接口兼容性
export interface AIIntentAnalysisResult {
  needsWebSearch: boolean;
  websearch?: ExtractedSearchKeywords;
  confidence: number;
  reason?: string;
}

// ==================== 提示词模板 ====================

/**
 * 统一提示词（web + knowledge）
 * 复刻 Cherry Studio 的 SEARCH_SUMMARY_PROMPT
 */
const PROMPT_COMBINED = `You are an AI question rephraser. Your role is to rephrase follow-up queries from a conversation into standalone queries that can be used by another LLM to retrieve information, either through web search or from a knowledge base.
**Use user's language to rephrase the question.**
Follow these guidelines:
1. If the question is a simple writing task, greeting (e.g., Hi, Hello, How are you), or does not require searching for information (unless the greeting contains a follow-up question), return 'not_needed' in the 'question' XML block. This indicates that no search is required.
2. If the user asks a question related to a specific URL, PDF, or webpage, include the links in the 'links' XML block and the question in the 'question' XML block. If the request is to summarize content from a URL or PDF, return 'summarize' in the 'question' XML block and include the relevant links in the 'links' XML block.
3. For websearch, You need extract keywords into 'question' XML block. For knowledge, You need rewrite user query into 'rewrite' XML block with one alternative version while preserving the original intent and meaning.
4. Websearch: Always return the rephrased question inside the 'question' XML block. If there are no links in the follow-up question, do not insert a 'links' XML block in your response.
5. Knowledge: Always return the rephrased question inside the 'question' XML block.
6. Always wrap the rephrased question in the appropriate XML blocks to specify the tool(s) for retrieving information: use <websearch></websearch> for queries requiring real-time or external information, <knowledge></knowledge> for queries that can be answered from a pre-existing knowledge base, or both if the question could be applicable to either tool. Ensure that the rephrased question is always contained within a <question></question> block inside these wrappers.

There are several examples attached for your reference inside the below 'examples' XML block.

<examples>
1. Follow up question: What is the capital of France
Rephrased question:
<websearch>
  <question>Capital of France</question>
</websearch>
<knowledge>
  <rewrite>What city serves as the capital of France?</rewrite>
  <question>What is the capital of France</question>
</knowledge>

2. Follow up question: Hi, how are you?
Rephrased question:
<websearch>
  <question>not_needed</question>
</websearch>
<knowledge>
  <question>not_needed</question>
</knowledge>

3. Follow up question: What is Docker?
Rephrased question:
<websearch>
  <question>What is Docker</question>
</websearch>
<knowledge>
  <rewrite>Can you explain what Docker is and its main purpose?</rewrite>
  <question>What is Docker</question>
</knowledge>

4. Follow up question: Can you tell me what is X from https://example.com
Rephrased question:
<websearch>
  <question>What is X</question>
  <links>https://example.com</links>
</websearch>
<knowledge>
  <question>not_needed</question>
</knowledge>

5. Follow up question: Which company had higher revenue in 2022, "Apple" or "Microsoft"?
Rephrased question:
<websearch>
  <question>Apple revenue 2022</question>
  <question>Microsoft revenue 2022</question>
</websearch>
<knowledge>
  <question>not_needed</question>
</knowledge>

6. Follow up question: Based on knowledge, Formula of Scaled Dot-Product Attention?
Rephrased question:
<websearch>
  <question>not_needed</question>
</websearch>
<knowledge>
  <rewrite>What is the mathematical formula for Scaled Dot-Product Attention?</rewrite>
  <question>What is the formula for Scaled Dot-Product Attention?</question>
</knowledge>

7. Follow up question: 帮我写一段代码
Rephrased question:
<websearch>
  <question>not_needed</question>
</websearch>
<knowledge>
  <question>not_needed</question>
</knowledge>

8. Follow up question: 今天北京天气怎么样
Rephrased question:
<websearch>
  <question>北京今天天气</question>
</websearch>
<knowledge>
  <question>not_needed</question>
</knowledge>
</examples>

Anything below is part of the actual conversation. Use the conversation history and the follow-up question to rephrase the follow-up question as a standalone question based on the guidelines shared above.

<conversation>
{chat_history}
</conversation>

**Use user's language to rephrase the question.**
Follow up question: {question}
Rephrased question:`;

/**
 * Web 搜索专用提示词
 * 复刻 Cherry Studio 的 SEARCH_SUMMARY_PROMPT_WEB_ONLY
 */
const PROMPT_WEB_ONLY = `You are an AI question rephraser. Your role is to rephrase follow-up queries from a conversation into standalone queries that can be used by another LLM to retrieve information through web search.
**Use user's language to rephrase the question.**
Follow these guidelines:
1. If the question is a simple writing task, greeting (e.g., Hi, Hello, How are you), or does not require searching for information (unless the greeting contains a follow-up question), return 'not_needed' in the 'question' XML block. This indicates that no search is required.
2. If the user asks a question related to a specific URL, PDF, or webpage, include the links in the 'links' XML block and the question in the 'question' XML block. If the request is to summarize content from a URL or PDF, return 'summarize' in the 'question' XML block and include the relevant links in the 'links' XML block.
3. For websearch, You need extract keywords into 'question' XML block.
4. Always return the rephrased question inside the 'question' XML block. If there are no links in the follow-up question, do not insert a 'links' XML block in your response.
5. Always wrap the rephrased question in the appropriate XML blocks: use <websearch></websearch> for queries requiring real-time or external information. Ensure that the rephrased question is always contained within a <question></question> block inside the wrapper.
6. For complex questions that require multiple searches, you can include multiple <question> blocks.

There are several examples attached for your reference inside the below 'examples' XML block.

<examples>
1. Follow up question: What is the capital of France
Rephrased question:
<websearch>
  <question>Capital of France</question>
</websearch>

2. Follow up question: Hi, how are you?
Rephrased question:
<websearch>
  <question>not_needed</question>
</websearch>

3. Follow up question: Which company had higher revenue in 2022, "Apple" or "Microsoft"?
Rephrased question:
<websearch>
  <question>Apple revenue 2022</question>
  <question>Microsoft revenue 2022</question>
</websearch>

4. Follow up question: Can you tell me what is X from https://example.com
Rephrased question:
<websearch>
  <question>What is X</question>
  <links>https://example.com</links>
</websearch>

5. Follow up question: 帮我写一段代码
Rephrased question:
<websearch>
  <question>not_needed</question>
</websearch>

6. Follow up question: 今天北京天气怎么样
Rephrased question:
<websearch>
  <question>北京今天天气</question>
</websearch>
</examples>

Anything below is part of the actual conversation. Use the conversation history and the follow-up question to rephrase the follow-up question as a standalone question based on the guidelines shared above.

<conversation>
{chat_history}
</conversation>

**Use user's language to rephrase the question.**
Follow up question: {question}
Rephrased question:`;

/**
 * 知识库搜索专用提示词
 * 复刻 Cherry Studio 的 SEARCH_SUMMARY_PROMPT_KNOWLEDGE_ONLY
 */
const PROMPT_KNOWLEDGE_ONLY = `You are an AI question rephraser. Your role is to rephrase follow-up queries from a conversation into standalone queries that can be used by another LLM to retrieve information from a knowledge base.
**Use user's language to rephrase the question.**
Follow these guidelines:
1. If the question is a simple writing task, greeting (e.g., Hi, Hello, How are you), or does not require searching for information (unless the greeting contains a follow-up question), return 'not_needed' in the 'question' XML block. This indicates that no search is required.
2. You need rewrite user query into 'rewrite' XML block with one alternative version while preserving the original intent and meaning.
3. Always return the rephrased question inside the 'question' XML block.
4. Always wrap the rephrased question in <knowledge></knowledge> XML blocks. Ensure that the rephrased question is always contained within a <question></question> block inside the wrapper.
5. For complex questions that require searching multiple aspects, you can include multiple <question> blocks.

There are several examples attached for your reference inside the below 'examples' XML block.

<examples>
1. Follow up question: What is Docker?
Rephrased question:
<knowledge>
  <rewrite>Can you explain what Docker is and its main purpose?</rewrite>
  <question>What is Docker</question>
</knowledge>

2. Follow up question: Hi, how are you?
Rephrased question:
<knowledge>
  <question>not_needed</question>
</knowledge>

3. Follow up question: Formula of Scaled Dot-Product Attention and Multi-Head Attention?
Rephrased question:
<knowledge>
  <rewrite>What are the mathematical formulas for Scaled Dot-Product Attention and Multi-Head Attention?</rewrite>
  <question>What is the formula for Scaled Dot-Product Attention?</question>
  <question>What is the formula for Multi-Head Attention?</question>
</knowledge>

4. Follow up question: 帮我写一段代码
Rephrased question:
<knowledge>
  <question>not_needed</question>
</knowledge>

5. Follow up question: 项目的部署流程是什么
Rephrased question:
<knowledge>
  <rewrite>请描述项目的部署步骤和流程</rewrite>
  <question>项目的部署流程是什么</question>
</knowledge>
</examples>

Anything below is part of the actual conversation. Use the conversation history and the follow-up question to rephrase the follow-up question as a standalone question based on the guidelines shared above.

<conversation>
{chat_history}
</conversation>

**Use user's language to rephrase the question.**
Follow up question: {question}
Rephrased question:`;

// ==================== XML 解析 ====================

/**
 * 从 XML 块中提取 question 列表
 */
function extractQuestions(xmlContent: string): string[] {
  const matches = xmlContent.match(/<question>([\s\S]*?)<\/question>/gi);
  if (!matches) return [];
  
  const questions: string[] = [];
  for (const match of matches) {
    const content = match.replace(/<\/?question>/gi, '').trim();
    if (content && content !== 'not_needed') {
      questions.push(content);
    }
  }
  return questions;
}

/**
 * 从 XML 块中提取 links 列表
 */
function extractLinks(xmlContent: string): string[] {
  const matches = xmlContent.match(/<links>([\s\S]*?)<\/links>/gi);
  if (!matches) return [];
  
  const links: string[] = [];
  for (const match of matches) {
    const content = match.replace(/<\/?links>/gi, '').trim();
    if (content) links.push(content);
  }
  return links;
}

/**
 * 从 XML 块中提取 rewrite 内容
 */
function extractRewrite(xmlContent: string): string | undefined {
  const match = xmlContent.match(/<rewrite>([\s\S]*?)<\/rewrite>/i);
  return match ? match[1].trim() || undefined : undefined;
}

/**
 * 解析统一 AI 响应为 UnifiedIntentResult
 */
function parseUnifiedResponse(response: string, options: IntentAnalysisOptions): UnifiedIntentResult {
  const result: UnifiedIntentResult = {};

  try {
    // 解析 websearch 块
    if (options.shouldWebSearch) {
      const wsMatch = response.match(/<websearch>([\s\S]*?)<\/websearch>/i);
      if (wsMatch) {
        const questions = extractQuestions(wsMatch[1]);
        if (questions.length > 0) {
          const links = extractLinks(wsMatch[1]);
          result.websearch = {
            question: questions,
            links: links.length > 0 ? links : undefined
          };
        }
      }
    }

    // 解析 knowledge 块
    if (options.shouldKnowledgeSearch) {
      const kbMatch = response.match(/<knowledge>([\s\S]*?)<\/knowledge>/i);
      if (kbMatch) {
        const questions = extractQuestions(kbMatch[1]);
        if (questions.length > 0) {
          result.knowledge = {
            question: questions,
            rewrite: extractRewrite(kbMatch[1])
          };
        }
      }
    }

    // 预留：解析 memory 块
    if (options.shouldMemorySearch) {
      const memMatch = response.match(/<memory>([\s\S]*?)<\/memory>/i);
      if (memMatch) {
        const questions = extractQuestions(memMatch[1]);
        if (questions.length > 0) {
          result.memory = { question: questions };
        }
      }
    }
  } catch (error) {
    logger.error('解析 AI 响应失败:', error);
  }

  return result;
}

// ==================== 核心分析函数 ====================

/**
 * 根据启用的搜索类型选择最合适的提示词
 */
function selectPrompt(options: IntentAnalysisOptions): string {
  const { shouldWebSearch, shouldKnowledgeSearch } = options;

  if (shouldWebSearch && shouldKnowledgeSearch) {
    return PROMPT_COMBINED;
  } else if (shouldKnowledgeSearch) {
    return PROMPT_KNOWLEDGE_ONLY;
  } else {
    return PROMPT_WEB_ONLY;
  }
}

/**
 * 获取意图分析使用的模型 ID
 */
function getIntentAnalysisModelId(): string {
  const settings = store.getState().settings;
  
  if (settings.aiIntentAnalysisUseCurrentModel && settings.currentModelId) {
    return settings.currentModelId;
  }
  if (settings.aiIntentAnalysisModelId) {
    return settings.aiIntentAnalysisModelId;
  }
  // 回退到话题命名模型（快速模型）或默认模型
  return settings.topicNamingModelId || settings.defaultModelId || 'gpt-3.5-turbo';
}

/**
 * 构建 fallback 结果（AI 请求失败时使用用户原文作为关键词）
 */
function buildFallbackResult(userMessage: string, options: IntentAnalysisOptions): UnifiedIntentResult {
  const result: UnifiedIntentResult = {};
  const fallbackContent = userMessage.trim() || 'search';

  if (options.shouldWebSearch) {
    result.websearch = { question: [fallbackContent] };
  }
  if (options.shouldKnowledgeSearch) {
    result.knowledge = { question: [fallbackContent], rewrite: fallbackContent };
  }

  return result;
}

/**
 * 🎯 统一搜索意图分析
 * 
 * 根据启用的搜索类型，使用 AI 一次性分析所有意图。
 * 复刻 Cherry Studio 的 searchOrchestrationPlugin.analyzeSearchIntent
 * 
 * @param userMessage 用户消息
 * @param lastAssistantMessage 上一条助手消息（可选，用于上下文）
 * @param options 指定需要分析哪些搜索类型
 * @returns 统一的意图分析结果
 */
export async function analyzeUnifiedSearchIntent(
  userMessage: string,
  lastAssistantMessage?: string,
  options: IntentAnalysisOptions = { shouldWebSearch: true }
): Promise<UnifiedIntentResult> {
  try {
    if (!userMessage?.trim()) {
      return {};
    }

    // 如果没有启用任何搜索类型，直接返回
    if (!options.shouldWebSearch && !options.shouldKnowledgeSearch && !options.shouldMemorySearch) {
      return {};
    }

    const modelId = getIntentAnalysisModelId();

    // 构建上下文
    const chatHistory = lastAssistantMessage 
      ? `assistant: ${lastAssistantMessage.slice(0, 500)}` 
      : '';

    // 根据启用的搜索类型选择提示词
    const prompt = selectPrompt(options);
    // 使用替换函数，避免用户输入中的 $& $' 等模式被 replace 特殊展开
    const formattedPrompt = prompt
      .replace('{chat_history}', () => chatHistory)
      .replace('{question}', () => userMessage);

    logger.debug('开始统一意图分析', {
      modelId,
      web: options.shouldWebSearch,
      knowledge: options.shouldKnowledgeSearch,
      memory: options.shouldMemorySearch
    });

    const response = await sendChatRequest({
      messages: [{ role: 'user', content: formattedPrompt }],
      modelId
    });

    if (!response.success || !response.content) {
      logger.warn('AI 请求失败，使用 fallback');
      return buildFallbackResult(userMessage, options);
    }

    const result = parseUnifiedResponse(response.content, options);
    logger.debug('意图分析完成:', result);

    return result;
  } catch (error) {
    logger.error('意图分析失败:', error);
    return buildFallbackResult(userMessage, options);
  }
}

// ==================== 兼容旧接口 ====================

/**
 * 使用 AI 分析用户消息的搜索意图（兼容旧接口）
 * @deprecated 请使用 analyzeUnifiedSearchIntent 代替
 */
export async function analyzeSearchIntentWithAI(
  userMessage: string,
  lastAssistantMessage?: string
): Promise<AIIntentAnalysisResult> {
  const result = await analyzeUnifiedSearchIntent(
    userMessage,
    lastAssistantMessage,
    { shouldWebSearch: true }
  );

  return {
    needsWebSearch: !!result.websearch,
    websearch: result.websearch,
    confidence: result.websearch ? 0.9 : 0.8,
    reason: result.websearch 
      ? `提取了 ${result.websearch.question.length} 个搜索关键词`
      : '不需要搜索'
  };
}

/**
 * 检查是否启用了 AI 意图分析
 */
export function isAIIntentAnalysisEnabled(): boolean {
  return store.getState().settings.enableAIIntentAnalysis ?? false;
}

export default {
  analyzeUnifiedSearchIntent,
  analyzeSearchIntentWithAI,
  isAIIntentAnalysisEnabled
};
