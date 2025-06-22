import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import { getStorageItem, setStorageItem } from '../../utils/storage';

// 存储键
const STORAGE_KEY = 'settings';

// 设置状态接口
export interface SettingsState {
  // 主题设置
  theme: 'light' | 'dark' | 'system';

  // 思考过程显示样式
  thinkingDisplayStyle?: 'compact' | 'full' | 'hidden';

  // 思考过程自动折叠
  thoughtAutoCollapse?: boolean;

  // 默认思维链长度
  defaultThinkingEffort?: 'off' | 'low' | 'medium' | 'high' | 'auto';

  // 多模型对比显示样式
  multiModelDisplayStyle?: 'horizontal' | 'grid' | 'vertical';

  // 工具调用显示详情
  showToolDetails?: boolean;

  // 引用显示详情
  showCitationDetails?: boolean;

  // CompactChatInput 功能控制开关
  showAIDebateButton?: boolean;
  showQuickPhraseButton?: boolean;

  // 系统提示词变量注入设置
  systemPromptVariables?: {
    enableTimeVariable?: boolean;
    enableLocationVariable?: boolean;
    customLocation?: string;
  };

  // 集成样式输入框自定义按钮
  integratedInputButtons?: string[];

  // 对话导航功能
  messageNavigation?: 'none' | 'buttons';

  // 其他设置...
  [key: string]: any;
}

// 从IndexedDB加载初始状态
const loadFromStorage = async (): Promise<SettingsState> => {
  try {
    const savedSettings = await getStorageItem<SettingsState>(STORAGE_KEY);
    if (savedSettings) {
      return savedSettings;
    }
  } catch (error) {
    console.error('Failed to load settings from IndexedDB', error);
  }

  // 默认初始状态
  return {
    theme: 'system',
    thinkingDisplayStyle: 'compact',
    thoughtAutoCollapse: true,
    defaultThinkingEffort: 'medium',
    multiModelDisplayStyle: 'horizontal',
    showToolDetails: true,
    showCitationDetails: true,
    fontSize: 16,
    language: 'zh-CN',
    sendWithEnter: true,
    enableNotifications: true,
    models: [],
    providers: [],
    autoNameTopic: true,
    modelSelectorStyle: 'dialog',
    toolbarDisplayStyle: 'both',
    showSystemPromptBubble: true,
    showAIDebateButton: true,
    showQuickPhraseButton: true,
    systemPromptVariables: {
      enableTimeVariable: false,
      enableLocationVariable: false,
      customLocation: ''
    },
    integratedInputButtons: ['tools', 'search'],
    messageNavigation: 'none',
    isLoading: false
  };
};

// 定义初始状态（首次加载使用默认值）
const initialState: SettingsState = {
  theme: 'system',
  thinkingDisplayStyle: 'compact',
  thoughtAutoCollapse: true,
  defaultThinkingEffort: 'medium',
  multiModelDisplayStyle: 'horizontal',
  showToolDetails: true,
  showCitationDetails: true,
  fontSize: 16,
  language: 'zh-CN',
  sendWithEnter: true,
  enableNotifications: true,
  models: [],
  providers: [],
  autoNameTopic: true,
  modelSelectorStyle: 'dialog',
  toolbarDisplayStyle: 'both',
  showSystemPromptBubble: true,
  showAIDebateButton: true,
  showQuickPhraseButton: true,
  systemPromptVariables: {
    enableTimeVariable: false,
    enableLocationVariable: false,
    customLocation: ''
  },
  integratedInputButtons: ['tools', 'search'],
  messageNavigation: 'none',
  isLoading: false
};

// 创建设置切片
const settingsSlice = createSlice({
  name: 'settings',
  initialState,
  reducers: {
    // 更新主题
    setTheme: (state, action: PayloadAction<'light' | 'dark' | 'system'>) => {
      state.theme = action.payload;
      // 保存到存储
      setStorageItem(STORAGE_KEY, state);
    },

    // 更新设置（通用方法）
    updateSettings: (state, action: PayloadAction<Partial<SettingsState>>) => {
      Object.assign(state, action.payload);
      // 保存到存储
      setStorageItem(STORAGE_KEY, state);
    },

    // 初始化设置（从存储加载）
    initSettings: (_state, action: PayloadAction<SettingsState>) => {
      return action.payload;
    }
  }
});

// 导出操作
export const settingsActions = settingsSlice.actions;
export const { setTheme, updateSettings, initSettings } = settingsSlice.actions;

// 导出异步初始化操作
export const initSettingsAsync = () => async (dispatch: any) => {
  const settings = await loadFromStorage();
  dispatch(settingsActions.initSettings(settings));
};

// 导出reducer
export default settingsSlice.reducer;
