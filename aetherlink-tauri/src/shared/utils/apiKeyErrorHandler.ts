/**
 * API Key 错误检测和处理工具
 * 参考 Cline 的错误处理机制，提供智能的 API Key 错误检测和重试功能
 */

import { EventEmitter } from '../services/EventEmitter';
import { EVENT_NAMES } from '../services/EventEmitter';
import store from '../store';
import { regenerateMessage } from '../store/thunks/messageThunk';

/**
 * 检测是否为 API Key 相关错误
 */
export function isApiKeyError(error: any): boolean {
  const message = (error?.message || '').toLowerCase();
  const status = error?.status || error?.code;

  // 检测 403 权限错误
  if (status === 403) {
    return true;
  }

  // 检测 401 认证错误
  if (status === 401) {
    return true;
  }

  // 检测特定的 API Key 错误消息
  const apiKeyErrorPatterns = [
    'api key',
    'api_key',
    'permission denied',
    'suspended',
    'invalid key',
    'unauthorized',
    'authentication failed',
    'token',
    '密钥',
    '认证失败',
    '权限',
    '暂停'
  ];

  return apiKeyErrorPatterns.some(pattern => message.includes(pattern));
}

/**
 * 获取 API Key 错误的用户友好提示
 */
export function getApiKeyErrorMessage(error: any): string {
  const message = (error?.message || '').toLowerCase();
  const status = error?.status || error?.code;

  if (status === 403) {
    if (message.includes('suspended')) {
      return 'API Key 已被暂停，请检查您的账户状态或更换 API Key';
    }
    return 'API Key 权限不足，请检查 API Key 是否有效';
  }

  if (status === 401) {
    return 'API Key 认证失败，请检查 API Key 是否正确';
  }

  if (message.includes('suspended')) {
    return 'API Key 已被暂停，请联系服务提供商或更换 API Key';
  }

  if (message.includes('invalid')) {
    return 'API Key 无效，请检查 API Key 格式是否正确';
  }

  return 'API Key 存在问题，请检查配置或联系技术支持';
}

/**
 * 检测并处理 API Key 错误
 * @param error 错误对象
 * @param messageId 消息ID
 * @param topicId 话题ID
 * @returns 是否为 API Key 错误
 */
export async function checkAndHandleApiKeyError(
  error: any,
  messageId: string,
  topicId: string
): Promise<boolean> {
  if (!isApiKeyError(error)) {
    return false;
  }

  console.log(`[ApiKeyErrorHandler] 检测到 API Key 错误:`, error);

  // 获取用户友好的错误消息
  const userMessage = getApiKeyErrorMessage(error);

  // 发送 API Key 错误事件，让UI组件处理显示
  EventEmitter.emit(EVENT_NAMES.API_KEY_ERROR, {
    error,
    messageId,
    topicId,
    userMessage,
    canRetry: true,
    showRetryButton: true,
    showConfigButton: true
  });

  //  重要：返回 false，让 ResponseHandler 继续创建错误块显示给用户
  // 这样用户既能看到错误信息，又能使用重试功能
  return false;
}

/**
 * 重试 API Key 错误的消息
 * @param messageId 消息ID
 * @param topicId 话题ID
 */
export async function retryApiKeyError(messageId: string, topicId: string): Promise<void> {
  try {
    console.log(`[ApiKeyErrorHandler] 重试消息: ${messageId}`);

    // 获取当前状态
    const state = store.getState();
    const message = state.messages.entities[messageId];

    if (!message) {
      throw new Error('找不到消息');
    }

    // 获取当前选择的模型（从设置中获取）
    const currentModelId = state.settings.currentModelId;
    if (!currentModelId) {
      throw new Error('未选择当前模型');
    }

    // 从可用模型中找到当前选择的模型
    let currentModel = null;
    if (state.settings.providers) {
      for (const provider of state.settings.providers) {
        if (provider.isEnabled) {
          const model = provider.models.find(m => m.id === currentModelId && m.enabled);
          if (model) {
            currentModel = {
              ...model,
              provider: provider.id, // 确保provider字段设置为正确的provider ID
              apiKey: model.apiKey || provider.apiKey,
              baseUrl: model.baseUrl || provider.baseUrl,
              providerType: model.providerType || provider.providerType || provider.id,
            };
            break;
          }
        }
      }
    }

    if (!currentModel) {
      // 如果找不到当前模型，回退到消息原始模型
      console.warn(`[ApiKeyErrorHandler] 找不到当前选择的模型 ${currentModelId}，使用消息原始模型`);
      if (!message.model) {
        throw new Error('找不到消息模型信息');
      }
      currentModel = message.model;
    }

    console.log(`[ApiKeyErrorHandler] 使用模型重试:`, {
      modelId: currentModel.id,
      modelName: currentModel.name,
      provider: currentModel.provider
    });

    // 使用当前选择的模型重新生成消息
    await store.dispatch(regenerateMessage(messageId, topicId, currentModel) as any);

    console.log(`[ApiKeyErrorHandler] 消息重试成功: ${messageId}`);
  } catch (error) {
    console.error(`[ApiKeyErrorHandler] 消息重试失败:`, error);
    throw error;
  }
}

/**
 * 显示 API Key 配置提示
 */
export function showApiKeyConfigHint(): void {
  EventEmitter.emit(EVENT_NAMES.SHOW_API_KEY_CONFIG, {
    message: '请检查并更新您的 API Key 配置',
    action: 'open_settings'
  });
}
