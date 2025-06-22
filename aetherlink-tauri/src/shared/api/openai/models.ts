/**
 * OpenAI模型管理模块
 * 负责处理模型列表获取和模型信息
 */
import type { Model } from '../../types';
import { createClient } from './client';
import { logApiRequest, logApiResponse } from '../../services/LoggerService';

/**
 * 获取模型列表
 * @param provider 提供商配置
 * @returns 模型列表
 */
export async function fetchModels(provider: any): Promise<any[]> {
  try {
    const baseUrl = provider.baseUrl || 'https://api.openai.com/v1';
    const apiKey = provider.apiKey;
    
    if (!apiKey) {
      console.warn('[fetchOpenAIModels] 警告: 未提供API密钥，可能导致请求失败');
    }
    
    // 构建API端点
    let endpoint = '';
    // 确保baseUrl不以斜杠结尾，避免双斜杠问题
    const cleanBaseUrl = baseUrl.replace(/\/+$/, '');

    if (cleanBaseUrl.includes('/v1')) {
      // 如果baseUrl已经包含/v1，直接添加/models
      endpoint = `${cleanBaseUrl}/models`;
    } else {
      // 否则添加完整路径
      endpoint = `${cleanBaseUrl}/v1/models`;
    }
    
    console.log(`[fetchOpenAIModels] 请求端点: ${endpoint}`);
    
    // 构建请求头
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    };
    
    // 添加自定义中转站可能需要的额外头部
    if (provider.extraHeaders) {
      Object.assign(headers, provider.extraHeaders);
    }
    
    // 记录API请求
    logApiRequest('OpenAI Models', 'INFO', {
      method: 'GET',
      endpoint,
      provider: provider.id
    });
    
    // 发送请求 - WebView混合内容设置已允许HTTP请求
    const response = await fetch(endpoint, {
      method: 'GET',
      headers: headers
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.warn(`[fetchOpenAIModels] API请求失败: ${response.status}, ${errorText}`);
      
      // 记录API响应
      logApiResponse('OpenAI Models', response.status, {
        error: errorText
      });
      
      throw new Error('API请求失败');
    }
    
    const data = await response.json();
    console.log(`[fetchOpenAIModels] 成功获取模型列表, 找到 ${(data.data || []).length} 个模型`);
    
    // 记录API响应
    logApiResponse('OpenAI Models', 200, {
      modelsCount: (data.data || []).length
    });
    
    // 确保返回的数据格式正确
    if (!data.data && Array.isArray(data)) {
      // 某些中转站可能直接返回模型数组而不是 {data: [...]} 格式
      return data;
    }
    
    return data.data || [];
  } catch (error) {
    console.error('[fetchOpenAIModels] 获取模型失败:', error);
    throw error;
  }
}

/**
 * 使用SDK获取模型列表
 * @param model 模型配置
 * @returns 模型列表
 */
export async function fetchModelsWithSDK(model: Model): Promise<any[]> {
  try {
    // 创建OpenAI客户端
    const openai = createClient(model);
    
    // 记录API请求
    logApiRequest('OpenAI Models SDK', 'INFO', {
      method: 'GET',
      model: model.id
    });
    
    // 获取模型列表
    const response = await openai.models.list();
    
    // 处理响应
    const models = response.data || [];
    models.forEach((model) => {
      model.id = model.id.trim();
    });
    
    // 记录API响应
    logApiResponse('OpenAI Models SDK', 200, {
      modelsCount: models.length
    });
    
    return models;
  } catch (error) {
    console.error('[fetchModelsWithSDK] 获取模型失败:', error);
    throw error;
  }
}
