import { useCallback } from 'react';
import { newMessagesActions } from '../../../shared/store/slices/newMessagesSlice';
import { upsertOneBlock } from '../../../shared/store/slices/messageBlocksSlice';
import { dexieStorage } from '../../../shared/services/storage/DexieStorageService';
import {
  createUserMessage,
  createAssistantMessage
} from '../../../shared/utils/messageUtils';
import {
  MessageBlockType,
  MessageBlockStatus,
  AssistantMessageStatus
} from '../../../shared/types/newMessage.ts';

import store from '../../../shared/store';
import { TopicService } from '../../../shared/services/topics/TopicService';
import { VideoTaskManager } from '../../../shared/services/ai/VideoTaskManager';
import type { SiliconFlowImageFormat, GoogleVeoParams, Model, ChatTopic } from '../../../shared/types';

/**
 * 处理视频生成完整流程的钩子
 * 支持 Google Veo 和硅基流动等 OpenAI 兼容 API
 */
export const useVideoGeneration = (
  currentTopic: ChatTopic | null,
  selectedModel: Model | null
) => {

  // 处理视频生成提示词
  const handleVideoPrompt = useCallback(async (prompt: string, images?: SiliconFlowImageFormat[], files?: any[]) => {
    if (!currentTopic || !prompt.trim() || !selectedModel) return;

    console.log(`[useVideoGeneration] 处理视频生成提示词: ${prompt}`);
    console.log(`[useVideoGeneration] 使用模型: ${selectedModel.id}`);

    // 检查模型是否支持视频生成
    const isVideoModel = selectedModel.modelTypes?.includes('video_gen') ||
                        selectedModel.videoGeneration ||
                        selectedModel.capabilities?.videoGeneration ||
                        selectedModel.id.includes('HunyuanVideo') ||
                        selectedModel.id.includes('Wan-AI/Wan2.1-T2V') ||
                        selectedModel.id.includes('Wan-AI/Wan2.1-I2V') ||
                        selectedModel.id.toLowerCase().includes('video');

    // 🔧 修复：即使模型不支持，也要先保存用户消息
    const { message: userMessage, blocks: userBlocks } = createUserMessage({
      content: prompt,
      assistantId: currentTopic.assistantId,
      topicId: currentTopic.id,
      modelId: selectedModel.id,
      model: selectedModel,
      images: images?.map(img => ({ url: img.image_url?.url || '' })),
      files: files?.map(file => file.fileRecord).filter(Boolean)
    });

    await TopicService.saveMessageAndBlocks(userMessage, userBlocks);

    if (!isVideoModel) {
      console.error(`[useVideoGeneration] 模型 ${selectedModel.name || selectedModel.id} 不支持视频生成`);
      // 创建错误消息
      const { message: errorMessage, blocks: errorBlocks } = createAssistantMessage({
        assistantId: currentTopic.assistantId,
        topicId: currentTopic.id,
        askId: userMessage.id, // 🔧 修复：使用正确的 askId
        modelId: selectedModel.id,
        model: selectedModel,
        status: AssistantMessageStatus.ERROR
      });

      const mainTextBlock = errorBlocks.find((block: any) => block.type === MessageBlockType.MAIN_TEXT);
      if (mainTextBlock && 'content' in mainTextBlock) {
        mainTextBlock.content = `❌ 模型 ${selectedModel.name || selectedModel.id} 不支持视频生成。请选择支持视频生成的模型，如 HunyuanVideo 或 Wan-AI 系列模型。`;
        mainTextBlock.status = MessageBlockStatus.ERROR;
      }

      await TopicService.saveMessageAndBlocks(errorMessage, errorBlocks);
      return;
    }

    // 创建助手消息（视频生成中）- 用户消息已在上面创建
    const { message: assistantMessage, blocks: assistantBlocks } = createAssistantMessage({
      assistantId: currentTopic.assistantId,
      topicId: currentTopic.id,
      askId: userMessage.id,
      modelId: selectedModel.id,
      model: selectedModel,
      status: AssistantMessageStatus.PROCESSING
    });

    const mainTextBlock = assistantBlocks.find((block: any) => block.type === MessageBlockType.MAIN_TEXT);
    if (mainTextBlock && 'content' in mainTextBlock) {
      mainTextBlock.content = '🎬 正在生成视频，请稍候...\n\n视频生成通常需要几分钟时间，请耐心等待。';
      mainTextBlock.status = MessageBlockStatus.PROCESSING;
    }

    await TopicService.saveMessageAndBlocks(assistantMessage, assistantBlocks);

    // 创建任务ID
    const taskId = `video-task-${Date.now()}`;

    try {
      // 调用视频生成API，但是我们需要拦截requestId
      console.log('[useVideoGeneration] 开始调用视频生成API');

      // 创建一个自定义的视频生成函数，支持多个提供商
      const generateVideoWithTaskSaving = async () => {
        // 检查是否是Google Veo模型
        if (selectedModel.id === 'veo-2.0-generate-001' || selectedModel.provider === 'google') {
          // 使用Google Veo API - 分离提交和轮询以支持任务恢复
          const { submitVeoGeneration, pollVeoOperation } = await import('../../../shared/api/gemini-aisdk/veo');

          if (!selectedModel.apiKey) {
            throw new Error('Google API密钥未设置');
          }

          // 构建Google Veo参数
          const veoParams: GoogleVeoParams = {
            prompt: prompt,
            aspectRatio: '16:9',
            personGeneration: 'dont_allow',
            durationSeconds: 8,
            enhancePrompt: true
          };

          // 如果有参考图片，添加到参数中
          if (images && images.length > 0) {
            veoParams.image = images[0].image_url?.url;
          }

          // 先提交请求获取操作名称
          const operationName = await submitVeoGeneration(selectedModel.apiKey, veoParams);

          console.log('[useVideoGeneration] 获得Google Veo操作名称:', operationName);

          // 保存任务，使用操作名称作为requestId以支持恢复
          VideoTaskManager.saveTask({
            id: taskId,
            requestId: operationName, // 使用操作名称，支持任务恢复
            messageId: assistantMessage.id,
            blockId: mainTextBlock?.id || '',
            model: selectedModel,
            prompt: prompt,
            startTime: new Date().toISOString(),
            status: 'processing'
          });

          // 继续轮询获取结果
          const videoUrl = await pollVeoOperation(selectedModel.apiKey, operationName);

          return { url: videoUrl };
        } else {
          // 使用硅基流动等OpenAI兼容API
          const { submitVideoGeneration, pollVideoStatusInternal } = await import('../../../shared/api/openai/video');

          // 先提交视频生成请求获取requestId
          const requestId = await submitVideoGeneration(
            selectedModel.baseUrl || 'https://api.siliconflow.cn/v1',
            selectedModel.apiKey!,
            selectedModel.id,
            {
              prompt: prompt,
              image_size: '1280x720',
              image: images && images.length > 0 ? images[0].image_url?.url : undefined
            }
          );

          console.log('[useVideoGeneration] 获得requestId:', requestId);

          // 立即保存任务到本地存储，包含正确的requestId
          VideoTaskManager.saveTask({
            id: taskId,
            requestId: requestId,
            messageId: assistantMessage.id,
            blockId: mainTextBlock?.id || '',
            model: selectedModel,
            prompt: prompt,
            startTime: new Date().toISOString(),
            status: 'processing'
          });

          // 继续轮询获取结果
          const videoUrl = await pollVideoStatusInternal(
            selectedModel.baseUrl || 'https://api.siliconflow.cn/v1',
            selectedModel.apiKey!,
            requestId
          );

          return { url: videoUrl };
        }
      };

      const videoResult = await generateVideoWithTaskSaving();

      // 更新消息内容为生成的视频
      const videoContent = `🎬 视频生成完成！\n\n**提示词：** ${prompt}\n\n**生成时间：** ${new Date().toLocaleString()}\n\n**模型：** ${selectedModel.name || selectedModel.id}`;

      if (mainTextBlock && mainTextBlock.id) {
        await TopicService.updateMessageBlockFields(mainTextBlock.id, {
          content: videoContent,
          status: MessageBlockStatus.SUCCESS
        });

        // 创建视频块 - 使用正确的字段结构
        const videoBlock = {
          id: `video-${Date.now()}`,
          type: MessageBlockType.VIDEO,
          messageId: assistantMessage.id,
          url: videoResult.url, // 视频URL存储在url字段
          mimeType: 'video/mp4', // 默认视频格式
          status: MessageBlockStatus.SUCCESS,
          width: 1280, // 默认宽度
          height: 720, // 默认高度
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        // 添加视频块到Redux状态
        store.dispatch(upsertOneBlock(videoBlock));

        // 更新消息的blocks数组
        const updatedBlocks = [...(assistantMessage.blocks || []), videoBlock.id];
        store.dispatch(newMessagesActions.updateMessage({
          id: assistantMessage.id,
          changes: { blocks: updatedBlocks }
        }));

        // 保存到数据库
        await dexieStorage.updateMessage(assistantMessage.id, { blocks: updatedBlocks });
        await dexieStorage.saveMessageBlock(videoBlock);
      }

      // 更新消息状态为成功
      store.dispatch(newMessagesActions.updateMessage({
        id: assistantMessage.id,
        changes: {
          status: AssistantMessageStatus.SUCCESS,
          updatedAt: new Date().toISOString()
        }
      }));

      // 删除任务（生成成功）
      VideoTaskManager.removeTask(taskId);

    } catch (error) {
      console.error('[useVideoGeneration] 视频生成失败:', error);

      // 更新为错误消息
      if (mainTextBlock && mainTextBlock.id) {
        await TopicService.updateMessageBlockFields(mainTextBlock.id, {
          content: `❌ 视频生成失败：${error instanceof Error ? error.message : String(error)}`,
          status: MessageBlockStatus.ERROR
        });
      }

      store.dispatch(newMessagesActions.updateMessage({
        id: assistantMessage.id,
        changes: {
          status: AssistantMessageStatus.ERROR,
          updatedAt: new Date().toISOString()
        }
      }));

      // 删除任务（生成失败）
      VideoTaskManager.removeTask(taskId);
    }
  }, [currentTopic, selectedModel]);

  return { handleVideoPrompt };
};
