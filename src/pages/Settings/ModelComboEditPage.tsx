import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Typography,
  IconButton,
  TextField,
  FormControl,
  Select,
  MenuItem,
  Button,
  alpha,
  useTheme,
} from '@mui/material';
import { useNavigate, useParams } from 'react-router-dom';
import { Plus as AddIcon, Trash2 as DeleteIcon, Brain, Sparkles, ArrowRight, GitCompare, Save } from 'lucide-react';
import { useSelector } from 'react-redux';
import type { RootState } from '../../shared/store';
import { ModelSelector } from '../ChatPage/components/ModelSelector';
import { getModelIdentityKey, modelMatchesIdentity, parseModelIdentityKey } from '../../shared/utils/modelUtils';
import CustomSwitch from '../../components/CustomSwitch';
import { useTranslation } from 'react-i18next';
import { modelComboService } from '../../shared/services/ai/ModelComboService';
import { useModelComboSync } from '../../shared/hooks/useModelComboSync';
import {
  SafeAreaContainer,
  Container,
  HeaderBar,
  SettingGroup,
  Row,
  YStack,
} from '../../components/settings/SettingComponents';

import type { ModelComboStrategy, ModelComboFormData } from '../../shared/types/ModelCombo';

const ModelComboEditPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const theme = useTheme();
  const { comboId } = useParams<{ comboId: string }>();
  const isEditing = comboId && comboId !== 'new';

  const { syncModelCombos } = useModelComboSync();

  const [formData, setFormData] = useState<ModelComboFormData>({
    name: '',
    description: '',
    strategy: 'sequential',
    enabled: true,
    models: [
      { modelId: '', role: 'thinking', weight: 1, priority: 1 },
      { modelId: '', role: 'generating', weight: 1, priority: 2 }
    ]
  });
  const [loading, setLoading] = useState(false);
  const [openSelectorIndex, setOpenSelectorIndex] = useState<number | null>(null);

  const modelSelectorStyle = useSelector((state: RootState) => state.settings.modelSelectorStyle);
  const isDialogStyle = modelSelectorStyle !== 'dropdown';

  // 获取所有可用模型
  const providers = useSelector((state: RootState) => state.settings.providers);
  const availableModels = useMemo(() => (
    providers
      .filter(provider => provider.id !== 'model-combo' && provider.isEnabled)
      .flatMap(provider =>
        provider.models
          .filter(model => model.enabled)
          .map(model => ({
            ...model,
            provider: model.provider || provider.id,
            providerId: provider.id,
            identityKey: getModelIdentityKey({ id: model.id, provider: model.provider || provider.id })
          }))
      )
  ), [providers]);

  // 加载现有组合数据
  useEffect(() => {
    const loadCombo = async () => {
      if (isEditing) {
        try {
          const combos = await modelComboService.getAllCombos();
          const combo = combos.find(c => c.id === comboId);
          if (combo) {
            const normalizedModels = combo.models.map(m => {
              const parsedIdentity = parseModelIdentityKey(m.modelId);
              if (parsedIdentity) {
                return {
                  modelId: getModelIdentityKey(parsedIdentity),
                  role: m.role,
                  weight: m.weight,
                  priority: m.priority
                };
              }
              const matchedModel = availableModels.find(model =>
                model.id === m.modelId || (model as any).identityKey === m.modelId
              );
              const fallbackIdentity = matchedModel
                ? getModelIdentityKey({ id: matchedModel.id, provider: matchedModel.provider || matchedModel.providerId })
                : getModelIdentityKey({ id: m.modelId, provider: '' });
              return {
                modelId: fallbackIdentity,
                role: m.role,
                weight: m.weight,
                priority: m.priority
              };
            });

            setFormData({
              name: combo.name,
              description: combo.description || '',
              strategy: combo.strategy,
              enabled: combo.enabled,
              models: normalizedModels
            });
          }
        } catch (error) {
          console.error('加载模型组合失败:', error);
        }
      }
    };
    loadCombo();
  }, [comboId, isEditing, availableModels]);

  const handleBack = () => {
    navigate('/settings/model-combo');
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      // 为 models 添加 id 字段
      const dataToSave = {
        ...formData,
        models: formData.models.map((m, index) => ({
          ...m,
          id: `model_${Date.now()}_${index}`,
          role: m.role as 'primary' | 'secondary' | 'thinking' | 'generating' | 'fallback'
        }))
      };

      if (isEditing && comboId) {
        await modelComboService.updateCombo(comboId, dataToSave);
      } else {
        await modelComboService.createCombo(dataToSave);
      }
      await syncModelCombos();
      navigate('/settings/model-combo');
    } catch (error) {
      console.error('保存模型组合失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddModel = () => {
    const newPriority = formData.models.length + 1;
    setFormData(prev => ({
      ...prev,
      models: [...prev.models, {
        modelId: '',
        role: 'primary',
        weight: 1,
        priority: newPriority
      }]
    }));
  };

  const handleRemoveModel = (index: number) => {
    if (formData.strategy === 'sequential' && formData.models.length <= 2) {
      return;
    }
    setFormData(prev => ({
      ...prev,
      models: prev.models.filter((_, i) => i !== index)
    }));
  };

  const handleModelChange = (index: number, field: string, value: any) => {
    let nextValue = value;
    if (field === 'modelId' && typeof value === 'string') {
      const parsedIdentity = parseModelIdentityKey(value);
      if (parsedIdentity) {
        nextValue = getModelIdentityKey(parsedIdentity);
      } else {
        const matchedModel = availableModels.find(model =>
          model.id === value || (model as any).identityKey === value
        );
        nextValue = matchedModel
          ? getModelIdentityKey({ id: matchedModel.id, provider: matchedModel.provider || matchedModel.providerId })
          : value;
      }
    }
    setFormData(prev => ({
      ...prev,
      models: prev.models.map((model, i) =>
        i === index ? { ...model, [field]: nextValue } : model
      )
    }));
  };

  const handleStrategyChange = (strategy: ModelComboStrategy) => {
    let newModels = formData.models;
    if (strategy === 'sequential') {
      newModels = [
        { modelId: formData.models[0]?.modelId || '', role: 'thinking', weight: 1, priority: 1 },
        { modelId: formData.models[1]?.modelId || '', role: 'generating', weight: 1, priority: 2 }
      ];
    } else if (strategy === 'comparison') {
      if (formData.models.length < 2) {
        newModels = [
          { modelId: '', role: 'primary', weight: 1, priority: 1 },
          { modelId: '', role: 'primary', weight: 1, priority: 2 }
        ];
      }
    }
    setFormData(prev => ({ ...prev, strategy, models: newModels }));
  };

  const getStrategyDescription = (strategy: ModelComboStrategy) => {
    switch (strategy) {
      case 'sequential':
        return t('modelSettings.combo.strategyDesc.sequential', '先用推理模型深度思考，再用生成模型输出答案（类似 DeepClaude）');
      case 'comparison':
        return t('modelSettings.combo.strategyDesc.comparison', '同时使用多个模型，展示对比结果供用户选择');
      default:
        return '';
    }
  };

  const getModelLabel = (index: number) => {
    if (formData.strategy === 'sequential') {
      return index === 0
        ? { icon: <Brain size={18} />, label: t('modelSettings.combo.thinkingModel', '推理模型'), color: theme.palette.secondary.main, desc: '负责深度思考和推理' }
        : { icon: <Sparkles size={18} />, label: t('modelSettings.combo.generatingModel', '生成模型'), color: theme.palette.primary.main, desc: '基于推理结果生成最终答案' };
    }
    return { icon: <GitCompare size={18} />, label: `${t('modelSettings.combo.model', '模型')} ${index + 1}`, color: theme.palette.text.secondary, desc: '' };
  };

  const isFormValid = () => {
    return formData.name.trim() !== '' &&
           formData.models.length >= 2 &&
           formData.models.every(m => m.modelId.trim() !== '');
  };

  const renderModelCard = (index: number, removable: boolean) => {
    const labelInfo = getModelLabel(index);
    const model = formData.models[index];
    const selectedModel = model.modelId
      ? availableModels.find(m =>
          modelMatchesIdentity(m, parseModelIdentityKey(model.modelId), m.provider)
        ) || null
      : null;
    return (
      <Box
        key={index}
        sx={{
          borderRadius: 2,
          border: '1px solid',
          borderColor: alpha(labelInfo.color, 0.35),
          bgcolor: alpha(labelInfo.color, 0.04),
          p: 1.5,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, color: labelInfo.color }}>
          {labelInfo.icon}
          <Typography variant="subtitle2" fontWeight={600} color="inherit" sx={{ flex: 1 }}>
            {labelInfo.label}
          </Typography>
          {removable && (
            <IconButton size="small" onClick={() => handleRemoveModel(index)} sx={{ color: 'text.secondary', '&:hover': { color: 'error.main' } }}>
              <DeleteIcon size={16} />
            </IconButton>
          )}
        </Box>
        {labelInfo.desc && (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
            {labelInfo.desc}
          </Typography>
        )}
        {isDialogStyle && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Typography
              variant="body2"
              color={selectedModel ? 'text.primary' : 'text.secondary'}
              sx={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
            >
              {selectedModel
                ? `${selectedModel.name || selectedModel.id}`
                : t('modelSettings.defaultModel.notSelected', '未选择')}
            </Typography>
            <Button
              variant="outlined"
              size="small"
              onClick={() => setOpenSelectorIndex(index)}
              sx={{ textTransform: 'none', borderRadius: 2, flexShrink: 0 }}
            >
              {t('modelSettings.defaultModel.selectModel', '选择模型')}
            </Button>
          </Box>
        )}
        <ModelSelector
          selectedModel={selectedModel}
          availableModels={availableModels}
          handleModelSelect={(newModel) => {
            handleModelChange(
              index,
              'modelId',
              newModel
                ? getModelIdentityKey({
                    id: newModel.id,
                    provider: newModel.provider || (newModel as any).providerId
                  })
                : ''
            );
            setOpenSelectorIndex(null);
          }}
          handleMenuClick={() => setOpenSelectorIndex(index)}
          handleMenuClose={() => setOpenSelectorIndex(null)}
          menuOpen={openSelectorIndex === index}
        />
      </Box>
    );
  };

  return (
    <SafeAreaContainer>
      <HeaderBar
        title={isEditing ? t('modelSettings.combo.editCombo', '编辑模型组合') : t('modelSettings.combo.createCombo', '创建模型组合')}
        onBackPress={handleBack}
        rightButton={
          <Button
            variant="contained"
            disableElevation
            size="small"
            startIcon={<Save size={16} />}
            onClick={handleSave}
            disabled={!isFormValid() || loading}
            sx={{ textTransform: 'none', borderRadius: 2 }}
          >
            {t('common.save', '保存')}
          </Button>
        }
      />
      <Container>
        <Box sx={{ maxWidth: 640, width: '100%', mx: 'auto', display: 'flex', flexDirection: 'column', gap: 3 }}>

          {/* ==================== 基本信息 ==================== */}
          <SettingGroup title={t('modelSettings.combo.basicInfo', '基本信息')}>
            <Row sx={{ flexDirection: 'column', alignItems: 'stretch', gap: 2 }}>
              <TextField
                fullWidth
                size="small"
                label={t('modelSettings.combo.comboName', '组合名称')}
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                required
                placeholder="例如：DeepClaude 组合"
              />
              <TextField
                fullWidth
                size="small"
                label={t('modelSettings.combo.description', '描述')}
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                multiline
                rows={2}
                placeholder="描述这个模型组合的用途"
              />
            </Row>
            <Row>
              <Typography sx={{ flex: 1 }}>{t('modelSettings.combo.enableCombo', '启用此组合')}</Typography>
              <CustomSwitch
                checked={formData.enabled}
                onChange={(e) => setFormData(prev => ({ ...prev, enabled: e.target.checked }))}
              />
            </Row>
          </SettingGroup>

          {/* ==================== 组合策略 ==================== */}
          <SettingGroup title={t('modelSettings.combo.strategy.label', '组合策略')}>
            <Row>
              <Typography sx={{ flex: 1 }}>{t('modelSettings.combo.strategy.label', '组合策略')}</Typography>
              <FormControl size="small" sx={{ minWidth: 180 }}>
                <Select
                  value={formData.strategy}
                  onChange={(e) => handleStrategyChange(e.target.value as ModelComboStrategy)}
                >
                  <MenuItem value="sequential">
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <ArrowRight size={16} />
                      {t('modelSettings.combo.strategy.sequential', '顺序执行')}
                    </Box>
                  </MenuItem>
                  <MenuItem value="comparison">
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <GitCompare size={16} />
                      {t('modelSettings.combo.strategy.comparison', '对比分析')}
                    </Box>
                  </MenuItem>
                </Select>
              </FormControl>
            </Row>
            <Box sx={{ px: 2, pb: 2 }}>
              <Typography variant="caption" color="text.secondary">
                {getStrategyDescription(formData.strategy)}
              </Typography>
            </Box>
          </SettingGroup>

          {/* ==================== 配置模型 ==================== */}
          <SettingGroup title={t('modelSettings.combo.configModels', '配置模型')}>
            <Box sx={{ p: 2 }}>
              <YStack sx={{ gap: 1.5 }}>
                {formData.models.map((_, index) =>
                  renderModelCard(
                    index,
                    formData.strategy === 'comparison' && formData.models.length > 2
                  )
                )}

                {formData.strategy === 'sequential' && (
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, color: 'text.secondary', py: 0.5 }}>
                    <Brain size={15} color={theme.palette.secondary.main} />
                    <ArrowRight size={15} />
                    <Sparkles size={15} color={theme.palette.primary.main} />
                    <Typography variant="caption" sx={{ ml: 0.5 }}>
                      {t('modelSettings.combo.sequentialFlow', '推理 → 生成')}
                    </Typography>
                  </Box>
                )}

                {formData.strategy === 'comparison' && (
                  <Button
                    fullWidth
                    variant="outlined"
                    size="small"
                    startIcon={<AddIcon size={16} />}
                    onClick={handleAddModel}
                    sx={{ textTransform: 'none', borderRadius: 2, borderStyle: 'dashed' }}
                  >
                    {t('modelSettings.combo.addModel', '添加模型')}
                  </Button>
                )}
              </YStack>
            </Box>
          </SettingGroup>

        </Box>
      </Container>
    </SafeAreaContainer>
  );
};

export default ModelComboEditPage;
