import store from '../../store';
import { updateTopic } from '../../store/slices/assistantsSlice';
import { dexieStorage } from '../storage/DexieStorageService';
import { MessageBlockType } from '../../types/newMessage';
import type { Message } from '../../types/newMessage';

/**
 * 话题预览服务
 *
 * 背景：侧边栏话题列表需要展示「最后一条消息」的文本预览，但消息内容是按话题懒加载进
 * Redux 的（只有打开过的话题才有）。若预览依赖 Redux，则未打开的话题永远取不到消息，
 * 错误地显示「无消息」。
 *
 * 解决：把预览作为话题自身的持久化元数据（`lastMessagePreview` + `messageCount`），
 * 由消息写入/完成/删除等持久化边界统一刷新。侧边栏只读这份持久化快照，与 Redux 的
 * 消息加载生命周期彻底解耦。
 */

const PREVIEW_MAX_LENGTH = 50;

function truncate(text: string): string {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (normalized.length <= PREVIEW_MAX_LENGTH) {
    return normalized;
  }
  return `${normalized.slice(0, PREVIEW_MAX_LENGTH)}…`;
}

/**
 * 从持久化数据（dexie）构建一条消息的预览文本。
 * 不依赖 Redux，因此对未加载进 Redux 的话题同样有效。
 */
export async function buildPreviewText(message: Message): Promise<string> {
  if (!message) return '';

  // 优先使用消息上保存的 content 字段（多模型对比选择后的内容）
  const direct = (message as { content?: unknown }).content;
  if (typeof direct === 'string' && direct.trim()) {
    return truncate(direct);
  }

  const blockIds = message.blocks || [];
  if (blockIds.length === 0) return '';

  for (const id of blockIds) {
    const block = await dexieStorage.getMessageBlock(id);
    if (!block) continue;
    if (
      block.type === MessageBlockType.MAIN_TEXT ||
      block.type === MessageBlockType.UNKNOWN ||
      block.type === MessageBlockType.CONTEXT_SUMMARY
    ) {
      const content = (block as { content?: unknown }).content;
      if (typeof content === 'string' && content.trim()) {
        return truncate(content);
      }
    }
  }

  return '';
}

/**
 * 重新计算并持久化某话题的预览元数据（消息条数 + 最后一条消息预览 + 时间），
 * 然后同步到 Redux assistants slice 以触发侧边栏重渲染。
 *
 * 幂等：若计算结果与现有值一致则跳过写入。失败仅记录日志，不抛出（预览是展示增强，
 * 不应影响消息主流程）。
 */
export async function refreshTopicPreview(topicId: string): Promise<void> {
  if (!topicId) return;

  try {
    const topic = await dexieStorage.getTopic(topicId);
    if (!topic) return;

    const ids = topic.messageIds || [];
    const count = ids.length;

    let preview = '';
    let lastMessageTime = topic.lastMessageTime;

    if (count > 0) {
      const lastMessage = await dexieStorage.messages.get(ids[count - 1]);
      if (lastMessage) {
        preview = await buildPreviewText(lastMessage);
        lastMessageTime = lastMessage.createdAt || lastMessage.updatedAt || lastMessageTime;
      }
    }

    // 幂等：无变化则不写库/不派发
    if (
      topic.lastMessagePreview === preview &&
      topic.messageCount === count &&
      topic.lastMessageTime === lastMessageTime
    ) {
      return;
    }

    const updated = {
      ...topic,
      messageCount: count,
      lastMessagePreview: preview,
      lastMessageTime,
    };

    await dexieStorage.saveTopic(updated);

    if (topic.assistantId) {
      store.dispatch(updateTopic({ assistantId: topic.assistantId, topic: updated }));
    }
  } catch (error) {
    console.error(`[TopicPreviewService] 刷新话题预览失败 (${topicId}):`, error);
  }
}
