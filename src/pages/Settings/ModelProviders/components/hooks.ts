import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch } from '../../../../shared/store';
import { updateProvider, deleteProvider } from '../../../../shared/store/settingsSlice';
import type { Model } from '../../../../shared/types';
import type { ApiKeyConfig, LoadBalanceStrategy } from '../../../../shared/config/defaultModels';
import { isValidUrl } from '../../../../shared/utils';
import ApiKeyManager from '../../../../shared/services/ApiKeyManager';
import { testApiConnection } from '../../../../shared/aiCore/legacy/clients';
import { modelMatchesIdentity } from '../../../../shared/utils/modelUtils';
import { CONSTANTS, STYLES, useDebounce } from './constants';
import { 
  testingModelId, 
  showApiKey, 
  startTestingModel, 
  finishTestingModel,
  resetProviderSignals 
} from './providerSignals';

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
  const dispatch = useAppDispatch();

  // 异步操作取消引用
  const abortControllerRef = useRef<AbortController | null>(null);

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
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  // testingModelId 已改用 Signals 管理
  const [testResultDialogOpen, setTestResultDialogOpen] = useState(false);

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

  // 防抖处理的URL输入
  const debouncedBaseUrl = useDebounce(baseUrl, CONSTANTS.DEBOUNCE_DELAY);

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
    }
  }, [provider]);

  // 组件卸载时取消正在进行的异步操作并重置 Signals
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      resetProviderSignals();
    };
  }, []);

  // 防抖URL验证
  useEffect(() => {
    if (debouncedBaseUrl && !isValidUrl(debouncedBaseUrl)) {
      setBaseUrlError('请输入有效的URL');
    } else {
      setBaseUrlError('');
    }
  }, [debouncedBaseUrl]);

  // 测试结果显示逻辑 - 使用常量替换硬编码值
  const shouldShowDetailDialog = useMemo(() => {
    return testResult && testResult.message && testResult.message.length > CONSTANTS.MESSAGE_LENGTH_THRESHOLD;
  }, [testResult]);

  useEffect(() => {
    // 当有测试结果时，如果内容较长则自动打开详细对话框
    if (shouldShowDetailDialog) {
      setTestResultDialogOpen(true);
    }
  }, [shouldShowDetailDialog]);

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
            maxFailuresBeforeDisable: provider.keyManagement?.maxFailuresBeforeDisable || 3,
            failureRecoveryTime: provider.keyManagement?.failureRecoveryTime || 5,
            enableAutoRecovery: provider.keyManagement?.enableAutoRecovery || true
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
        const currentKey = provider.apiKey;
        if (currentKey) {
          const initialKeys = [keyManager.createApiKeyConfig(currentKey, '主要密钥', 1)];
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
        }
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
      setBaseUrlError('请输入有效的URL');
      return false;
    }

    try {
      dispatch(updateProvider({
        id: provider.id,
        updates: {
          apiKey,
          baseUrl: baseUrl.trim(),
          isEnabled,
          extraHeaders,
          extraBody,
          ...updates
        }
      }));
      return true;
    } catch (error) {
      console.error('保存配置失败:', error);
      setBaseUrlError('保存配置失败，请重试');
      return false;
    }
  }, [provider, baseUrl, apiKey, isEnabled, extraHeaders, extraBody, dispatch]);

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
    setCustomModelEndpoint('');
    setCustomEndpointError('');
    setOpenCustomEndpointDialog(true);
  };

  const handleSaveCustomEndpoint = () => {
    const endpoint = customModelEndpoint.trim();

    // 验证URL是否完整
    if (!endpoint) {
      setCustomEndpointError('请输入端点URL');
      return;
    }

    if (!isValidUrl(endpoint)) {
      setCustomEndpointError('请输入有效的完整URL');
      return;
    }

    // 保存自定义端点并打开模型管理对话框
    if (provider) {
      // 临时保存自定义端点到provider中
      dispatch(updateProvider({
        id: provider.id,
        updates: {
          customModelEndpoint: endpoint
        }
      }));

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
        setTestResult({ success: false, message: '模型已存在，请勿重复添加' });
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

      // 验证并更新所有配置
      if (validateAndUpdateProvider({ models: updatedModels })) {
        logModelOperation('添加成功', { modelId: newModel.id, totalModels: updatedModels.length });
        // 清理状态
        setNewModelName('');
        setNewModelValue('');
        setOpenAddModelDialog(false);
        setTestResult({ success: true, message: '模型添加成功' });
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

      // 验证并更新所有配置
      if (validateAndUpdateProvider({ models: updatedModels })) {
        logModelOperation('编辑成功', { modelId: updatedModel.id });
        // 清理状态
        setModelToEdit(undefined);
        setOpenEditModelDialog(false);
      }
    }
  };

  const handleDeleteModel = (modelId: string) => {
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

      // 验证并更新所有配置
      validateAndUpdateProvider({ models: updatedModels });
    }
  };

  const openModelEditDialog = (model: Model) => {
    setModelToEdit(model);
    setNewModelName(model.name);
    setNewModelValue(model.id); // 使用模型ID作为value
    setOpenEditModelDialog(true);
  };

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

      // 验证并更新所有配置
      validateAndUpdateProvider({ models: updatedModels });
    }
  }, [provider, validateAndUpdateProvider]);

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

      // 验证并更新所有配置
      validateAndUpdateProvider({ models: updatedModels });
    }
  }, [provider, validateAndUpdateProvider]);

  // 批量删除多个模型
  const handleBatchRemoveModels = useCallback((modelIds: string[]) => {
    if (provider && modelIds.length > 0) {
      logModelOperation('批量删除', { count: modelIds.length, modelIds });
      
      // 使用精确匹配过滤要删除的模型（使用 Set 优化查找性能）
      const deleteSet = new Set(modelIds);
      const beforeCount = provider.models.length;
      const updatedModels = provider.models.filter(model => 
        !deleteSet.has(model.id) || model.provider !== provider.id
      );
      
      logModelOperation('批量删除结果', { 
        beforeCount, 
        afterCount: updatedModels.length, 
        deleted: beforeCount - updatedModels.length 
      });

      // 验证并更新所有配置
      validateAndUpdateProvider({ models: updatedModels });
    }
  }, [provider, validateAndUpdateProvider]);


  const handleOpenModelManagement = () => {
    // 验证URL有效性
    if (baseUrl && !isValidUrl(baseUrl)) {
      setBaseUrlError('请输入有效的URL');
      alert('请输入有效的基础URL');
      return;
    }
    
    // 在打开对话框前，先保存当前输入的配置到 Redux
    // 这样 ModelManagementDialog 就能使用最新的 apiKey 和 baseUrl
    if (provider) {
      dispatch(updateProvider({
        id: provider.id,
        updates: {
          apiKey,
          baseUrl: baseUrl.trim(),
          isEnabled,
          extraHeaders,
          extraBody
        }
      }));
    }
    
    setOpenModelManagementDialog(true);
  };

  // ========================================================================
  // API测试功能
  // ========================================================================

  const handleTestConnection = useCallback(async () => {
    if (!provider) return;

    // 验证URL有效性
    if (baseUrl && !isValidUrl(baseUrl)) {
      setBaseUrlError('请输入有效的URL');
      setTestResult({ success: false, message: '请输入有效的基础URL' });
      return;
    }

    // 取消之前的请求
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // 创建新的 AbortController
    abortControllerRef.current = new AbortController();

    // 开始测试
    setIsTesting(true);
    setTestResult(null);

    try {
      // 确定要使用的 API Key
      let testApiKey = apiKey;
      
      // 如果启用了多 Key 模式，从可用的 Key 中选择一个
      if (multiKeyEnabled && provider.apiKeys && provider.apiKeys.length > 0) {
        const keySelection = keyManager.selectApiKey(
          provider.apiKeys,
          provider.keyManagement?.strategy || 'round_robin'
        );
        
        if (keySelection.key) {
          testApiKey = keySelection.key.key;
          console.log(`[handleTestConnection] 多 Key 模式: 使用 ${keySelection.key.name || keySelection.key.id}`);
        } else {
          throw new Error('没有可用的 API Key。请检查多 Key 配置。');
        }
      }

      // 创建一个模拟模型对象，包含当前输入的API配置
      const testModel = {
        id: provider.models.length > 0 ? provider.models[0].id : 'gpt-3.5-turbo',
        name: provider.name,
        provider: provider.id,
        providerType: provider.providerType,
        apiKey: testApiKey,
        baseUrl: baseUrl,
        enabled: true
      };

      // 调用测试连接API
      const success = await testApiConnection(testModel);

      // 检查是否被取消
      if (abortControllerRef.current?.signal.aborted) {
        return;
      }

      if (success) {
        setTestResult({ success: true, message: '连接成功！API配置有效。' });
      } else {
        setTestResult({ success: false, message: '连接失败，请检查API密钥和基础URL是否正确。' });
      }
    } catch (error) {
      // 检查是否是取消操作
      if (error instanceof Error && error.name === 'AbortError') {
        return;
      }

      console.error('测试API连接时出错:', error);
      setTestResult({
        success: false,
        message: `连接错误: ${error instanceof Error ? error.message : String(error)}`
      });
    } finally {
      setIsTesting(false);
      abortControllerRef.current = null;
    }
  }, [provider, baseUrl, apiKey, multiKeyEnabled, keyManager]);

  // 增强的测试单个模型的函数
  const handleTestModelConnection = async (model: Model) => {
    if (!provider) return;

    // 使用 Signals 管理测试状态
    startTestingModel(model.id);
    setTestResult(null);

    try {
      // 确定要使用的 API Key
      let testApiKey = apiKey;
      
      // 如果启用了多 Key 模式，从可用的 Key 中选择一个
      if (multiKeyEnabled && provider.apiKeys && provider.apiKeys.length > 0) {
        const keySelection = keyManager.selectApiKey(
          provider.apiKeys,
          provider.keyManagement?.strategy || 'round_robin'
        );
        
        if (keySelection.key) {
          testApiKey = keySelection.key.key;
          console.log(`[handleTestModelConnection] 多 Key 模式: 使用 ${keySelection.key.name || keySelection.key.id}`);
        } else {
          throw new Error('没有可用的 API Key。请检查多 Key 配置。');
        }
      }

      // 创建测试模型对象，使用当前保存的API配置
      const testModel = {
        ...model,
        provider: provider.id, // 确保包含 provider 信息
        providerType: provider.providerType, // 确保包含 providerType
        apiKey: testApiKey,
        baseUrl: baseUrl,
        enabled: true
      };

      // 直接使用 testApiConnection，它会使用模型对象的配置进行测试
      // 而不会去数据库中查找，这样即使模型还未添加到 provider 也可以测试
      const success = await testApiConnection(testModel);

      if (success) {
        // 使用 Signals 更新测试结果
        finishTestingModel(true, `模型 ${model.name} 连接成功！`);
        setTestResult({
          success: true,
          message: `模型 ${model.name} 连接成功！`
        });
      } else {
        finishTestingModel(false, `模型 ${model.name} 连接失败，请检查API密钥和基础URL是否正确。`);
        setTestResult({
          success: false,
          message: `模型 ${model.name} 连接失败，请检查API密钥和基础URL是否正确。`
        });
      }
    } catch (error) {
      console.error('测试模型连接时出错:', error);
      const errorMsg = `连接错误: ${error instanceof Error ? error.message : String(error)}`;
      finishTestingModel(false, errorMsg);
      setTestResult({
        success: false,
        message: errorMsg
      });
    }
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

