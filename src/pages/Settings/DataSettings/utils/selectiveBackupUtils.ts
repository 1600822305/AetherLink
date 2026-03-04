import store from '../../../../shared/store';
import { createAndShareBackupFile, prepareBasicBackupData } from './backupUtils';
import type { ChatTopic } from '../../../../shared/types';
import type { Assistant } from '../../../../shared/types/Assistant';

/**
 * 选择性备份选项接口
 */
export interface SelectiveBackupOptions {
  modelConfig: boolean;    // 模型配置备份
  chatHistory: boolean;    // 聊天记录备份
  assistants: boolean;     // 助手配置备份
  userSettings: boolean;   // 用户设置备份
}

/**
 * 模型配置数据接口
 */
interface ModelConfigData {
  providers?: any[];
  models?: any[];
  defaultModelId?: string;
  currentModelId?: string;
  webSearch?: any;
  [key: string]: any;
}

/**
 * 准备模型配置备份数据
 */
async function prepareModelConfigData(): Promise<ModelConfigData> {
  try {
    // 从 Redux store 获取当前设置数据
    const settings = store.getState().settings as any;
    
    if (!settings) {
      console.warn('未找到设置数据');
      return {};
    }

    // 提取模型相关配置
    const modelConfigData: ModelConfigData = {
      providers: settings.providers || [],
      models: settings.models || [],
      defaultModelId: settings.defaultModelId,
      currentModelId: settings.currentModelId,
      webSearch: settings.webSearch,
    };

    // 添加其他模型相关设置
    if (settings.modelTypeRules) {
      modelConfigData.modelTypeRules = settings.modelTypeRules;
    }

    console.log('模型配置数据准备完成:', {
      providersCount: modelConfigData.providers?.length || 0,
      modelsCount: modelConfigData.models?.length || 0,
      hasDefaultModel: !!modelConfigData.defaultModelId,
      hasWebSearch: !!modelConfigData.webSearch
    });

    return modelConfigData;
  } catch (error) {
    console.error('准备模型配置数据失败:', error);
    throw new Error('获取模型配置失败: ' + (error instanceof Error ? error.message : '未知错误'));
  }
}

/**
 * 准备聊天记录备份数据
 */
async function prepareChatHistoryData(): Promise<ChatTopic[]> {
  try {
    const basicData = await prepareBasicBackupData();
    console.log('聊天记录数据准备完成:', {
      topicsCount: basicData.topics?.length || 0
    });
    return basicData.topics || [];
  } catch (error) {
    console.error('准备聊天记录数据失败:', error);
    throw new Error('获取聊天记录失败: ' + (error instanceof Error ? error.message : '未知错误'));
  }
}

/**
 * 准备助手配置备份数据
 */
async function prepareAssistantsData(): Promise<Assistant[]> {
  try {
    const basicData = await prepareBasicBackupData();
    console.log('助手配置数据准备完成:', {
      assistantsCount: basicData.assistants?.length || 0
    });
    return basicData.assistants || [];
  } catch (error) {
    console.error('准备助手配置数据失败:', error);
    throw new Error('获取助手配置失败: ' + (error instanceof Error ? error.message : '未知错误'));
  }
}

/**
 * 准备用户设置备份数据
 */
async function prepareUserSettingsData(): Promise<any> {
  try {
    const settings = store.getState().settings as any;
    
    if (!settings) {
      console.warn('未找到用户设置数据');
      return {};
    }

    // 提取用户设置相关配置（排除模型配置，因为模型配置是单独选项）
    const userSettingsData: any = {
      theme: settings.theme,
      language: settings.language,
      fontSize: settings.fontSize,
      sendWithEnter: settings.sendWithEnter,
      enableNotifications: settings.enableNotifications,
      showMessageDivider: settings.showMessageDivider,
      messageStyle: settings.messageStyle,
      topicPosition: settings.topicPosition,
      showInputEstimatedTokens: settings.showInputEstimatedTokens,
      showAssistantAvatar: settings.showAssistantAvatar,
      showUserAvatar: settings.showUserAvatar,
      pasteLongTextAsFile: settings.pasteLongTextAsFile,
      pasteLongTextThreshold: settings.pasteLongTextThreshold,
      clickAssistantToShowTopic: settings.clickAssistantToShowTopic,
      renderInputMessageAsMarkdown: settings.renderInputMessageAsMarkdown,
      codeShowLineNumbers: settings.codeShowLineNumbers,
      codeCollapsible: settings.codeCollapsible,
      codeCollapsibleDefaultOpen: settings.codeCollapsibleDefaultOpen,
      codeWrapping: settings.codeWrapping,
      mathEngine: settings.mathEngine,
      proxyUrl: settings.proxyUrl,
      // 音效设置
      soundEnabled: settings.soundEnabled,
      soundVolume: settings.soundVolume,
      // 生成的图片
      generatedImages: settings.generatedImages,
    };

    // 移除 undefined 值
    Object.keys(userSettingsData).forEach(key => {
      if (userSettingsData[key] === undefined) {
        delete userSettingsData[key];
      }
    });

    console.log('用户设置数据准备完成:', {
      settingsCount: Object.keys(userSettingsData).length
    });

    return userSettingsData;
  } catch (error) {
    console.error('准备用户设置数据失败:', error);
    throw new Error('获取用户设置失败: ' + (error instanceof Error ? error.message : '未知错误'));
  }
}

/**
 * 准备选择性备份数据
 */
export async function prepareSelectiveBackupData(options: SelectiveBackupOptions): Promise<any> {
  const backupData: any = {
    timestamp: Date.now(),
    appInfo: {
      version: '1.0.0',
      name: 'AetherLink',
      backupVersion: 5,
      backupType: 'selective',
      selectiveOptions: { ...options },
      backupDate: new Date().toISOString()
    }
  };

  // 根据选项添加相应的数据
  if (options.modelConfig) {
    const modelConfigData = await prepareModelConfigData();
    backupData.modelConfig = modelConfigData;
    console.log('已添加模型配置数据');
  }

  if (options.chatHistory) {
    const chatHistoryData = await prepareChatHistoryData();
    backupData.topics = chatHistoryData;
    console.log('已添加聊天记录数据');
  }

  if (options.assistants) {
    const assistantsData = await prepareAssistantsData();
    backupData.assistants = assistantsData;
    console.log('已添加助手配置数据');
  }

  if (options.userSettings) {
    const userSettingsData = await prepareUserSettingsData();
    backupData.userSettings = userSettingsData;
    console.log('已添加用户设置数据');
  }

  return backupData;
}

/**
 * 执行选择性备份
 */
export async function performSelectiveBackup(
  options: SelectiveBackupOptions,
  onSuccess: (message: string) => void,
  onError: (error: Error) => void,
  onBackupComplete?: () => void
): Promise<void> {
  try {
    // 验证至少选择了一个选项
    const hasSelectedOptions = Object.values(options).some(value => value);
    if (!hasSelectedOptions) {
      throw new Error('请至少选择一个备份选项');
    }

    // 准备备份数据
    const backupData = await prepareSelectiveBackupData(options);

    // 生成文件名
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const selectedItems = Object.entries(options)
      .filter(([_, selected]) => selected)
      .map(([key, _]) => {
        switch (key) {
          case 'modelConfig': return 'Model';
          case 'chatHistory': return 'Chats';
          case 'assistants': return 'Assistants';
          case 'userSettings': return 'Settings';
          default: return key;
        }
      })
      .join('_');
    
    const fileName = `AetherLink_Selective_${selectedItems}_${timestamp}.json`;

    // 创建并共享备份文件
    await createAndShareBackupFile(
      fileName,
      backupData,
      (_message) => {
        const successMessage = `选择性备份创建成功！\n已备份: ${getSelectedOptionsText(options)}`;
        onSuccess(successMessage);
      },
      onError,
      onBackupComplete
    );
  } catch (error) {
    console.error('执行选择性备份失败:', error);
    onError(error instanceof Error ? error : new Error('备份失败: 未知错误'));
  }
}

/**
 * 获取选中选项的文本描述
 */
function getSelectedOptionsText(options: SelectiveBackupOptions): string {
  const selectedItems: string[] = [];
  
  if (options.modelConfig) {
    selectedItems.push('模型配置');
  }
  if (options.chatHistory) {
    selectedItems.push('聊天记录');
  }
  if (options.assistants) {
    selectedItems.push('助手配置');
  }
  if (options.userSettings) {
    selectedItems.push('用户设置');
  }
  
  return selectedItems.join('、');
}

/**
 * 获取默认的选择性备份选项
 */
export function getDefaultSelectiveBackupOptions(): SelectiveBackupOptions {
  return {
    modelConfig: true,   // 默认选中模型配置
    chatHistory: false,  // 聊天记录
    assistants: false,   // 助手配置
    userSettings: false, // 用户设置
  };
}
