import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';

export interface UIState {
  // 是否正在生成响应
  generating: boolean;
  // 是否显示思考过程
  showThinking: boolean;
  // 思考过程显示样式
  thinkingDisplayStyle: 'compact' | 'detailed' | 'hidden';
  // 思考过程自动折叠
  thoughtAutoCollapse: boolean;
  // 思考过程默认深度
  defaultThinkingEffort: 'off' | 'low' | 'medium' | 'high' | 'auto';
  // 多模型响应显示样式
  multiModelDisplayStyle: 'horizontal' | 'vertical' | 'grid';
  // 是否显示系统提示词
  showSystemPrompt: boolean;
  // 是否显示工具调用详情
  showToolCalls: boolean;
  // 是否显示代码块行号
  showCodeLineNumbers: boolean;
  // 是否启用代码高亮
  enableCodeHighlight: boolean;
  // 是否启用Markdown渲染
  enableMarkdownRender: boolean;
  // 是否启用图片预览
  enableImagePreview: boolean;
  // 是否启用表格增强
  enableTableEnhancement: boolean;
  // 是否启用数学公式渲染
  enableMathRender: boolean;
  // 是否启用链接预览
  enableLinkPreview: boolean;
  // 是否启用自动滚动
  enableAutoScroll: boolean;
}

const initialState: UIState = {
  generating: false,
  showThinking: true,
  thinkingDisplayStyle: 'compact',
  thoughtAutoCollapse: true,
  defaultThinkingEffort: 'high',
  multiModelDisplayStyle: 'horizontal',
  showSystemPrompt: true,
  showToolCalls: true,
  showCodeLineNumbers: true,
  enableCodeHighlight: true,
  enableMarkdownRender: true,
  enableImagePreview: true,
  enableTableEnhancement: true,
  enableMathRender: true,
  enableLinkPreview: true,
  enableAutoScroll: true
};

export const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    setGenerating: (state, action: PayloadAction<boolean>) => {
      state.generating = action.payload;
    },
    setShowThinking: (state, action: PayloadAction<boolean>) => {
      state.showThinking = action.payload;
    },
    setThinkingDisplayStyle: (state, action: PayloadAction<'compact' | 'detailed' | 'hidden'>) => {
      state.thinkingDisplayStyle = action.payload;
    },
    setThoughtAutoCollapse: (state, action: PayloadAction<boolean>) => {
      state.thoughtAutoCollapse = action.payload;
    },
    setDefaultThinkingEffort: (state, action: PayloadAction<'off' | 'low' | 'medium' | 'high' | 'auto'>) => {
      state.defaultThinkingEffort = action.payload;
    },
    setMultiModelDisplayStyle: (state, action: PayloadAction<'horizontal' | 'vertical' | 'grid'>) => {
      state.multiModelDisplayStyle = action.payload;
    },
    setShowSystemPrompt: (state, action: PayloadAction<boolean>) => {
      state.showSystemPrompt = action.payload;
    },
    setShowToolCalls: (state, action: PayloadAction<boolean>) => {
      state.showToolCalls = action.payload;
    },
    setShowCodeLineNumbers: (state, action: PayloadAction<boolean>) => {
      state.showCodeLineNumbers = action.payload;
    },
    setEnableCodeHighlight: (state, action: PayloadAction<boolean>) => {
      state.enableCodeHighlight = action.payload;
    },
    setEnableMarkdownRender: (state, action: PayloadAction<boolean>) => {
      state.enableMarkdownRender = action.payload;
    },
    setEnableImagePreview: (state, action: PayloadAction<boolean>) => {
      state.enableImagePreview = action.payload;
    },
    setEnableTableEnhancement: (state, action: PayloadAction<boolean>) => {
      state.enableTableEnhancement = action.payload;
    },
    setEnableMathRender: (state, action: PayloadAction<boolean>) => {
      state.enableMathRender = action.payload;
    },
    setEnableLinkPreview: (state, action: PayloadAction<boolean>) => {
      state.enableLinkPreview = action.payload;
    },
    setEnableAutoScroll: (state, action: PayloadAction<boolean>) => {
      state.enableAutoScroll = action.payload;
    },
    // 用于UI事件的action
    scrollToBottom: () => {
      // 这个action不修改状态，只用于触发事件
    },
    forceUpdate: () => {
      // 这个action不修改状态，只用于触发事件
    }
  }
});

export const {
  setGenerating,
  setShowThinking,
  setThinkingDisplayStyle,
  setThoughtAutoCollapse,
  setDefaultThinkingEffort,
  setMultiModelDisplayStyle,
  setShowSystemPrompt,
  setShowToolCalls,
  setShowCodeLineNumbers,
  setEnableCodeHighlight,
  setEnableMarkdownRender,
  setEnableImagePreview,
  setEnableTableEnhancement,
  setEnableMathRender,
  setEnableLinkPreview,
  setEnableAutoScroll,
  scrollToBottom,
  forceUpdate
} = uiSlice.actions;

export default uiSlice.reducer;
