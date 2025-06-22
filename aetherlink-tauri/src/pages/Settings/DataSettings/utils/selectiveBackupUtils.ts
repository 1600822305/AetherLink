import { getStorageItem } from '../../../../shared/utils/storage';
import { createAndShareBackupFile } from './backupUtils';

/**
 * 选择性备份选项接口
 */
export interface SelectiveBackupOptions {
  modelConfig: boolean; // 模型配置备份
  // 未来可扩展的选项：
  // chatHistory: boolean;
  // assistants: boolean;
  // userSettings: boolean;
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
    // 获取完整的设置数据
    const settings = await getStorageItem<any>('settings');
    
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

  // 未来可以在这里添加其他选项的处理
  // if (options.chatHistory) { ... }
  // if (options.assistants) { ... }

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
          case 'modelConfig': return 'ModelConfig';
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
  
  // 未来可以添加其他选项的描述
  // if (options.chatHistory) selectedItems.push('聊天记录');
  // if (options.assistants) selectedItems.push('助手配置');
  
  return selectedItems.join('、');
}

/**
 * 获取默认的选择性备份选项
 */
export function getDefaultSelectiveBackupOptions(): SelectiveBackupOptions {
  return {
    modelConfig: true, // 默认选中模型配置
    // 未来的默认选项
    // chatHistory: false,
    // assistants: false,
  };
}
