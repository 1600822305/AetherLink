import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import type { Model } from '../types';
import type { PayloadAction } from '@reduxjs/toolkit';
import type { GeneratedImage } from '../types';
import { ThinkingDisplayStyle } from '../../components/message/blocks/ThinkingBlock';
import { getStorageItem, setStorageItem } from '../utils/storage';
import { getDefaultModelProviders, getDefaultModelId, type ModelProvider } from '../config/defaultModels';

interface SettingsState {
  theme: 'light' | 'dark' | 'system';
  themeStyle: 'default' | 'claude' | 'minimal' | 'vibrant' | 'nature' | 'ocean' | 'sunset' | 'monochrome' | 'cyberpunk'; // 新增主题风格
  fontSize: number;
  fontFamily: string; // 新增字体家族设置
  language: string;
  sendWithEnter: boolean;
  enableNotifications: boolean;
  // 移动端输入法发送按钮控制
  mobileInputMethodEnterAsNewline: boolean; // 移动端输入法的Enter键是否作为换行而非发送
  models: Model[];
  providers: ModelProvider[];
  defaultModelId?: string;
  currentModelId?: string;
  generatedImages?: GeneratedImage[];
  enableTopicNaming: boolean; // 统一字段名称，与最佳实例保持一致
  topicNamingModelId?: string;
  topicNamingPrompt: string; // 添加自定义提示词配置
  modelSelectorStyle: 'dialog' | 'dropdown';
  thinkingDisplayStyle: string;
  toolbarDisplayStyle: 'icon' | 'text' | 'both'; // 工具栏显示样式：仅图标、仅文字、图标+文字
  inputBoxStyle: 'default' | 'modern' | 'minimal'; // 输入框风格：默认、现代、简约
  inputLayoutStyle: 'default' | 'compact' | 'integrated'; // 输入框布局样式：默认（分离）、聚合或集成

  // 代码块设置
  codeStyle: string; // 代码主题风格
  codeEditor: boolean; // 代码编辑器开关
  codeShowLineNumbers: boolean; // 显示行号
  codeCollapsible: boolean; // 代码可折叠
  codeWrappable: boolean; // 代码可换行
  // 在代码块设置接口中添加 mermaid 开关
  codeDefaultCollapsed: boolean; // 代码块默认收起
  mermaidEnabled: boolean; // 是否启用 Mermaid 图表渲染
  showSystemPromptBubble: boolean; // 是否显示系统提示词气泡
  showUserAvatar: boolean; // 是否显示用户头像
  showUserName: boolean; // 是否显示用户名称
  showModelAvatar: boolean; // 是否显示模型头像
  showModelName: boolean; // 是否显示模型名称
  messageStyle: 'plain' | 'bubble'; // 消息样式：简洁或气泡
  renderUserInputAsMarkdown: boolean; // 是否渲染用户输入的markdown
  // 聊天界面自动滚动控制
  autoScrollToBottom: boolean; // 是否自动滚动到底部
  // 顶部工具栏设置
  topToolbar: {
    showSettingsButton: boolean; // 是否显示设置按钮
    showModelSelector: boolean; // 是否显示模型选择器
    modelSelectorStyle: 'dialog' | 'dropdown'; // 模型选择器样式：弹窗式或下拉式
    modelSelectorDisplayStyle?: 'icon' | 'text'; // 模型选择器在DIY布局中的显示样式：图标或文字
    showChatTitle: boolean; // 是否显示"对话"标题
    showTopicName: boolean; // 是否显示话题名称
    showNewTopicButton: boolean; // 是否显示新建话题按钮
    showClearButton: boolean; // 是否显示清空按钮
    showMenuButton: boolean; // 是否显示菜单按钮
    // 组件顺序配置
    leftComponents: string[]; // 左侧组件顺序
    rightComponents: string[]; // 右侧组件顺序
    // DIY布局组件位置信息
    componentPositions?: Array<{
      id: string;
      x: number;
      y: number;
      width?: number;
      height?: number;
    }>;
  };
  isLoading: boolean; // 添加加载状态以处理异步操作

  // 思考过程自动折叠
  thoughtAutoCollapse?: boolean;

  // 多模型对比显示样式
  multiModelDisplayStyle?: 'horizontal' | 'grid' | 'vertical';

  // 工具调用显示详情
  showToolDetails?: boolean;

  // 引用显示详情
  showCitationDetails?: boolean;

  // 消息气泡宽度设置
  messageBubbleMinWidth?: number; // 最小宽度百分比 (10-90)
  messageBubbleMaxWidth?: number; // 最大宽度百分比 (50-100)
  userMessageMaxWidth?: number;   // 用户消息最大宽度百分比 (50-100)

  // 工具栏折叠状态
  toolbarCollapsed?: boolean; // 工具栏是否折叠

  // 版本切换样式
  versionSwitchStyle?: 'popup' | 'arrows'; // 版本切换样式：弹出列表或箭头式切换

  // AI辩论功能设置
  showAIDebateButton?: boolean; // 是否在输入框显示AI辩论按钮

  // 快捷短语功能设置
  showQuickPhraseButton?: boolean; // 是否在输入框显示快捷短语按钮

  // 控制信息气泡上小功能气泡的显示
  showMicroBubbles?: boolean; // 是否显示消息气泡上的小功能气泡（播放和版本切换）

  // 消息操作显示模式
  messageActionMode?: 'bubbles' | 'toolbar'; // 消息操作显示模式：气泡模式或工具栏模式

  // 自定义气泡颜色设置
  customBubbleColors?: {
    userBubbleColor?: string; // 用户气泡背景色
    userTextColor?: string; // 用户气泡字体颜色
    aiBubbleColor?: string; // AI气泡背景色
    aiTextColor?: string; // AI气泡字体颜色
  };

  // 系统提示词变量注入设置
  systemPromptVariables?: {
    enableTimeVariable?: boolean;
    enableLocationVariable?: boolean;
    customLocation?: string;
    enableOSVariable?: boolean;
  };

  // 长文本粘贴为文件功能设置
  pasteLongTextAsFile?: boolean; // 是否启用长文本粘贴为文件
  pasteLongTextThreshold?: number; // 长文本阈值（字符数）

  // 工具栏样式设置
  toolbarStyle?: 'glassmorphism' | 'transparent'; // 工具栏样式：毛玻璃效果或透明效果

  // 工具栏按钮配置
  toolbarButtons?: {
    order: string[]; // 按钮显示顺序
    visibility: { [key: string]: boolean }; // 按钮可见性
  };

  // 聊天界面背景设置
  chatBackground?: {
    enabled: boolean; // 是否启用自定义背景
    imageUrl: string; // 背景图片URL
    opacity: number; // 背景透明度 (0-1)
    size: 'cover' | 'contain' | 'auto'; // 背景尺寸
    position: 'center' | 'top' | 'bottom' | 'left' | 'right'; // 背景位置
    repeat: 'no-repeat' | 'repeat' | 'repeat-x' | 'repeat-y'; // 背景重复
  };

  // Notion集成设置
  notion?: {
    enabled: boolean;
    apiKey: string;
    databaseId: string;
    pageTitleField: string;
    dateField?: string; // 可选的日期字段名
  };

  // 性能监控设置
  showPerformanceMonitor?: boolean; // 是否显示性能监控
}



// 初始化默认状态
const getInitialState = (): SettingsState => {
  const initialProviders = getDefaultModelProviders();

  // 默认状态
  const defaultState: SettingsState = {
    theme: 'system' as 'light' | 'dark' | 'system',
    themeStyle: 'default' as 'default' | 'claude' | 'minimal' | 'vibrant' | 'nature' | 'ocean' | 'sunset' | 'monochrome' | 'cyberpunk',
    fontSize: 16,
    fontFamily: 'system', // 默认使用系统字体
    language: 'zh-CN',
    sendWithEnter: true,
    enableNotifications: true,
    mobileInputMethodEnterAsNewline: false, // 默认移动端输入法Enter键仍然发送消息
    models: [],
    providers: initialProviders,
    enableTopicNaming: true, // 统一字段名称，与最佳实例保持一致
    topicNamingPrompt: '', // 添加默认空提示词
    modelSelectorStyle: 'dialog' as 'dialog' | 'dropdown',
    thinkingDisplayStyle: ThinkingDisplayStyle.COMPACT,
    toolbarDisplayStyle: 'both' as 'icon' | 'text' | 'both',
    inputBoxStyle: 'default' as 'default' | 'modern' | 'minimal', // 默认输入框风格
    inputLayoutStyle: 'integrated' as 'default' | 'compact' | 'integrated', // 输入框布局样式：默认（分离）、聚合或集成

    // 代码块默认设置
    codeStyle: 'auto',
    codeEditor: false, // 默认关闭编辑器
    codeShowLineNumbers: true, // 默认显示行号
    codeCollapsible: true, // 默认可折叠
    codeWrappable: true, // 默认可换行
    // 在默认设置中添加 mermaid 默认值
    codeDefaultCollapsed: false, // 默认展开代码块
    mermaidEnabled: true, // 默认启用 Mermaid 图表渲染
    showSystemPromptBubble: true, // 默认显示系统提示词气泡
    showUserAvatar: true, // 默认显示用户头像
    showUserName: true, // 默认显示用户名称
    showModelAvatar: true, // 默认显示模型头像
    showModelName: true, // 默认显示模型名称
    messageStyle: 'bubble' as 'plain' | 'bubble', // 默认使用气泡样式
    renderUserInputAsMarkdown: true, // 默认渲染用户输入的markdown
    // 默认开启自动滚动
    autoScrollToBottom: true,
    // 顶部工具栏默认设置
    topToolbar: {
      showSettingsButton: true, // 默认显示设置按钮
      showModelSelector: true, // 默认显示模型选择器
      modelSelectorStyle: 'dialog', // 默认弹窗式模型选择器
      modelSelectorDisplayStyle: 'icon', // 默认在DIY布局中显示图标
      showChatTitle: true, // 默认显示"对话"标题
      showTopicName: false, // 默认不显示话题名称
      showNewTopicButton: false, // 默认不显示新建话题按钮
      showClearButton: false, // 默认不显示清空按钮
      showMenuButton: true, // 默认显示菜单按钮
      // 默认组件顺序
      leftComponents: ['menuButton', 'chatTitle', 'topicName', 'newTopicButton', 'clearButton'],
      rightComponents: ['modelSelector', 'settingsButton'],
      // DIY布局组件位置信息
      componentPositions: [] as Array<{
        id: string;
        x: number;
        y: number;
        width?: number;
        height?: number;
      }>,
    },
    isLoading: true, // 初始时设为加载中状态

    // 消息气泡宽度默认设置
    messageBubbleMinWidth: 50, // 默认最小宽度50%
    messageBubbleMaxWidth: 100, // 默认AI消息最大宽度100%（铺满可用空间）
    userMessageMaxWidth: 80,   // 默认用户消息最大宽度80%

    // 工具栏默认设置
    toolbarCollapsed: false,    // 默认工具栏不折叠

    // 版本切换样式默认设置
    versionSwitchStyle: 'popup', // 默认使用弹出列表样式

    // AI辩论功能默认设置
    showAIDebateButton: true, // 默认显示AI辩论按钮

    // 快捷短语功能默认设置
    showQuickPhraseButton: true, // 默认显示快捷短语按钮

    // 小功能气泡默认设置
    showMicroBubbles: true, // 默认显示消息气泡上的小功能气泡

    // 消息操作显示模式默认设置
    messageActionMode: 'bubbles', // 默认使用气泡模式

    // 自定义气泡颜色默认设置
    customBubbleColors: {
      userBubbleColor: '', // 空字符串表示使用默认颜色
      userTextColor: '',
      aiBubbleColor: '',
      aiTextColor: ''
    },

    // 系统提示词变量注入默认设置
    systemPromptVariables: {
      enableTimeVariable: false,
      enableLocationVariable: false,
      customLocation: '',
      enableOSVariable: false
    },

    // 长文本粘贴为文件功能默认设置
    pasteLongTextAsFile: false, // 默认关闭长文本粘贴为文件
    pasteLongTextThreshold: 1500, // 默认阈值1500字符

    // 工具栏样式默认设置
    toolbarStyle: 'glassmorphism', // 默认使用毛玻璃效果

    // 工具栏按钮默认配置
    toolbarButtons: {
      order: ['mcp-tools', 'new-topic', 'clear-topic', 'generate-image', 'generate-video', 'knowledge', 'web-search'], // 默认按钮顺序
      visibility: {
        'mcp-tools': true,
        'new-topic': true,
        'clear-topic': true,
        'generate-image': true,
        'generate-video': true,
        'knowledge': true,
        'web-search': true
      }
    },

    // 聊天界面背景默认设置
    chatBackground: {
      enabled: false, // 默认不启用自定义背景
      imageUrl: '', // 默认无背景图片
      opacity: 0.3, // 默认透明度30%
      size: 'cover', // 默认覆盖整个区域
      position: 'center', // 默认居中
      repeat: 'no-repeat' // 默认不重复
    },

    // 性能监控默认设置
    showPerformanceMonitor: false, // 默认不显示性能监控
  };

  // 设置默认模型
  const defaultModelId = getDefaultModelId(initialProviders);
  return {
    ...defaultState,
    defaultModelId,
    currentModelId: defaultModelId
  };
};

// 创建异步加载设置的thunk
export const loadSettings = createAsyncThunk('settings/load', async () => {
  try {
    const savedSettings = await getStorageItem<SettingsState>('settings');
    if (savedSettings) {
      const initialProviders = getDefaultModelProviders();
      let providers = savedSettings.providers || initialProviders;

      // 确保模型组合供应商始终存在
      const hasModelComboProvider = providers.some((p: ModelProvider) => p.id === 'model-combo');
      if (!hasModelComboProvider) {
        // 如果没有模型组合供应商，添加到列表开头
        const modelComboProvider = initialProviders.find((p: ModelProvider) => p.id === 'model-combo');
        if (modelComboProvider) {
          providers = [modelComboProvider, ...providers];
        }
      }

      // 如果没有存储当前模型ID，使用默认模型ID
      if (!savedSettings.currentModelId) {
        savedSettings.currentModelId = savedSettings.defaultModelId || getDefaultModelId(providers);
      }

      // 如果没有思考过程显示样式设置，使用默认值
      if (!savedSettings.thinkingDisplayStyle) {
        savedSettings.thinkingDisplayStyle = ThinkingDisplayStyle.COMPACT;
      }

      // 如果没有工具栏显示样式设置，使用默认值
      if (!savedSettings.toolbarDisplayStyle) {
        savedSettings.toolbarDisplayStyle = 'both';
      }

      // 如果没有输入框风格设置，使用默认值
      if (!savedSettings.inputBoxStyle) {
        savedSettings.inputBoxStyle = 'default';
      }

      // 如果没有输入框布局样式设置，使用默认值
      if (!savedSettings.inputLayoutStyle) {
        savedSettings.inputLayoutStyle = 'default';
      }

      // 如果没有系统提示词气泡显示设置，使用默认值
      if (savedSettings.showSystemPromptBubble === undefined) {
        savedSettings.showSystemPromptBubble = true;
      }

      // 如果没有模型选择器样式设置，使用默认值
      if (!savedSettings.modelSelectorStyle) {
        savedSettings.modelSelectorStyle = 'dialog';
      }

      // 如果没有消息气泡宽度设置，使用默认值
      if (savedSettings.messageBubbleMinWidth === undefined) {
        savedSettings.messageBubbleMinWidth = 50;
      }
      if (savedSettings.messageBubbleMaxWidth === undefined) {
        savedSettings.messageBubbleMaxWidth = 100;
      }
      if (savedSettings.userMessageMaxWidth === undefined) {
        savedSettings.userMessageMaxWidth = 80;
      }

      // 如果没有工具栏折叠设置，使用默认值
      if (savedSettings.toolbarCollapsed === undefined) {
        savedSettings.toolbarCollapsed = false;
      }

      // 如果没有版本切换样式设置，使用默认值
      if (savedSettings.versionSwitchStyle === undefined) {
        savedSettings.versionSwitchStyle = 'popup';
      }

      // 如果没有消息样式设置，使用默认值
      if (!savedSettings.messageStyle) {
        savedSettings.messageStyle = 'bubble';
      }

      // 如果没有自动滚动设置，使用默认值
      if (savedSettings.autoScrollToBottom === undefined) {
        savedSettings.autoScrollToBottom = true;
      }

      // 如果没有AI辩论按钮显示设置，使用默认值
      if (savedSettings.showAIDebateButton === undefined) {
        savedSettings.showAIDebateButton = true;
      }

      // 如果没有快捷短语按钮显示设置，使用默认值
      if (savedSettings.showQuickPhraseButton === undefined) {
        savedSettings.showQuickPhraseButton = true;
      }

      // 如果没有代码块默认收起设置，使用默认值
      if (savedSettings.codeDefaultCollapsed === undefined) {
        savedSettings.codeDefaultCollapsed = false;
      }

      // 如果没有代码块主题设置，使用默认值
      if (!savedSettings.codeStyle) {
        savedSettings.codeStyle = 'auto';
      }

      // 如果没有小功能气泡显示设置，使用默认值
      if (savedSettings.showMicroBubbles === undefined) {
        savedSettings.showMicroBubbles = true;
      }

      // 如果没有系统提示词变量注入设置，使用默认值
      if (!savedSettings.systemPromptVariables) {
        savedSettings.systemPromptVariables = {
          enableTimeVariable: false,
          enableLocationVariable: false,
          customLocation: '',
          enableOSVariable: false
        };
      }

      // 如果没有字体家族设置，使用默认值
      if (!savedSettings.fontFamily) {
        savedSettings.fontFamily = 'system';
      }

      // 如果没有长文本粘贴为文件设置，使用默认值
      if (savedSettings.pasteLongTextAsFile === undefined) {
        savedSettings.pasteLongTextAsFile = false;
      }
      if (savedSettings.pasteLongTextThreshold === undefined) {
        savedSettings.pasteLongTextThreshold = 1500;
      }

      // 如果没有工具栏样式设置，使用默认值
      if (!savedSettings.toolbarStyle) {
        savedSettings.toolbarStyle = 'glassmorphism';
      }

      // 如果没有工具栏按钮配置，使用默认值
      if (!savedSettings.toolbarButtons) {
        savedSettings.toolbarButtons = {
          order: ['mcp-tools', 'new-topic', 'clear-topic', 'generate-image', 'generate-video', 'knowledge', 'web-search'],
          visibility: {
            'mcp-tools': true,
            'new-topic': true,
            'clear-topic': true,
            'generate-image': true,
            'generate-video': true,
            'knowledge': true,
            'web-search': true
          }
        };
      }

      // 如果没有性能监控显示设置，使用默认值
      if (savedSettings.showPerformanceMonitor === undefined) {
        savedSettings.showPerformanceMonitor = false;
      }

      return {
        ...savedSettings,
        providers,
        isLoading: false
      };
    }

    // 如果没有保存的设置，返回null让reducer使用默认值
    return null;
  } catch (e) {
    console.error('Failed to load settings from storage', e);
    return null;
  }
});

// 创建异步保存设置的thunk
export const saveSettings = createAsyncThunk('settings/save', async (state: SettingsState) => {
  try {
    await setStorageItem('settings', state);
    return true;
  } catch (e) {
    console.error('Failed to save settings to storage', e);
    return false;
  }
});

const initialState = getInitialState();

const settingsSlice = createSlice({
  name: 'settings',
  initialState,
  reducers: {
    setTheme: (state, action: PayloadAction<'light' | 'dark' | 'system'>) => {
      state.theme = action.payload;
      // 异步操作将通过 extraReducers 处理
    },
    setThemeStyle: (state, action: PayloadAction<'default' | 'claude' | 'minimal' | 'vibrant' | 'nature' | 'ocean' | 'sunset' | 'monochrome' | 'cyberpunk'>) => {
      state.themeStyle = action.payload;
    },
    setFontSize: (state, action: PayloadAction<number>) => {
      state.fontSize = action.payload;
    },
    setFontFamily: (state, action: PayloadAction<string>) => {
      state.fontFamily = action.payload;
    },
    setLanguage: (state, action: PayloadAction<string>) => {
      state.language = action.payload;
    },
    setSendWithEnter: (state, action: PayloadAction<boolean>) => {
      state.sendWithEnter = action.payload;
    },
    setEnableNotifications: (state, action: PayloadAction<boolean>) => {
      state.enableNotifications = action.payload;
    },
    setMobileInputMethodEnterAsNewline: (state, action: PayloadAction<boolean>) => {
      state.mobileInputMethodEnterAsNewline = action.payload;
    },
    addModel: (state, action: PayloadAction<Model>) => {
        state.models.push(action.payload);
    },
    updateModel: (state, action: PayloadAction<{ id: string; updates: Partial<Model> }>) => {
      const { id, updates } = action.payload;
      const modelIndex = state.models.findIndex(model => model.id === id);
      if (modelIndex !== -1) {
        state.models[modelIndex] = { ...state.models[modelIndex], ...updates };
      }
    },
    deleteModel: (state, action: PayloadAction<string>) => {
      const modelId = action.payload;

      // 从全局models数组中删除模型
      state.models = state.models.filter(model => model.id !== modelId);

      // 从所有provider的models数组中删除模型
      state.providers.forEach((provider: ModelProvider, index: number) => {
        state.providers[index].models = provider.models.filter((model: Model) => model.id !== modelId);
      });

      // 如果删除的是默认模型，需要重新设置默认模型
      if (state.defaultModelId === modelId) {
        // 尝试找到新的默认模型
        const firstAvailableModel = state.providers
          .flatMap((provider: ModelProvider) => provider.models)
          .find((model: Model) => model.enabled);

        if (firstAvailableModel) {
          state.defaultModelId = firstAvailableModel.id;
          firstAvailableModel.isDefault = true;
        } else {
          state.defaultModelId = undefined;
        }
      }

      // 如果删除的是当前选中的模型，需要重新设置当前模型
      if (state.currentModelId === modelId) {
        state.currentModelId = state.defaultModelId;
      }
    },
    setDefaultModel: (state, action: PayloadAction<string>) => {
        state.models.forEach(model => {
        model.isDefault = model.id === action.payload;
      });
      state.defaultModelId = action.payload;
    },
    setCurrentModel: (state, action: PayloadAction<string>) => {
      state.currentModelId = action.payload;
    },
    addProvider: (state, action: PayloadAction<ModelProvider>) => {
      state.providers.push(action.payload);
    },
    updateProvider: (state, action: PayloadAction<{ id: string; updates: Partial<ModelProvider> }>) => {
      const { id, updates } = action.payload;
      const providerIndex = state.providers.findIndex((provider: ModelProvider) => provider.id === id);
      if (providerIndex !== -1) {
        state.providers[providerIndex] = { ...state.providers[providerIndex], ...updates };

        // 如果apiKey、baseUrl、extraHeaders或apiKeys更新了，也要更新所有关联模型
        if (updates.apiKey !== undefined || updates.baseUrl !== undefined || updates.extraHeaders !== undefined || updates.apiKeys !== undefined) {
          state.providers[providerIndex].models = state.providers[providerIndex].models.map((model: Model) => ({
            ...model,
            apiKey: updates.apiKey !== undefined ? updates.apiKey : model.apiKey,
            baseUrl: updates.baseUrl !== undefined ? updates.baseUrl : model.baseUrl,
            providerExtraHeaders: updates.extraHeaders !== undefined ? updates.extraHeaders : (model as any).providerExtraHeaders
          }));
        }
      }
    },
    deleteProvider: (state, action: PayloadAction<string>) => {
      state.providers = state.providers.filter((provider: ModelProvider) => provider.id !== action.payload);
    },
    reorderProviders: (state, action: PayloadAction<ModelProvider[]>) => {
      state.providers = action.payload;
    },
    toggleProviderEnabled: (state, action: PayloadAction<{ id: string; enabled: boolean }>) => {
      const { id, enabled } = action.payload;
      const providerIndex = state.providers.findIndex((provider: ModelProvider) => provider.id === id);
      if (providerIndex !== -1) {
        state.providers[providerIndex].isEnabled = enabled;
      }
    },
    addModelToProvider: (state, action: PayloadAction<{ providerId: string; model: Model }>) => {
      const { providerId, model } = action.payload;
      const providerIndex = state.providers.findIndex((provider: ModelProvider) => provider.id === providerId);
      if (providerIndex !== -1) {
        const provider = state.providers[providerIndex];
        state.providers[providerIndex].models.push({
          ...model,
          provider: providerId,
          providerType: provider.providerType || providerId,
          apiKey: provider.apiKey,
          baseUrl: provider.baseUrl
        });
      }
    },
    setProviderDefaultModel: (state, action: PayloadAction<{ providerId: string; modelId: string }>) => {
      const { providerId, modelId } = action.payload;
      const providerIndex = state.providers.findIndex((provider: ModelProvider) => provider.id === providerId);
      if (providerIndex !== -1) {
        state.providers[providerIndex].models.forEach((model: Model) => {
          model.isDefault = model.id === modelId;
        });
      }
    },
    deleteModelFromProvider: (state, action: PayloadAction<{ providerId: string; modelId: string }>) => {
      const { providerId, modelId } = action.payload;
      const providerIndex = state.providers.findIndex((provider: ModelProvider) => provider.id === providerId);

      if (providerIndex !== -1) {
        // 从provider的models数组中删除模型
        state.providers[providerIndex].models = state.providers[providerIndex].models.filter(
          (model: Model) => model.id !== modelId
        );

        // 如果删除的是默认模型，需要重新设置默认模型
        if (state.defaultModelId === modelId) {
          // 尝试找到新的默认模型
          const firstAvailableModel = state.providers[providerIndex].models.find((model: Model) => model.enabled);

          if (firstAvailableModel) {
            state.defaultModelId = firstAvailableModel.id;
            firstAvailableModel.isDefault = true;
          } else {
            state.defaultModelId = undefined;
          }
        }

        // 如果删除的是当前选中的模型，需要重新设置当前模型
        if (state.currentModelId === modelId) {
          state.currentModelId = state.defaultModelId;
        }
      }
    },
    addGeneratedImage: (state, action: PayloadAction<GeneratedImage>) => {
      // 初始化generatedImages数组（如果不存在）
      if (!state.generatedImages) {
        state.generatedImages = [];
      }

      // 添加新生成的图像
      state.generatedImages.unshift(action.payload);

      // 限制保存的历史图像数量（保存最近的50张）
      if (state.generatedImages.length > 50) {
        state.generatedImages = state.generatedImages.slice(0, 50);
      }
    },
    deleteGeneratedImage: (state, action: PayloadAction<string>) => {
      // 如果generatedImages不存在，直接返回
      if (!state.generatedImages) {
        return;
      }

      // 根据图像URL删除
      state.generatedImages = state.generatedImages.filter(
        image => image.url !== action.payload
      );
    },
    clearGeneratedImages: (state) => {
      state.generatedImages = [];
    },
    updateSettings: (state, action: PayloadAction<Partial<SettingsState>>) => {
      Object.assign(state, action.payload);
    },
    setModelSelectorStyle: (state, action: PayloadAction<'dialog' | 'dropdown'>) => {
      state.modelSelectorStyle = action.payload;
    },

    // 更新模型组合供应商的模型列表
    updateModelComboModels: (state, action: PayloadAction<Model[]>) => {
      const comboProvider = state.providers.find((p: ModelProvider) => p.id === 'model-combo');
      if (comboProvider) {
        comboProvider.models = action.payload;
      }
    },
    // 话题命名相关的action creators
    setEnableTopicNaming: (state, action: PayloadAction<boolean>) => {
      state.enableTopicNaming = action.payload;
    },
    setTopicNamingPrompt: (state, action: PayloadAction<string>) => {
      state.topicNamingPrompt = action.payload;
    },
    setTopicNamingModelId: (state, action: PayloadAction<string>) => {
      state.topicNamingModelId = action.payload;
    },
    setMessageStyle: (state, action: PayloadAction<'plain' | 'bubble'>) => {
      state.messageStyle = action.payload;
    },
    setRenderUserInputAsMarkdown: (state, action: PayloadAction<boolean>) => {
      state.renderUserInputAsMarkdown = action.payload;
    },
    // 自动滚动控制
    setAutoScrollToBottom: (state, action: PayloadAction<boolean>) => {
      state.autoScrollToBottom = action.payload;
    },
    // AI辩论按钮显示控制
    setShowAIDebateButton: (state, action: PayloadAction<boolean>) => {
      state.showAIDebateButton = action.payload;
    },
    // 快捷短语按钮显示控制
    setShowQuickPhraseButton: (state, action: PayloadAction<boolean>) => {
      state.showQuickPhraseButton = action.payload;
    },

    // 代码块设置 actions
    setCodeStyle: (state, action: PayloadAction<string>) => {
      state.codeStyle = action.payload;
    },
    setCodeEditor: (state, action: PayloadAction<boolean>) => {
      state.codeEditor = action.payload;
    },
    setCodeShowLineNumbers: (state, action: PayloadAction<boolean>) => {
      state.codeShowLineNumbers = action.payload;
    },
    setCodeCollapsible: (state, action: PayloadAction<boolean>) => {
      state.codeCollapsible = action.payload;
    },
    setCodeWrappable: (state, action: PayloadAction<boolean>) => {
      state.codeWrappable = action.payload;
    },
    setCodeDefaultCollapsed: (state, action: PayloadAction<boolean>) => {
      state.codeDefaultCollapsed = action.payload;
    },
    setMermaidEnabled: (state, action: PayloadAction<boolean>) => {
      state.mermaidEnabled = action.payload;
    },

    // 长文本粘贴为文件功能设置 actions
    setPasteLongTextAsFile: (state, action: PayloadAction<boolean>) => {
      state.pasteLongTextAsFile = action.payload;
    },
    setPasteLongTextThreshold: (state, action: PayloadAction<number>) => {
      state.pasteLongTextThreshold = action.payload;
    },

    // 工具栏样式设置 actions
    setToolbarStyle: (state, action: PayloadAction<'glassmorphism' | 'transparent'>) => {
      state.toolbarStyle = action.payload;
    },

    // 工具栏按钮配置 actions
    setToolbarButtonOrder: (state, action: PayloadAction<string[]>) => {
      if (!state.toolbarButtons) {
        state.toolbarButtons = {
          order: action.payload,
          visibility: {}
        };
      } else {
        state.toolbarButtons.order = action.payload;
      }
    },
    setToolbarButtonVisibility: (state, action: PayloadAction<{ buttonId: string; visible: boolean }>) => {
      const { buttonId, visible } = action.payload;
      if (!state.toolbarButtons) {
        state.toolbarButtons = {
          order: [],
          visibility: { [buttonId]: visible }
        };
      } else {
        state.toolbarButtons.visibility[buttonId] = visible;
      }
    },
    updateToolbarButtons: (state, action: PayloadAction<{ order: string[]; visibility: { [key: string]: boolean } }>) => {
      state.toolbarButtons = action.payload;
    },

    // 性能监控显示控制
    setShowPerformanceMonitor: (state, action: PayloadAction<boolean>) => {
      state.showPerformanceMonitor = action.payload;
    },
  },
  extraReducers: (builder) => {
    // 处理加载设置
    builder
      .addCase(loadSettings.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(loadSettings.fulfilled, (state, action) => {
        if (action.payload) {
          // 合并加载的设置与当前状态
          return {
            ...action.payload,
            isLoading: false
          };
        }
        state.isLoading = false;
      })
      .addCase(loadSettings.rejected, (state) => {
        state.isLoading = false;
      })
      // 统一的响应保存设置操作的处理
      .addCase(saveSettings.pending, () => {
        // 可以在这里设置保存中的状态标记，如果需要的话
      })
      .addCase(saveSettings.fulfilled, () => {
        // 保存完成后的处理，如果需要的话
      })
      .addCase(saveSettings.rejected, () => {
        // 保存失败的处理，如果需要的话
      });
  }
});

// 导出操作
export const {
  setTheme,
  setThemeStyle,
  setFontSize,
  setFontFamily,
  setLanguage,
  setSendWithEnter,
  setEnableNotifications,
  setMobileInputMethodEnterAsNewline,
  addModel,
  updateModel,
  deleteModel,
  setDefaultModel,
  setCurrentModel,
  addProvider,
  updateProvider,
  deleteProvider,
  reorderProviders,
  toggleProviderEnabled,
  addModelToProvider,
  setProviderDefaultModel,
  deleteModelFromProvider,
  addGeneratedImage,
  deleteGeneratedImage,
  clearGeneratedImages,
  updateSettings,
  setModelSelectorStyle,
  updateModelComboModels,
  // 话题命名相关的actions
  setEnableTopicNaming,
  setTopicNamingPrompt,
  setTopicNamingModelId,
  // 消息样式相关的actions
  setMessageStyle,
  setRenderUserInputAsMarkdown,
  // 自动滚动控制
  setAutoScrollToBottom,
  // AI辩论按钮显示控制
  setShowAIDebateButton,
  // 快捷短语按钮显示控制
  setShowQuickPhraseButton,
  // 代码块设置控制
  setCodeStyle,
  setCodeEditor,
  setCodeShowLineNumbers,
  setCodeCollapsible,
  setCodeWrappable,
  setCodeDefaultCollapsed,
  setMermaidEnabled,
  // 长文本粘贴为文件功能控制
  setPasteLongTextAsFile,
  setPasteLongTextThreshold,
  // 工具栏样式控制
  setToolbarStyle,
  // 工具栏按钮配置控制
  setToolbarButtonOrder,
  setToolbarButtonVisibility,
  updateToolbarButtons,
  // 性能监控控制
  setShowPerformanceMonitor,
} = settingsSlice.actions;

// 重用现有的action creators，但添加异步保存
export const saveSettingsToStorage = (state: RootState) => (
  async (dispatch: any) => {
    try {
      // 触发异步保存
      await dispatch(saveSettings(state.settings));
    } catch (error) {
      console.error('保存设置时出错:', error);
    }
  }
);

// 中间件，用于在每次状态更改后保存
export const settingsMiddleware = (store: any) => (next: any) => (action: any) => {
  // 首先让reducer处理action
  const result = next(action);

  // 如果是设置相关的action，自动保存状态
  if (action.type.startsWith('settings/') &&
      !action.type.includes('load') &&
      !action.type.includes('save')) {
    store.dispatch(saveSettings(store.getState().settings));
  }

  return result;
};

export default settingsSlice.reducer;

// 用于TypeScript的RootState类型提示
interface RootState {
  settings: SettingsState;
}
