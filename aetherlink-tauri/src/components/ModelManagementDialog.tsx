import React, { useState, useEffect, useCallback, useRef, useTransition, useMemo } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  ListItem,
  ListItemText,
  IconButton,
  TextField,
  Typography,
  Box,
  Divider,
  CircularProgress,
  Chip,
  Skeleton,
  Fade,
  useTheme,
  useMediaQuery
} from '@mui/material';
import { Plus as AddIcon, Minus as RemoveIcon, Search as SearchIcon, Database } from 'lucide-react';
import { alpha } from '@mui/material/styles';
import { FixedSizeList } from 'react-window';
import type { ListChildComponentProps } from 'react-window';
import { fetchModels } from '../shared/services/network/APIService';
import type { Model } from '../shared/types';
import { debounce } from 'lodash';

// STEP 1: Define necessary types and a shell for the Row component

// 定义分组模型的类型
type GroupedModels = Record<string, Model[]>;

// Virtual list item data type
type ListItemData = { type: 'group'; name: string; modelCount: number } | { type: 'model'; data: Model };

// Complete data passed to each list item
interface RowData {
  items: ListItemData[];
  isModelInProvider: (modelId: string) => boolean;
  handleAddSingleModel: (model: Model) => void;
  handleRemoveSingleModel: (modelId: string) => void;
  handleAddGroup: (group: string) => void;
  handleRemoveGroup: (group: string) => void;
  groupedModels: GroupedModels;
}

// Row component, memoized for performance.
const Row = React.memo(({ index, style, data }: ListChildComponentProps<RowData>) => {
  const theme = useTheme();
  const { items, isModelInProvider, handleAddSingleModel, handleRemoveSingleModel, handleAddGroup, handleRemoveGroup, groupedModels } = data;
  const item = items[index];

  // Render Group Header
  if (item.type === 'group') {
    const groupModels = groupedModels[item.name] || [];
    const addableModels = groupModels.filter(model => !isModelInProvider(model.id));
    const removableModels = groupModels.filter(model => isModelInProvider(model.id));

    return (
      <Box
        style={style}
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          pl: 2,
          pr: 2,
          backgroundColor: (theme) => alpha(theme.palette.background.default, 0.95),
          borderBottom: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <Typography variant="subtitle2" fontWeight={600} sx={{ textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            {item.name}
          </Typography>
          <Chip label={item.modelCount} size="small" sx={{ ml: 1.5, height: 20, fontSize: '0.7rem' }} />
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          {addableModels.length > 0 && (
            <IconButton
              size="small"
              onClick={() => handleAddGroup(item.name)}
              sx={{
                border: '1px solid',
                borderColor: 'primary.light',
                color: 'primary.main',
                '&:hover': { bgcolor: (theme) => alpha(theme.palette.primary.main, 0.1) }
              }}
              title={`添加 ${addableModels.length} 个模型`}
            >
              <AddIcon size={14} />
            </IconButton>
          )}
          {removableModels.length > 0 && (
            <IconButton
              size="small"
              onClick={() => handleRemoveGroup(item.name)}
              sx={{
                border: '1px solid',
                borderColor: 'error.light',
                color: 'error.main',
                '&:hover': { bgcolor: (theme) => alpha(theme.palette.error.main, 0.1) }
              }}
              title={`移除 ${removableModels.length} 个模型`}
            >
              <RemoveIcon size={14} />
            </IconButton>
          )}
        </Box>
      </Box>
    );
  }

  // Render Model Item
  const model = item.data;
  return (
    <Box style={style} sx={{ display: 'flex', alignItems: 'center' }}>
      <ListItem
        key={model.id}
        sx={{
          pl: 2, pr: 2,
          '&:hover': {
            backgroundColor: (theme) => alpha(theme.palette.primary.main, 0.04),
          }
        }}
        secondaryAction={
          isModelInProvider(model.id) ? (
            <IconButton
              edge="end" size="small"
              onClick={() => handleRemoveSingleModel(model.id)}
              sx={{
                border: '1px solid',
                borderColor: 'error.light',
                color: 'error.main',
                '&:hover': { bgcolor: (theme) => alpha(theme.palette.error.main, 0.1) }
              }}
            >
              <RemoveIcon size={16} />
            </IconButton>
          ) : (
            <IconButton
              edge="end" size="small"
              onClick={() => handleAddSingleModel(model)}
              sx={{
                border: '1px solid',
                borderColor: 'primary.light',
                color: 'primary.main',
                '&:hover': { bgcolor: (theme) => alpha(theme.palette.primary.main, 0.1) }
              }}
            >
              <AddIcon size={16} />
            </IconButton>
          )
        }
      >
        <Database size={20} color={theme.palette.text.secondary} style={{ marginRight: theme.spacing(2) }} />
        <ListItemText
          primary={
            <Typography variant="body1" fontWeight={500} sx={{ lineHeight: 1.4 }}>
              {model.name || model.id}
            </Typography>
          }
          secondary={
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25 }}>
              {model.id}
            </Typography>
          }
        />
      </ListItem>
    </Box>
  );
});

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
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [loading, setLoading] = useState<boolean>(false);
  const [models, setModels] = useState<Model[]>([]);
  const [searchInputValue, setSearchInputValue] = useState<string>(''); // 输入框显示值
  const [actualSearchTerm, setActualSearchTerm] = useState<string>(''); // 实际搜索值
  const [pendingModels, setPendingModels] = useState<Map<string, boolean>>(new Map());

  // 恢复 useTransition 进行性能优化
  const [isSearchPending, startSearchTransition] = useTransition();

  // 使用ref存储初始provider，避免重新加载
  const initialProviderRef = useRef<any>(null);

  // 检查模型是否已经在提供商的模型列表中
  const isModelInProvider = useCallback((modelId: string): boolean => {
    return existingModels.some(m => m.id === modelId) || pendingModels.get(modelId) === true;
  }, [existingModels, pendingModels]);

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
        // 使用模型的分组信息，如果没有则使用默认分组
        const group = model.group || '其他模型';

        if (!result[group]) {
          result[group] = [];
        }
        result[group].push(model);
      }
    }
    return result;
  }, [models, actualSearchTerm]);

  // STEP 2: Add memoized hooks to prepare data for react-window

  const flattenedData = useMemo((): ListItemData[] => {
    const data: ListItemData[] = [];
    const sortedGroupNames = Object.keys(groupedModels).sort((a, b) => a.localeCompare(b));

    for (const groupName of sortedGroupNames) {
      const modelsInGroup = groupedModels[groupName];
      data.push({ type: 'group', name: groupName, modelCount: modelsInGroup.length });
      modelsInGroup.forEach((model: Model) => {
        data.push({ type: 'model', data: model });
      });
    }
    return data;
  }, [groupedModels]);

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

  const itemData = useMemo((): RowData => ({
    items: flattenedData,
    isModelInProvider,
    handleAddSingleModel,
    handleRemoveSingleModel,
    handleAddGroup,
    handleRemoveGroup,
    groupedModels,
  }), [flattenedData, isModelInProvider, handleAddSingleModel, handleRemoveSingleModel, handleAddGroup, handleRemoveGroup, groupedModels]);

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
      console.error('加载模型失败:', error);
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

  const listHeight = useMemo(() => {
    const dialogHeight = window.innerHeight * (isMobile ? 0.85 : 0.9);
    // 140 is a rough estimate for header, search, and actions
    return dialogHeight - 140; 
  }, [isMobile]);

  // 渲染加载骨架屏
  const renderLoadingSkeleton = () => (
    <Box sx={{ p: 2 }}>
      {[1, 2, 3].map((index) => (
        <Box key={index} sx={{ mb: 2 }}>
          <Skeleton variant="rectangular" height={48} sx={{ borderRadius: 2, mb: 1 }} />
          <Box sx={{ pl: 2 }}>
            {[1, 2, 3].map((itemIndex) => (
              <Skeleton key={itemIndex} variant="rectangular" height={60} sx={{ borderRadius: 1, mb: 1 }} />
            ))}
          </Box>
        </Box>
      ))}
    </Box>
  );

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="md"
      fullScreen={isMobile}
      PaperProps={{
        sx: {
          borderRadius: isMobile ? 0 : 2,
          height: isMobile ? '100%' : '90vh', // 移动端全屏，桌面端固定高度
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column'
        }
      }}
    >
      <DialogTitle
        sx={{
          fontWeight: 700,
          backgroundImage: 'linear-gradient(90deg, #9333EA, #754AB4)',
          backgroundClip: 'text',
          color: 'transparent',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          p: 3,
          flexShrink: 0 // 防止标题区域收缩
        }}
      >
        {provider.name}模型管理
        {loading && <CircularProgress size={24} sx={{ ml: 2 }} />}
      </DialogTitle>

      <Box sx={{ px: 3, pb: 2, flexShrink: 0 }}>
        <TextField
          fullWidth
          placeholder="搜索模型..."
          size="small"
          value={searchInputValue}
          onChange={handleSearchChange}
          autoComplete="off"
          spellCheck={false}
          InputProps={{
            startAdornment: <SearchIcon size={20} color="var(--mui-palette-text-secondary)" style={{ marginRight: 8 }} />,
            sx: { 
              borderRadius: 2
            }
          }}
          sx={{
            '& .MuiInputBase-input': {
              transition: 'none', // 移除可能的过渡效果
              padding: '8px 14px'
            }
          }}
        />
        {isSearchPending && (
          <Fade in={isSearchPending}>
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 1 }}>
              <CircularProgress size={16} />
            </Box>
          </Fade>
        )}
      </Box>

      <Divider sx={{ flexShrink: 0 }} />

      <DialogContent
        sx={{
          flex: 1,
          overflow: 'hidden', // IMPORTANT: Keep this hidden
          p: 0,
        }}
      >
        {loading ? (
          renderLoadingSkeleton()
        ) : (
          <Fade in={!isSearchPending} timeout={300}>
            <Box sx={{ height: '100%' }}>
              {flattenedData.length === 0 ? (
                <Box sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: '100%',
                  minHeight: '200px',
                  textAlign: 'center'
                }}>
                  <Typography variant="body1" sx={{ color: 'text.secondary' }}>
                    {actualSearchTerm ? '找不到匹配的模型' : '暂无模型'}
                  </Typography>
                </Box>
              ) : (
                <FixedSizeList
                  height={listHeight}
                  itemCount={flattenedData.length}
                  itemSize={56} // Optimized item size for tighter layout
                  width="100%"
                  itemData={itemData}
                >
                  {Row}
                </FixedSizeList>
              )}
            </Box>
          </Fade>
        )}
      </DialogContent>

      <DialogActions sx={{ p: isMobile ? 2 : 3, flexShrink: 0 }}>
        <Button onClick={onClose} variant="outlined">
          关闭
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ModelManagementDialog;