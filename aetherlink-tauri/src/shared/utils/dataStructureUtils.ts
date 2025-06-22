import { AssistantService } from '../services';
import { TopicService } from '../services/topics/TopicService';
import type { Assistant } from '../types/Assistant';
import type { ChatTopic } from '../types';

/**
 * 获取助手数据
 */
export async function getAssistantData(): Promise<{
  assistants: Assistant[];
}> {
  const assistants = await AssistantService.getUserAssistants();
  return {
    assistants
  };
}

/**
 * 获取指定助手的所有话题
 */
export async function getAssistantTopics(
  assistantId: string
): Promise<ChatTopic[]> {
  const allTopics = await TopicService.getAllTopics();
  const assistantTopicIds = await AssistantService.getAssistantTopics(assistantId);
  return allTopics.filter(topic => assistantTopicIds.includes(topic.id));
}

/**
 * 保存助手数据
 */
export async function saveAssistantData(
  assistant: Assistant
): Promise<boolean> {
  return await AssistantService.updateAssistant(assistant);
}

/**
 * 将话题添加到助手
 */
export async function addTopicToAssistant(
  assistantId: string,
  topicId: string,
  topicData?: ChatTopic
): Promise<boolean> {
  if (topicData) {
    // 先保存话题
    await TopicService.saveTopic(topicData);
  }

  // 添加话题到助手
  return await AssistantService.addTopicToAssistant(assistantId, topicId);
}

/**
 * 从助手中移除话题
 */
export async function removeTopicFromAssistant(
  assistantId: string,
  topicId: string
): Promise<boolean> {
  return await AssistantService.removeTopicFromAssistant(assistantId, topicId);
}