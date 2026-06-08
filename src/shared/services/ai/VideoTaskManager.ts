import type { Model } from '../../types';
import { log } from '../infra/LoggerService';
import { TopicService } from '../topics/TopicService';
import { MessageBlockStatus } from '../../types/newMessage';
import store from '../../store';
import { updateOneBlock } from '../../store/slices/messageBlocksSlice';
import { newMessagesActions } from '../../store/slices/newMessagesSlice';
import { AssistantMessageStatus } from '../../types/newMessage';
import { getStorageItem, setStorageItem } from '../../utils/storage';
import { messageBlockRepository } from '../messages/MessageBlockRepository';

/**
 * 视频生成任务接口
 */
export interface VideoTask {
  id: string;
  requestId: string;
  messageId: string;
  blockId: string;
  model: Model;
  prompt: string;
  startTime: string;
  status: 'pending' | 'processing';
}

/**
 * 视频任务管理器 - 简单实现，支持应用关闭后继续轮询
 */
export class VideoTaskManager {
  private static readonly STORAGE_KEY = 'video-generation-tasks';
  private static readonly MAX_TASK_AGE = 30 * 60 * 1000; // 30分钟超时

  /**
   * 保存视频生成任务
   */
  static async saveTask(task: VideoTask): Promise<void> {
    try {
      const tasks = await this.getTasks();
      tasks[task.id] = task;
      await setStorageItem(this.STORAGE_KEY, tasks);
      log('INFO', `保存视频生成任务: ${task.id}`, { requestId: task.requestId });
    } catch (error) {
      log('ERROR', '保存视频任务失败', { error, taskId: task.id });
    }
  }

  /**
   * 删除视频生成任务
   */
  static async removeTask(taskId: string): Promise<void> {
    try {
      const tasks = await this.getTasks();
      delete tasks[taskId];
      await setStorageItem(this.STORAGE_KEY, tasks);
      log('INFO', `删除视频生成任务: ${taskId}`);
    } catch (error) {
      log('ERROR', '删除视频任务失败', { error, taskId });
    }
  }

  /**
   * 获取所有任务
   */
  static async getTasks(): Promise<Record<string, VideoTask>> {
    try {
      const tasks = await getStorageItem<Record<string, VideoTask>>(this.STORAGE_KEY);
      if (!tasks) return {};
      
      // 清理过期任务
      const now = Date.now();
      const validTasks: Record<string, VideoTask> = {};
      
      for (const [id, task] of Object.entries(tasks)) {
        const taskAge = now - new Date(task.startTime).getTime();
        if (taskAge < this.MAX_TASK_AGE) {
          validTasks[id] = task;
        } else {
          log('INFO', `清理过期视频任务: ${id}`, { age: taskAge });
        }
      }
      
      // 如果清理了任务，更新存储
      if (Object.keys(validTasks).length !== Object.keys(tasks).length) {
        await setStorageItem(this.STORAGE_KEY, validTasks);
      }
      
      return validTasks;
    } catch (error) {
      log('ERROR', '获取视频任务失败', { error });
      return {};
    }
  }

  /**
   * 恢复未完成的视频生成任务
   */
  static async resumeTasks(): Promise<void> {
    const tasks = await this.getTasks();
    const taskList = Object.values(tasks);
    
    if (taskList.length === 0) {
      log('INFO', '没有需要恢复的视频生成任务');
      return;
    }
    
    log('INFO', `发现 ${taskList.length} 个未完成的视频生成任务，开始恢复`);
    
    // 并行恢复所有任务
    const resumePromises = taskList.map(task => this.resumeTask(task));
    await Promise.allSettled(resumePromises);
  }

  /**
   * 恢复单个任务
   */
  private static async resumeTask(task: VideoTask): Promise<void> {
    try {
      log('INFO', `恢复视频生成任务: ${task.id}`, { 
        requestId: task.requestId,
        prompt: task.prompt.substring(0, 50)
      });

      // 更新消息状态为处理中
      await this.updateTaskStatus(task, '🎬 正在恢复视频生成，请稍候...\n\n视频生成通常需要几分钟时间，请耐心等待。');

      // 继续轮询视频状态
      const videoUrl = await this.pollVideoStatus(task);
      
      // 生成成功，创建视频块
      await this.completeTask(task, videoUrl);
      
    } catch (error) {
      log('ERROR', `恢复视频任务失败: ${task.id}`, { error });
      await this.failTask(task, error instanceof Error ? error.message : String(error));
    }
  }

  /**
   * 轮询视频状态 - 支持多个提供商
   */
  private static async pollVideoStatus(task: VideoTask): Promise<string> {
    const apiKey = task.model.apiKey;

    if (!apiKey) {
      throw new Error('API密钥未设置');
    }

    // 检查是否是Google Veo任务（通过模型ID或操作名称格式识别）
    const isGoogleVeoTask = task.model.id === 'veo-2.0-generate-001' ||
                           task.model.provider === 'google' ||
                           task.requestId.startsWith('operations/');

    if (isGoogleVeoTask) {
      // 使用Google Veo轮询
      const { pollVeoOperation } = await import('../../api/gemini-aisdk/veo');
      return await pollVeoOperation(apiKey, task.requestId);
    }

    // 硅基流动等OpenAI兼容API
    const baseUrl = task.model.baseUrl || 'https://api.siliconflow.cn/v1';
    return await this.pollVideoStatusInternal(baseUrl, apiKey, task.requestId);
  }

  /**
   * 内部轮询函数 - 直接使用video.ts中的导出函数
   */
  private static async pollVideoStatusInternal(
    baseUrl: string,
    apiKey: string,
    requestId: string
  ): Promise<string> {
    const maxAttempts = 60;
    const pollInterval = 10000;
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        log('INFO', `轮询视频状态 (${attempt}/${maxAttempts})`, { requestId });

        const response = await fetch(`${baseUrl}/video/status`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ requestId })
        });

        if (!response.ok) {
          if (response.status >= 400 && response.status < 500) {
            throw new Error(`轮询状态失败: ${response.status} ${response.statusText}`);
          }
          if (attempt < maxAttempts) {
            await this.sleep(pollInterval);
            continue;
          } else {
            throw new Error(`轮询状态失败: ${response.status} ${response.statusText}`);
          }
        }

        const result: any = await response.json();
        log('INFO', `视频状态: ${result.status}`, { requestId, attempt });

        switch (result.status) {
          case 'completed':
          case 'Succeed':
            const videoUrl = result.results?.videos?.[0]?.url ||
                            result.video_url ||
                            (result.videos && result.videos[0]) ||
                            null;

            if (!videoUrl) {
              throw new Error('视频生成完成但未返回视频URL');
            }

            return videoUrl;

          case 'failed':
            throw new Error(`视频生成失败: ${result.error || '未知错误'}`);

          case 'pending':
          case 'processing':
          case 'InQueue':
            if (attempt < maxAttempts) {
              await this.sleep(pollInterval);
              break;
            } else {
              throw new Error('视频生成超时，请稍后重试');
            }

          default:
            log('WARN', `未知的视频状态: ${result.status}`, { requestId, result });
            if (attempt < maxAttempts) {
              await this.sleep(pollInterval);
              break;
            } else {
              throw new Error(`视频生成状态异常: ${result.status}`);
            }
        }

      } catch (error: any) {
        if (attempt >= maxAttempts) {
          throw error;
        }
        await this.sleep(pollInterval);
      }
    }

    throw new Error('视频生成超时，请稍后重试');
  }

  /**
   * 更新任务状态
   */
  private static async updateTaskStatus(task: VideoTask, content: string): Promise<void> {
    try {
      // 更新文本块内容
      await TopicService.updateMessageBlockFields(task.blockId, {
        content,
        status: MessageBlockStatus.PROCESSING
      });

      // 更新Redux状态
      store.dispatch(updateOneBlock({
        id: task.blockId,
        changes: {
          content,
          status: MessageBlockStatus.PROCESSING,
          updatedAt: new Date().toISOString()
        }
      }));
    } catch (error) {
      log('ERROR', '更新任务状态失败', { error, taskId: task.id });
    }
  }

  /**
   * 完成任务
   */
  private static async completeTask(task: VideoTask, videoUrl: string): Promise<void> {
    try {
      // 更新文本内容
      const videoContent = `🎬 视频生成完成！\n\n**提示词：** ${task.prompt}\n\n**生成时间：** ${new Date().toLocaleString()}\n\n**模型：** ${task.model.name || task.model.id}`;

      await TopicService.updateMessageBlockFields(task.blockId, {
        content: videoContent,
        status: MessageBlockStatus.SUCCESS
      });

      // 创建视频块

      const videoBlock = {
        id: `video-${Date.now()}`,
        type: 'video' as const,
        messageId: task.messageId,
        url: videoUrl,
        mimeType: 'video/mp4',
        status: MessageBlockStatus.SUCCESS,
        width: 1280,
        height: 720,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await messageBlockRepository.createBlockAndAttach(videoBlock);

      // 更新消息状态为成功
      store.dispatch(newMessagesActions.updateMessage({
        id: task.messageId,
        changes: {
          status: AssistantMessageStatus.SUCCESS,
          updatedAt: new Date().toISOString()
        }
      }));

      // 删除任务
      await this.removeTask(task.id);
      
      log('INFO', `视频生成任务完成: ${task.id}`, { videoUrl: videoUrl.substring(0, 50) });
      
    } catch (error) {
      log('ERROR', '完成视频任务失败', { error, taskId: task.id });
      throw error;
    }
  }

  /**
   * 任务失败
   */
  private static async failTask(task: VideoTask, errorMessage: string): Promise<void> {
    try {
      await TopicService.updateMessageBlockFields(task.blockId, {
        content: `❌ 视频生成失败：${errorMessage}`,
        status: MessageBlockStatus.ERROR
      });

      store.dispatch(newMessagesActions.updateMessage({
        id: task.messageId,
        changes: {
          status: AssistantMessageStatus.ERROR,
          updatedAt: new Date().toISOString()
        }
      }));

      // 删除任务
      await this.removeTask(task.id);
      
      log('ERROR', `视频生成任务失败: ${task.id}`, { error: errorMessage });
      
    } catch (error) {
      log('ERROR', '处理视频任务失败失败', { error, taskId: task.id });
    }
  }

  /**
   * 睡眠函数
   */
  private static sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
