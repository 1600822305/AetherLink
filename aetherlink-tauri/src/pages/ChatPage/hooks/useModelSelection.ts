import { useState, useEffect, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import type { RootState } from '../../../shared/store';
import { setCurrentModel } from '../../../shared/store/settingsSlice';
import type { Model } from '../../../shared/types';

export function useModelSelection() {
  const dispatch = useDispatch();
  const settings = useSelector((state: RootState) => state.settings);
  const currentModelId = useSelector((state: RootState) => state.settings.currentModelId);

  // 模型选择菜单相关状态
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedModel, setSelectedModel] = useState<Model | null>(null);
  const [availableModels, setAvailableModels] = useState<Model[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // 打开模型选择菜单
  const handleModelMenuClick = useCallback(() => {
    setDialogOpen(true);
  }, []);

  // 关闭模型选择菜单
  const handleModelMenuClose = useCallback(() => {
    setDialogOpen(false);
  }, []);

  // 优化选择模型函数 - 添加防抖和错误处理
  const handleModelSelect = useCallback((model: Model) => {
    if (!model || !model.id) {
      console.error('尝试选择无效的模型:', model);
      return;
    }

    // 使用 requestAnimationFrame 优化 UI 更新时机
    requestAnimationFrame(() => {
      setSelectedModel(model);
      // 保存选择的模型ID到Redux和localStorage
      dispatch(setCurrentModel(model.id));
      handleModelMenuClose();
    });
  }, [dispatch, handleModelMenuClose]);

  // 初始化可用模型列表
  useEffect(() => {
    const initializeModels = async () => {
      setIsLoading(true);
      try {
        // 从用户设置中加载可用模型列表
        const availableModels: Model[] = [];

        // 只收集启用的提供商中的启用模型
        if (settings.providers) {
          settings.providers.forEach(provider => {
            if (provider.isEnabled) {
              // 从每个启用的提供商中收集启用的模型
              provider.models.forEach(model => {
                if (model.enabled) {
                  // 确保模型包含提供商的信息
                  const modelWithProviderInfo = {
                    ...model,
                    apiKey: model.apiKey || provider.apiKey,
                    baseUrl: model.baseUrl || provider.baseUrl,
                    providerType: model.providerType || provider.providerType || provider.id,
                    description: model.description || `${provider.name}的${model.name}模型`
                  };
                  availableModels.push(modelWithProviderInfo);
                }
              });
            }
          });
        }

        // 如果没有找到模型，使用一些默认模型（仅用于测试/演示）
        if (availableModels.length === 0) {
          console.warn('未找到用户配置的模型，使用默认测试模型');
          const defaultModels: Model[] = [
            { id: 'gpt-4', name: 'GPT-4', description: '最强大的大语言模型', provider: 'OpenAI', enabled: true },
            { id: 'gpt-3.5-turbo', name: 'GPT-3.5', description: '平衡性能和速度', provider: 'OpenAI', enabled: true },
            { id: 'claude-3', name: 'Claude 3', description: '优秀的文本理解能力', provider: 'Anthropic', enabled: true },
            { id: 'deepseek', name: 'DeepSeek', description: '国内领先大模型', provider: 'DeepSeek', enabled: true }
          ];
          setAvailableModels(defaultModels);

          // 如果存储了当前模型ID，查找匹配的模型
          if (currentModelId) {
            const model = defaultModels.find(m => m.id === currentModelId);
            if (model) {
              setSelectedModel(model);
            } else {
              setSelectedModel(defaultModels[0]);
            }
          } else {
            setSelectedModel(defaultModels[0]);
          }
        } else {
          setAvailableModels(availableModels);

          // 使用Redux中存储的当前模型ID，如果没有则使用默认模型
          if (currentModelId) {
            const model = availableModels.find(m => m.id === currentModelId);
            if (model) {
              setSelectedModel(model);
            } else {
              // 如果找不到匹配的模型（可能是模型被删除了），选择默认或第一个
              const defaultModel = availableModels.find(model => model.isDefault) || availableModels[0];
              setSelectedModel(defaultModel);
              // 更新Redux中的当前模型ID
              if (defaultModel) {
                dispatch(setCurrentModel(defaultModel.id));
              }
            }
          } else {
            // 没有当前模型ID，选择默认或第一个
            const defaultModel = availableModels.find(model => model.isDefault) || availableModels[0];
            setSelectedModel(defaultModel);
            // 更新Redux中的当前模型ID
            if (defaultModel) {
              dispatch(setCurrentModel(defaultModel.id));
            }
          }
        }
      } catch (error) {
        console.error('加载模型数据失败', error);
        // 出错时使用一个安全的默认值
        setAvailableModels([]);
        setSelectedModel(null);
      } finally {
        setIsLoading(false);
      }
    };

    initializeModels();
  }, [dispatch, settings, currentModelId]);

  return {
    selectedModel,
    availableModels,
    handleModelSelect,
    handleModelMenuClick,
    handleModelMenuClose,
    menuOpen: dialogOpen,
    isLoading
  };
}