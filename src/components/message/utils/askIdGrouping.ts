/**
 * askIdGrouping - 把同一 askId 下的多模型助手响应识别为一个分组（纯逻辑，可单测）。
 *
 * 返回数组中的每个元素是：
 * - 单条消息（普通消息）
 * - 多模型分组对象 { type:'multi-model', userMessage, assistantMessages }
 */
import type { Message } from '../../../shared/types/newMessage';

export interface MultiModelGroup {
  type: 'multi-model';
  userMessage: Message;
  assistantMessages: Message[];
}

export type MessageOrGroup = Message | MultiModelGroup;

export interface GroupingResult {
  groupedMessages: MessageOrGroup[];
  messageIndexMap: Map<string, number>;
}

export const groupMessagesByAskId = (messages: Message[]): GroupingResult => {
  const result: MessageOrGroup[] = [];
  const processedIds = new Set<string>();
  const messageIndexMap = new Map<string, number>();

  // 预构建 askId 到助手消息的映射，提升性能
  const assistantsByAskId = new Map<string, Message[]>();
  const messagesById = new Map<string, Message>();

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    messagesById.set(msg.id, msg);
    messageIndexMap.set(msg.id, i);
    if (msg.role === 'assistant' && msg.askId) {
      const existing = assistantsByAskId.get(msg.askId) || [];
      existing.push(msg);
      assistantsByAskId.set(msg.askId, existing);
    }
  }

  for (let i = 0; i < messages.length; i++) {
    const message = messages[i];

    // 如果已处理过，跳过
    if (processedIds.has(message.id)) continue;

    // 检查是否是用户消息且有 mentions（多模型发送）
    if (message.role === 'user' && message.mentions && message.mentions.length > 0) {
      // 使用预构建的映射 O(1) 查找
      const assistantMessages = assistantsByAskId.get(message.id) || [];

      if (assistantMessages.length > 1) {
        // 多模型分组
        result.push({
          type: 'multi-model',
          userMessage: message,
          assistantMessages
        });

        // 标记所有相关消息为已处理
        processedIds.add(message.id);
        assistantMessages.forEach(m => processedIds.add(m.id));
        continue;
      }
    }

    // 检查是否是助手消息且属于多模型分组（已被上面处理）
    if (message.role === 'assistant' && message.askId) {
      const userMessage = messagesById.get(message.askId);
      if (userMessage?.mentions && userMessage.mentions.length > 0) {
        // 这条消息属于多模型分组，跳过（会在用户消息处理时一起处理）
        continue;
      }
    }

    // 普通消息
    result.push(message);
    processedIds.add(message.id);
  }

  return { groupedMessages: result, messageIndexMap };
};

export const isMultiModelGroup = (item: MessageOrGroup): item is MultiModelGroup => {
  return (item as MultiModelGroup).type === 'multi-model';
};
