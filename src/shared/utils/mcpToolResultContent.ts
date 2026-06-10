/**
 * MCP 工具结果内容处理工具
 *
 * MCP 工具按协议返回 `content: Array<{ type: 'text' | 'image' | 'resource', text?, data?, mimeType? }>`，
 * 其中图片项为 `{ type: 'image', data: <base64>, mimeType }`（与 MCP `ImageContent` 一致）。
 *
 * 历史上各 Provider 的"工具结果 → 消息"转换会直接 `JSON.stringify` 或 `.filter(type==='text')`，
 * 导致图片被丢弃或当成文本，模型收不到真正的图像。
 *
 * 这里提供统一的拆分逻辑，把 MCP 工具结果拆成「纯文本」与「图片列表」，
 * 各 Provider 再按自己通道的多模态规范组装消息。
 */

export interface McpResultImage {
  /** 纯 base64 数据（不含 data: 前缀） */
  data: string;
  /** MIME 类型，如 image/png */
  mimeType: string;
}

export interface SplitMcpContent {
  /** 合并后的文本内容 */
  text: string;
  /** 图片列表 */
  images: McpResultImage[];
}

/**
 * 把可能带 data: 前缀的 base64 字符串规整为 { data, mimeType }
 */
function normalizeBase64(raw: string, fallbackMime: string): McpResultImage {
  const match = /^data:([^;,]+);base64,(.*)$/s.exec(raw);
  if (match) {
    return { mimeType: match[1] || fallbackMime, data: match[2] };
  }
  return { mimeType: fallbackMime, data: raw };
}

/**
 * 拆分 MCP 工具结果为文本与图片
 */
export function splitMcpToolContent(resp: { content?: any[] } | null | undefined): SplitMcpContent {
  const images: McpResultImage[] = [];
  const textParts: string[] = [];

  const content = resp?.content;
  if (Array.isArray(content)) {
    for (const item of content) {
      if (!item || typeof item !== 'object') continue;

      if (item.type === 'text') {
        if (item.text) textParts.push(String(item.text));
        continue;
      }

      if (item.type === 'image' && item.data) {
        images.push(normalizeBase64(String(item.data), item.mimeType || 'image/png'));
        continue;
      }

      // 嵌入式资源：可能是图片（blob + image/* mime），也可能是文本资源
      if (item.type === 'resource') {
        const resource = item.resource || item;
        const mime: string | undefined = resource.mimeType || item.mimeType;
        const blob: string | undefined = resource.blob || resource.data || item.data;
        if (mime && mime.startsWith('image/') && blob) {
          images.push(normalizeBase64(String(blob), mime));
        } else if (resource.text) {
          textParts.push(String(resource.text));
        }
      }
    }
  }

  return { text: textParts.join('\n'), images };
}

/**
 * 构造 data URL（用于 user 角色多模态消息中的图片）
 */
export function toImageDataUrl(img: McpResultImage): string {
  return `data:${img.mimeType};base64,${img.data}`;
}

/**
 * 构造 Vercel AI SDK v6 的工具结果 output（ToolResultOutput）
 *
 * - 错误：{ type: 'error-text', value }
 * - 纯文本：{ type: 'text', value }
 * - 含图片：{ type: 'content', value: [{ type: 'text', text }, { type: 'image-data', data, mediaType }] }
 *
 * 注意：图片部件必须用 `image-data`（而非已弃用的 `media`）。
 * 实测 @ai-sdk/anthropic 与 @ai-sdk/google 的工具结果转换只识别 `image-data`/`image-url`，
 * `media` 会被当成未知类型丢弃 / JSON 序列化。
 *
 * 适用于 Anthropic、Google(Gemini 3) 等「tool 结果原生支持图片」的通道。
 * OpenAI Chat Completions 不支持（会把整个 content 数组 JSON.stringify），
 * 那条通道应改用「tool 文本 + 追加一条 user 图片消息」的方式。
 *
 * 参考：https://ai-sdk.dev/docs/reference/ai-sdk-core/model-message （ToolResultOutput）
 */
export function buildAISDKToolOutput(
  text: string,
  images: McpResultImage[],
  isError: boolean
): any {
  if (isError) {
    return { type: 'error-text', value: text || 'Unknown error' };
  }

  if (images.length === 0) {
    return { type: 'text', value: text };
  }

  const value: any[] = [];
  if (text) value.push({ type: 'text', text });
  for (const img of images) {
    value.push({ type: 'image-data', data: img.data, mediaType: img.mimeType });
  }
  return { type: 'content', value };
}
