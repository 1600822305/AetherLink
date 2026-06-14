/**
 * OpenAI模型管理模块
 * 负责处理模型列表获取和模型信息
 * 支持多种API响应格式兼容
 */
import type { Model } from '../../types';
import { createClient } from './client';
import { universalFetch } from '../../utils/universalFetch';
import { createLogger, LogLevel } from '../../services/infra/logger';

const logger = createLogger('OpenAI Models');


/**
 * 解析模型列表响应 - 支持多种格式
 * 参考 Cherry Studio 的兼容性处理
 * @param data API响应数据
 * @returns 标准化的模型数组
 */
export function parseModelsResponse(data: any): any[] {
  // 空数据检查
  if (!data) {
    logger.warn('响应数据为空');
    return [];
  }

  // 格式1: 标准 OpenAI 格式 {object: "list", data: [...]}
  if (data.object === 'list' && Array.isArray(data.data)) {
    logger.debug(`检测到标准OpenAI格式, ${data.data.length}个模型`);
    return data.data;
  }

  // 格式2: 简化格式 {data: [...]}
  if (data.data && Array.isArray(data.data)) {
    logger.debug(`检测到简化data格式, ${data.data.length}个模型`);
    return data.data;
  }

  // 格式3: 直接数组格式 [...]
  if (Array.isArray(data)) {
    logger.debug(`检测到直接数组格式, ${data.length}个模型`);
    return data;
  }

  // 格式4: {models: [...]} 格式（某些中转站使用）
  if (data.models && Array.isArray(data.models)) {
    logger.debug(`检测到models字段格式, ${data.models.length}个模型`);
    return data.models;
  }

  // 格式5: {result: [...]} 格式（某些中转站使用）
  if (data.result && Array.isArray(data.result)) {
    logger.debug(`检测到result字段格式, ${data.result.length}个模型`);
    return data.result;
  }

  // 格式6: {results: [...]} 格式
  if (data.results && Array.isArray(data.results)) {
    logger.debug(`检测到results字段格式, ${data.results.length}个模型`);
    return data.results;
  }

  // 格式7: {items: [...]} 格式
  if (data.items && Array.isArray(data.items)) {
    logger.debug(`检测到items字段格式, ${data.items.length}个模型`);
    return data.items;
  }

  // 格式8: {list: [...]} 格式
  if (data.list && Array.isArray(data.list)) {
    logger.debug(`检测到list字段格式, ${data.list.length}个模型`);
    return data.list;
  }

  // 格式9: 嵌套格式 {data: {models: [...]}} 或 {data: {data: [...]}}
  if (data.data && typeof data.data === 'object' && !Array.isArray(data.data)) {
    const nested = data.data;
    if (Array.isArray(nested.models)) {
      logger.debug(`检测到嵌套data.models格式, ${nested.models.length}个模型`);
      return nested.models;
    }
    if (Array.isArray(nested.data)) {
      logger.debug(`检测到嵌套data.data格式, ${nested.data.length}个模型`);
      return nested.data;
    }
  }

  // 格式10: 尝试查找任何包含模型数组的字段
  const possibleArrayKeys = Object.keys(data).filter(key => Array.isArray(data[key]));
  if (possibleArrayKeys.length > 0) {
    // 优先选择看起来像模型列表的字段
    const preferredKey = possibleArrayKeys.find(key => 
      ['data', 'models', 'result', 'results', 'items', 'list'].includes(key.toLowerCase())
    ) || possibleArrayKeys[0];
    
    const arr = data[preferredKey];
    // 验证数组内容看起来像模型对象（有id字段）
    if (arr.length > 0 && (arr[0].id || arr[0].model || arr[0].name)) {
      logger.debug(`自动检测到字段 "${preferredKey}", ${arr.length}个模型`);
      return arr;
    }
  }

  // 无法识别的格式
  logger.warn('无法识别的响应格式:', JSON.stringify(data).substring(0, 200));
  return [];
}

/**
 * 标准化单个模型对象
 * @param model 原始模型对象
 * @returns 标准化的模型对象
 */
export function normalizeModel(model: any): any {
  if (!model) return null;
  
  return {
    id: (model.id || model.model || model.name || '').toString().trim(),
    object: model.object || 'model',
    created: model.created || Math.floor(Date.now() / 1000),
    owned_by: model.owned_by || model.owner || model.provider || 'unknown',
    name: model.name || model.id || model.model || '',
    description: model.description || '',
    // 保留原始字段
    ...model
  };
}

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
      logger.warn('警告: 未提供API密钥，可能导致请求失败');
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
    
    logger.debug(`请求端点: ${endpoint}`);
    
    // 构建请求头 (GET 请求不应包含 Content-Type)
    // 参考 Cherry Studio 的请求头配置，确保与各种中转站兼容
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${apiKey}`,
      'Accept': 'application/json',
      'User-Agent': 'AetherLink/1.0 (compatible; OpenAI-Client)',
      'HTTP-Referer': 'https://aetherlink.chat',
      'X-Title': 'AetherLink'
    };
    
    // 添加自定义中转站可能需要的额外头部
    if (provider.extraHeaders) {
      Object.assign(headers, provider.extraHeaders);
    }
    
    // 记录API请求
    logger.logApiRequest('OpenAI Models', LogLevel.INFO, {
      method: 'GET',
      endpoint,
      provider: provider.id
    });
    
    // 发送请求 - 使用 universalFetch 自动处理平台差异（Tauri/Web/Mobile）
    // 传递 useCorsPlugin 配置以支持 CORS 兼容模式
    const response = await universalFetch(endpoint, {
      method: 'GET',
      headers: headers,
      useCorsPlugin: provider.useCorsPlugin
    } as any);
    
    if (!response.ok) {
      const errorText = await response.text();
      logger.warn(`API请求失败: ${response.status}, ${errorText}`);
      
      // 记录API响应
      logger.logApiResponse('OpenAI Models', response.status, {
        error: errorText
      });
      
      throw new Error('API请求失败');
    }
    
    const data = await response.json();
    
    // 使用增强的响应解析器处理多种格式
    const models = parseModelsResponse(data);
    
    // 标准化每个模型对象
    const normalizedModels = models
      .map(normalizeModel)
      .filter((m: any) => m && m.id); // 过滤掉无效模型
    
    logger.debug(`成功获取模型列表, 找到 ${normalizedModels.length} 个模型`);
    
    // 记录API响应
    logger.logApiResponse('OpenAI Models', 200, {
      modelsCount: normalizedModels.length,
      rawFormat: data.object || (Array.isArray(data) ? 'array' : 'unknown')
    });
    
    return normalizedModels;
  } catch (error) {
    logger.error('获取模型失败:', error);
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
    logger.logApiRequest('OpenAI Models SDK', LogLevel.INFO, {
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
    logger.logApiResponse('OpenAI Models SDK', 200, {
      modelsCount: models.length
    });
    
    return models;
  } catch (error) {
    logger.error('获取模型失败:', error);
    throw error;
  }
}
