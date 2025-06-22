import React from 'react';
import {
  Smile,
  Sparkles,
  Code,
  Languages,
  Edit
} from 'lucide-react';

import {
  DEFAULT_ASSISTANT_PROMPT,
  PROGRAMMING_ASSISTANT_PROMPT,
  TRANSLATION_ASSISTANT_PROMPT,
  WRITING_ASSISTANT_PROMPT,
  WEB_ANALYSIS_ASSISTANT_PROMPT
} from '../../config/assistantPrompts';
import { extendedAssistants } from './ExtendedAssistants';
import type { Assistant } from '../../types/Assistant';

/**
 * 基础预设助手列表
 */
export const baseAssistants: Assistant[] = [
  {
    id: 'default',
    name: '默认助手',
    description: '通用型AI助手，可以回答各种问题',
    icon: React.createElement(Smile, { size: 20, color: '#FFD700' }),
    emoji: '😀',
    isSystem: true,
    topicIds: [],
    topics: [],
    systemPrompt: DEFAULT_ASSISTANT_PROMPT,
    type: 'assistant'
  },
  {
    id: 'web-analysis',
    name: '网页分析助手',
    description: '帮助分析各种网页内容',
    icon: React.createElement(Sparkles, { size: 20, color: '#1E90FF' }),
    emoji: '🌐',
    isSystem: true,
    topicIds: [],
    topics: [],
    systemPrompt: WEB_ANALYSIS_ASSISTANT_PROMPT,
    type: 'assistant'
  },
  {
    id: 'code-assistant',
    name: '编程助手',
    description: '专业的编程助手，能够解答各种编程问题并提供代码示例',
    icon: React.createElement(Code, { size: 20, color: '#4CAF50' }),
    emoji: '💻',
    isSystem: true,
    topicIds: [],
    topics: [],
    systemPrompt: PROGRAMMING_ASSISTANT_PROMPT,
    type: 'assistant'
  },
  {
    id: 'translate-assistant',
    name: '翻译助手',
    description: '专业的翻译助手，可以在不同语言之间进行准确的翻译',
    icon: React.createElement(Languages, { size: 20, color: '#9C27B0' }),
    emoji: '🌍',
    isSystem: true,
    topicIds: [],
    topics: [],
    systemPrompt: TRANSLATION_ASSISTANT_PROMPT,
    type: 'assistant'
  },
  {
    id: 'writing-assistant',
    name: '写作助手',
    description: '专业的写作助手，可以帮助改进文章、报告和其他文本内容',
    icon: React.createElement(Edit, { size: 20, color: '#FF5722' }),
    emoji: '✍️',
    isSystem: true,
    topicIds: [],
    topics: [],
    systemPrompt: WRITING_ASSISTANT_PROMPT,
    type: 'assistant'
  }
];

/**
 * 系统预设助手列表（基础 + 扩展）
 */
export const systemAgents: Assistant[] = [...baseAssistants, ...extendedAssistants];

/**
 * 获取默认助手
 */
export function getDefaultAssistant(): Assistant {
  return {
    id: 'default',
    name: '默认助手',
    emoji: '😀',
    description: '通用型AI助手，可以回答各种问题',
    isSystem: true,
    topicIds: [],
    topics: [],
    systemPrompt: DEFAULT_ASSISTANT_PROMPT,
    type: 'assistant'
  };
}

/**
 * 获取所有系统预设助手
 */
export function getSystemAgents(): Assistant[] {
  return systemAgents;
}

/**
 * 获取用户自定义代理
 * 这里模拟最佳实例的实现，实际应该从数据库中获取
 */
export function getUserAgents(): Assistant[] {
  // 这里应该从数据库中获取用户自定义代理
  // 暂时返回空数组
  return [];
}

/**
 * 获取所有可用的助手来源
 */
export function getAllAgentSources(): Assistant[] {
  // 不再单独添加默认助手，因为它已经包含在systemAgents中
  const systemAgents = getSystemAgents();
  const userAgents = getUserAgents();

  return [...systemAgents, ...userAgents];
}
