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
  Avatar,
  IconButton,
  Tooltip
} from '@mui/material';
import { Image as PhotoIcon } from 'lucide-react';
import type { Model } from '../../shared/types';
import { ModelType } from '../../shared/types';
import { matchModelTypes } from '../../shared/data/modelTypeRules';
import AvatarUploader from './AvatarUploader';
import { dexieStorage } from '../../shared/services/storage/DexieStorageService';
import EnhancedModelTypeSelector from './EnhancedModelTypeSelector';

interface SimpleModelDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (model: Model) => void;
  editModel?: Model;
}

const SimpleModelDialog: React.FC<SimpleModelDialogProps> = ({
  open,
  onClose,
  onSave,
  editModel,
}) => {
  const [modelData, setModelData] = useState<Model>({
    id: '',
    name: '',
    provider: 'openai',
    enabled: true,
    isDefault: false,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [modelTypes, setModelTypes] = useState<ModelType[]>([ModelType.Chat]);
  const [autoDetectTypes, setAutoDetectTypes] = useState<boolean>(true);
  const [modelAvatar, setModelAvatar] = useState<string>("");
  const [isAvatarDialogOpen, setIsAvatarDialogOpen] = useState(false);

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

      // 尝试从数据库加载模型头像
      const loadModelAvatar = async () => {
        try {
          const modelConfig = await dexieStorage.getModel(editModel.id);
          if (modelConfig?.avatar) {
            setModelAvatar(modelConfig.avatar);
          }
        } catch (error) {
          console.error(`[SimpleModelDialog] 加载模型头像失败:`, error);
        }
      };

      loadModelAvatar();
    }
  }, [editModel, open]);

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

  // 处理头像上传
  const handleAvatarDialogOpen = () => {
    setIsAvatarDialogOpen(true);
  };

  const handleAvatarDialogClose = () => {
    setIsAvatarDialogOpen(false);
  };

  const handleSaveAvatar = async (avatarDataUrl: string) => {
    setModelAvatar(avatarDataUrl);
    if (modelData.id) {
      try {
        // 获取当前模型配置（如果存在）
        const existingConfig = await dexieStorage.getModel(modelData.id);

        // 创建或更新模型配置
        const modelConfig = {
          ...existingConfig,
          id: modelData.id,
          avatar: avatarDataUrl,
          updatedAt: new Date().toISOString()
        };

        // 保存到数据库
        await dexieStorage.saveModel(modelData.id, modelConfig);
        console.log(`[SimpleModelDialog] 模型头像已保存到数据库: ${modelData.id}`);
      } catch (error) {
        console.error(`[SimpleModelDialog] 保存模型头像到数据库失败:`, error);
      }
    }
  };

  // 验证表单
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!modelData.name.trim()) {
      newErrors.name = '请输入模型名称';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // 处理保存
  const handleSave = async () => {
    if (validateForm()) {
      // 添加模型类型到模型数据
      const finalModelData = {
        ...modelData,
        modelTypes: autoDetectTypes ? undefined : modelTypes,
        // 如果是多模态类型，确保设置capabilities.multimodal为true
        capabilities: {
          ...modelData.capabilities,
          multimodal: modelTypes.includes(ModelType.Vision)
        },
      };

      // 如果ID已更改，保存头像到新ID
      if (editModel && editModel.id !== modelData.id && modelAvatar) {
        try {
          // 保存到数据库
          await dexieStorage.saveModel(modelData.id, {
            id: modelData.id,
            avatar: modelAvatar,
            updatedAt: new Date().toISOString()
          });
        } catch (error) {
          console.error(`[SimpleModelDialog] 保存模型头像到数据库失败:`, error);
        }
      }

      // 保存模型配置到数据库
      try {
        // 创建完整的模型配置对象
        const modelConfig = {
          ...finalModelData,
          avatar: modelAvatar,
          updatedAt: new Date().toISOString()
        };

        // 保存到数据库
        await dexieStorage.saveModel(finalModelData.id, modelConfig);
        console.log(`[SimpleModelDialog] 模型配置已保存到数据库: ${finalModelData.id}`);
      } catch (error) {
        console.error(`[SimpleModelDialog] 保存模型配置到数据库失败:`, error);
      }

      onSave(finalModelData);
      onClose();
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{editModel ? '编辑模型' : '添加模型'}</DialogTitle>
      <DialogContent>
        <Box sx={{ mb: 3, mt: 1 }}>
          {/* 模型头像设置区域 */}
          <Box sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            mb: 2,
            p: 2,
            bgcolor: 'rgba(25, 118, 210, 0.08)',
            borderRadius: 1,
            border: '1px solid rgba(25, 118, 210, 0.2)'
          }}>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <Avatar
                src={modelAvatar}
                sx={{
                  width: 48,
                  height: 48,
                  mr: 2,
                  bgcolor: '#1677ff'
                }}
              >
                {!modelAvatar && modelData.name.charAt(0)}
              </Avatar>
              <Box>
                <Typography variant="body2" fontWeight="medium">
                  模型头像
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  为此模型设置自定义头像
                </Typography>
              </Box>
            </Box>
            <Tooltip title="设置头像">
              <IconButton
                color="primary"
                onClick={handleAvatarDialogOpen}
                size="small"
                sx={{
                  bgcolor: 'rgba(25, 118, 210, 0.12)',
                  '&:hover': { bgcolor: 'rgba(25, 118, 210, 0.2)' }
                }}
              >
                <PhotoIcon />
              </IconButton>
            </Tooltip>
          </Box>

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
              <MenuItem value="deepseek">DeepSeek</MenuItem>
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

          {/* 增强的模型类型选择 */}
          <EnhancedModelTypeSelector
            modelTypes={modelTypes}
            onChange={setModelTypes}
            autoDetect={autoDetectTypes}
            onAutoDetectChange={handleAutoDetectToggle}
            modelId={modelData.id}
            provider={modelData.provider}
          />
        </Box>

        {/* 头像上传对话框 */}
        <AvatarUploader
          open={isAvatarDialogOpen}
          onClose={handleAvatarDialogClose}
          onSave={handleSaveAvatar}
          currentAvatar={modelAvatar}
          title="设置模型头像"
        />
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

export default SimpleModelDialog;