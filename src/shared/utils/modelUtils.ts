/**
 * 模型工具函数
 * 提供与模型相关的工具函数
 */
import type { Model } from '../types';

/**
 * 模型唯一标识结构
 */
export interface ModelIdentity {
  id: string;
  provider?: string;
}

/**
 * 从模型 ID 中提取默认组名。
 * 规则如下：
 * 1. 第一类分隔规则：以第一个出现的分隔符分割，取第 0 个部分作为组名。
 * 2. 第二类分隔规则：取前两个部分拼接（如 'a-b-c' 得到 'a-b'）。
 * 3. 其他情况返回 id。
 *
 * 例如：
 * - 'gpt-3.5-turbo-16k-0613' => 'gpt-3.5'
 * - 'qwen3:32b' => 'qwen3'
 * - 'Qwen/Qwen3-32b' => 'qwen'
 * - 'deepseek-r1' => 'deepseek-r1'
 * - 'o3' => 'o3'
 *
 * @param {string} id 模型 ID 字符串
 * @param {string} [provider] 提供商 ID 字符串
 * @returns {string} 提取的组名
 */
export function getDefaultGroupName(id: string, provider?: string): string {
  const str = id.toLowerCase();

  // 定义分隔符
  let firstDelimiters = ['/', ' ', ':'];
  let secondDelimiters = ['-', '_'];

  if (provider && ['aihubmix', 'silicon', 'ocoolai', 'o3', 'dmxapi'].includes(provider.toLowerCase())) {
    firstDelimiters = ['/', ' ', '-', '_', ':'];
    secondDelimiters = [];
  }

  // 第一类分隔规则
  for (const delimiter of firstDelimiters) {
    if (str.includes(delimiter)) {
      return str.split(delimiter)[0];
    }
  }

  // 第二类分隔规则
  for (const delimiter of secondDelimiters) {
    if (str.includes(delimiter)) {
      const parts = str.split(delimiter);
      if (parts.length > 1) {
        // 检查第二部分是否为纯数字，如果是则只使用第一部分作为分组名
        if (/^\d+$/.test(parts[1])) {
          return parts[0];
        }
        return parts[0] + '-' + parts[1];
      }
      return parts[0];
    }
  }

  return str;
}

/**
 * 从模型 ID 中提取基础名称。
 * 例如：
 * - 'deepseek/deepseek-r1' => 'deepseek-r1'
 * - 'deepseek-ai/deepseek/deepseek-r1' => 'deepseek-r1'
 * @param {string} id 模型 ID
 * @param {string} [delimiter='/'] 分隔符，默认为 '/'
 * @returns {string} 基础名称
 */
export function getBaseModelName(id: string, delimiter: string = '/'): string {
  const parts = id.split(delimiter);
  return parts[parts.length - 1];
}

// getLowerBaseModelName 已移至 ../../config/models/utils
// 通过下方的 re-export 导出

/**
 * 根据模型信息生成唯一标识
 * 采用JSON序列化，避免分隔符冲突
 * @param model 模型或包含id/provider的对象
 * @returns 唯一标识字符串
 */
export function getModelIdentityKey(model?: (Pick<Model, 'id'> & { provider?: string }) | null): string {
  if (!model || !model.id) {
    return '';
  }

  const identity: ModelIdentity = { id: model.id };
  if (model.provider) {
    identity.provider = model.provider;
  }

  return JSON.stringify(identity);
}

/**
 * 解析模型唯一标识
 * 支持 JSON 字符串 或 provider::id 格式，向后兼容纯 id
 * @param identifier 唯一标识字符串
 * @returns 解析后的模型信息
 */
export function parseModelIdentityKey(identifier?: string | null): ModelIdentity | null {
  if (!identifier) {
    return null;
  }

  const trimmed = identifier.trim();

  // 优先尝试解析 JSON
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      const parsed = JSON.parse(trimmed) as ModelIdentity;
      if (parsed && typeof parsed.id === 'string') {
        return {
          id: parsed.id,
          provider: typeof parsed.provider === 'string' ? parsed.provider : undefined
        };
      }
    } catch {
      // ignore json parse error, fallback below
    }
  }

  // 兼容 provider::modelId 格式
  const delimiter = '::';
  if (trimmed.includes(delimiter)) {
    const [provider, ...rest] = trimmed.split(delimiter);
    const id = rest.join(delimiter);
    if (id) {
      return {
        id,
        provider: provider || undefined
      };
    }
  }

  // 兜底：仅包含模型ID
  return { id: trimmed };
}

/**
 * 判断模型是否匹配指定的标识
 * @param model 模型对象
 * @param identity 模型标识
 * @param providerFallback 当模型缺少provider字段时的兜底提供商ID
 */
export function modelMatchesIdentity(
  model: Pick<Model, 'id'> & { provider?: string },
  identity: ModelIdentity | null | undefined,
  providerFallback?: string
): boolean {
  if (!identity) return false;
  if (identity.id !== model.id) return false;

  const targetProvider = identity.provider;
  const modelProvider = model.provider || providerFallback;

  if (!targetProvider) {
    return true;
  }

  if (!modelProvider) {
    return false;
  }

  return targetProvider === modelProvider;
}

/**
 * 在提供商列表中根据标识查找模型
 * @param providers 提供商列表
 * @param identifier 模型标识字符串
 * @param options 配置项
 * @returns 匹配的模型及其提供商
 */
export function findModelInProviders<T extends { id: string; models?: Model[] }>(
  providers: T[],
  identifier?: string | null,
  options: { includeDisabled?: boolean } = {}
): { model: Model; provider: T } | null {
  const identity = parseModelIdentityKey(identifier);
  if (!identity) {
    return null;
  }

  for (const provider of providers) {
    if (!provider.models) continue;

    const found = provider.models.find(model =>
      modelMatchesIdentity(model, identity, provider.id) && (options.includeDisabled || model.enabled)
    );

    if (found) {
      return { model: found, provider };
    }
  }

  return null;
}

/**
 * 在提供商列表中根据标识查找模型，并合并提供商级别的配置（apiKey、baseUrl 等）。
 * 返回始终携带完整 provider/providerType 信息的模型对象，保证“存什么发什么”。
 * @param providers 提供商列表
 * @param identifier 模型标识字符串
 * @param options 配置项
 * @returns 合并后的模型对象，找不到时返回 null
 */
export function resolveModelFromProviders<
  T extends {
    id: string;
    providerType?: string;
    apiKey?: string;
    baseUrl?: string;
    useCorsPlugin?: boolean;
    models?: Model[];
  }
>(
  providers: T[],
  identifier?: string | null,
  options: { includeDisabled?: boolean } = {}
): Model | null {
  const match = findModelInProviders(providers, identifier, options);
  if (!match) {
    return null;
  }

  const { model, provider } = match;
  return {
    ...model,
    provider: model.provider || provider.id,
    providerType: model.providerType || provider.providerType || provider.id,
    apiKey: model.apiKey || provider.apiKey,
    baseUrl: model.baseUrl || provider.baseUrl,
    useCorsPlugin: model.useCorsPlugin ?? provider.useCorsPlugin
  };
}


/**
 * 获取模型的最大上下文长度
 * @param model 模型对象
 * @returns 最大上下文长度
 */
export function getModelMaxContextLength(model: Model): number {
  // 如果模型对象中有maxContextLength属性，直接返回
  if ((model as any).maxContextLength) {
    return (model as any).maxContextLength;
  }

  const modelId = model.id;

  // GPT-4 Turbo
  if (modelId.includes('gpt-4-turbo')) {
    return 128000;
  }

  // GPT-4o
  if (modelId.includes('gpt-4o')) {
    return 128000;
  }

  // GPT-4
  if (modelId.includes('gpt-4')) {
    return 8192;
  }

  // GPT-3.5 Turbo
  if (modelId.includes('gpt-3.5-turbo')) {
    return 16384;
  }

  // Claude 3 Opus
  if (modelId.includes('claude-3-opus')) {
    return 200000;
  }

  // Claude 3 Sonnet
  if (modelId.includes('claude-3-sonnet')) {
    return 200000;
  }

  // Claude 3 Haiku
  if (modelId.includes('claude-3-haiku')) {
    return 200000;
  }

  // Claude 2
  if (modelId.includes('claude-2')) {
    return 100000;
  }

  // Gemini Pro
  if (modelId.includes('gemini-pro')) {
    return 32768;
  }

  // Gemini Ultra
  if (modelId.includes('gemini-ultra')) {
    return 32768;
  }

  // Qwen
  if (modelId.includes('qwen')) {
    return 32768;
  }

  // 默认值
  return 4096;
}

/**
 * 获取模型的最大输出长度
 * @param model 模型对象
 * @returns 最大输出长度
 */
export function getModelMaxOutputLength(model: Model): number {
  // 如果模型对象中有maxTokens属性，直接返回
  if (model.maxTokens) {
    return model.maxTokens;
  }

  const modelId = model.id;

  // GPT-4 Turbo
  if (modelId.includes('gpt-4-turbo')) {
    return 4096;
  }

  // GPT-4o
  if (modelId.includes('gpt-4o')) {
    return 4096;
  }

  // GPT-4
  if (modelId.includes('gpt-4')) {
    return 4096;
  }

  // GPT-3.5 Turbo
  if (modelId.includes('gpt-3.5-turbo')) {
    return 4096;
  }

  // Claude 3
  if (modelId.includes('claude-3')) {
    return 4096;
  }

  // Claude 2
  if (modelId.includes('claude-2')) {
    return 4096;
  }

  // Gemini
  if (modelId.includes('gemini')) {
    return 8192;
  }

  // Qwen
  if (modelId.includes('qwen')) {
    return 8192;
  }

  // 默认值
  return 2048;
}

