import React from 'react';
import {
  Calculator,
  BookOpen,
  Plane,
  Heart,
  Film,
  ChefHat,
  HeartHandshake,
  GraduationCap,
  Briefcase,
  Smartphone,
  PenTool,
  Scale
} from 'lucide-react';

import {
  MATH_ASSISTANT_PROMPT,
  HISTORY_ASSISTANT_PROMPT,
  TRAVEL_ASSISTANT_PROMPT,
  HEALTH_ASSISTANT_PROMPT,
  MOVIE_ASSISTANT_PROMPT,
  COOKING_ASSISTANT_PROMPT,
  EMOTIONAL_SUPPORT_ASSISTANT_PROMPT,
  EDUCATION_ASSISTANT_PROMPT,
  BUSINESS_ASSISTANT_PROMPT,
  TECH_ASSISTANT_PROMPT,
  CREATIVE_WRITING_ASSISTANT_PROMPT,
  LEGAL_ASSISTANT_PROMPT
} from '../../config/assistantPrompts';
import type { Assistant } from '../../types/Assistant';

/**
 * 扩展助手列表
 * 这些是除了基础助手外的额外专业助手
 */
export const extendedAssistants: Assistant[] = [
  {
    id: 'math-assistant',
    name: '数学助手',
    description: '专业的数学助手，能够解答各种数学问题，从基础算术到高等数学',
    icon: React.createElement(Calculator, { size: 20, color: '#2196F3' }),
    emoji: '🔢',
    isSystem: true,
    topicIds: [],
    topics: [],
    systemPrompt: MATH_ASSISTANT_PROMPT,
    type: 'assistant'
  },
  {
    id: 'history-assistant',
    name: '历史顾问',
    description: '专业的历史顾问，对世界各地的历史事件、人物和文化有深入的了解',
    icon: React.createElement(BookOpen, { size: 20, color: '#795548' }),
    emoji: '📜',
    isSystem: true,
    topicIds: [],
    topics: [],
    systemPrompt: HISTORY_ASSISTANT_PROMPT,
    type: 'assistant'
  },
  {
    id: 'travel-assistant',
    name: '旅行规划助手',
    description: '专业的旅行规划助手，帮助规划旅行路线、推荐景点和活动',
    icon: React.createElement(Plane, { size: 20, color: '#00BCD4' }),
    emoji: '✈️',
    isSystem: true,
    topicIds: [],
    topics: [],
    systemPrompt: TRAVEL_ASSISTANT_PROMPT,
    type: 'assistant'
  },
  {
    id: 'health-assistant',
    name: '健康顾问',
    description: '健康生活顾问，提供健康饮食、锻炼计划等方面的一般性建议',
    icon: React.createElement(Heart, { size: 20, color: '#4CAF50' }),
    emoji: '🩺',
    isSystem: true,
    topicIds: [],
    topics: [],
    systemPrompt: HEALTH_ASSISTANT_PROMPT,
    type: 'assistant'
  },
  {
    id: 'movie-assistant',
    name: '电影专家',
    description: '电影专家，可推荐电影、分析电影主题和讨论电影的文化影响',
    icon: React.createElement(Film, { size: 20, color: '#E91E63' }),
    emoji: '🎬',
    isSystem: true,
    topicIds: [],
    topics: [],
    systemPrompt: MOVIE_ASSISTANT_PROMPT,
    type: 'assistant'
  },
  {
    id: 'cooking-assistant',
    name: '美食顾问',
    description: '美食顾问，提供烹饪建议、食谱推荐和食物搭配指南',
    icon: React.createElement(ChefHat, { size: 20, color: '#FF9800' }),
    emoji: '🍳',
    isSystem: true,
    topicIds: [],
    topics: [],
    systemPrompt: COOKING_ASSISTANT_PROMPT,
    type: 'assistant'
  },
  {
    id: 'emotional-assistant',
    name: '情感支持助手',
    description: '提供情感支持和倾听服务的对话伙伴',
    icon: React.createElement(HeartHandshake, { size: 20, color: '#F06292' }),
    emoji: '💗',
    isSystem: true,
    topicIds: [],
    topics: [],
    systemPrompt: EMOTIONAL_SUPPORT_ASSISTANT_PROMPT,
    type: 'assistant'
  },
  {
    id: 'education-assistant',
    name: '学习教育助手',
    description: '帮助理解各种学科概念和主题的教育助手',
    icon: React.createElement(GraduationCap, { size: 20, color: '#3F51B5' }),
    emoji: '🎓',
    isSystem: true,
    topicIds: [],
    topics: [],
    systemPrompt: EDUCATION_ASSISTANT_PROMPT,
    type: 'assistant'
  },
  {
    id: 'business-assistant',
    name: '商业咨询助手',
    description: '提供创业、营销、管理和商业策略方面建议的商业助手',
    icon: React.createElement(Briefcase, { size: 20, color: '#607D8B' }),
    emoji: '💼',
    isSystem: true,
    topicIds: [],
    topics: [],
    systemPrompt: BUSINESS_ASSISTANT_PROMPT,
    type: 'assistant'
  },
  {
    id: 'tech-assistant',
    name: '科技解说助手',
    description: '以通俗易懂的方式解释各种科技概念、产品和趋势',
    icon: React.createElement(Smartphone, { size: 20, color: '#673AB7' }),
    emoji: '📱',
    isSystem: true,
    topicIds: [],
    topics: [],
    systemPrompt: TECH_ASSISTANT_PROMPT,
    type: 'assistant'
  },
  {
    id: 'creative-writing-assistant',
    name: '创意写作助手',
    description: '帮助故事创作、诗歌写作和剧本开发的创意写作助手',
    icon: React.createElement(PenTool, { size: 20, color: '#9C27B0' }),
    emoji: '📝',
    isSystem: true,
    topicIds: [],
    topics: [],
    systemPrompt: CREATIVE_WRITING_ASSISTANT_PROMPT,
    type: 'assistant'
  },
  {
    id: 'legal-assistant',
    name: '法律咨询助手',
    description: '提供基本法律概念解释和一般性法律信息的助手',
    icon: React.createElement(Scale, { size: 20, color: '#455A64' }),
    emoji: '⚖️',
    isSystem: true,
    topicIds: [],
    topics: [],
    systemPrompt: LEGAL_ASSISTANT_PROMPT,
    type: 'assistant'
  }
];