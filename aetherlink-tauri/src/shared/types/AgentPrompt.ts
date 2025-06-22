/**
 * 智能体提示词类型定义
 */

export interface AgentPrompt {
  id: string;
  name: string;
  description: string;
  content: string;
  category: string;
  tags: string[];
  emoji: string;
  isBuiltIn: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface AgentPromptCategory {
  id: string;
  name: string;
  description: string;
  emoji: string;
  prompts: AgentPrompt[];
}

export interface AgentPromptsState {
  categories: AgentPromptCategory[];
  searchQuery: string;
  selectedCategory: string | null;
  loading: boolean;
  error: string | null;
}

export type AgentPromptAction = 
  | { type: 'SET_SEARCH_QUERY'; payload: string }
  | { type: 'SET_SELECTED_CATEGORY'; payload: string | null }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_CATEGORIES'; payload: AgentPromptCategory[] };
