/**
 * 翻译服务
 */
import { v4 as uuidv4 } from 'uuid';
import { TRANSLATE_PROMPT, type TranslateLanguage } from './TranslateConfig';
import { ApiProviderRegistry } from '../messages/ApiProvider';
import type { Model } from '../../types';
import { ChunkType, type Chunk } from '../../types/chunk';
import store from '../../store';
import { getStorageItem, setStorageItem, removeStorageItem } from '../../utils/storage';
import { createLogger } from '../infra/logger';
const logger = createLogger('TranslateService');

export interface TranslateHistory {
  id: string;
  sourceText: string;
  targetText: string;
  sourceLanguage: string;
  targetLanguage: string;
  createdAt: string;
  star?: boolean;
}

const TRANSLATE_HISTORY_KEY = 'translate_history';
const MAX_HISTORY_COUNT = 100;

/**
 * 获取翻译使用的模型
 */
export function getTranslateModel(): Model | null {
  try {
    const state = store.getState();
    // 优先使用设置中的翻译模型，否则使用默认模型
    const translateModelId = (state.settings as any).translateModelId;
    const providers = state.settings.providers || [];
    
    // 查找模型
    for (const provider of providers) {
      const model = provider.models?.find((m: Model) => m.id === translateModelId);
      if (model) {
        return { ...model, provider: provider.id };
      }
    }
    
    // 如果没有设置翻译模型，使用第一个可用模型
    for (const provider of providers) {
      if (provider.models && provider.models.length > 0) {
        const model = provider.models[0];
        return { ...model, provider: provider.id };
      }
    }
    
    return null;
  } catch (error) {
    logger.error('Failed to get translate model:', error);
    return null;
  }
}

/**
 * 翻译文本
 * @param text 要翻译的文本
 * @param targetLanguage 目标语言
 * @param onResponse 响应回调
 * @param abortSignal 中断信号
 * @param customModel 可选的自定义模型，如果不提供则使用默认模型
 */
export async function translateText(
  text: string,
  targetLanguage: TranslateLanguage,
  onResponse?: (text: string, isComplete: boolean) => void,
  abortSignal?: AbortSignal,
  customModel?: Model | null
): Promise<string> {
  const prompt = TRANSLATE_PROMPT
    .replace(/\{\{target_language\}\}/g, targetLanguage.value)
    .replace('{{text}}', text);

  // 使用自定义模型或默认模型
  const model = customModel || getTranslateModel();
  if (!model) {
    throw new Error('没有可用的翻译模型，请先配置模型');
  }

  const apiProvider = ApiProviderRegistry.get(model);
  if (!apiProvider) {
    throw new Error(`无法获取API提供商: ${model.provider}`);
  }

  let translatedText = '';
  
  try {
    // 创建简单的消息格式用于 API 调用
    // 注意：OpenAI Provider 通过 message.content 获取内容
    const messages = [{
      id: uuidv4(),
      role: 'user' as const,
      content: prompt, // OpenAI Provider 需要 content 字段
      blocks: [] as string[],
      assistantId: '',
      topicId: '',
      createdAt: new Date().toISOString(),
      status: 'success' as const,
      modelId: model.id
    }];

    await apiProvider.sendChatMessage(messages as any, {
      onChunk: (chunk: Chunk) => {
        // 处理文本增量 - 注意：chunk.text 已经是累积内容，不需要再累加
        if (chunk.type === ChunkType.TEXT_DELTA) {
          translatedText = chunk.text;  // 直接赋值，不累加
          onResponse?.(translatedText, false);
        }
        // 处理文本完成
        else if (chunk.type === ChunkType.TEXT_COMPLETE) {
          translatedText = chunk.text;
          onResponse?.(translatedText, true);
        }
      },
      abortSignal: abortSignal
    });

    onResponse?.(translatedText, true);
    return translatedText.trim();
  } catch (error) {
    if ((error as Error).name === 'AbortError') {
      throw error;
    }
    logger.error('Translation failed:', error);
    throw error;
  }
}

/**
 * 保存翻译历史
 */
export async function saveTranslateHistory(
  sourceText: string,
  targetText: string,
  sourceLanguage: string,
  targetLanguage: string
): Promise<TranslateHistory> {
  const history: TranslateHistory = {
    id: uuidv4(),
    sourceText,
    targetText,
    sourceLanguage,
    targetLanguage,
    createdAt: new Date().toISOString()
  };

  const histories = await getTranslateHistories();
  histories.unshift(history);
  
  // 限制历史记录数量
  if (histories.length > MAX_HISTORY_COUNT) {
    histories.splice(MAX_HISTORY_COUNT);
  }
  
  await setStorageItem(TRANSLATE_HISTORY_KEY, histories);
  return history;
}

/**
 * 获取所有翻译历史
 */
export async function getTranslateHistories(): Promise<TranslateHistory[]> {
  try {
    const data = await getStorageItem<TranslateHistory[]>(TRANSLATE_HISTORY_KEY);
    return data || [];
  } catch {
    return [];
  }
}

/**
 * 删除翻译历史
 */
export async function deleteTranslateHistory(id: string): Promise<void> {
  const histories = await getTranslateHistories();
  const filtered = histories.filter(h => h.id !== id);
  await setStorageItem(TRANSLATE_HISTORY_KEY, filtered);
}

/**
 * 切换收藏状态
 */
export async function toggleHistoryStar(id: string): Promise<void> {
  const histories = await getTranslateHistories();
  const index = histories.findIndex(h => h.id === id);
  if (index !== -1) {
    histories[index].star = !histories[index].star;
    await setStorageItem(TRANSLATE_HISTORY_KEY, histories);
  }
}

/**
 * 清空所有历史
 */
export async function clearTranslateHistory(): Promise<void> {
  await removeStorageItem(TRANSLATE_HISTORY_KEY);
}

/**
 * OCR 识别图片中的文字
 * @param imageBase64 图片的 base64 数据（包含 data:image/xxx;base64, 前缀）
 * @param onResponse 响应回调
 * @param abortSignal 中断信号
 * @param customModel 可选的自定义模型
 */
export async function recognizeImageText(
  imageBase64: string,
  onResponse?: (text: string, isComplete: boolean) => void,
  abortSignal?: AbortSignal,
  customModel?: Model | null
): Promise<string> {
  const ocrPrompt = `请识别这张图片中的所有文字内容，直接输出识别到的文字，不要添加任何解释或格式化。如果图片中没有文字，请回复"未识别到文字"。`;

  // 使用自定义模型或默认模型
  const model = customModel || getTranslateModel();
  if (!model) {
    throw new Error('没有可用的模型，请先配置模型');
  }

  const apiProvider = ApiProviderRegistry.get(model);
  if (!apiProvider) {
    throw new Error(`无法获取API提供商: ${model.provider}`);
  }

  let recognizedText = '';
  
  try {
    // 直接使用 OpenAI API 的多模态消息格式
    const messages = [{
      role: 'user' as const,
      content: [
        { type: 'text', text: ocrPrompt },
        { type: 'image_url', image_url: { url: imageBase64, detail: 'auto' } }
      ]
    }];

    await apiProvider.sendChatMessage(messages as any, {
      onChunk: (chunk: Chunk) => {
        if (chunk.type === ChunkType.TEXT_DELTA) {
          recognizedText = chunk.text;
          onResponse?.(recognizedText, false);
        } else if (chunk.type === ChunkType.TEXT_COMPLETE) {
          recognizedText = chunk.text;
          onResponse?.(recognizedText, true);
        }
      },
      abortSignal: abortSignal
    });

    onResponse?.(recognizedText, true);
    return recognizedText.trim();
  } catch (error) {
    if ((error as Error).name === 'AbortError') {
      throw error;
    }
    logger.error('OCR failed:', error);
    throw error;
  }
}
