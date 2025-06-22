import { useMemo } from 'react';
import { useSelector } from 'react-redux';
import type { RootState } from '../../../../shared/store';
import type { ChatTopic } from '../../../../shared/types';

/**
 * 话题分组钩子
 *
 * 用于管理话题分组相关的状态和操作
 */
export function useTopicGroups(topics: ChatTopic[], assistantId?: string) {
  // 从Redux获取分组数据
  const { groups, topicGroupMap } = useSelector((state: RootState) => state.groups);

  // 获取当前助手的话题分组
  const topicGroups = useMemo(() => {
    if (!assistantId) return [];

    return groups
      .filter(group => group.type === 'topic' && group.assistantId === assistantId)
      .sort((a, b) => a.order - b.order);
  }, [groups, assistantId]);

  // 获取当前助手的话题分组映射
  const currentTopicGroupMap = useMemo(() => {
    if (!assistantId) return {};
    return topicGroupMap[assistantId] || {};
  }, [topicGroupMap, assistantId]);

  // 获取未分组的话题并排序
  const ungroupedTopics = useMemo(() => {
    const filtered = topics.filter(topic => !currentTopicGroupMap[topic.id]);

    // 对未分组话题进行排序：固定的在前面，然后按时间降序
    return filtered.sort((a, b) => {
      // 首先按固定状态排序，固定的话题在前面
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;

      // 如果固定状态相同，按最后消息时间降序排序（最新的在前面）
      const timeA = new Date(a.lastMessageTime || a.updatedAt || a.createdAt || 0).getTime();
      const timeB = new Date(b.lastMessageTime || b.updatedAt || b.createdAt || 0).getTime();
      return timeB - timeA; // 降序排序
    });
  }, [topics, currentTopicGroupMap]);

  return {
    topicGroups,
    topicGroupMap: currentTopicGroupMap,
    ungroupedTopics
  };
}