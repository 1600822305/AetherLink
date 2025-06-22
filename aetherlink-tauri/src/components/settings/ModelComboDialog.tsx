import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  FormControlLabel,
  Box,
  Typography,
  Stepper,
  Step,
  StepLabel,
  Card,
  CardContent,
  Chip,
  IconButton,
  Alert
} from '@mui/material';
import { Plus as AddIcon, Trash2 as DeleteIcon } from 'lucide-react';
import { useSelector } from 'react-redux';
import type { RootState } from '../../shared/store';
import DropdownModelSelector from '../../pages/ChatPage/components/DropdownModelSelector';

import type { ModelComboConfig, ModelComboTemplate, ModelComboStrategy, ModelComboFormData } from '../../shared/types/ModelCombo';

interface ModelComboDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: ModelComboFormData) => void;
  combo?: ModelComboConfig | null;
  templates: ModelComboTemplate[];
}

const ModelComboDialog: React.FC<ModelComboDialogProps> = ({
  open,
  onClose,
  onSave,
  combo
}) => {
  const [activeStep, setActiveStep] = useState(0);
  const [formData, setFormData] = useState<ModelComboFormData>({
    name: '',
    description: '',
    strategy: 'routing',
    enabled: true,
    models: []
  });

  // 获取所有可用模型（排除模型组合供应商）
  const providers = useSelector((state: RootState) => state.settings.providers);
  const availableModels = providers
    .filter(provider => provider.id !== 'model-combo' && provider.isEnabled)
    .flatMap(provider =>
      provider.models
        .filter(model => model.enabled)
    );

  const steps = ['基本信息', '选择策略', '配置模型', '完成设置'];

  useEffect(() => {
    if (combo) {
      setFormData({
        name: combo.name,
        description: combo.description || '',
        strategy: combo.strategy,
        enabled: combo.enabled,
        models: combo.models.map(m => ({
          modelId: m.modelId,
          role: m.role,
          weight: m.weight,
          priority: m.priority
        }))
      });
    } else {
      setFormData({
        name: '',
        description: '',
        strategy: 'routing',
        enabled: true,
        models: []
      });
    }
    setActiveStep(0);
  }, [combo, open]);

  const handleNext = () => {
    setActiveStep((prevStep) => prevStep + 1);
  };

  const handleBack = () => {
    setActiveStep((prevStep) => prevStep - 1);
  };

  const handleSave = () => {
    onSave(formData);
  };

  const handleAddModel = () => {
    setFormData(prev => ({
      ...prev,
      models: [...prev.models, {
        modelId: '',
        role: 'primary',
        weight: 1,
        priority: 1
      }]
    }));
  };

  const handleRemoveModel = (index: number) => {
    setFormData(prev => ({
      ...prev,
      models: prev.models.filter((_, i) => i !== index)
    }));
  };

  const handleModelChange = (index: number, field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      models: prev.models.map((model, i) =>
        i === index ? { ...model, [field]: value } : model
      )
    }));
  };

  const getStrategyLabel = (strategy: ModelComboStrategy) => {
    switch (strategy) {
      case 'routing': return '智能路由 (开发中)';
      case 'ensemble': return '模型集成 (开发中)';
      case 'comparison': return '对比分析';
      case 'cascade': return '级联调用 (开发中)';
      case 'sequential': return '顺序执行';
      default: return strategy;
    }
  };

  const getStrategyDescription = (strategy: ModelComboStrategy) => {
    switch (strategy) {
      case 'routing':
        return '根据查询内容智能选择最适合的模型进行响应（基础功能可用，高级路由规则开发中）';
      case 'ensemble':
        return '多个模型同时工作，综合它们的输出结果（基础功能可用，高级集成算法开发中）';
      case 'comparison':
        return '同时使用多个模型，展示对比结果供用户选择（功能完整可用）';
      case 'cascade':
        return '先使用便宜的模型，必要时升级到更强的模型（功能开发中，暂时使用路由策略）';
      case 'sequential':
        return '按顺序使用模型，如先思考再生成（功能完整可用）';
      default:
        return '';
    }
  };

  const renderStepContent = (step: number) => {
    switch (step) {
      case 0:
        return (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              fullWidth
              label="组合名称"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              required
            />
            <TextField
              fullWidth
              label="描述"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              multiline
              rows={3}
            />
            <FormControlLabel
              control={
                <Switch
                  checked={formData.enabled}
                  onChange={(e) => setFormData(prev => ({ ...prev, enabled: e.target.checked }))}
                />
              }
              label="启用此组合"
            />
          </Box>
        );

      case 1:
        return (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <FormControl fullWidth>
              <InputLabel>组合策略</InputLabel>
              <Select
                value={formData.strategy}
                onChange={(e) => setFormData(prev => ({ ...prev, strategy: e.target.value as ModelComboStrategy }))}
                label="组合策略"
              >
                <MenuItem value="routing">智能路由 (开发中)</MenuItem>
                <MenuItem value="ensemble">模型集成 (开发中)</MenuItem>
                <MenuItem value="comparison">对比分析</MenuItem>
                <MenuItem value="cascade">级联调用 (开发中)</MenuItem>
                <MenuItem value="sequential">顺序执行</MenuItem>
              </Select>
            </FormControl>
            <Alert severity="info">
              {getStrategyDescription(formData.strategy)}
            </Alert>
          </Box>
        );

      case 2:
        return (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="h6">配置模型</Typography>
              <Button
                startIcon={<AddIcon />}
                onClick={handleAddModel}
                variant="outlined"
                size="small"
              >
                添加模型
              </Button>
            </Box>

            {formData.models.length === 0 ? (
              <Alert severity="warning">
                请至少添加一个模型
              </Alert>
            ) : (
              formData.models.map((model, index) => (
                <Card key={index} variant="outlined">
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                      <Typography variant="subtitle1">模型 {index + 1}</Typography>
                      <IconButton
                        size="small"
                        onClick={() => handleRemoveModel(index)}
                        color="error"
                      >
                        <DeleteIcon />
                      </IconButton>
                    </Box>

                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <Box>
                        <Typography variant="body2" sx={{ mb: 1, fontWeight: 500 }}>
                          选择模型 *
                        </Typography>
                        <DropdownModelSelector
                          selectedModel={availableModels.find(m => m.id === model.modelId) || null}
                          availableModels={availableModels}
                          handleModelSelect={(selectedModel) => {
                            handleModelChange(index, 'modelId', selectedModel?.id || '');
                          }}
                        />
                      </Box>

                      <FormControl fullWidth>
                        <InputLabel>角色</InputLabel>
                        <Select
                          value={model.role}
                          onChange={(e) => handleModelChange(index, 'role', e.target.value)}
                          label="角色"
                          MenuProps={{
                            disableAutoFocus: true,
                            disableRestoreFocus: true
                          }}
                        >
                          <MenuItem value="primary">主要</MenuItem>
                          <MenuItem value="secondary">次要</MenuItem>
                          <MenuItem value="fallback">备用</MenuItem>
                          <MenuItem value="thinking">思考</MenuItem>
                          <MenuItem value="generating">生成</MenuItem>
                        </Select>
                      </FormControl>

                      {(formData.strategy === 'ensemble' || formData.strategy === 'comparison') && (
                        <TextField
                          fullWidth
                          label="权重"
                          type="number"
                          value={model.weight || 1}
                          onChange={(e) => handleModelChange(index, 'weight', Number(e.target.value))}
                          slotProps={{
                            htmlInput: { min: 0, max: 1, step: 0.1 }
                          }}
                        />
                      )}

                      {(formData.strategy === 'cascade' || formData.strategy === 'sequential') && (
                        <TextField
                          fullWidth
                          label="优先级"
                          type="number"
                          value={model.priority || 1}
                          onChange={(e) => handleModelChange(index, 'priority', Number(e.target.value))}
                          slotProps={{
                            htmlInput: { min: 1 }
                          }}
                        />
                      )}
                    </Box>
                  </CardContent>
                </Card>
              ))
            )}
          </Box>
        );

      case 3:
        return (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Typography variant="h6">确认配置</Typography>
            <Card variant="outlined">
              <CardContent>
                <Typography variant="subtitle1" gutterBottom>
                  {formData.name}
                </Typography>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  {formData.description}
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                  <Chip label={getStrategyLabel(formData.strategy)} size="small" />
                  <Chip
                    label={formData.enabled ? '已启用' : '已禁用'}
                    size="small"
                    color={formData.enabled ? 'success' : 'default'}
                  />
                </Box>
                <Typography variant="body2">
                  包含 {formData.models.length} 个模型
                </Typography>
              </CardContent>
            </Card>
          </Box>
        );

      default:
        return null;
    }
  };

  const isStepValid = (step: number) => {
    switch (step) {
      case 0:
        return formData.name.trim() !== '';
      case 1:
        return Boolean(formData.strategy);
      case 2:
        return formData.models.length > 0 && formData.models.every(m => m.modelId.trim() !== '');
      case 3:
        return true;
      default:
        return false;
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      slotProps={{
        paper: {
          sx: { minHeight: '500px' }
        }
      }}
    >
      <DialogTitle>
        {combo ? '编辑模型组合' : '创建模型组合'}
      </DialogTitle>

      <DialogContent>
        <Box sx={{ width: '100%', mt: 2 }}>
          <Stepper activeStep={activeStep} alternativeLabel>
            {steps.map((label) => (
              <Step key={label}>
                <StepLabel>{label}</StepLabel>
              </Step>
            ))}
          </Stepper>

          <Box sx={{ mt: 3 }}>
            {renderStepContent(activeStep)}
          </Box>
        </Box>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>取消</Button>
        <Box sx={{ flex: '1 1 auto' }} />
        <Button
          disabled={activeStep === 0}
          onClick={handleBack}
        >
          上一步
        </Button>
        {activeStep === steps.length - 1 ? (
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={!isStepValid(activeStep)}
          >
            保存
          </Button>
        ) : (
          <Button
            variant="contained"
            onClick={handleNext}
            disabled={!isStepValid(activeStep)}
          >
            下一步
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default ModelComboDialog;
