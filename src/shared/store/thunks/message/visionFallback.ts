/**
 * 视觉识别回退 — apiMessages 改写纯函数
 *
 * 当前模型不支持图片输入且启用了视觉识别时：
 * 1. 提取最后一条用户消息中的图片（本轮提问的图片）
 * 2. 交给视觉模型分析后，将分析文本注入该消息
 * 3. 剥离所有消息中的 image_url 部分（历史图片以占位文本代替）
 *
 * 仅改写本次请求的 apiMessages 副本，不修改数据库中的消息记录。
 */

export interface ApiMessageContentPart {
  type: string;
  text?: string;
  image_url?: { url: string };
  [key: string]: unknown;
}

export interface ApiMessage {
  role: string;
  content?: string | ApiMessageContentPart[];
  [key: string]: unknown;
}

export interface ImageUrlPart {
  type: 'image_url';
  image_url: { url: string };
}

const isImagePart = (part: unknown): part is ImageUrlPart => {
  if (!part || typeof part !== 'object') return false;
  const p = part as ApiMessageContentPart;
  return p.type === 'image_url' && !!p.image_url?.url;
};

const HISTORICAL_IMAGE_PLACEHOLDER = '[图片：历史消息中的图片，此处省略]';

/** 提取最后一条用户消息中的图片部分及文本 */
export function extractLastUserImages(apiMessages: ApiMessage[]): {
  images: ImageUrlPart[];
  userText: string;
  messageIndex: number;
} {
  for (let i = apiMessages.length - 1; i >= 0; i--) {
    const message = apiMessages[i];
    if (message.role !== 'user') continue;
    if (!Array.isArray(message.content)) continue;

    const images = message.content.filter(isImagePart);
    if (images.length === 0) continue;

    const userText = message.content
      .filter((part) => part.type === 'text' && typeof part.text === 'string')
      .map((part) => part.text)
      .join('\n');

    return { images, userText, messageIndex: i };
  }
  return { images: [], userText: '', messageIndex: -1 };
}

/** 将单条消息的图片部分剥离为文本 */
const stripMessageImages = (message: ApiMessage, replacement: string | null): ApiMessage => {
  if (!Array.isArray(message.content)) return message;

  const textParts: ApiMessageContentPart[] = [];
  let hadImage = false;

  for (const part of message.content) {
    if (isImagePart(part)) {
      hadImage = true;
      continue;
    }
    textParts.push(part);
  }

  if (!hadImage) return message;

  if (replacement) {
    textParts.push({ type: 'text', text: replacement });
  }

  // 只剩一个文本部分时退化为字符串，保持与无图消息一致的格式
  if (textParts.length === 1 && textParts[0].type === 'text') {
    return { ...message, content: textParts[0].text || '' };
  }
  if (textParts.length === 0) {
    return { ...message, content: '' };
  }
  return { ...message, content: textParts };
};

/** 构造注入的分析文本块 */
export function buildAnalysisText(analysis: string): string {
  return [
    '<image_analysis note="以下内容由视觉模型自动分析用户发送的图片生成，请将其视为图片的真实内容">',
    analysis.trim(),
    '</image_analysis>',
  ].join('\n');
}

/**
 * 剥离所有图片并将分析结果注入最后一条带图的用户消息。
 * analysis 为 null 时仅剥离图片（失败降级策略 continueWithoutImage）。
 */
export function applyVisionAnalysisToApiMessages(
  apiMessages: ApiMessage[],
  analysis: string | null
): ApiMessage[] {
  const { messageIndex } = extractLastUserImages(apiMessages);

  return apiMessages.map((message, index) => {
    if (index === messageIndex) {
      const replacement = analysis
        ? buildAnalysisText(analysis)
        : '[图片：视觉分析不可用，图片内容未能解析]';
      return stripMessageImages(message, replacement);
    }
    return stripMessageImages(message, HISTORICAL_IMAGE_PLACEHOLDER);
  });
}
