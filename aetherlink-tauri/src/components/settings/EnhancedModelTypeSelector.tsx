import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Chip,
  FormControlLabel,
  FormHelperText,
  Tooltip,
  IconButton,
  useTheme,
  alpha,
  Paper
} from '@mui/material';
import CustomSwitch from '../CustomSwitch';
import { Info as InfoOutlinedIcon, Settings as SettingsIcon } from 'lucide-react';
import { ModelType } from '../../shared/types';
import type { ModelTypeRule } from '../../shared/types';
import { getModelTypeDisplayName, defaultModelTypeRules } from '../../shared/data/modelTypeRules';
import ModelTypeManagement from './ModelTypeManagement';
import { dexieStorage } from '../../shared/services/storage/DexieStorageService';

// 模型类型分组
const MODEL_TYPE_GROUPS = {
  basic: ['chat'],
  input: ['vision', 'audio'],
  output: ['image_gen', 'video_gen', 'transcription', 'translation'],
  advanced: ['reasoning', 'function_calling', 'web_search', 'tool', 'code_gen'],
  data: ['embedding', 'rerank']
};

// 模型类型图标和描述
const MODEL_TYPE_INFO: Record<string, { description: string, color: string }> = {
  chat: {
    description: '基础聊天功能，支持文本对话',
    color: '#4285F4'
  },
  vision: {
    description: '支持图像理解和分析',
    color: '#EA4335'
  },
  audio: {
    description: '支持音频处理和理解',
    color: '#FBBC05'
  },
  embedding: {
    description: '生成文本的向量表示，用于相似度搜索',
    color: '#34A853'
  },
  tool: {
    description: '支持使用外部工具和API',
    color: '#8E44AD'
  },
  reasoning: {
    description: '增强的推理能力，适合复杂问题解决',
    color: '#1ABC9C'
  },
  image_gen: {
    description: '生成图像的能力',
    color: '#E74C3C'
  },
  function_calling: {
    description: '支持函数调用，可与代码交互',
    color: '#3498DB'
  },
  web_search: {
    description: '支持网络搜索，获取实时信息',
    color: '#F39C12'
  },
  rerank: {
    description: '重新排序搜索结果或文档',
    color: '#16A085'
  },
  code_gen: {
    description: '代码生成和编程辅助',
    color: '#2C3E50'
  },
  translation: {
    description: '文本翻译功能',
    color: '#27AE60'
  },
  transcription: {
    description: '语音转文字功能',
    color: '#D35400'
  },
  video_gen: {
    description: '视频生成功能',
    color: '#8E44AD'
  }
};

interface EnhancedModelTypeSelectorProps {
  modelTypes: ModelType[];
  onChange: (types: ModelType[]) => void;
  autoDetect: boolean;
  onAutoDetectChange: (autoDetect: boolean) => void;
  modelId?: string;
  provider?: string;
}

const EnhancedModelTypeSelector: React.FC<EnhancedModelTypeSelectorProps> = ({
  modelTypes,
  onChange,
  autoDetect,
  onAutoDetectChange,
  modelId,
  provider
}) => {
  const theme = useTheme();
  const [openTypeManagement, setOpenTypeManagement] = useState(false);
  const [modelTypeRules, setModelTypeRules] = useState<ModelTypeRule[]>([]);

  // 从存储中加载模型类型规则
  useEffect(() => {
    const loadModelTypeRules = async () => {
      try {
        // 尝试从数据库加载模型类型规则
        const modelTypeRules = await dexieStorage.getSetting('modelTypeRules');
        if (modelTypeRules) {
          setModelTypeRules(modelTypeRules);
        } else {
          // 如果没有保存的规则，使用默认规则
          setModelTypeRules(defaultModelTypeRules);
        }
      } catch (error) {
        console.error('[EnhancedModelTypeSelector] 加载模型类型规则失败:', error);
        // 使用默认规则
        setModelTypeRules(defaultModelTypeRules);
      }
    };

    loadModelTypeRules();
  }, []);

  // 处理类型切换
  const handleTypeToggle = (type: ModelType) => {
    if (!autoDetect) {
      const newTypes = [...modelTypes];
      const index = newTypes.indexOf(type);

      if (index === -1) {
        newTypes.push(type);
      } else {
        newTypes.splice(index, 1);
      }

      // 确保至少有一个类型
      if (newTypes.length === 0) {
        newTypes.push(ModelType.Chat);
      }

      onChange(newTypes);
    }
  };

  // 打开模型类型管理对话框
  const handleOpenTypeManagement = () => {
    setOpenTypeManagement(true);
  };

  // 保存模型类型规则
  const handleSaveRules = async (rules: ModelTypeRule[]) => {
    setModelTypeRules(rules);

    // 保存规则到存储
    try {
      await dexieStorage.saveSetting('modelTypeRules', rules);
      console.log('[EnhancedModelTypeSelector] 模型类型规则已保存');
    } catch (error) {
      console.error('[EnhancedModelTypeSelector] 保存模型类型规则失败:', error);
    }
  };

  // 根据分组渲染模型类型
  const renderModelTypesByGroup = () => {
    return Object.entries(MODEL_TYPE_GROUPS).map(([groupName, types]) => (
      <Box key={groupName} sx={{ mb: 2 }}>
        <Typography variant="subtitle2" sx={{ mb: 1, color: 'text.secondary', fontSize: '0.8rem', textTransform: 'uppercase' }}>
          {getGroupDisplayName(groupName)}
        </Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          {types.map(typeValue => {
            const type = typeValue as ModelType;
            const typeInfo = MODEL_TYPE_INFO[type] || { description: '', color: theme.palette.primary.main };

            return (
              <Tooltip
                key={type}
                title={typeInfo.description}
                arrow
                placement="top"
              >
                <Chip
                  label={getModelTypeDisplayName(type)}
                  color={modelTypes.includes(type) ? "primary" : "default"}
                  onClick={() => !autoDetect && handleTypeToggle(type)}
                  sx={{
                    mr: 0.5,
                    mb: 0.5,
                    bgcolor: modelTypes.includes(type)
                      ? alpha(typeInfo.color, 0.2)
                      : 'default',
                    color: modelTypes.includes(type)
                      ? typeInfo.color
                      : 'text.secondary',
                    borderColor: modelTypes.includes(type)
                      ? typeInfo.color
                      : 'divider',
                    '&:hover': {
                      bgcolor: modelTypes.includes(type)
                        ? alpha(typeInfo.color, 0.3)
                        : alpha(theme.palette.action.hover, 0.1)
                    }
                  }}
                  disabled={autoDetect}
                  variant={modelTypes.includes(type) ? "filled" : "outlined"}
                />
              </Tooltip>
            );
          })}
        </Box>
      </Box>
    ));
  };

  // 获取分组显示名称
  const getGroupDisplayName = (group: string): string => {
    const displayNames: Record<string, string> = {
      basic: '基础功能',
      input: '输入能力',
      output: '输出能力',
      advanced: '高级功能',
      data: '数据处理'
    };

    return displayNames[group] || group;
  };

  return (
    <Box sx={{ mt: 3 }}>
      <Box sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        mb: 1
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <Typography variant="subtitle2">模型类型</Typography>
          <Tooltip title="模型类型决定了模型的能力和适用场景。您可以根据需要选择多种类型。">
            <IconButton size="small" sx={{ ml: 0.5 }}>
              <InfoOutlinedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <FormControlLabel
            control={
              <CustomSwitch
                checked={autoDetect}
                onChange={(e) => onAutoDetectChange(e.target.checked)}
              />
            }
            label="自动检测"
          />
          <Tooltip title="管理模型类型规则">
            <IconButton
              size="small"
              onClick={handleOpenTypeManagement}
              sx={{ ml: 1 }}
            >
              <SettingsIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      <Paper
        elevation={0}
        sx={{
          p: 2,
          borderRadius: 2,
          border: '1px solid',
          borderColor: 'divider',
          bgcolor: theme.palette.mode === 'dark' ? alpha(theme.palette.background.paper, 0.6) : alpha(theme.palette.background.paper, 0.8)
        }}
      >
        {renderModelTypesByGroup()}
      </Paper>

      <FormHelperText>
        {autoDetect
          ? '根据模型ID和提供商自动检测模型类型'
          : '点击类型标签来添加或移除'}
      </FormHelperText>

      {/* 模型类型管理对话框 */}
      <ModelTypeManagement
        open={openTypeManagement}
        onClose={() => setOpenTypeManagement(false)}
        rules={modelTypeRules}
        onSave={handleSaveRules}
        modelId={modelId}
        provider={provider}
      />
    </Box>
  );
};

export default EnhancedModelTypeSelector;
