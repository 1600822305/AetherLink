/**
 * 设置工具函数
 * 提供读取和保存应用设置的工具函数
 */

/**
 * 从localStorage读取流式输出设置
 * @returns 流式输出是否启用，默认为true
 */
export function getStreamOutputSetting(): boolean {
  try {
    const appSettingsJSON = localStorage.getItem('appSettings');
    if (appSettingsJSON) {
      const appSettings = JSON.parse(appSettingsJSON);
      // 如果设置中有streamOutput，使用它；否则默认为true
      return appSettings.streamOutput !== undefined ? appSettings.streamOutput : true;
    }
  } catch (error) {
    console.error('读取流式输出设置失败:', error);
  }

  // 默认启用流式输出
  return true;
}

/**
 * 保存流式输出设置到localStorage
 * @param enabled 是否启用流式输出
 */
export function setStreamOutputSetting(enabled: boolean): void {
  try {
    const appSettingsJSON = localStorage.getItem('appSettings');
    const appSettings = appSettingsJSON ? JSON.parse(appSettingsJSON) : {};

    appSettings.streamOutput = enabled;
    localStorage.setItem('appSettings', JSON.stringify(appSettings));

    console.log(`[settingsUtils] 流式输出设置已保存: ${enabled}`);
  } catch (error) {
    console.error('保存流式输出设置失败:', error);
  }
}

/**
 * 从localStorage读取对话分割线设置
 * @returns 对话分割线是否启用，默认为true
 */
export function getMessageDividerSetting(): boolean {
  try {
    const appSettingsJSON = localStorage.getItem('appSettings');
    if (appSettingsJSON) {
      const appSettings = JSON.parse(appSettingsJSON);
      // 如果设置中有showMessageDivider，使用它；否则默认为true
      return appSettings.showMessageDivider !== undefined ? appSettings.showMessageDivider : true;
    }
  } catch (error) {
    console.error('读取对话分割线设置失败:', error);
  }

  // 默认启用对话分割线
  return true;
}

/**
 * 保存消息分割线设置到localStorage
 * @param enabled 是否启用消息分割线
 */
export function setMessageDividerSetting(enabled: boolean): void {
  try {
    const appSettingsJSON = localStorage.getItem('appSettings');
    const appSettings = appSettingsJSON ? JSON.parse(appSettingsJSON) : {};

    appSettings.showMessageDivider = enabled;
    localStorage.setItem('appSettings', JSON.stringify(appSettings));

    console.log(`[settingsUtils] 消息分割线设置已保存: ${enabled}`);
  } catch (error) {
    console.error('保存消息分割线设置失败:', error);
  }
}

/**
 * 从localStorage读取所有应用设置
 * @returns 应用设置对象
 */
export function getAppSettings(): Record<string, any> {
  try {
    const appSettingsJSON = localStorage.getItem('appSettings');
    if (appSettingsJSON) {
      return JSON.parse(appSettingsJSON);
    }
  } catch (error) {
    console.error('读取应用设置失败:', error);
  }

  // 返回默认设置
  return {
    streamOutput: true,
    showMessageDivider: true,
    copyableCodeBlocks: true,
    contextLength: 16000,
    contextCount: 5,
    mathRenderer: 'KaTeX',
    defaultThinkingEffort: 'medium',
    thinkingBudget: 1024,  // 默认思考预算为1024 tokens
    enableMaxOutputTokens: true  // 默认启用最大输出Token参数
  };
}

/**
 * 保存应用设置到localStorage
 * @param settings 要保存的设置
 */
export function saveAppSettings(settings: Record<string, any>): void {
  try {
    localStorage.setItem('appSettings', JSON.stringify(settings));
    console.log('[settingsUtils] 应用设置已保存:', settings);
  } catch (error) {
    console.error('保存应用设置失败:', error);
  }
}

/**
 * 获取默认思维链长度设置
 * @returns 思维链长度选项
 */
export function getDefaultThinkingEffort(): string {
  try {
    const appSettings = getAppSettings();
    return appSettings.defaultThinkingEffort || 'medium';
  } catch (error) {
    console.error('读取思维链长度设置失败:', error);
    return 'medium';
  }
}

/**
 * 获取思考预算设置
 * @returns 思考预算值
 */
export function getThinkingBudget(): number {
  try {
    const appSettings = getAppSettings();
    return appSettings.thinkingBudget || 1024;
  } catch (error) {
    console.error('读取思考预算设置失败:', error);
    return 1024;
  }
}

/**
 * 识别对话轮次结束
 * 判断当前消息是否是一轮对话的最后一条消息
 * @param messages 所有消息
 * @param currentIndex 当前消息的索引
 * @returns 是否应该显示对话分割线
 */
export function shouldShowConversationDivider(messages: any[], currentIndex: number): boolean {
  const currentMessage = messages[currentIndex];
  if (!currentMessage) return false;

  // 如果是最后一条消息，不显示分割线
  if (currentIndex === messages.length - 1) return false;

  // 如果当前消息是AI回复
  if (currentMessage.role === 'assistant') {
    // 检查下一条消息是否是用户消息（新的对话轮次开始）
    const nextMessage = messages[currentIndex + 1];
    if (nextMessage && nextMessage.role === 'user') {
      return true; // 在AI回复后，用户开始新对话时显示分割线
    }
  }

  return false;
}
