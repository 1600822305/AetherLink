import { useDispatch } from 'react-redux';
import { newMessagesActions } from '../../../shared/store/slices/newMessagesSlice';
import { AssistantMessageStatus } from '../../../shared/types/newMessage.ts';
import { abortCompletion } from '../../../shared/utils/abortController';
import type { SiliconFlowImageFormat, Model, ChatTopic } from '../../../shared/types';
import type { Message } from '../../../shared/types/newMessage.ts';

import { useExclusiveMode } from './useExclusiveMode';
import { useVideoGeneration } from './useVideoGeneration';
import { useMultiModelSend } from './useMultiModelSend';
import { useMCPTools } from './useMCPTools';

/**
 * 处理聊天特殊功能相关的钩子（组合层）
 * 将互斥模式、视频生成、多模型发送、MCP工具管理组合在一起
 * 对外保持完全相同的返回值签名
 */
export const useChatFeatures = (
  currentTopic: ChatTopic | null,
  currentMessages: Message[],
  selectedModel: Model | null,
  handleSendMessage: (content: string, images?: SiliconFlowImageFormat[], toolsEnabled?: boolean, files?: any[]) => void
) => {
  const dispatch = useDispatch();

  // 互斥模式管理（图像/视频/网络搜索）
  const {
    webSearchActive,
    imageGenerationMode,
    videoGenerationMode,
    toggleImageGenerationMode,
    toggleVideoGenerationMode,
    toggleWebSearch,
    clearMode
  } = useExclusiveMode();

  // 视频生成
  const { handleVideoPrompt } = useVideoGeneration(currentTopic, selectedModel);

  // 多模型并行发送
  const { handleMultiModelSend } = useMultiModelSend(currentTopic, selectedModel);

  // MCP 工具开关和模式
  const { toolsEnabled, mcpMode, toggleToolsEnabled, handleMCPModeChange } = useMCPTools();

  // 处理图像生成提示词
  const handleImagePrompt = (prompt: string, images?: SiliconFlowImageFormat[], files?: any[]) => {
    if (!currentTopic || !prompt.trim() || !selectedModel) return;

    console.log(`[useChatFeatures] 处理图像生成提示词: ${prompt}`);
    console.log(`[useChatFeatures] 使用模型: ${selectedModel.id}`);

    // 直接使用正常的消息发送流程，让messageThunk处理图像生成
    // 不再调用handleSendMessage，避免重复发送
    handleSendMessage(prompt, images, false, files); // 禁用工具，因为图像生成不需要工具
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

  // 处理消息发送 - 根据当前模式分发到对应处理函数
  const handleMessageSend = async (content: string, images?: SiliconFlowImageFormat[], toolsEnabledParam?: boolean, files?: any[]) => {
    // 如果处于图像生成模式，则调用图像生成处理函数
    if (imageGenerationMode) {
      handleImagePrompt(content, images, files);
      // 关闭图像生成模式
      clearMode();
      return;
    }

    // 如果处于视频生成模式，则调用视频生成处理函数
    if (videoGenerationMode) {
      await handleVideoPrompt(content, images, files);
      // 关闭视频生成模式
      clearMode();
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