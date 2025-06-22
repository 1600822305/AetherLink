import { format } from 'date-fns';
import type { Message } from '../types/newMessage';

/**
 * 消息分组类型
 */
export const MessageGroupingType = {
  BY_DATE: 'byDate',
  BY_MODEL: 'byModel',
  BY_HOUR: 'byHour',
  DISABLED: 'disabled',
} as const;

export type MessageGroupingType = typeof MessageGroupingType[keyof typeof MessageGroupingType];

/**
 * 按日期对消息进行分组
 * @param messages 消息列表
 * @returns 分组后的消息，格式为 { [日期]: Message[] }
 */
export function groupMessagesByDate(messages: Message[]): Record<string, Message[]> {
  const groups: Record<string, Message[]> = {};

  messages.forEach((message) => {
    const date = message.createdAt ? new Date(message.createdAt) : new Date();
    const dateKey = format(date, 'yyyy-MM-dd');

    if (!groups[dateKey]) {
      groups[dateKey] = [];
    }

    groups[dateKey].push(message);
  });

  return groups;
}

/**
 * 按小时对消息进行分组
 * @param messages 消息列表
 * @returns 分组后的消息，格式为 { [日期+小时]: Message[] }
 */
export function groupMessagesByHour(messages: Message[]): Record<string, Message[]> {
  const groups: Record<string, Message[]> = {};

  messages.forEach((message) => {
    const date = message.createdAt ? new Date(message.createdAt) : new Date();
    const dateKey = format(date, 'yyyy-MM-dd HH:00');

    if (!groups[dateKey]) {
      groups[dateKey] = [];
    }

    groups[dateKey].push(message);
  });

  return groups;
}

/**
 * 按模型对消息进行分组
 * @param messages 消息列表
 * @returns 分组后的消息，格式为 { [模型ID]: Message[] }
 */
export function groupMessagesByModel(messages: Message[]): Record<string, Message[]> {
  const groups: Record<string, Message[]> = {};

  messages.forEach((message) => {
    // 用户消息放在一组
    if (message.role === 'user') {
      const key = 'user';
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(message);
      return;
    }

    // 助手消息按模型分组
    const modelId = message.modelId || 'unknown';
    if (!groups[modelId]) {
      groups[modelId] = [];
    }

    groups[modelId].push(message);
  });

  return groups;
}

/**
 * 根据分组类型对消息进行分组
 * @param messages 消息列表
 * @param groupingType 分组类型
 * @returns 分组后的消息
 */
export function getGroupedMessages(
  messages: Message[],
  groupingType: MessageGroupingType = MessageGroupingType.BY_DATE
): Record<string, Message[]> {
  if (groupingType === MessageGroupingType.DISABLED) {
    // 不分组，每条消息单独一组
    const groups: Record<string, Message[]> = {};
    messages.forEach((message) => {
      groups[message.id] = [message];
    });
    return groups;
  }

  if (groupingType === MessageGroupingType.BY_MODEL) {
    return groupMessagesByModel(messages);
  }

  if (groupingType === MessageGroupingType.BY_HOUR) {
    return groupMessagesByHour(messages);
  }

  // 默认按日期分组
  return groupMessagesByDate(messages);
}

/**
 * 获取分组的显示名称
 * @param groupKey 分组键
 * @param groupingType 分组类型
 * @returns 分组显示名称
 */
export function getGroupDisplayName(
  groupKey: string,
  groupingType: MessageGroupingType
): string {
  if (groupingType === MessageGroupingType.BY_MODEL) {
    if (groupKey === 'user') {
      return '用户消息';
    }
    return `模型: ${groupKey}`;
  }

  // 日期或小时分组直接返回键名
  return groupKey;
}
