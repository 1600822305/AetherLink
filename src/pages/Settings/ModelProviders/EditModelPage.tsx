import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Box,
  Button,
  AppBar,
  Toolbar,
  IconButton,
  Typography,
  useTheme,
  alpha,
} from '@mui/material';
import { ArrowLeft } from 'lucide-react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useAppSelector, useAppDispatch } from '../../../shared/store';
import { updateProvider } from '../../../shared/store/settingsSlice';
import { SafeAreaContainer } from '../../../components/settings/SettingComponents';
import Scrollbar from '../../../components/Scrollbar';
import { SolidBridge } from '../../../shared/bridges/SolidBridge';
import { EditModelForm } from '../../../solid/components/ModelEditor/EditModelForm.solid';
import AvatarUploader from '../../../components/settings/AvatarUploader';
import ModelTypeManagement from '../../../components/settings/ModelTypeManagement';
import type { Model, ModelTypeRule } from '../../../shared/types';
import { ModelType } from '../../../shared/types';
import { matchModelTypes, defaultModelTypeRules } from '../../../shared/data/modelTypeRules';
import { getDefaultModelProviders } from '../../../shared/config/defaultModels';
import { modelMatchesIdentity } from '../../../shared/utils/modelUtils';
import { dexieStorage } from '../../../shared/services/storage/DexieStorageService';

const EditModelPage: React.FC = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { providerId } = useParams<{ providerId: string }>();
  const [searchParams] = useSearchParams();
  const targetModelId = searchParams.get('mid') || '';

  const provider = useAppSelector(state =>
    state.settings.providers.find(p => p.id === providerId)
  );

  // 原始模型（用于保存时按身份匹配替换，避免改 ID 后找不到）
  const editModel = useMemo(
    () => provider?.models.find(m => m.id === targetModelId),
    [provider, targetModelId]
  );
  const originalModelRef = useRef<Model | undefined>(undefined);

  // 表单状态
  const [modelData, setModelData] = useState<Model>({
    id: '',
    name: '',
    provider: 'openai',
    enabled: true,
    isDefault: false,
  });
  const [nameError, setNameError] = useState('');
  const [modelTypes, setModelTypes] = useState<ModelType[]>([ModelType.Chat]);
  const [autoDetectTypes, setAutoDetectTypes] = useState(true);
  const [modelAvatar, setModelAvatar] = useState('');
  const [isAvatarDialogOpen, setIsAvatarDialogOpen] = useState(false);
  const [openTypeManagement, setOpenTypeManagement] = useState(false);
  const [modelTypeRules, setModelTypeRules] = useState<ModelTypeRule[]>([]);
  const [initialized, setInitialized] = useState(false);

  // 主题模式
  const themeMode = theme.palette.mode as 'light' | 'dark';

  // 提供商下拉选项
  const providerOptions = useMemo(
    () => getDefaultModelProviders().filter(p => !p.isSystem).map(p => ({ id: p.id, name: p.name })),
    []
  );

  // 注入主题 CSS 变量供 SolidJS 组件使用（与 ModelManagementDialogSolid 一致）
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--theme-bg-paper', theme.palette.background.paper);
    root.style.setProperty('--theme-bg-default', theme.palette.background.default);
    root.style.setProperty('--theme-text-primary', theme.palette.text.primary);
    root.style.setProperty('--theme-text-secondary', theme.palette.text.secondary);
    root.style.setProperty('--theme-primary', theme.palette.primary.main);
    root.style.setProperty('--theme-error', theme.palette.error.main);
    root.style.setProperty('--theme-border-default', alpha(theme.palette.text.primary, 0.23));
    root.style.setProperty('--theme-hover-bg', alpha(theme.palette.text.primary, 0.04));
    root.style.setProperty('--theme-primary-bg', alpha(theme.palette.primary.main, 0.12));
    root.style.setProperty('--theme-primary-border', alpha(theme.palette.primary.main, 0.3));
    root.style.setProperty('--theme-error-bg', alpha(theme.palette.error.main, 0.15));
  }, [theme]);

  // 初始化表单数据
  useEffect(() => {
    if (!editModel || initialized) return;
    originalModelRef.current = editModel;
    setModelData(editModel);

    if (editModel.modelTypes) {
      setModelTypes(editModel.modelTypes);
      setAutoDetectTypes(false);
    } else {
      setModelTypes(matchModelTypes(editModel.id, editModel.provider));
      setAutoDetectTypes(true);
    }

    (async () => {
      try {
        const modelConfig = await dexieStorage.getModel(editModel.id);
        if (modelConfig?.avatar) {
          setModelAvatar(modelConfig.avatar);
        }
      } catch (error) {
        console.error('[EditModelPage] 加载模型头像失败:', error);
      }
    })();

    setInitialized(true);
  }, [editModel, initialized]);

  // 加载模型类型规则
  useEffect(() => {
    (async () => {
      try {
        const rules = await dexieStorage.getSetting('modelTypeRules');
        setModelTypeRules(rules || defaultModelTypeRules);
      } catch (error) {
        console.error('[EditModelPage] 加载模型类型规则失败:', error);
        setModelTypeRules(defaultModelTypeRules);
      }
    })();
  }, []);

  const handleBack = useCallback(() => {
    navigate(`/settings/model-provider/${providerId}`);
  }, [navigate, providerId]);

  // 字段变更
  const handleNameChange = (value: string) => {
    setModelData(prev => ({ ...prev, name: value }));
    if (nameError) setNameError('');
  };

  const handleModelIdChange = (value: string) => {
    setModelData(prev => ({ ...prev, id: value }));
    if (autoDetectTypes) {
      setModelTypes(matchModelTypes(value, modelData.provider));
    }
  };

  const handleProviderChange = (value: string) => {
    setModelData(prev => ({ ...prev, provider: value }));
    if (autoDetectTypes) {
      setModelTypes(matchModelTypes(modelData.id, value));
    }
  };

  const handleToggleType = (type: string) => {
    if (autoDetectTypes) return;
    const t = type as ModelType;
    setModelTypes(prev => {
      const next = prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t];
      return next.length === 0 ? [ModelType.Chat] : next;
    });
  };

  const handleAutoDetectChange = (autoDetect: boolean) => {
    setAutoDetectTypes(autoDetect);
    if (autoDetect) {
      setModelTypes(matchModelTypes(modelData.id, modelData.provider));
    }
  };

  // 头像
  const handleSaveAvatar = async (avatarDataUrl: string) => {
    setModelAvatar(avatarDataUrl);
    if (modelData.id) {
      try {
        const { saveModelAvatar } = await import('../../../shared/utils/avatarUtils');
        await saveModelAvatar(modelData.id, avatarDataUrl);
      } catch (error) {
        console.error('[EditModelPage] 保存模型头像失败:', error);
      }
    }
  };

  // 模型类型规则保存
  const handleSaveRules = async (rules: ModelTypeRule[]) => {
    setModelTypeRules(rules);
    try {
      await dexieStorage.saveSetting('modelTypeRules', rules);
    } catch (error) {
      console.error('[EditModelPage] 保存模型类型规则失败:', error);
    }
  };

  // 保存模型
  const handleSave = async () => {
    if (!modelData.name.trim()) {
      setNameError('请输入模型名称');
      return;
    }
    if (!provider || !originalModelRef.current) return;

    const original = originalModelRef.current;
    const finalModelData: Model = {
      ...modelData,
      modelTypes: autoDetectTypes ? undefined : modelTypes,
      capabilities: {
        ...modelData.capabilities,
        multimodal: modelTypes.includes(ModelType.Vision),
      },
    };

    // ID 变化时，把头像迁移到新 ID
    if (original.id !== finalModelData.id && modelAvatar) {
      try {
        await dexieStorage.saveModel(finalModelData.id, {
          id: finalModelData.id,
          avatar: modelAvatar,
          updatedAt: new Date().toISOString(),
        });
      } catch (error) {
        console.error('[EditModelPage] 迁移模型头像失败:', error);
      }
    }

    try {
      await dexieStorage.saveModel(finalModelData.id, {
        ...finalModelData,
        avatar: modelAvatar,
        updatedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error('[EditModelPage] 保存模型配置到数据库失败:', error);
    }

    const updatedModels = provider.models.map(m =>
      modelMatchesIdentity(m, original, provider.id) ? finalModelData : m
    );
    dispatch(updateProvider({ id: provider.id, updates: { models: updatedModels } }));
    navigate(`/settings/model-provider/${providerId}`);
  };

  if (!provider) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography>未找到对应的供应商</Typography>
        <Button onClick={handleBack}>返回</Button>
      </Box>
    );
  }

  if (!editModel) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography>未找到要编辑的模型</Typography>
        <Button onClick={handleBack}>返回</Button>
      </Box>
    );
  }

  return (
    <SafeAreaContainer>
      <AppBar
        position="static"
        elevation={0}
        sx={{
          bgcolor: 'background.paper',
          color: 'text.primary',
          borderBottom: 1,
          borderColor: 'divider',
          backdropFilter: 'blur(8px)',
        }}
      >
        <Toolbar>
          <IconButton
            edge="start"
            onClick={handleBack}
            aria-label="back"
            sx={{ color: (t) => t.palette.primary.main }}
          >
            <ArrowLeft size={20} />
          </IconButton>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1, fontWeight: 600 }}>
            编辑模型
          </Typography>
          <Button onClick={handleSave} variant="contained" sx={{ borderRadius: 2, textTransform: 'none' }}>
            保存
          </Button>
        </Toolbar>
      </AppBar>

      <Scrollbar
        style={{
          flexGrow: 1,
          padding: '16px',
          paddingBottom: 'var(--content-bottom-padding)',
        }}
      >
        <SolidBridge
          component={EditModelForm as any}
          props={{
            name: modelData.name,
            modelId: modelData.id,
            provider: modelData.provider,
            avatar: modelAvatar,
            modelTypes: modelTypes as string[],
            autoDetect: autoDetectTypes,
            nameError,
            providerOptions,
            themeMode,
            onNameChange: handleNameChange,
            onModelIdChange: handleModelIdChange,
            onProviderChange: handleProviderChange,
            onToggleType: handleToggleType,
            onAutoDetectChange: handleAutoDetectChange,
            onOpenAvatar: () => setIsAvatarDialogOpen(true),
            onOpenTypeManagement: () => setOpenTypeManagement(true),
          }}
          debugName="EditModelForm"
          debug={process.env.NODE_ENV === 'development'}
          onError={(error) => console.error('[EditModelPage] SolidJS 组件错误:', error)}
        />
      </Scrollbar>

      {/* 头像上传对话框（React/MUI） */}
      <AvatarUploader
        open={isAvatarDialogOpen}
        onClose={() => setIsAvatarDialogOpen(false)}
        onSave={handleSaveAvatar}
        currentAvatar={modelAvatar}
        title="设置模型头像"
      />

      {/* 模型类型规则管理对话框（React/MUI） */}
      <ModelTypeManagement
        open={openTypeManagement}
        onClose={() => setOpenTypeManagement(false)}
        rules={modelTypeRules}
        onSave={handleSaveRules}
        modelId={modelData.id}
        provider={modelData.provider}
      />
    </SafeAreaContainer>
  );
};

export default EditModelPage;
