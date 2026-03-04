import { ThinkingDisplayStyle } from '../../../components/message/blocks/ThinkingBlock';
import { getDefaultModelProviders, getDefaultModelId } from '../../config/defaultModels';
import { setDefaultFlags } from './helpers';
import type { SettingsState } from './types';

// 嵌套对象默认值常量（消除 reducers 和 getInitialState 中的重复）
export const DEFAULT_HAPTIC_FEEDBACK: NonNullable<SettingsState['hapticFeedback']> = {
  enabled: true,
  enableOnSidebar: true,
  enableOnSwitch: true,
  enableOnListItem: false,
  enableOnNavigation: true,
};

export const DEFAULT_CONTEXT_CONDENSE: NonNullable<SettingsState['contextCondense']> = {
  enabled: false,
  threshold: 80,
  modelId: undefined,
  customPrompt: undefined,
  useCurrentTopicModel: true,
};

export const DEFAULT_TOOLBAR_BUTTONS: NonNullable<SettingsState['toolbarButtons']> = {
  order: ['mcp-tools', 'new-topic', 'clear-topic', 'generate-image', 'generate-video', 'knowledge', 'web-search'],
  visibility: {
    'mcp-tools': true,
    'new-topic': true,
    'clear-topic': true,
    'generate-image': true,
    'generate-video': true,
    'knowledge': true,
    'web-search': true,
  },
};

// 初始化默认状态
export const getInitialState = (): SettingsState => {
  const initialProviders = getDefaultModelProviders();

  // 默认状态
  const defaultState: SettingsState = {
    theme: 'system' as 'light' | 'dark' | 'system',
    themeStyle: 'default' as 'default' | 'claude' | 'nature' | 'tech' | 'soft' | 'ocean' | 'sunset',
    fontSize: 16,
    fontFamily: 'system', // 默认使用系统字体
    language: 'zh-CN',
    sendWithEnter: true,
    enableNotifications: true,
    mobileInputMethodEnterAsNewline: false, // 默认移动端输入法Enter键仍然发送消息
    models: [],
    providers: initialProviders,
    enableTopicNaming: true, // 统一字段名称，与最佳实例保持一致
    topicNamingUseCurrentModel: true, // 默认使用当前话题模型
    topicNamingPrompt: '', // 添加默认空提示词
    modelSelectorStyle: 'dialog' as 'dialog' | 'dropdown',
    
    // 🚀 AI 意图分析设置
    enableAIIntentAnalysis: false, // 默认关闭，直接注入搜索工具让 LLM 自行决定
    aiIntentAnalysisUseCurrentModel: true, // 默认使用当前话题模型
    aiIntentAnalysisModelId: undefined as string | undefined,
    thinkingDisplayStyle: ThinkingDisplayStyle.COMPACT,
    toolbarDisplayStyle: 'both' as 'icon' | 'text' | 'both',
    inputBoxStyle: 'default' as 'default' | 'modern' | 'minimal', // 默认输入框风格
    inputLayoutStyle: 'integrated' as const, // 输入框布局样式：仅保留集成模式

    // 代码块默认设置
    codeThemeLight: 'one-light', // 默认浅色主题
    codeThemeDark: 'material-theme-darker', // 默认深色主题
    editorTheme: 'oneDark', // 默认编辑器主题
    editorZoomLevel: 1.0, // 默认缩放级别 (100%)
    codeEditor: false, // 默认关闭编辑器
    codeShowLineNumbers: true, // 默认显示行号
    codeCollapsible: true, // 默认可折叠
    codeWrappable: true, // 默认开启换行
    // 在默认设置中添加 mermaid 默认值
    codeDefaultCollapsed: false, // 默认展开代码块
    mermaidEnabled: true, // 默认启用 Mermaid 图表渲染
    useNewCodeBlockView: true, // 默认使用新版代码块视图
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
      showTopicName: true, // 默认显示话题名称
      showNewTopicButton: false, // 默认不显示新建话题按钮
      showClearButton: false, // 默认不显示清空按钮
      showMenuButton: true, // 默认显示菜单按钮
      // 默认组件顺序
      leftComponents: ['menuButton', 'topicName', 'newTopicButton', 'clearButton'],
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
    isLoading: false, // redux-persist 自动恢复状态，无需加载中标记

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

    // TTS播放按钮默认设置
    showTTSButton: true, // 默认显示TTS播放按钮

    // 消息操作显示模式默认设置
    messageActionMode: 'bubbles', // 默认使用气泡模式

    // 自定义气泡颜色默认设置
    customBubbleColors: {
      userBubbleColor: '', // 空字符串表示使用默认颜色
      userTextColor: '',
      aiBubbleColor: '',
      aiTextColor: ''
    },

    // 隐藏气泡默认设置
    hideUserBubble: false, // 默认显示用户气泡
    hideAIBubble: true, // 默认隐藏AI气泡

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
    toolbarButtons: { ...DEFAULT_TOOLBAR_BUTTONS },

    // 聊天界面背景默认设置
    chatBackground: {
      enabled: false, // 默认不启用自定义背景
      imageUrl: '', // 默认无背景图片
      opacity: 0.7, // 默认透明度70% - 直接控制背景图不透明度
      size: 'cover', // 默认覆盖整个区域
      position: 'center', // 默认居中
      repeat: 'no-repeat', // 默认不重复
      showOverlay: true, // 默认显示渐变遮罩
    },

    // 性能监控默认设置
    showPerformanceMonitor: false, // 默认不显示性能监控
    
    // 开发者工具悬浮窗默认设置
    showDevToolsFloatingButton: false, // 默认不显示开发者工具悬浮窗

    // 模型测试按钮默认设置
    alwaysShowModelTestButton: false, // 默认不长期显示模型测试按钮
    
    // 触觉反馈默认设置
    hapticFeedback: { ...DEFAULT_HAPTIC_FEEDBACK },

    // 上下文压缩默认设置
    contextCondense: { ...DEFAULT_CONTEXT_CONDENSE },

    // 侧边栏 tab 默认设置
    sidebarTabIndex: 0, // 默认为助手 tab

    // 消息分组默认设置
    messageGrouping: 'byDate' // 默认按日期分组
  };

  // 设置默认模型
  const defaultModelId = getDefaultModelId(initialProviders);
  setDefaultFlags(defaultState.providers, defaultModelId);
  return {
    ...defaultState,
    defaultModelId,
    currentModelId: defaultModelId
  };
};
