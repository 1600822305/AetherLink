import store from '../../store';
import { updateTopic, updateAssistantTopics } from '../../store/slices/assistantsSlice';
import { dexieStorage } from '../storage/DexieStorageService';
import { MessageBlockType } from '../../types/newMessage';
import type { Message } from '../../types/newMessage';
import type { ChatTopic } from '../../types';

/**
 * 话题预览服务
 *
 * 背景：侧边栏话题列表需要展示「最后一条消息」的文本预览，但消息内容是按话题懒加载进
 * Redux 的（只有打开过的话题才有）。若预览依赖 Redux，则未打开的话题永远取不到消息，
 * 错误地显示「无消息」。
 *
 * 解决：把预览作为话题自身的持久化元数据（`lastMessagePreview` + `messageCount`），
 * 由消息写入/完成/删除等持久化边界统一刷新。侧边栏读这份持久化快照即可，与 Redux 的
 * 消息加载生命周期解耦。
 *
 * 启动时由 `migrateTopicPreviews` 对全部历史话题做一次性回填，整体批量同步到 Redux，
 * 避免逐项懒加载回填导致的「满屏占位符」与本次会话列表刷新不到位的问题。
 */

const PREVIEW_MAX_LENGTH = 50;

/**
 * 将原始文本规整为侧边栏预览文本（折叠空白 + 超长截断）。
 * 导出供侧边栏对「已加载话题」的 Redux 实时内容做一致的格式化。
 */
export function formatPreviewText(text: string): string {
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
    return formatPreviewText(direct);
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
        return formatPreviewText(content);
      }
    }
  }

  return '';
}

interface TopicPreviewMeta {
  messageCount: number;
  lastMessagePreview: string;
  lastMessageTime?: string;
}

/**
 * 基于持久化数据计算某话题的预览元数据（消息条数 + 最后一条消息预览 + 时间）。
 * 仅读 dexie，不依赖 Redux，可用于未加载进 Redux 的历史话题。
 */
async function computePreviewMeta(topic: ChatTopic): Promise<TopicPreviewMeta> {
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

  return { messageCount: count, lastMessagePreview: preview, lastMessageTime };
}

/**
 * 重新计算并持久化某话题的预览元数据，然后同步到 Redux assistants slice 以触发侧边栏重渲染。
 *
 * 幂等：若计算结果与现有值一致则跳过写入。失败仅记录日志，不抛出（预览是展示增强，
 * 不应影响消息主流程）。
 */
export async function refreshTopicPreview(topicId: string): Promise<void> {
  if (!topicId) return;

  try {
    const topic = await dexieStorage.getTopic(topicId);
    if (!topic) return;

    const meta = await computePreviewMeta(topic);

    // 幂等：无变化则不写库/不派发
    if (
      topic.lastMessagePreview === meta.lastMessagePreview &&
      topic.messageCount === meta.messageCount &&
      topic.lastMessageTime === meta.lastMessageTime
    ) {
      return;
    }

    const updated = { ...topic, ...meta };

    await dexieStorage.saveTopic(updated);

    if (topic.assistantId) {
      store.dispatch(updateTopic({ assistantId: topic.assistantId, topic: updated }));
    }
  } catch (error) {
    console.error(`[TopicPreviewService] 刷新话题预览失败 (${topicId}):`, error);
  }
}

/**
 * 启动时一次性迁移回填：扫描全部话题，把缺失的预览元数据
 * （`lastMessagePreview` / `messageCount` / `lastMessageTime`）一次性写进 dexie，
 * 并按助手整体同步到 Redux（`updateAssistantTopics` 批量替换，而非逐条 `updateTopic`）。
 *
 * 这样保证全量、一次到位，不会出现满屏「…」占位，也不依赖逐项渲染时的懒派发。
 *
 * 幂等：只回填 `lastMessagePreview === undefined` 的话题；全部回填完成后再次启动时
 * 仅做一次廉价的全表扫描即返回。失败仅记录日志，不抛出。
 */
export async function migrateTopicPreviews(): Promise<void> {
  try {
    const topics = await dexieStorage.getAllTopics();
    const updatedById = new Map<string, ChatTopic>();

    for (const topic of topics) {
      // 已回填过的话题（含空话题，预览为 ''）跳过，保证幂等且廉价。
      if (topic.lastMessagePreview !== undefined) continue;

      const meta = await computePreviewMeta(topic);
      updatedById.set(topic.id, { ...topic, ...meta });
    }

    if (updatedById.size === 0) return;

    // 1) 批量写 dexie
    await dexieStorage.bulkUpdateTopics([...updatedById.values()]);

    // 2) 按助手整体替换 Redux 中的话题数组（批量，避免逐条派发）
    const assistants = store.getState().assistants.assistants;
    for (const assistant of assistants) {
      const assistantTopics = assistant.topics;
      if (!assistantTopics || assistantTopics.length === 0) continue;
      if (!assistantTopics.some(t => updatedById.has(t.id))) continue;

      const merged = assistantTopics.map(t => updatedById.get(t.id) ?? t);
      store.dispatch(updateAssistantTopics({ assistantId: assistant.id, topics: merged }));
    }

    console.log(`[TopicPreviewService] 话题预览一次性回填完成，共 ${updatedById.size} 个话题`);
  } catch (error) {
    console.error('[TopicPreviewService] 话题预览迁移回填失败:', error);
  }
}
