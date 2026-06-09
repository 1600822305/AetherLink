/**
 * messageRows - 把「按日期分组 + askId 多模型分组 + 分割线」拍平成一维行模型，
 * 供虚拟化列表按行窗口化渲染。
 *
 * 严格复刻现有 MessageGroup 的渲染单元，保证开启虚拟化前后视觉一致：
 * - 日期分组来自 getGroupedMessages（与旧路径一致）
 * - 组内多模型识别来自 groupMessagesByAskId（与旧路径一致）
 * - 单条消息后的对话分割线来自 shouldShowConversationDivider（与旧路径一致）
 *
 * 纯函数、不依赖 React/DOM，可单测。
 */
import type { Message } from '../../../shared/types/newMessage';
import {
  getGroupedMessages,
  MessageGroupingType,
} from '../../../shared/utils/messageGrouping';
import { shouldShowConversationDivider } from '../../../shared/utils/settingsUtils';
import {
  groupMessagesByAskId,
  isMultiModelGroup,
  type MessageOrGroup,
} from './askIdGrouping';

/** 日期标题行 */
export interface DateHeaderRow {
  kind: 'date-header';
  key: string;
  /** 原始分组键（日期/模型 id 等），渲染时用 dayjs 格式化 */
  date: string;
}

/** 消息/多模型分组行 */
export interface UnitRow {
  kind: 'unit';
  key: string;
  unit: MessageOrGroup;
  /** 单条消息在全局消息列表中的索引（多模型行为 -1，不使用） */
  messageIndex: number;
  /** 该单条消息后是否应渲染对话分割线（多模型行恒为 false） */
  showDivider: boolean;
}

export type MessageRow = DateHeaderRow | UnitRow;

/**
 * 构建拍平后的行模型。
 * @param messages 当前话题的完整消息列表（已排序）
 * @param groupingType 分组方式（byDate/byHour/byModel/disabled）
 */
export function buildMessageRows(
  messages: Message[],
  groupingType: MessageGroupingType
): MessageRow[] {
  const rows: MessageRow[] = [];
  if (messages.length === 0) return rows;

  const dateGroups = Object.entries(getGroupedMessages(messages, groupingType));
  const showDateHeader = groupingType !== MessageGroupingType.DISABLED;

  let globalStartIndex = 0;
  for (const [date, groupMessages] of dateGroups) {
    if (showDateHeader) {
      rows.push({ kind: 'date-header', key: `header-${date}`, date });
    }

    const { groupedMessages: units, messageIndexMap } =
      groupMessagesByAskId(groupMessages);

    for (const unit of units) {
      if (isMultiModelGroup(unit)) {
        rows.push({
          kind: 'unit',
          key: `multi-${unit.userMessage.id}`,
          unit,
          messageIndex: -1,
          showDivider: false,
        });
      } else {
        const indexInGroup = messageIndexMap.get(unit.id) ?? 0;
        rows.push({
          kind: 'unit',
          key: unit.id,
          unit,
          messageIndex: globalStartIndex + indexInGroup,
          showDivider: shouldShowConversationDivider(groupMessages, indexInGroup),
        });
      }
    }

    globalStartIndex += groupMessages.length;
  }

  return rows;
}

/** 收集某段行区间内涉及的所有 block id（用于按可视区懒加载） */
export function collectBlockIdsForRows(rows: MessageRow[]): string[] {
  const ids: string[] = [];
  for (const row of rows) {
    if (row.kind !== 'unit') continue;
    const { unit } = row;
    if (isMultiModelGroup(unit)) {
      pushBlocks(ids, unit.userMessage);
      unit.assistantMessages.forEach((m) => pushBlocks(ids, m));
    } else {
      pushBlocks(ids, unit);
    }
  }
  return ids;
}

function pushBlocks(target: string[], message: Message): void {
  if (message.blocks && message.blocks.length > 0) {
    target.push(...message.blocks);
  }
}
