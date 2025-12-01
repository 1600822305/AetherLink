/**
 * 队列管理模块
 * 统一管理 Topic 级别的消息队列
 * 
 * 参考 Cherry Studio 设计
 */

import { TopicQueue } from './TopicQueue';
import type { QueueConfig, QueueStatus } from './types';

export * from './types';
export { TopicQueue } from './TopicQueue';

// 全局队列管理
const topicQueues = new Map<string, TopicQueue>();

// 队列自动清理配置
const QUEUE_IDLE_TIMEOUT = 5 * 60 * 1000; // 5分钟空闲后清理
const cleanupTimers = new Map<string, NodeJS.Timeout>();

/**
 * 获取 Topic 队列
 * 如果不存在则创建新队列
 * 
 * @param topicId 话题 ID
 * @param config 队列配置
 * @returns Topic 队列实例
 */
export function getTopicQueue(topicId: string, config?: Partial<QueueConfig>): TopicQueue {
  // 清除清理定时器（如果有）
  const existingTimer = cleanupTimers.get(topicId);
  if (existingTimer) {
    clearTimeout(existingTimer);
    cleanupTimers.delete(topicId);
  }

  if (!topicQueues.has(topicId)) {
    topicQueues.set(topicId, new TopicQueue({
      concurrency: 1,
      timeout: 120000, // 2分钟超时
      ...config
    }));
  }
  
  return topicQueues.get(topicId)!;
}

/**
 * 等待 Topic 队列空闲
 * 
 * @param topicId 话题 ID
 */
export async function waitForTopicQueue(topicId: string): Promise<void> {
  const queue = topicQueues.get(topicId);
  if (queue) {
    await queue.onIdle();
    // 队列空闲后设置延迟清理
    scheduleQueueCleanup(topicId);
  }
}

/**
 * 清除 Topic 队列
 * 
 * @param topicId 话题 ID
 */
export function clearTopicQueue(topicId: string): void {
  const queue = topicQueues.get(topicId);
  if (queue) {
    queue.clear();
  }
  
  // 清除清理定时器
  const timer = cleanupTimers.get(topicId);
  if (timer) {
    clearTimeout(timer);
    cleanupTimers.delete(topicId);
  }
}

/**
 * 删除 Topic 队列
 * 
 * @param topicId 话题 ID
 */
export function deleteTopicQueue(topicId: string): void {
  clearTopicQueue(topicId);
  topicQueues.delete(topicId);
}

/**
 * 暂停 Topic 队列
 * 
 * @param topicId 话题 ID
 */
export function pauseTopicQueue(topicId: string): void {
  const queue = topicQueues.get(topicId);
  if (queue) {
    queue.pause();
  }
}

/**
 * 恢复 Topic 队列
 * 
 * @param topicId 话题 ID
 */
export function resumeTopicQueue(topicId: string): void {
  const queue = topicQueues.get(topicId);
  if (queue) {
    queue.resume();
  }
}

/**
 * 获取队列状态
 * 
 * @param topicId 话题 ID
 */
export function getQueueStatus(topicId: string): QueueStatus | null {
  const queue = topicQueues.get(topicId);
  return queue ? queue.getStatus() : null;
}

/**
 * 获取所有队列状态
 */
export function getAllQueueStatus(): Map<string, QueueStatus> {
  const statuses = new Map<string, QueueStatus>();
  topicQueues.forEach((queue, topicId) => {
    statuses.set(topicId, queue.getStatus());
  });
  return statuses;
}

/**
 * 清除所有队列
 */
export function clearAllQueues(): void {
  topicQueues.forEach(queue => queue.clear());
  topicQueues.clear();
  
  // 清除所有清理定时器
  cleanupTimers.forEach(timer => clearTimeout(timer));
  cleanupTimers.clear();
}

/**
 * 安排队列清理
 */
function scheduleQueueCleanup(topicId: string): void {
  const timer = setTimeout(() => {
    const queue = topicQueues.get(topicId);
    if (queue && queue.isEmpty) {
      topicQueues.delete(topicId);
      cleanupTimers.delete(topicId);
      console.log(`[QueueManager] 清理空闲队列: ${topicId}`);
    }
  }, QUEUE_IDLE_TIMEOUT);
  
  cleanupTimers.set(topicId, timer);
}

/**
 * 获取活跃队列数量
 */
export function getActiveQueueCount(): number {
  return topicQueues.size;
}

/**
 * 检查队列是否存在
 */
export function hasTopicQueue(topicId: string): boolean {
  return topicQueues.has(topicId);
}
