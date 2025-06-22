import { useState } from 'react';
import type { ThinkingOption } from '../../../shared/config/reasoningConfig';
import {
  getHighPerformanceStreamingSetting,
  setHighPerformanceStreamingSetting
} from '../../../shared/utils/performanceSettings';
import { useAppSelector, useAppDispatch } from '../../../shared/store';
import { setMessageStyle, setRenderUserInputAsMarkdown, setAutoScrollToBottom, updateSettings } from '../../../shared/store/settingsSlice';

/**
 * 设置管理钩子
 */
export function useSettingsManagement() {
  const dispatch = useAppDispatch();
  const messageStyle = useAppSelector(state => state.settings.messageStyle);
  const renderUserInputAsMarkdown = useAppSelector(state => state.settings.renderUserInputAsMarkdown);
  // 获取自动滚动设置
  const autoScrollToBottom = useAppSelector(state => state.settings.autoScrollToBottom);
  // 获取对话导航设置
  const messageNavigation = useAppSelector(state => (state.settings as any).messageNavigation || 'none');

  // 应用设置
  const [settings, setSettings] = useState({
    streamOutput: true,
    showMessageDivider: true,
    copyableCodeBlocks: true,
    highPerformanceStreaming: getHighPerformanceStreamingSetting(), // 从 localStorage 加载
    messageStyle: messageStyle || 'bubble', // 从Redux获取消息样式
    renderUserInputAsMarkdown: renderUserInputAsMarkdown !== undefined ? renderUserInputAsMarkdown : true, // 从Redux获取用户输入渲染设置
    // 自动滚动设置
    autoScrollToBottom: autoScrollToBottom !== undefined ? autoScrollToBottom : true, // 从Redux获取自动滚动设置
    // 对话导航设置
    messageNavigation: messageNavigation, // 从Redux获取对话导航设置
    contextLength: 16000, // 设置为16K，适合大多数模型
    contextCount: 5,      // 与最佳实例保持一致，DEFAULT_CONTEXTCOUNT = 5
    mathRenderer: 'KaTeX' as const,
    defaultThinkingEffort: 'medium' as ThinkingOption
  });

  // 转换设置对象为SettingsTab组件需要的格式
  // 创建非readonly的options数组
  const messageStyleOptions = [
    { value: 'plain', label: '简洁' },
    { value: 'bubble', label: '气泡' }
  ];

  const messageNavigationOptions = [
    { value: 'none', label: '不显示' },
    { value: 'buttons', label: '上下按钮' }
  ];

  const settingsArray = [
    { id: 'streamOutput', name: '流式输出', defaultValue: settings.streamOutput, description: '实时显示AI回答，打字机效果' },
    { id: 'highPerformanceStreaming', name: '高性能流式输出', defaultValue: settings.highPerformanceStreaming, description: '启用超高性能渲染模式：虚拟化、Canvas或最小化渲染，大幅提升流式输出性能' },
    { id: 'showMessageDivider', name: '消息分割线', defaultValue: settings.showMessageDivider, description: '在消息之间显示分割线' },
    { id: 'copyableCodeBlocks', name: '代码块可复制', defaultValue: settings.copyableCodeBlocks, description: '允许复制代码块的内容' },
    { id: 'renderUserInputAsMarkdown', name: '渲染用户输入', defaultValue: settings.renderUserInputAsMarkdown, description: '是否渲染用户输入的Markdown格式（关闭后用户消息将显示为纯文本）' },
    { id: 'autoScrollToBottom', name: '自动下滑', defaultValue: settings.autoScrollToBottom, description: '新消息时自动滚动到聊天底部' },
    { id: 'messageStyle', name: '消息样式', defaultValue: settings.messageStyle, description: '选择聊天消息的显示样式', type: 'select' as const, options: messageStyleOptions},
    { id: 'messageNavigation', name: '对话导航', defaultValue: settings.messageNavigation, description: '显示上下按钮快速跳转到上一条/下一条消息', type: 'select' as const, options: messageNavigationOptions},
  ];

  // 设置相关函数
  const handleSettingChange = (settingId: string, value: boolean | string) => {
    // 特殊处理消息样式
    if (settingId === 'messageStyle') {
      const newStyle = value as 'plain' | 'bubble';
      dispatch(setMessageStyle(newStyle));
      setSettings(prev => ({ ...prev, messageStyle: newStyle }));
      return;
    }

    // 特殊处理用户输入渲染设置
    if (settingId === 'renderUserInputAsMarkdown') {
      const newValue = value as boolean;
      dispatch(setRenderUserInputAsMarkdown(newValue));
      setSettings(prev => ({ ...prev, renderUserInputAsMarkdown: newValue }));
      return;
    }

    // 特殊处理自动滚动设置
    if (settingId === 'autoScrollToBottom') {
      const newValue = value as boolean;
      dispatch(setAutoScrollToBottom(newValue));
      setSettings(prev => ({ ...prev, autoScrollToBottom: newValue }));
      return;
    }

    // 特殊处理对话导航设置
    if (settingId === 'messageNavigation') {
      const newValue = value as 'none' | 'buttons';
      dispatch(updateSettings({ messageNavigation: newValue } as any));
      setSettings(prev => ({ ...prev, messageNavigation: newValue }));
      return;
    }

    setSettings(prev => ({ ...prev, [settingId]: value }));

    // 特殊处理：保存高性能流式输出设置到 localStorage
    if (settingId === 'highPerformanceStreaming') {
      setHighPerformanceStreamingSetting(value as boolean);
    }
  };

  const handleContextLengthChange = (value: number) => {
    setSettings(prev => ({ ...prev, contextLength: value }));
  };

  const handleContextCountChange = (value: number) => {
    setSettings(prev => ({ ...prev, contextCount: value }));
  };

  const handleMathRendererChange = (value: any) => {
    setSettings(prev => ({ ...prev, mathRenderer: value }));
  };

  const handleThinkingEffortChange = (value: ThinkingOption) => {
    setSettings(prev => ({ ...prev, defaultThinkingEffort: value }));
  };

  return {
    settings,
    settingsArray,
    handleSettingChange,
    handleContextLengthChange,
    handleContextCountChange,
    handleMathRendererChange,
    handleThinkingEffortChange
  };
}
