import React from 'react';
import {
  Select,
  MenuItem,
  Typography,
  alpha,
  useTheme,
  Box,
  ListSubheader,
  Avatar,
  useMediaQuery
} from '@mui/material';
import type { Model } from '../../../shared/types';
import { useSelector } from 'react-redux';
import type { SelectChangeEvent } from '@mui/material';
import { selectProviders } from '../../../shared/store/selectors/settingsSelectors';
import { UnifiedModelDisplay } from './UnifiedModelDisplay';
import { getModelIdentityKey, modelMatchesIdentity, parseModelIdentityKey } from '../../../shared/utils/modelUtils';
import { getProviderIcon, getModelOrProviderIcon } from '../../../shared/utils/providerIcons';
import { createLogger } from '../../../shared/services/infra/logger';

const logger = createLogger('DropdownModelSelector');

interface DropdownModelSelectorProps {
  selectedModel: Model | null;
  availableModels: Model[];
  handleModelSelect: (model: Model) => void;
  displayStyle?: 'icon' | 'text';
}

export const DropdownModelSelector: React.FC<DropdownModelSelectorProps> = ({
  selectedModel,
  availableModels,
  handleModelSelect,
  displayStyle = 'text'
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const providers = useSelector(selectProviders);

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
    const identityValue = event.target.value;
    if (!identityValue || typeof identityValue !== 'string') return;

    setOpen(false);
    requestAnimationFrame(() => {
      const activeElement = document.activeElement as HTMLElement | null;
      if (activeElement?.getAttribute('role') === 'option') {
        activeElement.blur();
      }
    });

    try {
      const identity = parseModelIdentityKey(identityValue);
      if (!identity) {
        logger.error('无法解析模型标识:', identityValue);
        return;
      }

      const model = availableModels.find(m =>
        modelMatchesIdentity(m, identity, m.provider)
      );

      if (model) {
        // 使用setTimeout防止事件处理冲突
        setTimeout(() => {
          handleModelSelect(model);
        }, 0);
      } else {
        logger.error('未找到匹配的模型:', identityValue);
      }
    } catch (error) {
      logger.error('处理模型选择时出错:', error);
    }
  };

  const getIdentityValue = React.useCallback((model: Model): string => {
    return getModelIdentityKey({ id: model.id, provider: model.provider || model.providerType || '' });
  }, []);

  // 获取当前选中模型的复合值
  const getCurrentValue = React.useCallback((): string => {
    if (!selectedModel) return '';

    const selectedIdentity = parseModelIdentityKey(getIdentityValue(selectedModel));
    if (selectedIdentity) {
      const exactMatch = availableModels.find(m =>
        modelMatchesIdentity(m, selectedIdentity, m.provider)
      );

      if (exactMatch) {
        return getIdentityValue(exactMatch);
      }
    }

    // 如果都没找到，返回原始的复合值（可能导致不匹配，但至少不会崩溃）
    return getIdentityValue(selectedModel);
  }, [selectedModel, getIdentityValue, availableModels]);

  // 处理下拉菜单打开状态
  const [open, setOpen] = React.useState(false);

  const handleOpen = () => setOpen(true);
  const handleClose = () => setOpen(false);

  return (
    <Box sx={{ position: 'relative' }}>
      <UnifiedModelDisplay
        selectedModel={selectedModel}
        onClick={handleOpen}
        displayStyle={displayStyle}
      />
      <Select
        open={open}
        onClose={handleClose}
        onOpen={handleOpen}
        value={getCurrentValue()}
        onChange={handleChange}
        displayEmpty
        renderValue={() => null}
        sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          opacity: 0,
          pointerEvents: open ? 'auto' : 'none',
          '& .MuiSelect-select': {
            padding: 0,
            border: 'none',
            bgcolor: 'transparent',
          },
          '& .MuiSelect-icon': {
            display: 'none',
          },
          '&:before': {
            display: 'none',
          },
          '&:after': {
            display: 'none',
          },
          '& .MuiOutlinedInput-notchedOutline': {
            border: 'none',
          }
        }}
        MenuProps={{
          anchorOrigin: {
            vertical: 'bottom',
            horizontal: 'left',
          },
          transformOrigin: {
            vertical: 'top',
            horizontal: 'left',
          },
          slotProps: {
            paper: {
              sx: {
                maxHeight: isMobile ? '50vh' : '70vh', // 移动端减少高度避免超出屏幕
                minHeight: isMobile ? 150 : 300,
                width: isMobile ? '85vw' : 'auto', // 移动端使用更大宽度
                maxWidth: isMobile ? '85vw' : 400,
                minWidth: isMobile ? '300px' : 280,
                mt: 0.5,
                // 移动端确保不超出屏幕边界
                ...(isMobile && {
                  maxWidth: 'calc(100vw - 32px)', // 留出边距
                  marginLeft: 'auto',
                  marginRight: 'auto'
                }),
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)',
                bgcolor: theme.palette.mode === 'dark' ? '#2A2A2A' : theme.palette.background.paper,
                borderRadius: 1,
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
                  invisible: true, // 保持透明背景，维持下拉效果
                  sx: {
                    backgroundColor: 'transparent'
                  }
                }
              }
            }
          }
        }}
      >
        {/* 始终渲染当前选中的模型，避免 MUI Select 值不匹配警告 */}
        {!open && selectedModel && (
          <MenuItem 
            key={getIdentityValue(selectedModel)} 
            value={getIdentityValue(selectedModel)}
            sx={{ display: 'none' }}
          />
        )}
        
        {/* 只在打开时渲染完整的模型列表 */}
        {open && groupedModels.sortedGroups.flatMap((providerId) => {
          const providerName = getProviderName(providerId);
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
                borderBottom: `1px solid ${theme.palette.divider}`,
                '&:not(:first-of-type)': {
                  borderTop: `1px solid ${alpha(theme.palette.divider, 0.5)}`
                }
              }}
            >
              <Avatar
                src={getProviderIcon(providerId, theme.palette.mode === 'dark')}
                alt={providerName}
                sx={{
                  width: 16, // 减小头像大小
                  height: 16,
                  bgcolor: 'transparent',
                  fontSize: '0.65rem' // 减小字体大小
                }}
              >
                {providerName[0]}
              </Avatar>
              {providerName}
            </ListSubheader>,
            // 该供应商下的模型
            ...models.map((model) => {
              const identityValue = getIdentityValue(model);

              return (
                <MenuItem
                  key={identityValue}
                  value={identityValue}
                  sx={{
                    py: 1, // 减少垂直内边距
                    pl: 3, // 减少左边距
                    pr: 2,
                    minHeight: 40, // 设置最小高度
                    bgcolor: 'transparent',
                    '&:hover': {
                      bgcolor: 'action.hover'
                    },
                    '&.Mui-selected': {
                      bgcolor: alpha(theme.palette.primary.main, 0.12),
                      '&:hover': {
                        bgcolor: alpha(theme.palette.primary.main, 0.2)
                      }
                    }
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, width: '100%', maxWidth: '100%' }}>
                    <Avatar
                      src={getModelOrProviderIcon(model.id, model.provider || model.providerType || '', theme.palette.mode === 'dark')}
                      alt={model.name}
                      sx={{
                        width: 24,
                        height: 24,
                        bgcolor: 'transparent',
                        fontSize: '0.7rem',
                        flexShrink: 0
                      }}
                    >
                      {model.name[0]}
                    </Avatar>
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
    </Box>
  );
};

export default DropdownModelSelector;