import { useCallback } from 'react';
import { useDispatch } from 'react-redux';
import store from '../../../shared/store';
import { selectMessagesForTopic } from '../../../shared/store/selectors/messageSelectors';
import { sendMessage, deleteMessage, regenerateMessage, resendUserMessage } from '../../../shared/store/thunks/messageThunk';
import { loadTopicMessagesThunk } from '../../../shared/store/slices/newMessagesSlice';
import { versionService } from '../../../shared/services/VersionService';
import type { SiliconFlowImageFormat } from '../../../shared/types';
import type { AppDispatch } from '../../../shared/store';

/**
 * 处理消息相关逻辑的钩子
 * 负责发送、删除、重新生成消息等功能
 */
export const useMessageHandling = (
  selectedModel: any,
  currentTopic: any
) => {
  const dispatch = useDispatch<AppDispatch>();

  // 处理发送消息
  const handleSendMessage = useCallback(async (content: string, images?: SiliconFlowImageFormat[], toolsEnabled?: boolean, files?: any[]) => {
    if (!currentTopic || !content.trim() || !selectedModel) return null;

    try {
      // 转换图片格式
      const formattedImages = images?.map(img => ({
        url: img.image_url?.url || ''
      }));

      // 转换文件格式
      const formattedFiles = files?.map(file => file.fileRecord).filter(Boolean);

      // 使用Redux Thunk直接处理整个消息发送流程
      dispatch(sendMessage(
        content.trim(),
        currentTopic.id,
        selectedModel,
        formattedImages,
        toolsEnabled, // 传递工具开关状态
        formattedFiles // 传递文件
      ));

      // 返回成功标识
      return true;
    } catch (error) {
      console.error('发送消息失败:', error);
      return null;
    }
  }, [dispatch, currentTopic, selectedModel]);

  // 处理删除消息
  const handleDeleteMessage = useCallback(async (messageId: string) => {
    if (!currentTopic) return;

    try {
      // 使用Redux Thunk删除消息
      await dispatch(deleteMessage(messageId, currentTopic.id));
    } catch (error) {
      console.error('删除消息失败:', error);
    }
  }, [dispatch, currentTopic]);

  // 处理重新生成消息 - 直接从Redux获取最新的模型选择
  const handleRegenerateMessage = useCallback(async (messageId: string) => {
    if (!currentTopic) return null;

    try {
      // 直接从Redux store获取最新的模型ID和可用模型列表，避免组件状态更新延迟
      const state = store.getState();
      const latestModelId = state.settings.currentModelId;
      const providers = state.settings.providers || [];

      if (!latestModelId) {
        console.error('[handleRegenerateMessage] Redux中没有当前模型ID');
        return null;
      }

      // 从Redux中的providers获取所有可用模型，确保provider字段正确设置
      const availableModels = providers.flatMap((provider: any) =>
        (provider.models?.filter((model: any) => model.enabled) || []).map((model: any) => ({
          ...model,
          provider: provider.id, // 确保provider字段设置为正确的provider ID
          providerType: model.providerType || provider.providerType || provider.id,
          apiKey: model.apiKey || provider.apiKey,
          baseUrl: model.baseUrl || provider.baseUrl
        }))
      );

      // 从可用模型列表中找到对应的模型对象
      const latestModel = availableModels.find((m: any) => m.id === latestModelId);
      if (!latestModel) {
        console.error('[handleRegenerateMessage] 找不到对应的模型:', latestModelId);
        // 如果找不到最新模型，回退到组件状态中的模型
        if (!selectedModel) {
          console.error('[handleRegenerateMessage] 组件状态中也没有模型');
          return null;
        }
        console.warn('[handleRegenerateMessage] 回退使用组件状态中的模型:', selectedModel.id);
      }

      const modelToUse = latestModel || selectedModel;

      console.log(`[handleRegenerateMessage] 使用模型重新生成消息: ${messageId}`, {
        modelId: modelToUse.id,
        modelName: modelToUse.name,
        provider: modelToUse.provider,
        source: latestModel ? 'Redux-Direct' : 'Component-Fallback'
      });

      // 使用Redux Thunk重新生成消息，传入最新选择的模型
      dispatch(regenerateMessage(messageId, currentTopic.id, modelToUse));
      return true;
    } catch (error) {
      console.error('重新生成消息失败:', error);
      return null;
    }
  }, [dispatch, currentTopic, selectedModel]);

  // 加载主题消息 - 使用最佳实例的标准方式
  const loadTopicMessages = useCallback(async (topicId: string) => {
    try {
      // 使用最佳实例的 loadTopicMessagesThunk，确保消息和块正确加载到Redux
      await dispatch(loadTopicMessagesThunk(topicId)); // 加载消息
      return selectMessagesForTopic(store.getState(), topicId)?.length || 0;
    } catch (error) {
      console.error('加载主题消息失败:', error);
      throw error;
    }
  }, [dispatch]);

  // 增强版本管理 - 支持更多版本操作
  const handleSwitchMessageVersion = useCallback(async (versionIdOrCommand: string) => {
    try {
      // 处理特殊命令
      if (versionIdOrCommand === 'latest') {
        // 获取消息ID - 假设当前只有一个消息显示版本
        const messages = selectMessagesForTopic(store.getState(), currentTopic.id);
        const messageWithVersion = messages.find(m => m.currentVersionId);
        
        if (messageWithVersion) {
          const success = await versionService.switchToLatest(messageWithVersion.id);
          return success;
        }
        return false;
      }
      
      if (versionIdOrCommand === 'create') {
        // 获取当前消息 - 假设当前只处理助手消息
        const messages = selectMessagesForTopic(store.getState(), currentTopic.id);
        const assistantMessages = messages.filter(m => m.role === 'assistant');
        
        if (assistantMessages.length > 0) {
          // 默认为最后一条助手消息创建版本
          const latestAssistantMsg = assistantMessages[assistantMessages.length - 1];
          const versionId = await versionService.createManualVersion(latestAssistantMsg.id);
          
          return !!versionId;
        }
        return false;
      }
      
      if (versionIdOrCommand.startsWith('delete:')) {
        const versionId = versionIdOrCommand.substring(7); // 移除'delete:'前缀
        const success = await versionService.deleteVersion(versionId);
        return success;
      }
      
      // 常规版本切换
      const success = await versionService.switchToVersion(versionIdOrCommand);
      return success;
    } catch (error) {
      console.error(`[handleSwitchMessageVersion] 版本操作异常:`, error);
      return false;
    }
  }, [currentTopic]);

  // 处理重新发送用户消息 - 基于新逻辑
  const handleResendMessage = useCallback(async (messageId: string) => {
    if (!currentTopic || !selectedModel) return null;

    try {
      // 使用基于新逻辑的重新发送 thunk
      // 这个 thunk 不会创建新的用户消息，而是重置关联的助手消息
      dispatch(resendUserMessage(messageId, currentTopic.id, selectedModel));
      return true;
    } catch (error) {
      console.error('重新发送消息失败:', error);
      return null;
    }
  }, [dispatch, currentTopic, selectedModel]);

  return {
    handleSendMessage,
    handleDeleteMessage,
    handleRegenerateMessage,
    handleSwitchMessageVersion,
    handleResendMessage,
    loadTopicMessages
  };
};