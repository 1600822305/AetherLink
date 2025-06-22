import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Checkbox,
  Typography,
  Box,
  Chip,
  IconButton,
  Tooltip,
  useTheme,
  useMediaQuery
} from '@mui/material';
import { X as CloseIcon, ArrowLeftRight as CompareArrowsIcon, CheckSquare as SelectAllIcon, Trash2 as ClearAllIcon, History as HistoryIcon } from 'lucide-react';
import { useSelector } from 'react-redux';
import type { RootState } from '../../shared/store';
import type { Model } from '../../shared/types';

interface MultiModelSelectorProps {
  open: boolean;
  onClose: () => void;
  availableModels: Model[];
  onConfirm: (selectedModels: Model[]) => void; // 传递模型对象而不是ID
  maxSelection?: number; // 最大选择数量
}

/**
 * 多模型选择器组件
 * 允许用户选择多个模型进行并行响应
 */
const MultiModelSelector: React.FC<MultiModelSelectorProps> = ({
  open,
  onClose,
  availableModels,
  onConfirm,
  maxSelection = 5 // 默认最多选择5个模型
}) => {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));
  const [selectedModelIds, setSelectedModelIds] = useState<string[]>([]);

  // 从Redux获取提供商配置
  const providers = useSelector((state: RootState) => state.settings.providers || []);

  // 创建提供商名称映射
  const providerNameMap = useMemo(() => {
    const map = new Map<string, string>();
    providers.forEach(provider => {
      map.set(provider.id, provider.name);
    });
    return map;
  }, [providers]);

  // 记忆功能 - 保存和加载上次选择的模型
  const STORAGE_KEY = 'multiModelSelector_lastSelection';

  // 从localStorage加载上次选择的模型
  const loadLastSelection = useCallback(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const lastSelection = JSON.parse(saved);
        // 验证保存的模型是否仍然可用
        const validSelection = lastSelection.filter((uniqueId: string) =>
          availableModels.some(model => getUniqueModelId(model) === uniqueId)
        );
        return validSelection;
      }
    } catch (error) {
      console.warn('加载上次多模型选择失败:', error);
    }
    return [];
  }, [availableModels]);

  // 保存当前选择到localStorage
  const saveCurrentSelection = useCallback((selection: string[]) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(selection));
    } catch (error) {
      console.warn('保存多模型选择失败:', error);
    }
  }, []);

  // 组件打开时自动加载上次选择
  useEffect(() => {
    if (open && selectedModelIds.length === 0) {
      const lastSelection = loadLastSelection();
      if (lastSelection.length > 0) {
        setSelectedModelIds(lastSelection);
      }
    }
  }, [open, loadLastSelection, selectedModelIds.length]);

  // 生成唯一的模型标识符（供应商+模型ID）
  const getUniqueModelId = useCallback((model: Model) => {
    const provider = model.provider || model.providerType || 'unknown';
    return `${provider}:${model.id}`;
  }, []);

  // 处理模型选择
  const handleToggleModel = useCallback((model: Model) => {
    const uniqueId = getUniqueModelId(model);
    setSelectedModelIds(prev => {
      if (prev.includes(uniqueId)) {
        // 取消选择
        return prev.filter(id => id !== uniqueId);
      } else {
        // 添加选择（检查最大数量限制）
        if (prev.length >= maxSelection) {
          return prev; // 达到最大选择数量，不添加
        }
        return [...prev, uniqueId];
      }
    });
  }, [maxSelection, getUniqueModelId]);

  // 全选
  const handleSelectAll = useCallback(() => {
    const allUniqueIds = availableModels.slice(0, maxSelection).map(model => getUniqueModelId(model));
    setSelectedModelIds(allUniqueIds);
  }, [availableModels, maxSelection, getUniqueModelId]);

  // 清空选择
  const handleClearAll = useCallback(() => {
    setSelectedModelIds([]);
  }, []);

  // 快速选择上次的模型
  const handleQuickSelectLast = useCallback(() => {
    const lastSelection = loadLastSelection();
    if (lastSelection.length > 0) {
      setSelectedModelIds(lastSelection);
    }
  }, [loadLastSelection]);

  // 确认选择
  const handleConfirm = useCallback(() => {
    if (selectedModelIds.length > 0) {
      // 保存当前选择到记忆中
      saveCurrentSelection(selectedModelIds);

      // 将唯一ID转换回模型对象，传递给父组件
      const selectedModels = selectedModelIds.map(uniqueId => {
        return availableModels.find(model => getUniqueModelId(model) === uniqueId);
      }).filter(Boolean) as Model[];

      onConfirm(selectedModels);
      setSelectedModelIds([]); // 重置选择
      onClose();
    }
  }, [selectedModelIds, availableModels, getUniqueModelId, onConfirm, onClose, saveCurrentSelection]);

  // 关闭对话框
  const handleClose = useCallback(() => {
    setSelectedModelIds([]); // 重置选择
    onClose();
  }, [onClose]);

  // 获取模型显示名称
  const getModelDisplayName = useCallback((model: Model) => {
    return model.name || model.id;
  }, []);

  // 获取提供商名称 - 使用友好名称而不是内部ID
  const getProviderName = useCallback((providerId: string) => {
    return providerNameMap.get(providerId) || providerId;
  }, [providerNameMap]);

  // 获取提供商信息
  const getProviderInfo = useCallback((providerId: string) => {
    return providers.find(p => p.id === providerId);
  }, [providers]);

  // 按提供商分组模型
  const groupedModels = useMemo(() => {
    const groups: { [key: string]: Model[] } = {};

    availableModels.forEach(model => {
      const providerId = model.provider || model.providerType || 'unknown';
      if (!groups[providerId]) {
        groups[providerId] = [];
      }
      groups[providerId].push(model);
    });

    // 按照设置中的提供商顺序排序
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

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      fullScreen={fullScreen}
      maxWidth="sm"
      fullWidth
      slotProps={{
        paper: {
          sx: {
            borderRadius: fullScreen ? 0 : 2,
            maxHeight: '80vh'
          }
        }
      }}
    >
      <DialogTitle sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        pb: 1
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <CompareArrowsIcon size={20} style={{ marginRight: 8, color: theme.palette.primary.main }} />
          <Typography variant="h6">
            选择多个模型
          </Typography>
        </Box>
        <IconButton onClick={handleClose} size="small">
          <CloseIcon size={20} />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ px: 1, py: 1 }}>
        {/* 选择状态和操作按钮 */}
        <Box sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 2,
          px: 2
        }}>
          <Typography variant="body2" color="text.secondary">
            已选择 {selectedModelIds.length} / {maxSelection} 个模型
          </Typography>
          <Box>
            <Tooltip title="选择上次的模型">
              <IconButton
                size="small"
                onClick={handleQuickSelectLast}
                disabled={loadLastSelection().length === 0}
                sx={{
                  color: loadLastSelection().length > 0 ? theme.palette.primary.main : 'inherit'
                }}
              >
                <HistoryIcon size={16} />
              </IconButton>
            </Tooltip>
            <Tooltip title="全选">
              <IconButton
                size="small"
                onClick={handleSelectAll}
                disabled={availableModels.length === 0}
              >
                <SelectAllIcon size={16} />
              </IconButton>
            </Tooltip>
            <Tooltip title="清空">
              <IconButton
                size="small"
                onClick={handleClearAll}
                disabled={selectedModelIds.length === 0}
              >
                <ClearAllIcon size={16} />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        {/* 快速选择上次模型的提示 */}
        {loadLastSelection().length > 0 && selectedModelIds.length === 0 && (
          <Box sx={{ mb: 2, px: 2 }}>
            <Button
              variant="outlined"
              size="small"
              startIcon={<HistoryIcon size={16} />}
              onClick={handleQuickSelectLast}
              sx={{
                borderColor: theme.palette.primary.main,
                color: theme.palette.primary.main,
                '&:hover': {
                  backgroundColor: theme.palette.primary.main + '10'
                }
              }}
            >
              快速选择上次的 {loadLastSelection().length} 个模型
            </Button>
          </Box>
        )}

        {/* 已选择的模型标签 */}
        {selectedModelIds.length > 0 && (
          <Box sx={{ mb: 2, px: 2 }}>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
              已选择的模型：
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
              {selectedModelIds.map(uniqueId => {
                const model = availableModels.find(m => getUniqueModelId(m) === uniqueId);
                return model ? (
                  <Chip
                    key={uniqueId}
                    label={`${getProviderName(model.provider || model.providerType || '未知')} / ${getModelDisplayName(model)}`}
                    size="small"
                    onDelete={() => handleToggleModel(model)}
                    color="primary"
                    variant="outlined"
                  />
                ) : null;
              })}
            </Box>
          </Box>
        )}

        {/* 模型列表 - 按提供商分组 */}
        <List sx={{ pt: 0 }}>
          {groupedModels.sortedGroups.flatMap((providerId) => {
            const providerName = getProviderName(providerId);
            const providerInfo = getProviderInfo(providerId);
            const models = groupedModels.groups[providerId];

            return [
              // 提供商分组标题
              <ListItem
                key={`header-${providerId}`}
                sx={{
                  bgcolor: theme.palette.mode === 'dark' ? '#3A3A3A' : '#F5F5F5',
                  fontWeight: 600,
                  fontSize: '0.8rem',
                  py: 0.75,
                  px: 2,
                  minHeight: 32,
                  position: 'sticky',
                  top: 0,
                  zIndex: 10,
                  borderBottom: `1px solid ${theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`,
                  '&:not(:first-of-type)': {
                    borderTop: `1px solid ${theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)'}`
                  }
                }}
              >
                <ListItemIcon sx={{ minWidth: 32 }}>
                  <Box
                    sx={{
                      width: 16,
                      height: 16,
                      borderRadius: '50%',
                      bgcolor: providerInfo?.color || theme.palette.primary.main,
                      color: 'white',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.65rem',
                      fontWeight: 'bold'
                    }}
                  >
                    {providerInfo?.avatar || providerName[0]}
                  </Box>
                </ListItemIcon>
                <ListItemText
                  primary={providerName}
                  slotProps={{
                    primary: {
                      fontSize: '0.8rem',
                      fontWeight: 600
                    }
                  }}
                />
              </ListItem>,
              // 该提供商下的模型
              ...models.map((model) => {
                const uniqueId = getUniqueModelId(model);
                const isSelected = selectedModelIds.includes(uniqueId);
                const isDisabled = !isSelected && selectedModelIds.length >= maxSelection;

                return (
                  <ListItem
                    key={uniqueId}
                    component="div"
                    onClick={() => !isDisabled && handleToggleModel(model)}
                    sx={{
                      borderRadius: 1,
                      mb: 0.5,
                      ml: 2, // 缩进以显示层级关系
                      opacity: isDisabled ? 0.5 : 1,
                      cursor: isDisabled ? 'not-allowed' : 'pointer',
                      '&:hover': {
                        backgroundColor: isDisabled ? 'transparent' : theme.palette.action.hover
                      }
                    }}
                  >
                    <ListItemIcon>
                      <Checkbox
                        checked={isSelected}
                        disabled={isDisabled}
                        color="primary"
                        onChange={() => !isDisabled && handleToggleModel(model)}
                      />
                    </ListItemIcon>
                    <ListItemText
                      primary={`${getModelDisplayName(model)}`}
                      secondary={model.description || `${model.id}`}
                      slotProps={{
                        primary: {
                          fontWeight: isSelected ? 600 : 400
                        },
                        secondary: {
                          fontSize: '0.75rem'
                        }
                      }}
                    />
                  </ListItem>
                );
              })
            ].filter(Boolean);
          })}
        </List>

        {availableModels.length === 0 && (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography variant="body2" color="text.secondary">
              没有可用的模型
            </Typography>
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={handleClose} color="inherit">
          取消
        </Button>
        <Button
          onClick={handleConfirm}
          variant="contained"
          disabled={selectedModelIds.length === 0}
          startIcon={<CompareArrowsIcon size={16} />}
        >
          发送到 {selectedModelIds.length} 个模型
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default MultiModelSelector;
