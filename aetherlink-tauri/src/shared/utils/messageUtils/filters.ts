/**
 * 消息过滤工具函数 - 参考最佳实例架构
 * 统一处理消息去重、分组、过滤等逻辑
 */
import type { Message } from '../../types';
import { TopicStatsService } from '../../services/topics/TopicStatsService';
import { getMainTextContent } from '../messageUtils';

/**
 * 按照askId分组消息 - 参考最佳实例实现
 * @param messages 消息数组
 * @returns 分组后的消息对象
 */
export function getGroupedMessages(messages: Message[]): { [key: string]: (Message & { index: number })[] } {
  const groups: { [key: string]: (Message & { index: number })[] } = {};

  messages.forEach((message, index) => {
    // 用户消息使用自己的ID作为key，助手消息使用askId
    const key = message.role === 'user' ? message.id : (message.askId || message.id);

    if (!groups[key]) {
      groups[key] = [];
    }

    groups[key].push({ ...message, index });
    // 按索引排序，保持原始顺序
    groups[key].sort((a, b) => b.index - a.index);
  });

  return groups;
}

/**
 * 去重消息 - 统一的去重逻辑，参考最佳实例架构
 * @param messages 消息数组
 * @returns 去重后的消息数组
 */
export function deduplicateMessages(messages: Message[]): Message[] {
  if (!Array.isArray(messages) || messages.length === 0) {
    return [];
  }

  // 创建一个Map来存储已处理的消息，按照askId分组
  const messageGroups = new Map<string, Message[]>();

  // 按照askId分组消息
  messages.forEach(message => {
    // 用户消息使用自己的ID作为key
    const key = message.role === 'user' ? message.id : (message.askId || message.id);

    if (!messageGroups.has(key)) {
      messageGroups.set(key, []);
    }

    messageGroups.get(key)?.push(message);
  });

  // 从每个组中选择最新的消息
  const deduplicated: Message[] = [];

  messageGroups.forEach(group => {
    // 按创建时间排序
    const sorted = [...group].sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    // 用户消息只保留最新的一条
    if (sorted[0].role === 'user') {
      deduplicated.push(sorted[0]);
    } else {
      // 助手消息可能有多条（如重新生成的情况），全部保留
      deduplicated.push(...sorted);
    }
  });

  // 按创建时间排序
  return deduplicated.sort((a, b) =>
    new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );
}

/**
 * 过滤有用的消息 - 参考最佳实例实现
 * @param messages 消息数组
 * @returns 过滤后的消息数组
 */
export function filterUsefulMessages(messages: Message[]): Message[] {
  let _messages = [...messages];
  const groupedMessages = getGroupedMessages(messages);

  Object.entries(groupedMessages).forEach(([key, groupedMsgs]) => {
    if (key.startsWith('assistant') || groupedMsgs[0]?.role === 'assistant') {
      const usefulMessage = groupedMsgs.find((m) => m.useful === true);
      if (usefulMessage) {
        // 移除组中除有用消息外的所有消息
        groupedMsgs.forEach((m) => {
          if (m.id !== usefulMessage.id) {
            _messages = _messages.filter(msg => msg.id !== m.id);
          }
        });
      } else if (groupedMsgs.length > 0) {
        // 如果没有标记为有用的消息，保留最后一条
        const messagesToRemove = groupedMsgs.slice(0, -1);
        messagesToRemove.forEach((m) => {
          _messages = _messages.filter(msg => msg.id !== m.id);
        });
      }
    }
  });

  // 移除尾部的助手消息
  while (_messages.length > 0 && _messages[_messages.length - 1].role === 'assistant') {
    _messages.pop();
  }

  // 过滤相邻的用户消息，只保留最后一条
  _messages = _messages.filter((message, index, origin) => {
    return !(message.role === 'user' && index + 1 < origin.length && origin[index + 1].role === 'user');
  });

  return _messages;
}

/**
 * 过滤空消息 - 参考最佳实例实现
 * @param messages 消息数组
 * @returns 过滤后的消息数组
 */
export function filterEmptyMessages(messages: Message[]): Message[] {
  return messages.filter(message => {
    // 检查消息是否有blocks内容
    if (message.blocks && message.blocks.length > 0) {
      // 如果有blocks，假设就有内容
      return true;
    }

    // 检查是否有其他类型的内容（文件、图片等）
    if ((message as any).files && (message as any).files.length > 0) {
      return true;
    }

    // 检查是否有文本内容
    const textContent = getMainTextContent(message);
    if (textContent && textContent.trim()) {
      return true;
    }

    return false;
  });
}

/**
 * 过滤消息以确保从第一个用户消息开始 - 参考实现
 * @param messages 消息数组
 * @returns 过滤后的消息数组
 */
export function filterUserRoleStartMessages(messages: Message[]): Message[] {
  const firstUserMessageIndex = messages.findIndex((message) => message.role === 'user');

  if (firstUserMessageIndex === -1) {
    // 如果没有找到用户消息，返回原数组
    return messages;
  }

  return messages.slice(firstUserMessageIndex);
}

/**
 * 过滤上下文消息 - 从最后一个clear消息后开始
 * @param messages 消息数组
 * @returns 过滤后的消息数组
 */
export function filterContextMessages(messages: Message[]): Message[] {
  // 手动实现findLastIndex以兼容旧版本
  let clearIndex = -1;
  for (let i = messages.length - 1; i >= 0; i--) {
    if ((messages[i] as any).type === 'clear') {
      clearIndex = i;
      break;
    }
  }

  if (clearIndex === -1) {
    return messages;
  }

  return messages.slice(clearIndex + 1);
}

/**
 * 处理话题去重 - 用于备份等场景，使用统一的话题验证逻辑
 * @param topics 话题数组
 * @returns 去重后的话题数组
 */
export function deduplicateTopics<T extends { id: string; title?: string; messages?: any[] }>(topics: T[]): T[] {
  if (!Array.isArray(topics)) return [];

  console.log(`处理前话题数量: ${topics.length}`);

  // 使用统一的话题验证服务过滤有效话题
  const validTopics = TopicStatsService.getValidTopics(topics as any[]) as unknown as T[];

  // 使用Map进行话题去重，以id为key
  const uniqueTopicsMap = new Map<string, T>();

  validTopics.forEach(topic => {
    // 如果已存在相同ID的话题，选择消息更多的或更新的
    if (uniqueTopicsMap.has(topic.id)) {
      const existing = uniqueTopicsMap.get(topic.id)!;
      const existingMessageCount = Array.isArray(existing.messages) ? existing.messages.length : 0;
      const currentMessageCount = Array.isArray(topic.messages) ? topic.messages.length : 0;

      // 选择消息更多的话题
      if (currentMessageCount > existingMessageCount) {
        uniqueTopicsMap.set(topic.id, topic);
      }
    } else {
      uniqueTopicsMap.set(topic.id, topic);
    }
  });

  const result = Array.from(uniqueTopicsMap.values());
  console.log(`处理后话题数量: ${result.length}`);

  return result;
}
