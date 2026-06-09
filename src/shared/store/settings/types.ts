import type { Model } from '../../types';
import type { GeneratedImage } from '../../types';
import type { ModelProvider } from '../../config/defaultModels';
import type { ThemeStyle } from '../../config/themes';

export interface SettingsState {
  theme: 'light' | 'dark' | 'system';
  themeStyle: ThemeStyle; // 主题风格
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
  topicNamingUseCurrentModel?: boolean; // 使用当前话题模型进行命名
  topicNamingPrompt: string; // 添加自定义提示词配置
  modelSelectorStyle: 'dialog' | 'dropdown';
  
  // 🚀 AI 意图分析设置（用于网络搜索手动模式）
  enableAIIntentAnalysis?: boolean; // 是否启用 AI 意图分析
  aiIntentAnalysisUseCurrentModel?: boolean; // 是否使用当前话题模型进行意图分析
  aiIntentAnalysisModelId?: string; // 指定的意图分析模型 ID
  thinkingDisplayStyle: string;
  toolbarDisplayStyle: 'icon' | 'text' | 'both'; // 工具栏显示样式：仅图标、仅文字、图标+文字
  inputBoxStyle: 'default' | 'modern' | 'minimal'; // 输入框风格：默认、现代、简约
  inputLayoutStyle: 'integrated'; // 输入框布局样式：仅保留集成模式

  // 代码块设置
  codeThemeLight: string; // 浅色模式代码主题
  codeThemeDark: string; // 深色模式代码主题
  editorTheme: string; // 编辑器主题（CodeMirror专用）
  editorZoomLevel: number; // 编辑器缩放级别
  codeEditor: boolean; // 代码编辑器开关
  codeShowLineNumbers: boolean; // 显示行号
  codeCollapsible: boolean; // 代码可折叠
  codeWrappable: boolean; // 代码可换行
  // 在代码块设置接口中添加 mermaid 开关
  codeDefaultCollapsed: boolean; // 代码块默认收起
  mermaidEnabled: boolean; // 是否启用 Mermaid 图表渲染
  useNewCodeBlockView: boolean; // 是否使用新版代码块视图
  showSystemPromptBubble: boolean; // 是否显示系统提示词气泡
  showUserAvatar: boolean; // 是否显示用户头像
  showUserName: boolean; // 是否显示用户名称
  showModelAvatar: boolean; // 是否显示模型头像
  showModelName: boolean; // 是否显示模型名称
  messageStyle: 'plain' | 'bubble'; // 消息样式：简洁或气泡
  renderUserInputAsMarkdown: boolean; // 是否渲染用户输入的markdown
  // 聊天界面自动滚动控制
  autoScrollToBottom: boolean; // 是否自动滚动到底部
  // 实验特性：消息列表带回收的虚拟化渲染（默认关闭，灰度验证用）
  experimentalVirtualizedList?: boolean;
  // 顶部工具栏设置
  topToolbar: {
    showSettingsButton: boolean; // 是否显示设置按钮
    showModelSelector: boolean; // 是否显示模型选择器
    modelSelectorStyle: 'dialog' | 'dropdown'; // 模型选择器样式：弹窗式或下拉式
    modelSelectorDisplayStyle?: 'icon' | 'text'; // 模型选择器在DIY布局中的显示样式：图标或文字
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

  // 思考过程内显示工具调用（将思考阶段发起的工具调用以简化样式内嵌进思考块）
  thinkingToolInline?: boolean;

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

  // 控制AI气泡播放按钮的显示
  showTTSButton?: boolean; // 是否显示AI气泡的TTS播放按钮

  // 消息操作显示模式
  messageActionMode?: 'bubbles' | 'toolbar'; // 消息操作显示模式：气泡模式或工具栏模式

  // 自定义气泡颜色设置
  customBubbleColors?: {
    userBubbleColor?: string; // 用户气泡背景色
    userTextColor?: string; // 用户气泡字体颜色
    aiBubbleColor?: string; // AI气泡背景色
    aiTextColor?: string; // AI气泡字体颜色
  };

  // 隐藏气泡设置（只隐藏气泡背景，保留内容）
  hideUserBubble?: boolean; // 是否隐藏用户气泡背景
  hideAIBubble?: boolean; // 是否隐藏AI气泡背景

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
    showOverlay?: boolean; // 是否显示渐变遮罩
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
  
  // 开发者工具悬浮窗设置
  showDevToolsFloatingButton?: boolean; // 是否显示开发者工具悬浮窗

  // 模型测试按钮设置
  alwaysShowModelTestButton?: boolean; // 是否长期显示模型测试按钮
  
  // 触觉反馈设置
  hapticFeedback?: {
    enabled: boolean; // 全局触觉反馈总开关
    enableOnSidebar: boolean; // 侧边栏打开/关闭时的触觉反馈
    enableOnSwitch: boolean; // 开关切换时的触觉反馈
    enableOnListItem: boolean; // 列表项点击时的触觉反馈
    enableOnNavigation: boolean; // 上下导航按钮的触觉反馈
  };

  // 上下文压缩设置
  contextCondense?: {
    enabled: boolean; // 是否启用自动压缩
    threshold: number; // 触发阈值百分比 (5-100)
    modelId?: string; // 用于压缩的模型ID（可选，使用更便宜的模型）
    customPrompt?: string; // 自定义压缩提示词
    useCurrentTopicModel?: boolean; // 是否使用当前话题的模型（优先于 modelId）
  };

  // 侧边栏当前选中的 tab 索引（0=助手, 1=话题, 2=设置）
  sidebarTabIndex?: number;

  // 消息分组方式
  messageGrouping?: 'byDate' | 'disabled' | 'none';

  // 集成输入框左右侧按钮布局配置
  integratedInputLeftButtons?: string[];
  integratedInputRightButtons?: string[];

  // 功能侧边栏开关
  ENABLE_WORKSPACE_SIDEBAR?: boolean;
  ENABLE_NOTE_SIDEBAR?: boolean;

  // 滚动时显示导航按钮
  showNavigationOnScroll?: boolean;
}
