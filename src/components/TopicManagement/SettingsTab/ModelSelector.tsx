import React, { useState, useEffect } from 'react';
import {
  Box,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Avatar,
  Typography,
  Chip,
  ListItemIcon,
  ListItemText,
  Alert
} from '@mui/material';
import { useSelector } from 'react-redux';
import type { RootState } from '../../../shared/store';
import type { Model } from '../../../shared/types';
import { getModelIdentityKey, modelMatchesIdentity, parseModelIdentityKey } from '../../../shared/utils/modelUtils';
import { createLogger } from '../../../shared/services/infra/logger';

const logger = createLogger('ModelSelector');

interface ModelSelectorProps {
  value: string;
  onChange: (modelId: string) => void;
  disabled?: boolean;
}

// 扩展Model类型以包含显示所需的字段
interface ExtendedModel extends Model {
  providerId?: string;
  providerName?: string;
  supportsFunctionCalling?: boolean;
  supportsVision?: boolean;
  identityKey: string;
}

/**
 * 模型选择器组件
 */
const ModelSelector: React.FC<ModelSelectorProps> = ({
  value,
  onChange,
  disabled = false
}) => {
  const [availableModels, setAvailableModels] = useState<ExtendedModel[]>([]);
  const [loading, setLoading] = useState(true);
  
  // 从Redux获取提供商信息
  const providers = useSelector((state: RootState) => state.settings.providers);

  useEffect(() => {
    loadAvailableModels();
  }, [providers]);

  const loadAvailableModels = async () => {
    try {
      setLoading(true);
      const models: ExtendedModel[] = [];

      // 遍历所有启用的提供商，收集可用模型
      for (const provider of providers) {
        if (provider.isEnabled && provider.models) {
          for (const model of provider.models) {
            models.push({
              ...model,
              providerId: provider.id,
              providerName: provider.name,
              identityKey: getModelIdentityKey({ id: model.id, provider: provider.id }),
              // 确保必要字段存在
              supportsFunctionCalling: model.capabilities?.functionCalling || false,
              supportsVision: model.capabilities?.multimodal || model.multimodal || false
            });
          }
        }
      }

      
      // 按提供商和模型名称排序
      models.sort((a, b) => {
        const providerA = a.providerName || a.provider;
        const providerB = b.providerName || b.provider;
        if (providerA !== providerB) {
          return providerA.localeCompare(providerB);
        }
        return a.name.localeCompare(b.name);
      });
      
      setAvailableModels(models);
    } catch (error) {
      logger.error('加载可用模型失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleModelChange = (event: any) => {
    const selectedModelId = event.target.value;
    onChange(selectedModelId);
  };

  const getModelById = (modelId: string) => {
    const identity = parseModelIdentityKey(modelId);
    if (identity) {
      // 使用 {id, provider} 组合精确匹配，避免同名模型冲突
      return availableModels.find(model => modelMatchesIdentity(model, identity, model.providerId));
    }
    
    // 兜底：使用 identityKey 匹配（避免仅按 id 匹配导致冲突）
    return availableModels.find(model => model.identityKey === modelId);
  };

  if (loading) {
    return (
      <Box sx={{ p: 2, textAlign: 'center' }}>
        <Typography variant="body2" color="text.secondary">
          加载模型列表...
        </Typography>
      </Box>
    );
  }

  if (availableModels.length === 0) {
    return (
      <Alert severity="warning" sx={{ mt: 1 }}>
        暂无可用模型，请先配置模型提供商
      </Alert>
    );
  }

  return (
    <FormControl fullWidth disabled={disabled}>
      <InputLabel>选择模型</InputLabel>
      <Select
        value={value}
        onChange={handleModelChange}
        label="选择模型"
        MenuProps={{
          disableAutoFocus: true,
          disableRestoreFocus: true
        }}
        renderValue={(selected) => {
          const model = getModelById(selected as string);
          if (!model) {
            return <Typography color="text.secondary">请选择模型</Typography>;
          }
          
          return (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Avatar
                sx={{
                  width: 24,
                  height: 24,
                  fontSize: '0.75rem',
                  bgcolor: 'primary.main'
                }}
              >
                {(model.providerName || model.provider).charAt(0)}
              </Avatar>
              <Typography variant="body2">
                {model.name}
              </Typography>
              <Chip
                label={model.providerName || model.provider}
                size="small"
                variant="outlined"
                sx={{ ml: 'auto' }}
              />
            </Box>
          );
        }}
      >
        {availableModels.map((model) => (
          <MenuItem key={model.identityKey} value={model.identityKey}>
            <ListItemIcon>
              <Avatar
                sx={{
                  width: 32,
                  height: 32,
                  fontSize: '0.875rem',
                  bgcolor: 'primary.main'
                }}
              >
                {(model.providerName || model.provider).charAt(0)}
              </Avatar>
            </ListItemIcon>
            <ListItemText
              primary={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                    {model.name}
                  </Typography>
                  <Chip
                    label={model.providerName || model.provider}
                    size="small"
                    variant="outlined"
                  />
                </Box>
              }
              secondary={
                <Box sx={{ mt: 0.5 }}>
                  {model.description && (
                    <Typography variant="caption" color="text.secondary">
                      {model.description}
                    </Typography>
                  )}
                  <Box sx={{ display: 'flex', gap: 1, mt: 0.5 }}>
                    {model.maxTokens && (
                      <Chip 
                        label={`${model.maxTokens} tokens`} 
                        size="small" 
                        variant="outlined"
                        sx={{ fontSize: '0.6rem', height: 20 }}
                      />
                    )}
                    {model.supportsFunctionCalling && (
                      <Chip 
                        label="函数调用" 
                        size="small" 
                        color="primary"
                        variant="outlined"
                        sx={{ fontSize: '0.6rem', height: 20 }}
                      />
                    )}
                    {model.supportsVision && (
                      <Chip 
                        label="视觉" 
                        size="small" 
                        color="secondary"
                        variant="outlined"
                        sx={{ fontSize: '0.6rem', height: 20 }}
                      />
                    )}
                  </Box>
                </Box>
              }
            />
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
};

export default ModelSelector;
