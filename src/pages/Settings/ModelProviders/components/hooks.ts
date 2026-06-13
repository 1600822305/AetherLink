import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAppDispatch } from '../../../../shared/store';
import { updateProvider, deleteProvider } from '../../../../shared/store/settingsSlice';
import type { Model } from '../../../../shared/types';
import type { ApiKeyConfig, LoadBalanceStrategy } from '../../../../shared/config/defaultModels';
import { isValidUrl } from '../../../../shared/utils';
import ApiKeyManager from '../../../../shared/services/ai/ApiKeyManager';
import { modelMatchesIdentity } from '../../../../shared/utils/modelUtils';
import { toastManager } from '../../../../components/EnhancedToast';
import { CONSTANTS, STYLES, useDebounce } from './constants';
import { 
  testingModelId, 
  showApiKey, 
  resetProviderSignals 
} from './providerSignals';
import { useModelTest } from './useModelTest';

// ============================================================================
// 调试工具函数
// ============================================================================

/**
 * 调试日志 - 模型操作
 */
const logModelOperation = (operation: string, details: any) => {
  if (process.env.NODE_ENV === 'development') {
    console.log(`[ModelProvider] ${operation}:`, details);
  }
};

// ============================================================================
// 类型定义
// ============================================================================

interface Provider {
  id: string;
  name: string;
  apiKey?: string;
  baseUrl?: string;
  isEnabled: boolean;
  models: Model[];
  providerType?: string;
  extraHeaders?: Record<string, string>;
  extraBody?: Record<string, any>;
  apiKeys?: ApiKeyConfig[];
  keyManagement?: {
    strategy: LoadBalanceStrategy;
    maxFailuresBeforeDisable?: number;
    failureRecoveryTime?: number;
    enableAutoRecovery?: boolean;
  };
}

// ============================================================================
// 主 Hook
// ============================================================================

export const useProviderSettings = (provider: Provider | undefined) => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const dispatch = useAppDispatch();


  // ========================================================================
  // 状态管理
  // ========================================================================

  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [isEnabled, setIsEnabled] = useState(true);
  const [openAddModelDialog, setOpenAddModelDialog] = useState(false);
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
  const [openEditModelDialog, setOpenEditModelDialog] = useState(false);
  const [modelToEdit, setModelToEdit] = useState<Model | undefined>(undefined);
  const [newModelName, setNewModelName] = useState('');
  const [newModelValue, setNewModelValue] = useState('');
  const [baseUrlError, setBaseUrlError] = useState('');
  const [openModelManagementDialog, setOpenModelManagementDialog] = useState(false);
  // testingModelId 已改用 Signals 管理

  // 编辑供应商相关状态
  const [openEditProviderDialog, setOpenEditProviderDialog] = useState(false);
  const [editProviderName, setEditProviderName] = useState('');
  const [editProviderType, setEditProviderType] = useState('');

  // 高级 API 配置相关状态（合并请求头和请求体）
  const [extraHeaders, setExtraHeaders] = useState<Record<string, string>>({});
  const [newHeaderKey, setNewHeaderKey] = useState('');
  const [newHeaderValue, setNewHeaderValue] = useState('');
  const [extraBody, setExtraBody] = useState<Record<string, any>>({});
  const [newBodyKey, setNewBodyKey] = useState('');
  const [newBodyValue, setNewBodyValue] = useState('');
  const [openAdvancedConfigDialog, setOpenAdvancedConfigDialog] = useState(false);

  // 自定义模型端点相关状态
  const [customModelEndpoint, setCustomModelEndpoint] = useState('');
  const [openCustomEndpointDialog, setOpenCustomEndpointDialog] = useState(false);
  const [customEndpointError, setCustomEndpointError] = useState('');

  // 多 Key 管理相关状态
  const [multiKeyEnabled, setMultiKeyEnabled] = useState(false);
  // showApiKey 已改用 Signals 管理
  const keyManager = ApiKeyManager.getInstance();

  // Responses API 开关状态（仅对 OpenAI 类型有效）
  const [useResponsesAPI, setUseResponsesAPI] = useState(false);

  // 防抖处理的URL输入
  const debouncedBaseUrl = useDebounce(baseUrl, CONSTANTS.DEBOUNCE_DELAY);
  // 防抖处理的API Key输入
  const debouncedApiKey = useDebounce(apiKey, CONSTANTS.DEBOUNCE_DELAY);

  // 优化的样式对象
  const buttonStyles = useMemo(() => ({
    primary: STYLES.primaryButton,
    error: STYLES.errorButton
  }), []);

  // ========================================================================
  // 副作用处理
  // ========================================================================

  // 当provider加载完成后初始化状态
  useEffect(() => {
    if (provider) {
      setApiKey(provider.apiKey || '');
      setBaseUrl(provider.baseUrl || '');
      setIsEnabled(provider.isEnabled);
      setExtraHeaders(provider.extraHeaders || {});
      setExtraBody(provider.extraBody || {});

      // 检查是否启用了多 Key 模式
      setMultiKeyEnabled(!!(provider.apiKeys && provider.apiKeys.length > 0));

      // 初始化 Responses API 开关状态
      setUseResponsesAPI(!!(provider as any).useResponsesAPI);
    }
    // 仅在切换供应商时重置本地表单状态，避免其他字段的 updateProvider 覆盖未保存的输入
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider?.id]);

  // 多 Key 配置变化时同步开关状态（非文本输入，不存在覆盖输入问题）
  useEffect(() => {
    setMultiKeyEnabled(!!(provider?.apiKeys && provider.apiKeys.length > 0));
  }, [provider?.apiKeys]);

  // 组件卸载时重置 Signals
  useEffect(() => {
    return () => {
      resetProviderSignals();
    };
  }, []);

  // 防抖URL验证
  useEffect(() => {
    if (debouncedBaseUrl && !isValidUrl(debouncedBaseUrl)) {
      setBaseUrlError(t('modelSettings.provider.invalidUrl'));
    } else {
      setBaseUrlError('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedBaseUrl]);

  // API Key 防抖自动保存（多 Key 模式下该字段由 handleApiKeysChange 独占维护）
  useEffect(() => {
    if (!provider) return;
    if (multiKeyEnabled) return;
    if (debouncedApiKey !== apiKey) return;
    if (debouncedApiKey === (provider.apiKey || '')) return;
    dispatch(updateProvider({ id: provider.id, updates: { apiKey: debouncedApiKey } }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedApiKey]);

  // 基础URL 防抖自动保存（非法 URL 不保存，错误提示由上方验证 effect 处理）
  useEffect(() => {
    if (!provider) return;
    if (debouncedBaseUrl !== baseUrl) return;
    const trimmed = debouncedBaseUrl.trim();
    if (trimmed === (provider.baseUrl || '')) return;
    if (trimmed && !isValidUrl(trimmed)) return;
    dispatch(updateProvider({ id: provider.id, updates: { baseUrl: trimmed } }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedBaseUrl]);

  // 模型测试连接 - 使用独立模块
  const {
    testResult,
    setTestResult,
    testSnackbarOpen,
    setTestSnackbarOpen,
    isTesting,
    testResultDialogOpen,
    setTestResultDialogOpen,
    handleTestConnection,
    handleTestModelConnection,
  } = useModelTest(provider, apiKey, baseUrl, multiKeyEnabled);

  // ========================================================================
  // 多 Key 管理函数
  // ========================================================================

  const handleApiKeysChange = (keys: ApiKeyConfig[]) => {
    if (provider) {
      dispatch(updateProvider({
        id: provider.id,
        updates: {
          apiKeys: keys,
          // 如果有多个 Key，更新主 apiKey 为第一个启用的 Key
          apiKey: keys.find(k => k.isEnabled)?.key || keys[0]?.key || ''
        }
      }));
    }
  };

  const handleStrategyChange = (strategy: LoadBalanceStrategy) => {
    if (provider) {
      dispatch(updateProvider({
        id: provider.id,
        updates: {
          keyManagement: {
            strategy,
            maxFailuresBeforeDisable: provider.keyManagement?.maxFailuresBeforeDisable ?? 3,
            failureRecoveryTime: provider.keyManagement?.failureRecoveryTime ?? 5,
            enableAutoRecovery: provider.keyManagement?.enableAutoRecovery ?? true
          }
        }
      }));
    }
  };

  const handleToggleMultiKey = (enabled: boolean) => {
    setMultiKeyEnabled(enabled);
    if (provider) {
      if (enabled) {
        // 启用多 Key 模式：将当前单个 Key 转换为多 Key 配置
        const currentKey = provider.apiKey || apiKey;
        const initialKeys = currentKey
          ? [keyManager.createApiKeyConfig(currentKey, '主要密钥', 1)]
          : [];
        dispatch(updateProvider({
          id: provider.id,
          updates: {
            apiKeys: initialKeys,
            keyManagement: {
              strategy: 'round_robin' as LoadBalanceStrategy,
              maxFailuresBeforeDisable: 3,
              failureRecoveryTime: 5,
              enableAutoRecovery: true
            }
          }
        }));
      } else {
        // 禁用多 Key 模式：保留第一个 Key 作为单个 Key
        const firstKey = provider.apiKeys?.[0];
        dispatch(updateProvider({
          id: provider.id,
          updates: {
            apiKey: firstKey?.key || '',
            apiKeys: undefined,
            keyManagement: undefined
          }
        }));
      }
    }
  };

  const toggleShowApiKey = () => {
    showApiKey.value = !showApiKey.value;
  };

  // ========================================================================
  // 导航和基本操作
  // ========================================================================

  const handleBack = useCallback(() => {
    navigate('/settings/default-model', { replace: true });
  }, [navigate]);

  // 验证并更新供应商配置的辅助函数
  const validateAndUpdateProvider = useCallback((updates: any): boolean => {
    if (!provider) return false;

    // 验证baseUrl是否有效（如果已输入）
    if (baseUrl && !isValidUrl(baseUrl)) {
      setBaseUrlError(t('modelSettings.provider.invalidUrl'));
      return false;
    }

    try {
      const providerUpdates: Record<string, any> = {
        baseUrl: baseUrl.trim(),
        isEnabled,
        extraHeaders,
        extraBody,
        useResponsesAPI, // 保存 Responses API 开关状态
        ...updates
      };
      // 多 Key 模式下不写单 Key 字段（由 handleApiKeysChange 独占维护）
      if (!multiKeyEnabled) {
        providerUpdates.apiKey = apiKey;
      }
      dispatch(updateProvider({
        id: provider.id,
        updates: providerUpdates
      }));
      return true;
    } catch (error) {
      console.error('保存配置失败:', error);
      setBaseUrlError(t('modelSettings.provider.saveConfigFailed'));
      return false;
    }
  }, [provider, baseUrl, apiKey, isEnabled, extraHeaders, extraBody, useResponsesAPI, multiKeyEnabled, dispatch, t]);

  // 只更新模型列表，不隐式保存连接配置
  const updateProviderModels = useCallback((updatedModels: Model[]): boolean => {
    if (!provider) return false;
    try {
      dispatch(updateProvider({ id: provider.id, updates: { models: updatedModels } }));
      return true;
    } catch (error) {
      console.error('保存模型失败:', error);
      return false;
    }
  }, [provider, dispatch]);

  // 保存并返回
  const handleSave = useCallback(() => {
    if (validateAndUpdateProvider({})) {
      setTimeout(() => {
        navigate('/settings/default-model', { replace: true });
      }, 0);
    }
  }, [validateAndUpdateProvider, navigate]);

  const handleDelete = () => {
    if (provider) {
      dispatch(deleteProvider(provider.id));
    }
    setOpenDeleteDialog(false);
    navigate('/settings/default-model', { replace: true });
  };

  // ========================================================================
  // 编辑供应商相关函数
  // ========================================================================

  const handleEditProviderName = () => {
    if (provider) {
      setEditProviderName(provider.name);
      setEditProviderType(provider.providerType || '');
      setOpenEditProviderDialog(true);
    }
  };

  const handleSaveProviderName = () => {
    if (provider && editProviderName.trim()) {
      dispatch(updateProvider({
        id: provider.id,
        updates: {
          name: editProviderName.trim(),
          providerType: editProviderType
        }
      }));
      setOpenEditProviderDialog(false);
      setEditProviderName('');
      setEditProviderType('');
    }
  };

  // ========================================================================
  // 自定义请求头相关函数
  // ========================================================================

  const handleAddHeader = () => {
    if (newHeaderKey.trim() && newHeaderValue.trim()) {
      setExtraHeaders(prev => ({
        ...prev,
        [newHeaderKey.trim()]: newHeaderValue.trim()
      }));
      setNewHeaderKey('');
      setNewHeaderValue('');
    }
  };

  const handleRemoveHeader = (key: string) => {
    setExtraHeaders(prev => {
      const newHeaders = { ...prev };
      delete newHeaders[key];
      return newHeaders;
    });
  };

  const handleUpdateHeader = (oldKey: string, newKey: string, newValue: string) => {
    setExtraHeaders(prev => {
      const newHeaders = { ...prev };
      if (oldKey !== newKey) {
        delete newHeaders[oldKey];
      }
      newHeaders[newKey] = newValue;
      return newHeaders;
    });
  };

  // ========================================================================
  // 自定义请求体相关函数
  // ========================================================================

  const handleAddBody = () => {
    if (newBodyKey.trim() && newBodyValue.trim()) {
      try {
        // 尝试解析JSON值
        let parsedValue: any = newBodyValue.trim();
        try {
          parsedValue = JSON.parse(parsedValue);
        } catch {
          // 如果不是有效的JSON，尝试解析为数字或布尔值
          if (parsedValue === 'true') parsedValue = true;
          else if (parsedValue === 'false') parsedValue = false;
          else if (parsedValue === 'null') parsedValue = null;
          else if (/^-?\d+$/.test(parsedValue)) parsedValue = parseInt(parsedValue, 10);
          else if (/^-?\d*\.\d+$/.test(parsedValue)) parsedValue = parseFloat(parsedValue);
          // 否则保持为字符串
        }
        
        setExtraBody(prev => ({
          ...prev,
          [newBodyKey.trim()]: parsedValue
        }));
        setNewBodyKey('');
        setNewBodyValue('');
      } catch (error) {
        console.error('解析body值失败:', error);
      }
    }
  };

  const handleRemoveBody = (key: string) => {
    setExtraBody(prev => {
      const newBody = { ...prev };
      delete newBody[key];
      return newBody;
    });
  };

  const handleUpdateBody = (oldKey: string, newKey: string, newValue: string) => {
    try {
      // 尝试解析JSON值
      let parsedValue: any = newValue.trim();
      try {
        parsedValue = JSON.parse(parsedValue);
      } catch {
        // 如果不是有效的JSON，尝试解析为数字或布尔值
        if (parsedValue === 'true') parsedValue = true;
        else if (parsedValue === 'false') parsedValue = false;
        else if (parsedValue === 'null') parsedValue = null;
        else if (/^-?\d+$/.test(parsedValue)) parsedValue = parseInt(parsedValue, 10);
        else if (/^-?\d*\.\d+$/.test(parsedValue)) parsedValue = parseFloat(parsedValue);
        // 否则保持为字符串
      }
      
      setExtraBody(prev => {
        const newBody = { ...prev };
        if (oldKey !== newKey) {
          delete newBody[oldKey];
        }
        newBody[newKey] = parsedValue;
        return newBody;
      });
    } catch (error) {
      console.error('更新body值失败:', error);
    }
  };

  // ========================================================================
  // 自定义模型端点相关函数
  // ========================================================================

  const handleOpenCustomEndpointDialog = () => {
    setCustomModelEndpoint((provider as any)?.customModelEndpoint || '');
    setCustomEndpointError('');
    setOpenCustomEndpointDialog(true);
  };

  const handleSaveCustomEndpoint = () => {
    const endpoint = customModelEndpoint.trim();

    // 验证URL是否完整
    if (!endpoint) {
      setCustomEndpointError(t('modelSettings.provider.endpointRequired'));
      return;
    }

    if (!isValidUrl(endpoint)) {
      setCustomEndpointError(t('modelSettings.provider.invalidEndpointUrl'));
      return;
    }

    // 保存自定义端点并打开模型管理对话框
    // 同时保存当前连接配置，保证打开对话框前 Redux 是最新值
    if (provider) {
      if (!validateAndUpdateProvider({ customModelEndpoint: endpoint })) {
        return;
      }

      setOpenCustomEndpointDialog(false);
      setOpenModelManagementDialog(true);
    }
  };

  // ========================================================================
  // 模型管理函数
  // ========================================================================

  const handleAddModel = () => {
    if (provider && newModelName && newModelValue) {
      logModelOperation('添加模型', { name: newModelName, value: newModelValue, provider: provider.id });
      
      // 检查模型是否已存在
      const modelExists = provider.models.some(m => 
        modelMatchesIdentity(m, { id: newModelValue, provider: provider.id }, provider.id)
      );

      if (modelExists) {
        logModelOperation('添加失败 - 模型已存在', { modelId: newModelValue });
        toastManager.error(t('modelSettings.provider.modelExists'));
        return;
      }

      // 创建新模型对象
      const newModel: Model = {
        id: newModelValue,
        name: newModelName,
        provider: provider.id,
        providerType: provider.providerType,
        enabled: true,
        isDefault: false
      };

      // 创建更新后的模型数组
      const updatedModels = [...provider.models, newModel];

      // 只保存模型列表
      if (updateProviderModels(updatedModels)) {
        logModelOperation('添加成功', { modelId: newModel.id, totalModels: updatedModels.length });
        // 清理状态
        setNewModelName('');
        setNewModelValue('');
        setOpenAddModelDialog(false);
        toastManager.success(t('modelSettings.provider.modelAdded'));
      }
    }
  };

  const handleEditModel = (updatedModel: Model) => {
    if (provider && updatedModel && modelToEdit) {
      logModelOperation('编辑模型', { oldId: modelToEdit.id, newId: updatedModel.id, name: updatedModel.name });
      
      // 查找并替换原有模型（保持位置不变）
      const updatedModels = provider.models.map(m =>
        modelMatchesIdentity(m, modelToEdit, provider.id) ? updatedModel : m
      );

      // 只保存模型列表
      if (updateProviderModels(updatedModels)) {
        logModelOperation('编辑成功', { modelId: updatedModel.id });
        // 清理状态
        setModelToEdit(undefined);
        setOpenEditModelDialog(false);
      }
    }
  };

  const handleDeleteModel = useCallback((modelId: string) => {
    if (provider) {
      logModelOperation('删除模型', { modelId, provider: provider.id });
      
      // 使用精确匹配删除模型（匹配 id + provider 组合）
      const beforeCount = provider.models.length;
      const updatedModels = provider.models.filter(model => 
        !modelMatchesIdentity(model, { id: modelId, provider: provider.id }, provider.id)
      );
      
      logModelOperation('删除结果', { 
        beforeCount, 
        afterCount: updatedModels.length, 
        deleted: beforeCount - updatedModels.length 
      });

      // 只保存模型列表
      updateProviderModels(updatedModels);
    }
  }, [provider, updateProviderModels]);

  const openModelEditDialog = useCallback((model: Model) => {
    setModelToEdit(model);
    setNewModelName(model.name);
    setNewModelValue(model.id); // 使用模型ID作为value
    setOpenEditModelDialog(true);
  }, [setModelToEdit, setNewModelName, setNewModelValue, setOpenEditModelDialog]);

  const handleAddModelFromApi = useCallback((model: Model) => {
    if (provider) {
      // 创建新模型对象
      const newModel: Model = {
        ...model,
        provider: provider.id,
        providerType: provider.providerType,
        enabled: true
      };

      // 检查模型是否已存在（使用精确匹配：{id, provider}组合）
      const modelExists = provider.models.some(m => 
        modelMatchesIdentity(m, { id: model.id, provider: provider.id }, provider.id)
      );
      if (modelExists) {
        // 如果模型已存在，不添加
        return;
      }

      // 创建更新后的模型数组
      const updatedModels = [...provider.models, newModel];

      // 只保存模型列表
      updateProviderModels(updatedModels);
    }
  }, [provider, updateProviderModels]);

  // 批量添加多个模型
  const handleBatchAddModels = useCallback((addedModels: Model[]) => {
    if (provider && addedModels.length > 0) {
      logModelOperation('批量添加', { count: addedModels.length });
      
      // 获取所有不存在的模型（使用精确匹配：{id, provider}组合）
      const newModels = addedModels.filter(model =>
        !provider.models.some(m => 
          modelMatchesIdentity(m, { id: model.id, provider: provider.id }, provider.id)
        )
      ).map(model => ({
        ...model,
        provider: provider.id,
        providerType: provider.providerType,
        enabled: true
      }));

      if (newModels.length === 0) {
        logModelOperation('批量添加跳过 - 无新模型', {});
        return;
      }
      
      logModelOperation('批量添加实际数量', { newCount: newModels.length });

      // 创建更新后的模型数组
      const updatedModels = [...provider.models, ...newModels];

      // 只保存模型列表
      updateProviderModels(updatedModels);
    }
  }, [provider, updateProviderModels]);

  // 批量删除多个模型
  const handleBatchRemoveModels = useCallback((modelIds: string[]) => {
    if (provider && modelIds.length > 0) {
      logModelOperation('批量删除', { count: modelIds.length, modelIds });
      
      // 使用精确匹配过滤要删除的模型（使用 Set 优化查找性能）
      const deleteSet = new Set(modelIds);
      const beforeCount = provider.models.length;
      const updatedModels = provider.models.filter(model => 
        !deleteSet.has(model.id) || (model.provider || provider.id) !== provider.id
      );
      
      logModelOperation('批量删除结果', { 
        beforeCount, 
        afterCount: updatedModels.length, 
        deleted: beforeCount - updatedModels.length 
      });

      // 只保存模型列表
      updateProviderModels(updatedModels);
    }
  }, [provider, updateProviderModels]);


  const handleOpenModelManagement = () => {
    // 验证URL有效性
    if (baseUrl && !isValidUrl(baseUrl)) {
      setBaseUrlError(t('modelSettings.provider.invalidUrl'));
      toastManager.error(t('modelSettings.provider.invalidUrl'));
      return;
    }

    // 在打开对话框前，先保存当前输入的配置到 Redux
    // 这样 ModelManagementDialog 就能使用最新的 apiKey 和 baseUrl
    if (!validateAndUpdateProvider({})) {
      return;
    }

    setOpenModelManagementDialog(true);
  };

  // ========================================================================
  // 返回所有状态和方法
  // ========================================================================

  return {
    // 状态
    apiKey,
    setApiKey,
    baseUrl,
    setBaseUrl,
    isEnabled,
    setIsEnabled,
    openAddModelDialog,
    setOpenAddModelDialog,
    openDeleteDialog,
    setOpenDeleteDialog,
    openEditModelDialog,
    setOpenEditModelDialog,
    modelToEdit,
    setModelToEdit,
    newModelName,
    setNewModelName,
    newModelValue,
    setNewModelValue,
    baseUrlError,
    setBaseUrlError,
    openModelManagementDialog,
    setOpenModelManagementDialog,
    isTesting,
    testResult,
    setTestResult,
    testSnackbarOpen,
    setTestSnackbarOpen,
    testingModelId: testingModelId.value, // 从 Signals 导出
    testResultDialogOpen,
    setTestResultDialogOpen,
    openEditProviderDialog,
    setOpenEditProviderDialog,
    editProviderName,
    setEditProviderName,
    editProviderType,
    setEditProviderType,
    extraHeaders,
    setExtraHeaders,
    newHeaderKey,
    setNewHeaderKey,
    newHeaderValue,
    setNewHeaderValue,
    extraBody,
    setExtraBody,
    newBodyKey,
    setNewBodyKey,
    newBodyValue,
    setNewBodyValue,
    openAdvancedConfigDialog,
    setOpenAdvancedConfigDialog,
    customModelEndpoint,
    setCustomModelEndpoint,
    openCustomEndpointDialog,
    setOpenCustomEndpointDialog,
    customEndpointError,
    setCustomEndpointError,
    multiKeyEnabled,
    setMultiKeyEnabled,
    // Responses API 开关状态
    useResponsesAPI,
    setUseResponsesAPI,
    // showApiKey 不再从这里返回，直接在组件中导入使用
    keyManager,
    buttonStyles,

    // 方法
    handleApiKeysChange,
    handleStrategyChange,
    handleToggleMultiKey,
    toggleShowApiKey,
    handleBack,
    handleSave,
    handleDelete,
    handleEditProviderName,
    handleSaveProviderName,
    handleAddHeader,
    handleRemoveHeader,
    handleUpdateHeader,
    handleAddBody,
    handleRemoveBody,
    handleUpdateBody,
    handleOpenCustomEndpointDialog,
    handleSaveCustomEndpoint,
    handleAddModel,
    handleEditModel,
    handleDeleteModel,
    openModelEditDialog,
    handleAddModelFromApi,
    handleBatchAddModels,
    handleBatchRemoveModels,
    handleOpenModelManagement,
    handleTestConnection,
    handleTestModelConnection,
  };
};

