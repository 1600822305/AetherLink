import { useState, useCallback } from 'react';
import { useDispatch } from 'react-redux';
import { newMessagesActions } from '../../../shared/store/slices/newMessagesSlice';
import { upsertOneBlock, upsertManyBlocks } from '../../../shared/store/slices/messageBlocksSlice';
import { dexieStorage } from '../../../shared/services/storage/DexieStorageService';
import {
  createUserMessage,
  createAssistantMessage
} from '../../../shared/utils/messageUtils';
import { processAssistantResponse } from '../../../shared/store/thunks/message/assistantResponse';
import {
  MessageBlockType,
  MessageBlockStatus,
  AssistantMessageStatus
} from '../../../shared/types/newMessage.ts';
import type { MessageBlock } from '../../../shared/types/newMessage.ts';

import { abortCompletion } from '../../../shared/utils/abortController';
import store from '../../../shared/store';
import { setActiveProviderId } from '../../../shared/store/slices/webSearchSlice';
import { TopicService } from '../../../shared/services/topics/TopicService';
import { VideoTaskManager } from '../../../shared/services/ai/VideoTaskManager';
import type { SiliconFlowImageFormat, GoogleVeoParams, Model, ChatTopic } from '../../../shared/types';
import type { Message } from '../../../shared/types/newMessage.ts';

/**
 * 互斥模式类型
 */
type ExclusiveMode = 'image' | 'video' | 'webSearch' | null;

/**
 * 处理聊天特殊功能相关的钩子
 * 包括图像生成、网络搜索、URL抓取等功能
 */
export const useChatFeatures = (
  currentTopic: ChatTopic | null,
  currentMessages: Message[],
  selectedModel: Model | null,
  handleSendMessage: (content: string, images?: SiliconFlowImageFormat[], toolsEnabled?: boolean, files?: any[]) => void
) => {
  const dispatch = useDispatch();
  
  // 统一管理互斥模式状态
  const [activeMode, setActiveMode] = useState<ExclusiveMode>(null);
  
  // MCP 工具开关状态 - 从 localStorage 读取并持久化
  const [toolsEnabled, setToolsEnabled] = useState(() => {
    const saved = localStorage.getItem('mcp-tools-enabled');
    return saved !== null ? JSON.parse(saved) : false; // 默认关闭
  });

  // MCP 工具调用模式 - 从 localStorage 读取
  const [mcpMode, setMcpMode] = useState<'prompt' | 'function'>(() => {
    const saved = localStorage.getItem('mcp-mode');
    return (saved as 'prompt' | 'function') || 'function';
  });

  // 派生状态：各模式是否激活
  const webSearchActive = activeMode === 'webSearch';
  const imageGenerationMode = activeMode === 'image';
  const videoGenerationMode = activeMode === 'video';

  /**
   * 通用的互斥模式切换函数
   * 切换到某个模式时会自动关闭其他模式
   */
  const toggleMode = useCallback((mode: ExclusiveMode) => {
    setActiveMode(prev => {
      if (prev === mode) {
        // 关闭当前模式
        if (mode === 'webSearch') {
          // 关闭搜索模式时，清除 activeProviderId
          dispatch(setActiveProviderId(undefined));
        }
        return null;
      }
      // 切换到新模式
      return mode;
    });
  }, [dispatch]);

  // 切换图像生成模式
  const toggleImageGenerationMode = useCallback(() => {
    toggleMode('image');
  }, [toggleMode]);

  // 切换视频生成模式
  const toggleVideoGenerationMode = useCallback(() => {
    toggleMode('video');
  }, [toggleMode]);

  // 切换网络搜索模式
  const toggleWebSearch = useCallback(() => {
    toggleMode('webSearch');
  }, [toggleMode]);

  // 处理图像生成提示词
  const handleImagePrompt = (prompt: string, images?: SiliconFlowImageFormat[], files?: any[]) => {
    if (!currentTopic || !prompt.trim() || !selectedModel) return;

    console.log(`[useChatFeatures] 处理图像生成提示词: ${prompt}`);
    console.log(`[useChatFeatures] 使用模型: ${selectedModel.id}`);

    // 直接使用正常的消息发送流程，让messageThunk处理图像生成
    // 不再调用handleSendMessage，避免重复发送
    handleSendMessage(prompt, images, false, files); // 禁用工具，因为图像生成不需要工具
  };

  // 处理视频生成提示词
  const handleVideoPrompt = async (prompt: string, images?: SiliconFlowImageFormat[], files?: any[]) => {
    if (!currentTopic || !prompt.trim() || !selectedModel) return;

    console.log(`[useChatFeatures] 处理视频生成提示词: ${prompt}`);
    console.log(`[useChatFeatures] 使用模型: ${selectedModel.id}`);

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
      console.error(`[useChatFeatures] 模型 ${selectedModel.name || selectedModel.id} 不支持视频生成`);
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
      console.log('[useChatFeatures] 开始调用视频生成API');

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

          console.log('[useChatFeatures] 获得Google Veo操作名称:', operationName);

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

          console.log('[useChatFeatures] 获得requestId:', requestId);

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
      console.error('[useChatFeatures] 视频生成失败:', error);

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
  };

  // 处理停止响应点击事件 - 参考 Cherry Studio 的 pauseMessages 实现
  const handleStopResponseClick = () => {
    if (!currentTopic) return;

    // 找到所有正在处理的助手消息（包括 processing、pending、searching 状态）
    const streamingMessages = currentMessages.filter(
      m => m.role === 'assistant' &&
      (m.status === AssistantMessageStatus.PROCESSING ||
       m.status === AssistantMessageStatus.PENDING ||
       m.status === AssistantMessageStatus.SEARCHING)
    );

    // 收集所有唯一的 askId 并中断
    const askIds = [...new Set(streamingMessages?.map((m) => m.askId).filter((id) => !!id) as string[])];
    for (const askId of askIds) {
      abortCompletion(askId);
    }

    // 关键：强制重置 loading 和 streaming 状态（参考 Cherry Studio）
    dispatch(newMessagesActions.setTopicLoading({ topicId: currentTopic.id, loading: false }));
    dispatch(newMessagesActions.setTopicStreaming({ topicId: currentTopic.id, streaming: false }));

    // 更新所有正在处理的消息状态为成功
    streamingMessages.forEach(message => {
      dispatch(newMessagesActions.updateMessage({
        id: message.id,
        changes: {
          status: AssistantMessageStatus.SUCCESS,
          updatedAt: new Date().toISOString()
        }
      }));
    });
  };

  // 处理消息发送
  const handleMessageSend = async (content: string, images?: SiliconFlowImageFormat[], toolsEnabledParam?: boolean, files?: any[]) => {
    // 如果处于图像生成模式，则调用图像生成处理函数
    if (imageGenerationMode) {
      handleImagePrompt(content, images, files);
      // 关闭图像生成模式
      setActiveMode(null);
      return;
    }

    // 如果处于视频生成模式，则调用视频生成处理函数
    if (videoGenerationMode) {
      await handleVideoPrompt(content, images, files);
      // 关闭视频生成模式
      setActiveMode(null);
      return;
    }

    // 如果处于网络搜索模式 - 使用自动模式，让 AI 自主决定是否搜索
    if (webSearchActive) {
      // 🚀 自动模式：将搜索提供商设置到助手配置，让 AI 自主决定是否搜索
      // 通过正常的消息发送流程，assistantResponse.ts 会检测 webSearchProviderId 并添加搜索工具
      console.log('[WebSearch] 自动模式：AI 将自主决定是否需要搜索');
      handleSendMessage(content, images, toolsEnabledParam, files);
      return;
    }

    // 普通消息发送
    handleSendMessage(content, images, toolsEnabledParam, files);
  };

  // MCP 工具开关切换
  const toggleToolsEnabled = useCallback(() => {
    setToolsEnabled((prev: boolean) => {
      const newValue = !prev;
      localStorage.setItem('mcp-tools-enabled', JSON.stringify(newValue));
      return newValue;
    });
  }, []);

  // MCP 模式切换
  const handleMCPModeChange = useCallback((mode: 'prompt' | 'function') => {
    setMcpMode(mode);
    localStorage.setItem('mcp-mode', mode);
  }, []);

  /**
   * 多模型发送消息
   * 支持同时向多个模型发送相同的消息
   */
  const handleMultiModelSend = async (content: string, models: Model[], images?: SiliconFlowImageFormat[], _toolsEnabled?: boolean, files?: any[]) => {
    if (!currentTopic || !selectedModel) return;

    try {
      console.log(`[useChatFeatures] `, models.length);
      console.log(`[useChatFeatures] `, models.map(m => `${m.provider || m.providerType}:${m.id}`));
      console.log(`[useChatFeatures] 选中的模型:`, models.map(m => `${m.provider || m.providerType}:${m.id}`));

      // 1. 创建用户消息，包含 mentions 字段记录选中的模型
      const { message: userMessage, blocks: userBlocks } = createUserMessage({
        content,
        assistantId: currentTopic.assistantId,
        topicId: currentTopic.id,
        modelId: selectedModel.id,
        model: selectedModel,
        images: images?.map(img => ({ url: img.image_url?.url || '' })),
        files: files?.map(file => file.fileRecord).filter(Boolean)
      });

      // 添加 mentions 字段到用户消息
      (userMessage as any).mentions = models;

      // 2. 保存用户消息和块
      await dexieStorage.saveMessage(userMessage);
      for (const block of userBlocks) {
        await dexieStorage.saveMessageBlock(block);
      }

      // 更新 Redux 状态
      dispatch(newMessagesActions.addMessage({ topicId: currentTopic.id, message: userMessage }));

      // 3. 为每个模型创建独立的助手消息
      const assistantMessages: { message: Message; blocks: MessageBlock[]; model: Model }[] = [];

      for (const model of models) {
        const { message: assistantMessage, blocks: assistantBlocks } = createAssistantMessage({
          assistantId: currentTopic.assistantId,
          topicId: currentTopic.id,
          askId: userMessage.id, // 关键：所有助手消息共享同一个 askId
          modelId: model.id,
          model: model,
          status: AssistantMessageStatus.PENDING
        });

        // 保存助手消息和块
        await dexieStorage.saveMessage(assistantMessage);
        for (const block of assistantBlocks) {
          await dexieStorage.saveMessageBlock(block);
        }

        // 更新 Redux 状态
        dispatch(newMessagesActions.addMessage({ topicId: currentTopic.id, message: assistantMessage }));

        assistantMessages.push({ message: assistantMessage, blocks: assistantBlocks, model });
      }

      // 4. 并行调用所有模型
      await Promise.all(assistantMessages.map(async ({ message: assistantMessage, blocks: assistantBlocks, model }) => {
        try {
          await callSingleModelForMultiModel(model, assistantMessage, assistantBlocks, _toolsEnabled);
        } catch (error) {
          console.error(`[useChatFeatures] 模型 ${model.id} 调用失败:`, error);
          // 更新消息状态为错误
          dispatch(newMessagesActions.updateMessage({
            id: assistantMessage.id,
            changes: {
              status: AssistantMessageStatus.ERROR,
              updatedAt: new Date().toISOString()
            }
          }));
        }
      }));

    } catch (error) {
      console.error('[useChatFeatures] 多模型发送失败:', error);
    }
  };

  /**
   * 为多模型调用单个模型 - 使用标准的 processAssistantResponse
   * 这样可以正确支持思考过程显示
   */
  const callSingleModelForMultiModel = async (
    model: Model,
    assistantMessage: Message,
    assistantBlocks: MessageBlock[],
    enableTools?: boolean
  ) => {
    try {
      // 添加块到 Redux 状态
      if (assistantBlocks.length > 0) {
        dispatch(upsertManyBlocks(assistantBlocks));
      }

      // 使用标准的 processAssistantResponse 处理响应
      // 这会使用 ResponseHandler，正确处理思考过程
      await processAssistantResponse(
        dispatch as any,
        store.getState,
        assistantMessage,
        currentTopic!.id,
        model,
        enableTools ?? false // 支持工具调用
      );

    } catch (error) {
      console.error(`[useChatFeatures] 模型 ${model.id} 调用失败:`, error);

      // 更新消息状态为错误
      dispatch(newMessagesActions.updateMessage({
        id: assistantMessage.id,
        changes: {
          status: AssistantMessageStatus.ERROR,
          updatedAt: new Date().toISOString()
        }
      }));

      throw error;
    }
  };

  return {
    webSearchActive,
    imageGenerationMode,
    videoGenerationMode,
    toolsEnabled,
    mcpMode,
    toggleWebSearch,
    toggleImageGenerationMode,
    toggleVideoGenerationMode,
    toggleToolsEnabled,
    handleMCPModeChange,
    handleImagePrompt,
    handleVideoPrompt,
    handleStopResponseClick,
    handleMessageSend,
    handleMultiModelSend
  };
};