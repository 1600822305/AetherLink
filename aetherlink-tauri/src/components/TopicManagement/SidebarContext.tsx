import React, { createContext, useContext } from 'react';
import type { ReactNode } from 'react';
import type { Assistant } from '../../shared/types/Assistant';
import type { ChatTopic } from '../../shared/types';
import type { ThinkingOption } from '../../shared/config/reasoningConfig';

// 定义设置类型
export interface Settings {
  streamOutput: boolean;
  showMessageDivider: boolean;
  copyableCodeBlocks: boolean;
  highPerformanceStreaming: boolean; // 新增：高性能流式输出
  contextLength: number;
  contextCount: number;
  mathRenderer: 'KaTeX' | 'MathJax';
  defaultThinkingEffort: ThinkingOption;
}

export interface SettingItem {
  id: string;
  name: string;
  defaultValue: boolean | string;
  description: string;
  type?: 'switch' | 'select';
  options?: Array<{ value: string; label: string }>;
}

// 定义上下文类型
export interface SidebarContextType {
  // 状态
  loading: boolean;
  value: number;
  userAssistants: Assistant[];
  currentAssistant: Assistant | null;
  assistantWithTopics: Assistant | null;
  currentTopic: ChatTopic | null;

  // 设置状态的函数
  setValue: (value: number) => void;
  setCurrentAssistant: (assistant: Assistant | null) => void;

  // 助手管理函数
  handleSelectAssistant: (assistant: Assistant) => void;
  handleAddAssistant: (assistant: Assistant) => Promise<void>;
  handleUpdateAssistant: (assistant: Assistant) => Promise<void>;
  handleDeleteAssistant: (assistantId: string) => Promise<void>;

  // 话题管理函数
  handleCreateTopic: () => Promise<ChatTopic | null>;
  handleSelectTopic: (topic: ChatTopic) => void;
  handleDeleteTopic: (topicId: string, event: React.MouseEvent) => Promise<void>;
  handleUpdateTopic: (topic: ChatTopic) => void;

  // 设置管理
  settings: Settings;
  settingsArray: SettingItem[];
  handleSettingChange: (settingId: string, value: boolean | string) => void;
  handleContextLengthChange: (value: number) => void;
  handleContextCountChange: (value: number) => void;
  handleMathRendererChange: (value: any) => void;
  handleThinkingEffortChange: (value: ThinkingOption) => void;

  // MCP 相关状态和函数
  mcpMode?: 'prompt' | 'function';
  toolsEnabled?: boolean;
  handleMCPModeChange?: (mode: 'prompt' | 'function') => void;
  handleToolsToggle?: (enabled: boolean) => void;

  // 刷新函数
  refreshTopics: () => Promise<void>;
}

// 创建上下文
export const SidebarContext = createContext<SidebarContextType | undefined>(undefined);

// 上下文提供者组件
interface SidebarProviderProps {
  children: ReactNode;
  value: SidebarContextType;
}

export const SidebarProvider: React.FC<SidebarProviderProps> = ({ children, value }) => {
  return <SidebarContext.Provider value={value}>{children}</SidebarContext.Provider>;
};

// 自定义钩子，用于访问上下文
export const useSidebarContext = () => {
  const context = useContext(SidebarContext);
  if (context === undefined) {
    throw new Error('useSidebarContext must be used within a SidebarProvider');
  }
  return context;
};
