import { useState } from 'react';
import { useDispatch } from 'react-redux';
import { v4 as uuid } from 'uuid';
import { newMessagesActions } from '../../../shared/store/slices/newMessagesSlice';
import { updateOneBlock, upsertOneBlock } from '../../../shared/store/slices/messageBlocksSlice';
import { multiModelService } from '../../../shared/services/MultiModelService';
import { ApiProviderRegistry } from '../../../shared/services/messages/ApiProvider';
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


import { EnhancedWebSearchService } from '../../../shared/services/webSearch';
import { abortCompletion } from '../../../shared/utils/abortController';
import store from '../../../shared/store';
import { TopicService } from '../../../shared/services/topics/TopicService';
import { VideoTaskManager } from '../../../shared/services/VideoTaskManager';
import type { SiliconFlowImageFormat, GoogleVeoParams } from '../../../shared/types';

/**
 * 处理聊天特殊功能相关的钩子
 * 包括图像生成、网络搜索、URL抓取等功能
 */
export const useChatFeatures = (
  currentTopic: any,
  currentMessages: any[],
  selectedModel: any,
  handleSendMessage: (content: string, images?: SiliconFlowImageFormat[], toolsEnabled?: boolean, files?: any[]) => void
) => {
  const dispatch = useDispatch();
  const [webSearchActive, setWebSearchActive] = useState(false); // 控制是否处于网络搜索模式
  const [imageGenerationMode, setImageGenerationMode] = useState(false); // 控制是否处于图像生成模式
  const [videoGenerationMode, setVideoGenerationMode] = useState(false); // 控制是否处于视频生成模式
  // MCP 工具开关状态 - 从 localStorage 读取并持久化
  const [toolsEnabled, setToolsEnabled] = useState(() => {
    const saved = localStorage.getItem('mcp-tools-enabled');
    return saved !== null ? JSON.parse(saved) : true; // 默认启用
  });
  // MCP 工具调用模式 - 从 localStorage 读取
  const [mcpMode, setMcpMode] = useState<'prompt' | 'function'>(() => {
    const saved = localStorage.getItem('mcp-mode');
    return (saved as 'prompt' | 'function') || 'function';
  });

  // 切换图像生成模式
  const toggleImageGenerationMode = () => {
    setImageGenerationMode(!imageGenerationMode);
    // 如果启用图像生成模式，关闭其他模式
    if (!imageGenerationMode) {
      if (webSearchActive) setWebSearchActive(false);
      if (videoGenerationMode) setVideoGenerationMode(false);
    }
  };

  // 切换视频生成模式
  const toggleVideoGenerationMode = () => {
    setVideoGenerationMode(!videoGenerationMode);
    // 如果启用视频生成模式，关闭其他模式
    if (!videoGenerationMode) {
      if (webSearchActive) setWebSearchActive(false);
      if (imageGenerationMode) setImageGenerationMode(false);
    }
  };

  // 切换网络搜索模式
  const toggleWebSearch = () => {
    setWebSearchActive(!webSearchActive);
    // 如果启用网络搜索模式，关闭其他模式
    if (!webSearchActive) {
      if (imageGenerationMode) setImageGenerationMode(false);
      if (videoGenerationMode) setVideoGenerationMode(false);
    }
  };

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

    if (!isVideoModel) {
      console.error(`[useChatFeatures] 模型 ${selectedModel.name || selectedModel.id} 不支持视频生成`);
      // 创建错误消息
      const { message: errorMessage, blocks: errorBlocks } = createAssistantMessage({
        assistantId: currentTopic.assistantId,
        topicId: currentTopic.id,
        askId: `video-gen-${Date.now()}`,
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

    // 创建用户消息
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

    // 创建助手消息（视频生成中）
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
          const { submitVeoGeneration, pollVeoOperation } = await import('../../../shared/api/google/veo');

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

  // 处理网络搜索请求
  const handleWebSearch = async (query: string) => {
    if (!currentTopic || !query.trim()) return;

    // 使用新的块系统创建用户消息
    const { message: userMessage, blocks: userBlocks } = createUserMessage({
      content: query,
      assistantId: currentTopic.assistantId,
      topicId: currentTopic.id,
      modelId: selectedModel?.id,
      model: selectedModel || undefined
    });

    // 保存用户消息和块
    await TopicService.saveMessageAndBlocks(userMessage, userBlocks);

    try {
      // 🚀 设置流式状态，让输入框显示正确的状态
      store.dispatch({
        type: 'normalizedMessages/setTopicStreaming',
        payload: { topicId: currentTopic.id, streaming: true }
      });
      store.dispatch({
        type: 'normalizedMessages/setTopicLoading',
        payload: { topicId: currentTopic.id, loading: true }
      });

      // 创建助手消息和块
      const { message: searchingMessage, blocks: searchingBlocks } = createAssistantMessage({
        assistantId: currentTopic.assistantId,
        topicId: currentTopic.id,
        askId: userMessage.id,
        modelId: selectedModel?.id,
        model: selectedModel || undefined,
        status: AssistantMessageStatus.SEARCHING // 设置初始状态为SEARCHING
      });

      // 更新主文本块内容
      const mainTextBlock = searchingBlocks.find((block: any) => block.type === MessageBlockType.MAIN_TEXT);
      if (mainTextBlock && 'content' in mainTextBlock) {
        mainTextBlock.content = "正在搜索网络，请稍候...";
        mainTextBlock.status = MessageBlockStatus.PROCESSING; // 使用PROCESSING状态
      }

      // 保存助手消息和块
      await TopicService.saveMessageAndBlocks(searchingMessage, searchingBlocks);

      // 使用增强版搜索服务 - 支持最佳实例所有提供商
      const searchResults = await EnhancedWebSearchService.searchWithStatus(
        query,
        currentTopic.id,
        searchingMessage.id
      );

      // 🚀 风格：搜索结果通过搜索结果块显示
      let resultsContent = '';

      if (searchResults.length === 0) {
        resultsContent = "没有找到相关结果。";
      } else {
        // 🚀 搜索成功，显示简短提示，详细结果通过搜索结果块显示
        resultsContent = `✅ 搜索完成，找到 ${searchResults.length} 个相关结果`;

        // 🚀 创建搜索结果块
        const searchResultsBlock = {
          id: `search-results-${Date.now()}`,
          type: MessageBlockType.SEARCH_RESULTS,
          messageId: searchingMessage.id,
          content: '',
          status: MessageBlockStatus.SUCCESS,
          searchResults: searchResults,
          query: query,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        // 🚀 立即添加搜索结果块到Redux状态（参考思考块的处理方式）
        store.dispatch(upsertOneBlock(searchResultsBlock));

        // 发送块创建事件，确保其他组件能够监听到
        const { EventEmitter, EVENT_NAMES } = await import('../../../shared/services/EventEmitter');
        EventEmitter.emit(EVENT_NAMES.BLOCK_CREATED, { id: searchResultsBlock.id, block: searchResultsBlock });

        // 🚀 将搜索结果块插入到消息块列表的开头（在主文本块之前）
        const updatedMessage = await dexieStorage.getMessage(searchingMessage.id);
        if (updatedMessage) {
          // 将搜索结果块ID插入到blocks数组的开头
          const updatedBlocks = [searchResultsBlock.id, ...(updatedMessage.blocks || [])];

          // 立即更新Redux中的消息blocks数组
          store.dispatch(newMessagesActions.updateMessage({
            id: searchingMessage.id,
            changes: {
              blocks: updatedBlocks
            }
          }));

          // 保存到数据库
          await dexieStorage.updateMessage(searchingMessage.id, { blocks: updatedBlocks });
          await dexieStorage.saveMessageBlock(searchResultsBlock);
        }
      }

      // 更新主文本块内容
      if (mainTextBlock && mainTextBlock.id) {
        await TopicService.updateMessageBlockFields(mainTextBlock.id, {
          content: resultsContent,
          status: MessageBlockStatus.SUCCESS
        });

        // 立即更新Redux状态以确保UI立即响应
        dispatch(updateOneBlock({
          id: mainTextBlock.id,
          changes: {
            content: resultsContent,
            status: MessageBlockStatus.SUCCESS,
            updatedAt: new Date().toISOString()
          }
        }));
      }

      // 🚀 不再创建引用块，搜索结果通过搜索结果块显示

      // 更新消息状态为成功
      store.dispatch({
        type: 'normalizedMessages/updateMessageStatus',
        payload: {
          topicId: currentTopic.id,
          messageId: searchingMessage.id,
          status: AssistantMessageStatus.SUCCESS
        }
      });

      // 关闭网络搜索模式
      setWebSearchActive(false);

      // 🚀 新增：基于搜索结果让AI进行回复（在同一个消息块内追加）
      if (mainTextBlock && mainTextBlock.id) {
        await handleAIResponseAfterSearch(
          query,
          searchResults,
          currentTopic,
          selectedModel,
          searchingMessage.id,
          mainTextBlock.id
        );
      }

    } catch (error) {
      console.error("网络搜索失败:", error);

      // 创建错误消息
      const { message: errorMessage, blocks: errorBlocks } = createAssistantMessage({
        assistantId: currentTopic.assistantId,
        topicId: currentTopic.id,
        askId: userMessage.id,
        modelId: selectedModel?.id,
        model: selectedModel || undefined,
        status: AssistantMessageStatus.ERROR // 设置状态为ERROR
      });

      // 更新主文本块内容
      const mainTextBlock = errorBlocks.find((block: any) => block.type === MessageBlockType.MAIN_TEXT);
      if (mainTextBlock && 'content' in mainTextBlock) {
        mainTextBlock.content = `网络搜索失败: ${error instanceof Error ? error.message : String(error)}`;
        mainTextBlock.status = MessageBlockStatus.ERROR;
      }

      // 保存错误消息和块
      await TopicService.saveMessageAndBlocks(errorMessage, errorBlocks);

      // 设置错误状态
      store.dispatch({
        type: 'normalizedMessages/setError',
        payload: {
          error: `网络搜索失败: ${error instanceof Error ? error.message : String(error)}`
        }
      });

      // 🚀 清除流式状态
      store.dispatch({
        type: 'normalizedMessages/setTopicStreaming',
        payload: { topicId: currentTopic.id, streaming: false }
      });
      store.dispatch({
        type: 'normalizedMessages/setTopicLoading',
        payload: { topicId: currentTopic.id, loading: false }
      });

      // 关闭网络搜索模式
      setWebSearchActive(false);
    }
  };

  // 🚀 改造：基于搜索结果让AI进行回复，使用供应商原生onChunk回调
  const handleAIResponseAfterSearch = async (
    originalQuery: string,
    searchResults: any[],
    topic: any,
    model: any,
    existingMessageId: string,
    existingMainTextBlockId: string
  ) => {
    if (!topic || !model || searchResults.length === 0 || !existingMessageId || !existingMainTextBlockId) return;

    try {
      console.log(`[useChatFeatures] 开始基于搜索结果生成AI回复，使用供应商原生回调`);

      // 构建包含搜索结果的提示词
      let searchContext = `用户问题：${originalQuery}\n\n`;
      searchContext += `网络搜索结果：\n`;

      searchResults.forEach((result, index) => {
        searchContext += `${index + 1}. 标题：${result.title}\n`;
        searchContext += `   链接：${result.url}\n`;
        searchContext += `   内容：${result.snippet}\n\n`;
      });

      searchContext += `请基于以上搜索结果，对用户的问题进行详细、准确的回答。请引用相关的搜索结果，并提供有价值的分析和见解。`;

      // 获取当前搜索结果内容
      const currentBlock = store.getState().messageBlocks.entities[existingMainTextBlockId];
      const currentContent = (currentBlock as any)?.content || '';

      // 在现有内容后添加分隔符和AI分析标题
      const aiAnalysisHeader = '\n\n---\n\n## 🤖 AI 智能分析\n\n';

      // 先添加分析标题到内容中
      const contentWithHeader = currentContent + aiAnalysisHeader;
      await TopicService.updateMessageBlockFields(existingMainTextBlockId, {
        content: contentWithHeader,
        status: MessageBlockStatus.PROCESSING
      });

      // 🚀 设置流式状态，让输入框显示AI分析进行中
      store.dispatch({
        type: 'normalizedMessages/setTopicStreaming',
        payload: { topicId: topic.id, streaming: true }
      });
      store.dispatch({
        type: 'normalizedMessages/setTopicLoading',
        payload: { topicId: topic.id, loading: true }
      });

      // 构建消息数组
      const messages = [
        {
          id: 'search-context',
          role: 'user' as const,
          content: searchContext,
          assistantId: topic.assistantId,
          topicId: topic.id,
          createdAt: new Date().toISOString(),
          status: 'success',
          blocks: []
        }
      ];

      console.log(`[useChatFeatures] 使用供应商原生回调处理AI分析`);

      // 使用现有的助手响应处理系统，但需要特殊处理内容前缀
      await handleAIAnalysisWithNativeCallbacks(
        messages,
        model,
        existingMessageId,
        existingMainTextBlockId,
        contentWithHeader
      );

      console.log(`[useChatFeatures] AI搜索结果分析完成`);

    } catch (error) {
      console.error('[useChatFeatures] AI搜索结果分析失败:', error);
    }
  };

  // 🚀 简化：使用供应商原生回调处理AI分析
  const handleAIAnalysisWithNativeCallbacks = async (
    messages: any[],
    model: any,
    _messageId: string,
    blockId: string,
    contentPrefix: string
  ) => {
    try {
      // 直接调用API并手动处理响应，使用累积方式而不是替换
      const { sendChatRequest } = await import('../../../shared/api');

      let accumulatedContent = '';

      const response = await sendChatRequest({
        messages,
        modelId: model.id,
        onChunk: async (content: string) => {
          // 只累积新的AI分析内容
          accumulatedContent += content;
          // 组合完整内容：前缀（搜索结果+标题）+ 累积的AI分析内容
          const fullContent = contentPrefix + accumulatedContent;

          // 更新块内容
          await TopicService.updateMessageBlockFields(blockId, {
            content: fullContent,
            status: MessageBlockStatus.PROCESSING
          });

          // 更新Redux状态
          dispatch(updateOneBlock({
            id: blockId,
            changes: {
              content: fullContent,
              status: MessageBlockStatus.PROCESSING,
              updatedAt: new Date().toISOString()
            }
          }));
        }
      });

      // 处理最终响应
      let finalContent = '';
      if (response.success && response.content) {
        finalContent = response.content;
      } else if (response.error) {
        finalContent = `AI分析失败: ${response.error}`;
      }

      // 更新最终状态
      const finalFullContent = contentPrefix + finalContent;
      await TopicService.updateMessageBlockFields(blockId, {
        content: finalFullContent,
        status: MessageBlockStatus.SUCCESS
      });

      dispatch(updateOneBlock({
        id: blockId,
        changes: {
          content: finalFullContent,
          status: MessageBlockStatus.SUCCESS,
          updatedAt: new Date().toISOString()
        }
      }));

      // 🚀 清除流式状态，让输入框恢复正常
      store.dispatch({
        type: 'normalizedMessages/setTopicStreaming',
        payload: { topicId: currentTopic.id, streaming: false }
      });
      store.dispatch({
        type: 'normalizedMessages/setTopicLoading',
        payload: { topicId: currentTopic.id, loading: false }
      });

    } catch (error) {
      console.error('[handleAIAnalysisWithNativeCallbacks] 处理失败:', error);

      // 🚀 错误时也要清除流式状态
      store.dispatch({
        type: 'normalizedMessages/setTopicStreaming',
        payload: { topicId: currentTopic.id, streaming: false }
      });
      store.dispatch({
        type: 'normalizedMessages/setTopicLoading',
        payload: { topicId: currentTopic.id, loading: false }
      });

      throw error;
    }
  };

  // 处理停止响应点击事件
  const handleStopResponseClick = () => {
    if (!currentTopic) return;

    // 找到所有正在处理的助手消息
    const streamingMessages = currentMessages.filter(
      m => m.role === 'assistant' &&
      (m.status === AssistantMessageStatus.PROCESSING ||
       m.status === AssistantMessageStatus.PENDING ||
       m.status === AssistantMessageStatus.SEARCHING)
    );

    // 中断所有正在进行的请求
    const askIds = [...new Set(streamingMessages?.map((m) => m.askId).filter((id) => !!id) as string[])];

    for (const askId of askIds) {
      abortCompletion(askId);
    }

    // 停止流式响应
    store.dispatch({
      type: 'messages/setTopicStreaming',
      payload: { topicId: currentTopic.id, streaming: false }
    });

    // 更新所有正在处理的消息状态为成功，并添加中断标记
    streamingMessages.forEach(message => {
      console.log(`[handleStopResponseClick] 更新消息状态为成功: ${message.id}`);

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
  const handleMessageSend = async (content: string, images?: SiliconFlowImageFormat[], toolsEnabled?: boolean, files?: any[]) => {
    // 如果处于图像生成模式，则调用图像生成处理函数
    if (imageGenerationMode) {
      handleImagePrompt(content, images, files);
      // 关闭图像生成模式
      setImageGenerationMode(false);
      return;
    }

    // 如果处于视频生成模式，则调用视频生成处理函数
    if (videoGenerationMode) {
      await handleVideoPrompt(content, images, files);
      // 关闭视频生成模式
      setVideoGenerationMode(false);
      return;
    }

    // 如果处于网络搜索模式，则调用网络搜索处理函数
    if (webSearchActive) {
      handleWebSearch(content);
      return;
    }

    // 正常的消息发送处理，传递工具开关状态和文件
    handleSendMessage(content, images, toolsEnabled, files);
  };

  // 切换工具调用开关
  const toggleToolsEnabled = () => {
    const newValue = !toolsEnabled;
    setToolsEnabled(newValue);
    localStorage.setItem('mcp-tools-enabled', JSON.stringify(newValue));
  };

  // 切换 MCP 模式
  const handleMCPModeChange = (mode: 'prompt' | 'function') => {
    setMcpMode(mode);
    localStorage.setItem('mcp-mode', mode);
  };

  // 处理多模型发送 - 完全重写
  const handleMultiModelSend = async (content: string, models: any[], images?: any[], _toolsEnabled?: boolean, files?: any[]) => {
    if (!currentTopic || !selectedModel) return;

    try {
      console.log(`[useChatFeatures] 开始多模型发送，模型数量: ${models.length}`);
      console.log(`[useChatFeatures] 选中的模型:`, models.map(m => `${m.provider || m.providerType}:${m.id}`));

      // 1. 创建用户消息
      const { message: userMessage, blocks: userBlocks } = createUserMessage({
        content,
        assistantId: currentTopic.assistantId,
        topicId: currentTopic.id,
        modelId: selectedModel.id,
        model: selectedModel,
        images: images?.map(img => ({ url: img.image_url?.url || '' })),
        files: files?.map(file => file.fileRecord).filter(Boolean)
      });

      // 2. 创建助手消息 - 只包含多模型块
      const assistantMessageId = uuid();
      const multiModelBlockId = `multi-model-${uuid()}`;

      const assistantMessage = {
        id: assistantMessageId,
        role: 'assistant' as const,
        content: '',
        assistantId: currentTopic.assistantId,
        topicId: currentTopic.id,
        askId: userMessage.id,
        modelId: selectedModel.id,
        model: selectedModel,
        createdAt: new Date().toISOString(),
        status: 'streaming' as const,
        blocks: [multiModelBlockId] // 直接包含多模型块ID
      };

      // 3. 直接创建多模型块
      const responses = models.map(model => ({
        modelId: model.id,
        modelName: model.name || model.id,
        content: '',
        status: MessageBlockStatus.PENDING
      }));

      const multiModelBlock = {
        id: multiModelBlockId,
        messageId: assistantMessageId,
        type: MessageBlockType.MULTI_MODEL,
        responses,
        displayStyle: 'horizontal' as const,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        status: MessageBlockStatus.PENDING
      };

      // 5. 保存所有数据
      await dexieStorage.saveMessage(userMessage);
      await dexieStorage.saveMessage(assistantMessage);
      await dexieStorage.saveMessageBlock(multiModelBlock);

      // 保存用户消息块
      for (const block of userBlocks) {
        await dexieStorage.saveMessageBlock(block);
      }

      // 6. 更新Redux状态
      dispatch(newMessagesActions.addMessage({ topicId: currentTopic.id, message: userMessage }));
      dispatch(newMessagesActions.addMessage({ topicId: currentTopic.id, message: assistantMessage }));
      dispatch(upsertOneBlock(multiModelBlock));

      // 7. 并行调用所有模型
      models.map(async (model) => {
        try {
          // 实际调用模型API
          await callSingleModelForMultiModel(model, content, multiModelBlockId);

        } catch (error) {
          console.error(`[useChatFeatures] 模型 ${model.id} 调用失败:`, error);
          await multiModelService.updateModelResponse(multiModelBlockId, model.id, `模型调用失败: ${error}`, 'error');
        }
      });

    } catch (error) {
      console.error('[useChatFeatures] 多模型发送失败:', error);
    }
  };

  // 为多模型调用单个模型
  const callSingleModelForMultiModel = async (
    model: any,
    content: string,
    blockId: string
  ) => {
    try {

      // 使用静态导入的API和服务

      // 获取当前话题的消息历史
      const topicMessages = await dexieStorage.getTopicMessages(currentTopic.id);

      // 按创建时间排序消息
      const sortedMessages = [...topicMessages].sort((a, b) => {
        const timeA = new Date(a.createdAt).getTime();
        const timeB = new Date(b.createdAt).getTime();
        return timeA - timeB;
      });

      // 构建API消息数组
      const chatMessages: any[] = [];

      // 添加历史消息
      for (const message of sortedMessages) {
        if (message.role === 'system') continue; // 跳过系统消息

        // 获取消息的主要文本内容
        const messageBlocks = await dexieStorage.getMessageBlocksByMessageId(message.id);
        const mainTextBlock = messageBlocks.find((block: any) => block.type === 'main_text');
        const messageContent = (mainTextBlock as any)?.content || '';

        if (messageContent.trim()) {
          // 创建符合Message接口的对象
          chatMessages.push({
            id: message.id,
            role: message.role,
            content: messageContent,
            assistantId: message.assistantId,
            topicId: message.topicId,
            createdAt: message.createdAt,
            status: message.status,
            blocks: message.blocks
          });
        }
      }

      // 添加用户的新消息
      chatMessages.push({
        id: `temp-${Date.now()}`,
        role: 'user' as const,
        content: content,
        assistantId: currentTopic.assistantId,
        topicId: currentTopic.id,
        createdAt: new Date().toISOString(),
        status: 'success',
        blocks: []
      });



      // 获取API提供商
      const provider = ApiProviderRegistry.get(model);
      if (!provider) {
        throw new Error(`无法获取模型 ${model.id} 的API提供商`);
      }

      // 初始化响应状态
      await multiModelService.updateModelResponse(blockId, model.id, '', 'streaming');

      // 调用模型API，使用流式更新（高级模式）
      const response = await provider.sendChatMessage(chatMessages, {
        onUpdate: async (content: string) => {
          // 实时更新响应内容
          await multiModelService.updateModelResponse(blockId, model.id, content, 'streaming');
        },
        onChunk: async () => {
          // 启用高级流式模式
        },
        enableTools: true,
        // 其他选项...
      });

      // 处理最终响应
      let finalContent = '';
      if (typeof response === 'string') {
        finalContent = response;
      } else if (response && typeof response === 'object' && 'content' in response) {
        finalContent = response.content;
      }

      // 完成响应
      await multiModelService.completeModelResponse(blockId, model.id, finalContent);

    } catch (error) {
      console.error(`[useChatFeatures] 模型 ${model.id} 调用失败:`, error);

      // 使用静态导入的服务
      await multiModelService.updateModelResponse(
        blockId,
        model.id,
        `调用失败: ${error instanceof Error ? error.message : String(error)}`,
        'error'
      );
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
    handleWebSearch,
    handleImagePrompt,
    handleVideoPrompt,
    handleStopResponseClick,
    handleMessageSend,
    handleMultiModelSend
  };
};