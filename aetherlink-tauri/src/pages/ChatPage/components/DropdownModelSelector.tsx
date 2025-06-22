import React from 'react';
import {
  Select,
  MenuItem,
  FormControl,
  Typography,
  useTheme,
  Box,
  ListSubheader,
  Avatar
} from '@mui/material';
import type { Model } from '../../../shared/types';
import { useSelector } from 'react-redux';
import type { RootState } from '../../../shared/store';
import type { SelectChangeEvent } from '@mui/material';

interface DropdownModelSelectorProps {
  selectedModel: Model | null;
  availableModels: Model[];
  handleModelSelect: (model: Model) => void;
}

export const DropdownModelSelector: React.FC<DropdownModelSelectorProps> = ({
  selectedModel,
  availableModels,
  handleModelSelect
}) => {
  const theme = useTheme();
  const providers = useSelector((state: RootState) => state.settings.providers || []);

  // 获取提供商名称的函数
  const getProviderName = React.useCallback((providerId: string) => {
    const provider = providers.find(p => p.id === providerId);
    // 如果找到提供商，返回用户设置的名称
    if (provider) {
      return provider.name;
    }
    // 没有找到，返回原始ID
    return providerId;
  }, [providers]);

  // 获取提供商信息的函数
  const getProviderInfo = React.useCallback((providerId: string) => {
    return providers.find(p => p.id === providerId);
  }, [providers]);

  // 按供应商分组模型
  const groupedModels = React.useMemo(() => {
    const groups: { [key: string]: Model[] } = {};

    availableModels.forEach(model => {
      const providerId = model.provider || model.providerType || 'unknown';
      if (!groups[providerId]) {
        groups[providerId] = [];
      }
      groups[providerId].push(model);
    });

    // 按照设置中的供应商顺序排序
    const sortedGroups = Object.keys(groups).sort((a, b) => {
      const indexA = providers.findIndex(p => p.id === a);
      const indexB = providers.findIndex(p => p.id === b);

      // 如果都在providers中，按照providers中的顺序
      if (indexA !== -1 && indexB !== -1) {
        return indexA - indexB;
      }
      // 如果只有一个在providers中，优先显示在providers中的
      if (indexA !== -1) return -1;
      if (indexB !== -1) return 1;
      // 如果都不在providers中，按字母顺序
      const nameA = getProviderName(a);
      const nameB = getProviderName(b);
      return nameA.localeCompare(nameB);
    });

    return { groups, sortedGroups };
  }, [availableModels, getProviderName, providers]);

  const handleChange = (event: SelectChangeEvent<string>) => {
    const compositeValue = event.target.value;
    if (!compositeValue || typeof compositeValue !== 'string') return;

    try {
      // 从复合值中提取模型ID和提供商
      const [modelId, providerId] = compositeValue.split('---');

      // 找到匹配ID和提供商的模型
      const model = availableModels.find(m =>
        m.id === modelId && (m.provider || '') === providerId
      );

      if (model) {
        // 使用setTimeout防止事件处理冲突
        setTimeout(() => {
          handleModelSelect(model);
        }, 0);
      } else {
        console.error('未找到匹配的模型:', modelId, providerId);
      }
    } catch (error) {
      console.error('处理模型选择时出错:', error);
    }
  };

  // 生成唯一的复合值，防止-字符在modelId或providerId中导致的解析错误
  const getCompositeValue = React.useCallback((model: Model): string => {
    return `${model.id}---${model.provider || ''}`;
  }, []);

  // 获取当前选中模型的复合值
  const getCurrentValue = React.useCallback((): string => {
    if (!selectedModel) return '';

    // 首先尝试在 availableModels 中找到完全匹配的模型（id + provider）
    const exactMatch = availableModels.find(m =>
      m.id === selectedModel.id &&
      (m.provider || '') === (selectedModel.provider || '')
    );

    if (exactMatch) {
      return getCompositeValue(exactMatch);
    }

    // 如果没有找到完全匹配，尝试只匹配 id，但优先选择第一个匹配的
    const idMatch = availableModels.find(m => m.id === selectedModel.id);
    if (idMatch) {
      return getCompositeValue(idMatch);
    }

    // 如果都没找到，返回原始的复合值（可能导致不匹配，但至少不会崩溃）
    return getCompositeValue(selectedModel);
  }, [selectedModel, getCompositeValue, availableModels]);

  // 计算动态字体大小函数
  const getDynamicFontSize = (text: string): string => {
    const baseSize = 0.875; // 基础字体大小 (rem)
    const minSize = 0.65; // 最小字体大小 (rem)
    const maxLength = 18; // 理想最大长度

    if (text.length <= maxLength) {
      return `${baseSize}rem`;
    }

    // 使用更平滑的缩放算法
    const lengthRatio = text.length / maxLength;
    const scaleFactor = Math.max(1 / Math.sqrt(lengthRatio), minSize / baseSize);
    const scaledSize = baseSize * scaleFactor;

    return `${Math.max(scaledSize, minSize)}rem`;
  };

  // 自定义渲染选中的值
  const renderValue = (value: string) => {
    if (!value || !selectedModel) {
      return (
        <Typography
          variant="body2"
          sx={{
            color: theme.palette.text.secondary,
            fontSize: '0.875rem'
          }}
        >
          选择模型
        </Typography>
      );
    }

    const dynamicFontSize = getDynamicFontSize(selectedModel.name);
    const providerName = getProviderName(selectedModel.provider);

    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', width: '100%', py: 0.5 }}>
        <Typography
          variant="body2"
          sx={{
            fontWeight: 500,
            fontSize: dynamicFontSize,
            color: theme.palette.text.primary,
            maxWidth: '150px', // 限制最大宽度
            transition: 'font-size 0.2s ease', // 平滑过渡效果
            wordBreak: 'keep-all', // 保持单词完整
            lineHeight: 1.1 // 调整行高
          }}
          title={selectedModel.name} // 悬停时显示完整名称
        >
          {selectedModel.name}
        </Typography>
        <Typography
          variant="caption"
          sx={{
            fontSize: '0.7rem',
            color: theme.palette.text.secondary,
            lineHeight: 1,
            mt: 0.25,
            maxWidth: '150px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}
          title={providerName} // 悬停时显示完整供应商名称
        >
          {providerName}
        </Typography>
      </Box>
    );
  };

  return (
    <FormControl
      variant="outlined"
      size="small"
      sx={{
        minWidth: 180,
        mr: 1,
        userSelect: 'none', // 禁止文本选择
        '& .MuiOutlinedInput-root': {
          borderRadius: '16px',
          fontSize: '0.9rem',
          bgcolor: theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.03)' : theme.palette.background.paper, // 深色模式淡背景，浅色模式跟随主题
          '& .MuiOutlinedInput-notchedOutline': {
            border: `1px solid ${theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)'}`, // 淡黑边框
          },
          '&:hover .MuiOutlinedInput-notchedOutline': {
            border: `1px solid ${theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.12)'}`, // 悬停时稍微明显一点
          },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
            border: `1px solid ${theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.15)'}`, // 聚焦时更明显
          },
          '&:hover': {
            bgcolor: theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.05)' : theme.palette.background.paper,
          }
        }
      }}
    >
      <Select
        labelId="model-select-label"
        id="model-select"
        value={getCurrentValue()}
        onChange={handleChange}
        displayEmpty
        renderValue={renderValue}
        sx={{
          bgcolor: 'transparent',
          border: 'none',
          '& .MuiSelect-select': {
            padding: '10px 32px 10px 12px', // 增加垂直内边距以适应两行文字
            bgcolor: 'transparent',
            border: 'none',
            '&:focus': {
              bgcolor: 'transparent',
            }
          },
          '& .MuiSelect-icon': {
            color: theme.palette.text.secondary,
          },
          '&:before': {
            display: 'none',
          },
          '&:after': {
            display: 'none',
          },
          '&:focus': {
            bgcolor: 'transparent',
          },
          '&:hover': {
            bgcolor: 'transparent',
          }
        }}
        MenuProps={{
          disableAutoFocus: true,
          disableRestoreFocus: true,
          disableEnforceFocus: true,
          slotProps: {
            paper: {
              sx: {
                maxHeight: '70vh', // 增加最大高度到视口高度的70%
                minHeight: 300, // 设置最小高度
                width: 'auto', // 自动宽度
                maxWidth: 400, // 限制最大宽度
                minWidth: 280, // 设置最小宽度
                mt: 0.5,
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)',
                bgcolor: theme.palette.mode === 'dark' ? '#2A2A2A' : theme.palette.background.paper, // 不透明背景
                '& .MuiList-root': {
                  py: 0,
                  bgcolor: 'transparent',
                  '&:focus': {
                    outline: 'none'
                  }
                }
              }
            },
            root: {
              slotProps: {
                backdrop: {
                  invisible: false,
                  sx: {
                    backgroundColor: 'transparent'
                  }
                }
              }
            }
          }
        }}
      >
        {groupedModels.sortedGroups.flatMap((providerId) => {
          const providerName = getProviderName(providerId);
          const providerInfo = getProviderInfo(providerId);
          const models = groupedModels.groups[providerId];

          return [
            // 供应商分组标题
            <ListSubheader
              key={`header-${providerId}`}
              sx={{
                bgcolor: theme.palette.mode === 'dark' ? '#3A3A3A' : '#F5F5F5', // 更明显的背景色
                fontWeight: 600,
                fontSize: '0.8rem', // 减小字体大小
                py: 0.75, // 减少垂直内边距
                px: 2,
                minHeight: 32, // 设置最小高度
                display: 'flex',
                alignItems: 'center',
                gap: 0.75, // 减少间距
                position: 'sticky', // 粘性定位
                top: 0, // 固定在顶部
                zIndex: 10, // 确保在其他元素之上
                borderBottom: `1px solid ${theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`,
                '&:not(:first-of-type)': {
                  borderTop: `1px solid ${theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)'}`
                }
              }}
            >
              <Avatar
                sx={{
                  width: 16, // 减小头像大小
                  height: 16,
                  bgcolor: providerInfo?.color || theme.palette.primary.main,
                  fontSize: '0.65rem' // 减小字体大小
                }}
              >
                {providerInfo?.avatar || providerName[0]}
              </Avatar>
              {providerName}
            </ListSubheader>,
            // 该供应商下的模型
            ...models.map((model) => {
              const compositeValue = getCompositeValue(model);

              return (
                <MenuItem
                  key={compositeValue}
                  value={compositeValue}
                  sx={{
                    py: 1, // 减少垂直内边距
                    pl: 3, // 减少左边距
                    pr: 2,
                    minHeight: 40, // 设置最小高度
                    bgcolor: 'transparent',
                    '&:hover': {
                      bgcolor: theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.04)'
                    },
                    '&.Mui-selected': {
                      bgcolor: theme.palette.mode === 'dark' ? 'rgba(33, 150, 243, 0.2)' : 'rgba(33, 150, 243, 0.1)',
                      '&:hover': {
                        bgcolor: theme.palette.mode === 'dark' ? 'rgba(33, 150, 243, 0.3)' : 'rgba(33, 150, 243, 0.15)'
                      }
                    }
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', width: '100%', maxWidth: '100%' }}>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography
                        variant="body2"
                        sx={{
                          fontWeight: 500,
                          fontSize: '0.875rem', // 稍微减小字体
                          lineHeight: 1.3, // 减少行高
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          maxWidth: '100%'
                        }}
                        title={model.name} // 悬停显示完整名称
                      >
                        {model.name}
                      </Typography>
                      {model.description && (
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{
                            display: 'block',
                            fontSize: '0.75rem', // 减小描述字体
                            lineHeight: 1.2,
                            mt: 0.25, // 减少上边距
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            maxWidth: '100%'
                          }}
                          title={model.description} // 悬停显示完整描述
                        >
                          {model.description}
                        </Typography>
                      )}
                    </Box>
                  </Box>
                </MenuItem>
              );
            }).filter(Boolean)
          ].filter(Boolean);
        })}
      </Select>
    </FormControl>
  );
};

export default DropdownModelSelector;