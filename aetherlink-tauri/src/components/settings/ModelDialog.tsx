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
  FormHelperText,
  Box,
  Typography,
  Slider,
} from '@mui/material';
import type { Model, PresetModel } from '../../shared/types';
import { ModelType } from '../../shared/types';
import { presetModels } from '../../shared/data/presetModels';
import { generateId } from '../../shared/utils';
import { matchModelTypes } from '../../shared/data/modelTypeRules';
import EnhancedModelTypeSelector from './EnhancedModelTypeSelector';

interface ModelDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (model: Model) => void;
  editModel?: Model;
}

const ModelDialog: React.FC<ModelDialogProps> = ({
  open,
  onClose,
  onSave,
  editModel,
}) => {
  const [selectedPreset, setSelectedPreset] = useState<PresetModel | null>(null);
  const [modelData, setModelData] = useState<Model>({
    id: '',
    name: '',
    provider: 'openai',
    apiKey: '',
    baseUrl: '',
    maxTokens: 4096,
    temperature: 0.7,
    enabled: true,
    isDefault: false,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [modelTypes, setModelTypes] = useState<ModelType[]>([ModelType.Chat]);
  const [autoDetectTypes, setAutoDetectTypes] = useState<boolean>(true);

  // 当编辑模型变化时，更新表单数据
  useEffect(() => {
    if (editModel) {
      setModelData(editModel);

      // 设置模型类型
      if (editModel.modelTypes) {
        setModelTypes(editModel.modelTypes);
        setAutoDetectTypes(false);
      } else {
        // 自动检测类型
        const detectedTypes = matchModelTypes(editModel.id, editModel.provider);
        setModelTypes(detectedTypes);
        setAutoDetectTypes(true);
      }

      // 查找匹配的预设模型
      const preset = presetModels.find(p => p.id === editModel.id);
      setSelectedPreset(preset || null);
    } else {
      // 重置表单
      setModelData({
        id: generateId(),
        name: '',
        provider: 'openai',
        apiKey: '',
        baseUrl: '',
        maxTokens: 4096,
        temperature: 0.7,
        enabled: true,
        isDefault: false,
      });
      setSelectedPreset(null);
      setModelTypes([ModelType.Chat]);
      setAutoDetectTypes(true);
    }
  }, [editModel, open]);

  // 处理预设模型选择
  const handlePresetChange = (event: React.ChangeEvent<{ value: unknown }> | any) => {
    const presetId = event.target.value as string;
    const preset = presetModels.find(p => p.id === presetId) || null;

    setSelectedPreset(preset);

    if (preset) {
      // 设置预设模型的属性，但保留当前的ID
      setModelData({
        ...modelData,
        // 使用预设模型的名称
        name: preset.name,
        // 如果是新建模型，使用预设的provider，否则保留当前provider
        provider: !editModel ? preset.provider : modelData.provider,
        baseUrl: preset.defaultBaseUrl || ''
      });

      // 设置模型类型
      if (preset.modelTypes) {
        setModelTypes(preset.modelTypes);
      } else {
        const detectedTypes = matchModelTypes(preset.id, preset.provider);
        setModelTypes(detectedTypes);
      }

      setAutoDetectTypes(true);

      console.log(`选择预设模型: ${preset.name}, ID: ${preset.id}, 提供商: ${!editModel ? preset.provider : modelData.provider}`);
    }
  };

  // 处理表单字段变化
  const handleChange = (field: keyof Model, value: any) => {
    setModelData({
      ...modelData,
      [field]: value,
    });

    // 如果更改了ID或提供商，自动更新类型
    if ((field === 'id' || field === 'provider') && autoDetectTypes) {
      const updatedModelData = {
        ...modelData,
        [field]: value,
      };
      const detectedTypes = matchModelTypes(updatedModelData.id, updatedModelData.provider);
      setModelTypes(detectedTypes);
    }

    // 清除错误
    if (errors[field]) {
      setErrors({
        ...errors,
        [field]: '',
      });
    }
  };

  // 切换自动检测
  const handleAutoDetectToggle = () => {
    const newAutoDetect = !autoDetectTypes;
    setAutoDetectTypes(newAutoDetect);

    if (newAutoDetect) {
      const detectedTypes = matchModelTypes(modelData.id, modelData.provider);
      setModelTypes(detectedTypes);
    }
  };

  // 验证表单
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!modelData.name.trim()) {
      newErrors.name = '请输入模型名称';
    }

    if (selectedPreset?.requiresApiKey && !modelData.apiKey?.trim()) {
      newErrors.apiKey = '请输入API密钥';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // 处理保存
  const handleSave = () => {
    if (validateForm()) {
      // 添加模型类型到模型数据
      const finalModelData = {
        ...modelData,
        modelTypes: autoDetectTypes ? undefined : modelTypes,
        // 更新模型能力
        capabilities: {
          ...modelData.capabilities,
          // 如果是多模态类型，确保设置capabilities.multimodal为true
          multimodal: modelTypes.includes(ModelType.Vision) || Boolean(modelData.multimodal),
          // 如果是推理类型，确保设置capabilities.reasoning为true
          reasoning: modelTypes.includes(ModelType.Reasoning) || Boolean(modelData.capabilities?.reasoning)
        },
        // 向下兼容
        multimodal: modelTypes.includes(ModelType.Vision) || Boolean(modelData.multimodal)
      };

      onSave(finalModelData);
      onClose();
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>{editModel ? '编辑模型' : '添加模型'}</DialogTitle>
      <DialogContent>
        <Box sx={{ mb: 3, mt: 1 }}>
          <FormControl fullWidth sx={{ mb: 3 }}>
            <InputLabel id="preset-model-label">预设模型</InputLabel>
            <Select
              labelId="preset-model-label"
              value={selectedPreset?.id || ''}
              onChange={handlePresetChange}
              label="预设模型"
              MenuProps={{
                disableAutoFocus: true,
                disableRestoreFocus: true
              }}
            >
              <MenuItem value="">自定义模型</MenuItem>
              {presetModels.map((preset) => (
                <MenuItem key={preset.id} value={preset.id}>
                  {preset.name} ({preset.provider})
                </MenuItem>
              ))}
            </Select>
            <FormHelperText>选择预设模型或创建自定义模型</FormHelperText>
          </FormControl>

          <TextField
            fullWidth
            label="模型名称"
            value={modelData.name}
            onChange={(e) => handleChange('name', e.target.value)}
            margin="normal"
            error={!!errors.name}
            helperText={errors.name}
            required
          />

          <FormControl fullWidth margin="normal">
            <InputLabel id="provider-label">提供商</InputLabel>
            <Select
              labelId="provider-label"
              value={modelData.provider}
              onChange={(e) => handleChange('provider', e.target.value)}
              label="提供商"
            >
              <MenuItem value="openai">OpenAI</MenuItem>
              <MenuItem value="anthropic">Anthropic</MenuItem>
              <MenuItem value="google">Google</MenuItem>
              <MenuItem value="siliconflow">SiliconFlow</MenuItem>
              <MenuItem value="volcengine">火山引擎</MenuItem>
              <MenuItem value="custom">自定义</MenuItem>
            </Select>
            <FormHelperText>
              选择API提供商，可以与模型ID自由组合
            </FormHelperText>
          </FormControl>

          <TextField
            fullWidth
            label="模型ID"
            value={modelData.id}
            onChange={(e) => handleChange('id', e.target.value)}
            margin="normal"
            helperText="模型的唯一标识符，例如：gpt-4、claude-3-opus"
          />

          <TextField
            fullWidth
            label="API密钥"
            value={modelData.apiKey || ''}
            onChange={(e) => handleChange('apiKey', e.target.value)}
            margin="normal"
            type="password"
            error={!!errors.apiKey}
            helperText={errors.apiKey || '请输入API密钥，将安全存储在本地'}
            required={selectedPreset?.requiresApiKey}
            slotProps={{
              input: {
                'aria-invalid': !!errors.apiKey,
                'aria-describedby': 'model-api-key-helper-text'
              },
              formHelperText: {
                id: 'model-api-key-helper-text'
              }
            }}
          />

          <TextField
            fullWidth
            label="API基础URL"
            value={modelData.baseUrl || ''}
            onChange={(e) => handleChange('baseUrl', e.target.value)}
            margin="normal"
            placeholder={selectedPreset?.defaultBaseUrl || 'https://api.example.com/v1'}
            helperText="可选，如果使用自定义API端点"
          />

          {/* 增强的模型类型选择 */}
          <EnhancedModelTypeSelector
            modelTypes={modelTypes}
            onChange={setModelTypes}
            autoDetect={autoDetectTypes}
            onAutoDetectChange={handleAutoDetectToggle}
            modelId={modelData.id}
            provider={modelData.provider}
          />

          <Box sx={{ mt: 3 }}>
            <Typography gutterBottom>最大Token数</Typography>
            <Slider
              value={modelData.maxTokens || 4096}
              onChange={(_, value) => handleChange('maxTokens', value)}
              min={1024}
              max={32768}
              step={1024}
              marks={[
                { value: 1024, label: '1K' },
                { value: 4096, label: '4K' },
                { value: 8192, label: '8K' },
                { value: 16384, label: '16K' },
                { value: 32768, label: '32K' },
              ]}
              valueLabelDisplay="auto"
            />
          </Box>

          <Box sx={{ mt: 3 }}>
            <Typography gutterBottom>温度 (Temperature)</Typography>
            <Slider
              value={modelData.temperature || 0.7}
              onChange={(_, value) => handleChange('temperature', value)}
              min={0}
              max={2}
              step={0.1}
              marks={[
                { value: 0, label: '0' },
                { value: 0.7, label: '0.7' },
                { value: 1, label: '1' },
                { value: 2, label: '2' },
              ]}
              valueLabelDisplay="auto"
            />
            <FormHelperText>
              较低的值使输出更确定，较高的值使输出更随机和创造性
            </FormHelperText>
          </Box>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>取消</Button>
        <Button onClick={handleSave} variant="contained" color="primary">
          保存
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ModelDialog;
