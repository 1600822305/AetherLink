import React, { useState, useEffect, useCallback, useRef, useTransition, useMemo } from 'react';
import {
  IconButton,
  TextField,
  Typography,
  Box,
  CircularProgress,
  useTheme,
  InputAdornment,
  Avatar
} from '@mui/material';
import BackButtonDrawer from '../common/BackButtonDrawer';
import {
  Plus as AddIcon,
  Minus as RemoveIcon,
  Search as SearchIcon
} from 'lucide-react';
import { alpha } from '@mui/material/styles';
import { fetchModels } from '../../shared/services/network/APIService';
import type { Model } from '../../shared/types';
import { debounce } from 'lodash';
import { useTranslation } from 'react-i18next';
import VirtualizedModelGroupList from '../settings/VirtualizedModelGroupList';
import { getDefaultGroupName, modelMatchesIdentity } from '../../shared/utils/modelUtils';
import { createLogger } from '../../shared/services/infra/logger';

const logger = createLogger('ModelManagementDialog');

// 定义分组模型的类型
type GroupedModels = Record<string, Model[]>;

// 触感反馈按钮组件
const TactileButton: React.FC<{
  children: React.ReactNode;
  onClick?: () => void;
  sx?: any;
}> = ({ children, onClick, sx }) => {
  const [pressed, setPressed] = useState(false);

  return (
    <Box
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onMouseLeave={() => setPressed(false)}
      onClick={onClick}
      sx={{
        transform: pressed ? 'scale(0.97)' : 'scale(1)',
        transition: 'transform 0.15s cubic-bezier(0.4, 0, 0.2, 1)',
        cursor: 'pointer',
        ...sx
      }}
    >
      {children}
    </Box>
  );
};

// 品牌头像组件
const BrandAvatar: React.FC<{ name: string; size?: number }> = ({ name, size = 28 }) => {
  const getInitial = (name: string) => {
    const match = name.match(/^([a-zA-Z0-9])/);
    return match ? match[1].toUpperCase() : '?';
  };

  const getColor = (name: string) => {
    const colors = [
      '#9333EA', '#3B82F6', '#10B981', '#F59E0B', '#EF4444', 
      '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16', '#F97316'
    ];
    const hash = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[hash % colors.length];
  };

  return (
    <Avatar
      sx={{
        width: size,
        height: size,
        bgcolor: getColor(name),
        fontSize: size * 0.5,
        fontWeight: 600
      }}
    >
      {getInitial(name)}
    </Avatar>
  );
};

interface ModelManagementDialogProps {
  open: boolean;
  onClose: () => void;
  provider: any;
  onAddModel: (model: Model) => void;
  onAddModels?: (models: Model[]) => void;
  onRemoveModel: (modelId: string) => void;
  onRemoveModels?: (modelIds: string[]) => void;
  existingModels: Model[];
}

const ModelManagementDialog: React.FC<ModelManagementDialogProps> = ({
  open,
  onClose,
  provider,
  onAddModel,
  onAddModels,
  onRemoveModel,
  onRemoveModels,
  existingModels
}) => {
  const theme = useTheme();
  const { t } = useTranslation();
  const [loading, setLoading] = useState<boolean>(false);
  const [models, setModels] = useState<Model[]>([]);
  const [searchInputValue, setSearchInputValue] = useState<string>('');
  const [actualSearchTerm, setActualSearchTerm] = useState<string>('');
  const [pendingModels, setPendingModels] = useState<Map<string, boolean>>(new Map());

  const [, startSearchTransition] = useTransition();

  // 使用ref存储初始provider，避免重新加载
  const initialProviderRef = useRef<any>(null);

  // 检查模型是否已经在提供商的模型列表中（使用精确匹配：{id, provider}组合）
  const isModelInProvider = useCallback((modelId: string): boolean => {
    return existingModels.some(m => 
      modelMatchesIdentity(m, { id: modelId, provider: provider.id }, provider.id)
    ) || pendingModels.get(modelId) === true;
  }, [existingModels, pendingModels, provider.id]);

  // 恢复防抖搜索函数，使用 useTransition 优化性能
  const debouncedSetSearchTerm = useMemo(
    () => debounce((value: string) => {
      startSearchTransition(() => {
        setActualSearchTerm(value);
      });
    }, 300), // 300ms防抖延迟
    []
  );

  // 清理防抖函数
  useEffect(() => {
    return () => {
      debouncedSetSearchTerm.cancel();
    };
  }, [debouncedSetSearchTerm]);

  // 优化搜索输入处理 - 确保输入框立即响应
  const handleSearchChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = event.target.value;
    // 立即同步更新输入框显示，不使用任何异步操作
    setSearchInputValue(newValue);
    // 防抖更新实际搜索逻辑
    debouncedSetSearchTerm(newValue);
  }, [debouncedSetSearchTerm]);

  // 将过滤和分组操作合并为一次循环，以提升性能，解决首次输入卡顿问题
  const groupedModels = useMemo((): GroupedModels => {
    const searchLower = actualSearchTerm.toLowerCase();
    const result: GroupedModels = {};

    for (const model of models) {
      // 如果搜索词为空，或模型名称/ID匹配，则处理该模型
      const modelName = model.name || model.id;
      if (!searchLower || modelName.toLowerCase().includes(searchLower) || model.id.toLowerCase().includes(searchLower)) {
        // 使用自动分组逻辑：优先使用 model.group，否则自动从 ID 推断
        const group = model.group || getDefaultGroupName(model.id, provider?.id);

        if (!result[group]) {
          result[group] = [];
        }
        result[group].push(model);
      }
    }
    return result;
  }, [models, actualSearchTerm, provider?.id]);

  const handleAddSingleModel = useCallback((model: Model) => {
    if (!isModelInProvider(model.id)) {
      setPendingModels(prev => new Map(prev).set(model.id, true));
      onAddModel(model);
    }
  }, [isModelInProvider, onAddModel]);

  const handleRemoveSingleModel = useCallback((modelId: string) => {
    setPendingModels(prev => {
      const newMap = new Map(prev);
      newMap.delete(modelId);
      return newMap;
    });
    onRemoveModel(modelId);
  }, [onRemoveModel]);

  // 添加整个组 - 使用 useCallback 优化性能
  const handleAddGroup = useCallback((group: string) => {
    // 创建新模型集合，一次性添加整个组
    const modelsToAdd = groupedModels[group]?.filter((model: Model) => !isModelInProvider(model.id)) || [];

    if (modelsToAdd.length > 0) {
      // 批量更新pendingModels状态
      setPendingModels(prev => {
        const newPendingModels = new Map(prev);
        modelsToAdd.forEach((model: Model) => {
          newPendingModels.set(model.id, true);
        });
        return newPendingModels;
      });

      // 使用批量添加API（如果可用）
      if (onAddModels) {
        // 为每个模型创建副本
        const modelsCopy = modelsToAdd.map((model: Model) => ({...model}));
        // 批量添加
        onAddModels(modelsCopy);
      } else {
        // 为每个要添加的模型创建一个副本，添加到provider中
        modelsToAdd.forEach((model: Model) => {
          onAddModel({...model});
        });
      }
    }
  }, [groupedModels, isModelInProvider, onAddModels, onAddModel]);

  // 移除整个组 - 使用 useCallback 优化性能
  const handleRemoveGroup = useCallback((group: string) => {
    const modelsToRemove = groupedModels[group]?.filter((model: Model) => isModelInProvider(model.id)) || [];

    if (modelsToRemove.length > 0) {
      // 批量更新pendingModels状态
      setPendingModels(prev => {
        const newPendingModels = new Map(prev);
        modelsToRemove.forEach((model: Model) => {
          newPendingModels.delete(model.id);
        });
        return newPendingModels;
      });

      // 使用批量移除API（如果可用）
      if (onRemoveModels) {
        // 批量移除
        const modelIdsToRemove = modelsToRemove.map((model: Model) => model.id);
        onRemoveModels(modelIdsToRemove);
      } else {
        // 逐个移除
        modelsToRemove.forEach((model: Model) => {
          onRemoveModel(model.id);
        });
      }
    }
  }, [groupedModels, isModelInProvider, onRemoveModels, onRemoveModel]);

  // 加载模型列表
  const loadModels = async () => {
    try {
      setLoading(true);
      // 使用ref中存储的provider或当前provider
      const providerToUse = initialProviderRef.current || provider;
      const fetchedModels = await fetchModels(providerToUse);
      // 合并现有模型和从API获取的模型
      const allModels = [...fetchedModels];
      setModels(allModels);
    } catch (error) {
      logger.error('加载模型失败:', error);
    } finally {
      setLoading(false);
    }
  };



  // 当对话框打开时加载模型（避免每次provider变化都重新加载）
  useEffect(() => {
    if (open && provider && (!initialProviderRef.current || initialProviderRef.current.id !== provider.id)) {
      initialProviderRef.current = provider;
      loadModels();
    }
  }, [open, provider]); // 只依赖open状态，不依赖provider

  // 当对话框关闭时重置搜索状态
  useEffect(() => {
    if (!open) {
      setSearchInputValue('');
      setActualSearchTerm('');
      debouncedSetSearchTerm.cancel();
    }
  }, [open, debouncedSetSearchTerm]);

  // 分组后的模型数据
  const groupedModelsList = useMemo(() => {
    const groupKeys = Object.keys(groupedModels).sort((a, b) => {
      if (a === 'Embeddings') return -1;
      if (b === 'Embeddings') return 1;
      if (a === '其他模型') return 1;
      if (b === '其他模型') return -1;
      return a.localeCompare(b);
    });
    
    return groupKeys.map(name => [name, groupedModels[name]] as [string, Model[]]);
  }, [groupedModels]);

  return (
    <BackButtonDrawer
      drawerId="model-management-drawer"
      anchor="bottom"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: {
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
          maxHeight: '80vh',
          bgcolor: 'background.paper',
          pb: 'var(--safe-area-bottom-computed, 0px)'
        }
      }}
    >
      <Box sx={{ height: '80vh', display: 'flex', flexDirection: 'column' }}>
        {/* 拖拽指示器 */}
        <Box sx={{ pt: 1, pb: 1.5, display: 'flex', justifyContent: 'center' }}>
          <Box
            sx={{
              width: 40,
              height: 4,
              bgcolor: (theme) => alpha(theme.palette.text.primary, 0.2),
              borderRadius: 999
            }}
          />
        </Box>

        {/* 搜索栏 */}
        <Box sx={{ px: 2, pb: 1 }}>
          <TextField
            fullWidth
            placeholder={t('modelSettings.dialogs.modelManagement.searchPlaceholder')}
            value={searchInputValue}
            onChange={handleSearchChange}
            autoComplete="off"
            spellCheck={false}
            size="small"
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon size={20} color={theme.palette.text.secondary} />
                </InputAdornment>
              ),
              sx: {
                borderRadius: 3,
                bgcolor: 'action.hover',
                '& fieldset': { border: 'none' }
              }
            }}
          />
        </Box>

        {/* 模型列表 */}
        <Box sx={{ flex: 1, minHeight: 0, overflow: 'hidden', px: 1.5 }}>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          ) : groupedModelsList.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Typography color="text.secondary">
                {actualSearchTerm ? t('modelSettings.dialogs.modelManagement.noModelsFound') : t('modelSettings.dialogs.modelManagement.noModelsAvailable')}
              </Typography>
            </Box>
          ) : (
            <VirtualizedModelGroupList
              modelGroups={groupedModelsList}
              showEmptyState={false}
              defaultExpanded={[]}
              enableSearch={false}
              bordered={false}
              maxHeight="calc(80vh - 96px)"
              renderModelItem={(model) => {
                const added = isModelInProvider(model.id);
                return (
                  <TactileButton key={model.id} sx={{ width: '100%' }}>
                    <Box
                      sx={{
                        position: 'relative',
                        display: 'flex',
                        alignItems: 'center',
                        py: { xs: 1.5, sm: 1 },
                        pl: { xs: 2.5, sm: 2 },
                        pr: { xs: 7, sm: 6 },
                        transition: 'all 0.2s ease',
                        '&:hover': {
                          bgcolor: alpha(theme.palette.primary.main, 0.05),
                        },
                      }}
                    >
                      <Box sx={{ width: { xs: 32, sm: 28 }, display: 'flex', justifyContent: 'center', flexShrink: 0 }}>
                        <BrandAvatar name={model.id} size={28} />
                      </Box>
                      
                      <Box sx={{ flex: 1, ml: { xs: 2.5, sm: 2 }, minWidth: 0 }}>
                        <Typography 
                          variant="body2" 
                          fontWeight={600} 
                          sx={{ 
                            lineHeight: 1.4,
                            fontSize: { xs: '0.95rem', sm: '0.875rem' }
                          }}
                        >
                          {model.name || model.id}
                        </Typography>
                        {model.id !== model.name && (
                          <Typography 
                            variant="caption" 
                            color="text.secondary" 
                            sx={{ 
                              display: 'block', 
                              mt: { xs: 0.5, sm: 0.25 }, 
                              lineHeight: 1.3,
                              fontSize: { xs: '0.8rem', sm: '0.75rem' }
                            }}
                          >
                            {model.id}
                          </Typography>
                        )}
                      </Box>
                      
                      {/* 添加/移除按钮 - 绝对定位 */}
                      <IconButton
                        size="small"
                        onClick={() => {
                          if (added) {
                            handleRemoveSingleModel(model.id);
                          } else {
                            handleAddSingleModel(model);
                          }
                        }}
                        sx={{ 
                          position: 'absolute',
                          right: { xs: 2.5, sm: 2 },
                          top: '50%',
                          transform: 'translateY(-50%)',
                          width: { xs: 40, sm: 36 },
                          height: { xs: 40, sm: 36 },
                          minWidth: { xs: 40, sm: 36 },
                          borderRadius: 1.5,
                          p: 0,
                          bgcolor: added
                            ? (theme) => alpha(theme.palette.error.main, 0.12)
                            : (theme) => alpha(theme.palette.success.main, 0.12),
                          color: added ? 'error.main' : 'success.main',
                          '&:hover': {
                            bgcolor: added
                              ? (theme) => alpha(theme.palette.error.main, 0.2)
                              : (theme) => alpha(theme.palette.success.main, 0.2),
                          },
                          transition: 'all 0.2s ease',
                        }}
                      >
                        {added ? (
                          <RemoveIcon size={18} />
                        ) : (
                          <AddIcon size={18} />
                        )}
                      </IconButton>
                    </Box>
                  </TactileButton>
                );
              }}
              renderGroupButton={(groupName, models) => {
                const allAdded = models.every(m => isModelInProvider(m.id));
                return (
                  <IconButton
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (allAdded) {
                        handleRemoveGroup(groupName);
                      } else {
                        handleAddGroup(groupName);
                      }
                    }}
                    sx={{
                      width: { xs: 40, sm: 36 },
                      height: { xs: 40, sm: 36 },
                      minWidth: { xs: 40, sm: 36 },
                      borderRadius: 1.5,
                      p: 0,
                      bgcolor: allAdded
                        ? (theme) => alpha(theme.palette.error.main, 0.12)
                        : (theme) => alpha(theme.palette.success.main, 0.12),
                      color: allAdded ? 'error.main' : 'success.main',
                      '&:hover': {
                        bgcolor: allAdded
                          ? (theme) => alpha(theme.palette.error.main, 0.2)
                          : (theme) => alpha(theme.palette.success.main, 0.2),
                      }
                    }}
                    title={allAdded ? t('modelSettings.dialogs.modelManagement.removeGroup') : t('modelSettings.dialogs.modelManagement.addGroup')}
                  >
                    {allAdded ? (
                      <RemoveIcon size={18} />
                    ) : (
                      <AddIcon size={18} />
                    )}
                  </IconButton>
                );
              }}
            />
          )}
        </Box>
      </Box>
    </BackButtonDrawer>
  );
};

export default ModelManagementDialog;
