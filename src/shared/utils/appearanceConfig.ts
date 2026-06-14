import type { ThemeStyle } from '../config/themes';
import { createLogger } from '../services/infra/logger';
const logger = createLogger('AppearanceConfig');

/**
 * 外观配置接口
 * 包含所有可分享的外观设置
 */
export interface AppearanceConfig {
  // 基础设置
  theme: 'light' | 'dark' | 'system';
  themeStyle: ThemeStyle;
  fontSize: number;
  fontFamily: string;
  
  // 界面显示设置
  messageStyle: 'plain' | 'bubble';
  showUserAvatar: boolean;
  showUserName: boolean;
  showModelAvatar: boolean;
  showModelName: boolean;
  showSystemPromptBubble: boolean;
  renderUserInputAsMarkdown: boolean;
  autoScrollToBottom: boolean;
  
  // 消息气泡设置
  messageBubbleMinWidth?: number;
  messageBubbleMaxWidth?: number;
  userMessageMaxWidth?: number;
  customBubbleColors?: {
    userBubbleColor?: string;
    userTextColor?: string;
    aiBubbleColor?: string;
    aiTextColor?: string;
  };
  hideUserBubble?: boolean;
  hideAIBubble?: boolean;
  
  // 代码块设置
  codeThemeLight: string;
  codeThemeDark: string;
  codeEditor: boolean;
  codeShowLineNumbers: boolean;
  codeCollapsible: boolean;
  codeWrappable: boolean;
  codeDefaultCollapsed: boolean;
  mermaidEnabled: boolean;
  
  // 思考过程设置
  thinkingDisplayStyle: string;
  thoughtAutoCollapse?: boolean;
  
  // 工具栏设置
  toolbarDisplayStyle: 'icon' | 'text' | 'both';
  toolbarCollapsed?: boolean;
  toolbarStyle?: 'glassmorphism' | 'transparent';
  toolbarButtons?: {
    order: string[];
    visibility: { [key: string]: boolean };
  };
  
  // 输入框设置
  inputBoxStyle: 'default' | 'modern' | 'minimal';
  inputLayoutStyle: 'integrated';
  
  // 顶部工具栏设置
  topToolbar: {
    showSettingsButton: boolean;
    showModelSelector: boolean;
    modelSelectorStyle: 'dialog' | 'dropdown';
    modelSelectorDisplayStyle?: 'icon' | 'text';
    showTopicName: boolean;
    showNewTopicButton: boolean;
    showClearButton: boolean;
    showMenuButton: boolean;
    leftComponents: string[];
    rightComponents: string[];
  };
  
  // 其他显示设置
  modelSelectorStyle: 'dialog' | 'dropdown';
  versionSwitchStyle?: 'popup' | 'arrows';
  showMicroBubbles?: boolean;
  messageActionMode?: 'bubbles' | 'toolbar';
  multiModelDisplayStyle?: 'horizontal' | 'grid' | 'vertical';
  showToolDetails?: boolean;
  showCitationDetails?: boolean;
  showAIDebateButton?: boolean;
  showQuickPhraseButton?: boolean;
  
  // 聊天背景设置
  chatBackground?: {
    enabled: boolean;
    imageUrl: string;
    opacity: number;
    size: 'cover' | 'contain' | 'auto';
    position: 'center' | 'top' | 'bottom' | 'left' | 'right';
    repeat: 'no-repeat' | 'repeat' | 'repeat-x' | 'repeat-y';
  };
}

/**
 * 从 Redux state 提取外观配置
 */
export function extractAppearanceConfig(settings: any): AppearanceConfig {
  return {
    // 基础设置
    theme: settings.theme,
    themeStyle: settings.themeStyle,
    fontSize: settings.fontSize,
    fontFamily: settings.fontFamily,
    
    // 界面显示设置
    messageStyle: settings.messageStyle,
    showUserAvatar: settings.showUserAvatar,
    showUserName: settings.showUserName,
    showModelAvatar: settings.showModelAvatar,
    showModelName: settings.showModelName,
    showSystemPromptBubble: settings.showSystemPromptBubble,
    renderUserInputAsMarkdown: settings.renderUserInputAsMarkdown,
    autoScrollToBottom: settings.autoScrollToBottom,
    
    // 消息气泡设置
    messageBubbleMinWidth: settings.messageBubbleMinWidth,
    messageBubbleMaxWidth: settings.messageBubbleMaxWidth,
    userMessageMaxWidth: settings.userMessageMaxWidth,
    customBubbleColors: settings.customBubbleColors,
    hideUserBubble: settings.hideUserBubble,
    hideAIBubble: settings.hideAIBubble,
    
    // 代码块设置
    codeThemeLight: settings.codeThemeLight,
    codeThemeDark: settings.codeThemeDark,
    codeEditor: settings.codeEditor,
    codeShowLineNumbers: settings.codeShowLineNumbers,
    codeCollapsible: settings.codeCollapsible,
    codeWrappable: settings.codeWrappable,
    codeDefaultCollapsed: settings.codeDefaultCollapsed,
    mermaidEnabled: settings.mermaidEnabled,
    
    // 思考过程设置
    thinkingDisplayStyle: settings.thinkingDisplayStyle,
    thoughtAutoCollapse: settings.thoughtAutoCollapse,
    
    // 工具栏设置
    toolbarDisplayStyle: settings.toolbarDisplayStyle,
    toolbarCollapsed: settings.toolbarCollapsed,
    toolbarStyle: settings.toolbarStyle,
    toolbarButtons: settings.toolbarButtons,
    
    // 输入框设置
    inputBoxStyle: settings.inputBoxStyle,
    inputLayoutStyle: settings.inputLayoutStyle,
    
    // 顶部工具栏设置
    topToolbar: settings.topToolbar,
    
    // 其他显示设置
    modelSelectorStyle: settings.modelSelectorStyle,
    versionSwitchStyle: settings.versionSwitchStyle,
    showMicroBubbles: settings.showMicroBubbles,
    messageActionMode: settings.messageActionMode,
    multiModelDisplayStyle: settings.multiModelDisplayStyle,
    showToolDetails: settings.showToolDetails,
    showCitationDetails: settings.showCitationDetails,
    showAIDebateButton: settings.showAIDebateButton,
    showQuickPhraseButton: settings.showQuickPhraseButton,
    
    // 聊天背景设置
    chatBackground: settings.chatBackground,
  };
}

/**
 * 将外观配置编码为 Base64 字符串
 */
export function encodeAppearanceConfig(config: AppearanceConfig): string {
  try {
    const json = JSON.stringify(config);
    return btoa(encodeURIComponent(json));
  } catch (error) {
    logger.error('编码外观配置失败:', error);
    throw new Error('编码外观配置失败');
  }
}

/**
 * 从 Base64 字符串解码外观配置
 */
export function decodeAppearanceConfig(encoded: string): AppearanceConfig {
  try {
    const json = decodeURIComponent(atob(encoded));
    return JSON.parse(json);
  } catch (error) {
    logger.error('解码外观配置失败:', error);
    throw new Error('解码外观配置失败，请检查分享码是否正确');
  }
}

/**
 * 生成分享链接
 */
export function generateShareLink(config: AppearanceConfig): string {
  const encoded = encodeAppearanceConfig(config);
  const baseUrl = window.location.origin;
  return `${baseUrl}/#/settings/appearance?share=${encoded}`;
}

/**
 * 从 URL 参数中提取分享配置
 */
export function extractShareConfigFromUrl(): AppearanceConfig | null {
  try {
    const hash = window.location.hash;
    const params = new URLSearchParams(hash.split('?')[1]);
    const shareCode = params.get('share');
    
    if (shareCode) {
      return decodeAppearanceConfig(shareCode);
    }
    return null;
  } catch (error) {
    logger.error('从 URL 提取分享配置失败:', error);
    return null;
  }
}

/**
 * 验证外观配置的有效性
 */
export function validateAppearanceConfig(config: any): boolean {
  try {
    // 检查必需的字段
    if (!config.theme || !config.themeStyle || !config.fontSize) {
      return false;
    }
    
    // 检查主题值是否有效
    if (!['light', 'dark', 'system'].includes(config.theme)) {
      return false;
    }
    
    // 检查字体大小是否在合理范围内
    if (config.fontSize < 12 || config.fontSize > 24) {
      return false;
    }
    
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * 导出外观配置为 JSON 文件（浏览器下载）
 */
export function exportAppearanceConfigToFile(config: AppearanceConfig, filename: string = 'appearance-config.json'): void {
  try {
    const json = JSON.stringify(config, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (error) {
    logger.error('导出外观配置失败:', error);
    throw new Error('导出外观配置失败');
  }
}

/**
 * 导出外观配置到用户选择的文件夹（使用文件系统 API）
 */
export async function exportAppearanceConfigToFolder(config: AppearanceConfig, filename: string = 'appearance-config.json'): Promise<string> {
  try {
    const { unifiedFileManager } = await import('../services/files/UnifiedFileManagerService');
    
    // 选择保存位置
    const result = await unifiedFileManager.openSystemFilePicker({
      type: 'directory',
      multiple: false,
      title: '选择保存位置'
    });

    if (result.cancelled || !result.directories || result.directories.length === 0) {
      throw new Error('用户取消选择');
    }

    const selectedDir = result.directories[0];
    const dirPath = selectedDir.displayPath || selectedDir.path || selectedDir.uri;

    if (!dirPath) {
      throw new Error('无法获取有效的目录路径');
    }

    // 写入文件
    const json = JSON.stringify(config, null, 2);
    const fullPath = `${dirPath}/${filename}`;
    
    await unifiedFileManager.writeFile({
      path: fullPath,
      content: json,
      encoding: 'utf8',
      append: false
    });
    
    return fullPath;
  } catch (error) {
    logger.error('导出外观配置失败:', error);
    throw error;
  }
}

/**
 * 从 JSON 文件导入外观配置
 */
export function importAppearanceConfigFromFile(file: File): Promise<AppearanceConfig> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const json = e.target?.result as string;
        const config = JSON.parse(json);
        
        if (!validateAppearanceConfig(config)) {
          reject(new Error('无效的外观配置文件'));
          return;
        }
        
        resolve(config);
      } catch (error) {
        reject(new Error('解析外观配置文件失败'));
      }
    };
    
    reader.onerror = () => {
      reject(new Error('读取文件失败'));
    };
    
    reader.readAsText(file);
  });
}
