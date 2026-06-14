/**
 * Agentic Files List 组件
 * 显示 Agentic 模式下 AI 编辑的文件列表
 * 
 * 功能：
 * - 显示文件修改列表（创建、修改、删除）
 * - 展开查看 Diff
 * - 接受/拒绝单个文件修改
 * - 批量接受/拒绝所有修改
 */

import React, { useCallback, useMemo } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { 
  Box, 
  Collapse, 
  IconButton, 
  Tooltip, 
  Chip,
  Typography,
  Paper,
  Button,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import {
  FileText,
  FilePlus,
  FileX,
  FileEdit,
  ChevronDown,
  ChevronUp,
  Check,
  X,
  Trash2,
  FolderOpen
} from 'lucide-react';
import type { RootState } from '../../shared/store';
import {
  acceptFileChange,
  rejectFileChange,
  acceptAllChanges,
  removeFileChange,
  setExpandedFileId,
  togglePanelVisibility,
} from '../../shared/store/slices/agenticFilesSlice';
import type { FileChange, FileOperationType } from '../../shared/store/slices/agenticFilesSlice';
import { unifiedFileManager } from '../../shared/services/files/UnifiedFileManagerService';
import SimpleDiffViewer from './SimpleDiffViewer';
import { createLogger } from '../../shared/services/infra/logger';

const logger = createLogger('AgenticFilesList');

/** 获取操作类型的图标 */
const getOperationIcon = (operation: FileOperationType) => {
  switch (operation) {
    case 'create':
      return <FilePlus size={14} />;
    case 'modify':
      return <FileEdit size={14} />;
    case 'delete':
      return <FileX size={14} />;
    case 'rename':
    case 'move':
      return <FolderOpen size={14} />;
    default:
      return <FileText size={14} />;
  }
};

/** 获取操作类型的颜色 */
const getOperationColor = (operation: FileOperationType): 'success' | 'warning' | 'error' | 'info' => {
  switch (operation) {
    case 'create':
      return 'success';
    case 'modify':
      return 'warning';
    case 'delete':
      return 'error';
    case 'rename':
    case 'move':
      return 'info';
    default:
      return 'info';
  }
};

/** 获取操作类型的中文名称 */
const getOperationLabel = (operation: FileOperationType): string => {
  switch (operation) {
    case 'create':
      return '新建';
    case 'modify':
      return '修改';
    case 'delete':
      return '删除';
    case 'rename':
      return '重命名';
    case 'move':
      return '移动';
    default:
      return '未知';
  }
};

/** 从路径中提取文件名 */
const getFileName = (path: string): string => {
  const parts = path.split(/[/\\]/);
  return parts[parts.length - 1] || path;
};

/** 单个文件修改项组件 */
interface FileChangeItemProps {
  change: FileChange;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onAccept: () => void;
  onReject: () => void;
  onRemove: () => void;
  isDarkMode: boolean;
}

const FileChangeItem: React.FC<FileChangeItemProps> = ({
  change,
  isExpanded,
  onToggleExpand,
  onAccept,
  onReject,
  onRemove,
  isDarkMode,
}) => {
  const isPending = change.status === 'pending';
  const statusColor = change.status === 'accepted' ? 'success' : change.status === 'rejected' ? 'error' : 'default';

  return (
    <Box
      sx={{
        borderRadius: 1,
        overflow: 'hidden',
        border: '1px solid',
        borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
        mb: 1,
        opacity: change.status !== 'pending' ? 0.7 : 1,
        transition: 'opacity 0.2s',
      }}
    >
      {/* 文件头部 */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          px: 1.5,
          py: 1,
          backgroundColor: isDarkMode ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
          cursor: 'pointer',
          '&:hover': {
            backgroundColor: isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
          },
        }}
        onClick={onToggleExpand}
      >
        {/* 操作类型图标 */}
        <Chip
          icon={getOperationIcon(change.operation)}
          label={getOperationLabel(change.operation)}
          size="small"
          color={getOperationColor(change.operation)}
          variant="outlined"
          sx={{ 
            height: 22, 
            '& .MuiChip-label': { px: 0.5, fontSize: '0.7rem' },
            '& .MuiChip-icon': { ml: 0.5 }
          }}
        />

        {/* 文件名 */}
        <Typography
          variant="body2"
          sx={{
            flex: 1,
            fontFamily: 'monospace',
            fontSize: '0.8rem',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
          title={change.path}
        >
          {getFileName(change.path)}
        </Typography>

        {/* Diff 统计 */}
        {change.diffStats && (
          <Box sx={{ display: 'flex', gap: 0.5, fontSize: '0.7rem' }}>
            {change.diffStats.added > 0 && (
              <Typography component="span" sx={{ color: 'success.main', fontFamily: 'monospace' }}>
                +{change.diffStats.added}
              </Typography>
            )}
            {change.diffStats.removed > 0 && (
              <Typography component="span" sx={{ color: 'error.main', fontFamily: 'monospace' }}>
                -{change.diffStats.removed}
              </Typography>
            )}
          </Box>
        )}

        {/* 状态标签 */}
        {change.status !== 'pending' && (
          <Chip
            label={change.status === 'accepted' ? '已接受' : '已拒绝'}
            size="small"
            color={statusColor as any}
            sx={{ height: 20, '& .MuiChip-label': { px: 0.5, fontSize: '0.65rem' } }}
          />
        )}

        {/* 操作按钮 */}
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          {isPending && (
            <>
              <Tooltip title="接受修改">
                <IconButton
                  size="small"
                  onClick={(e) => { e.stopPropagation(); onAccept(); }}
                  sx={{ 
                    color: 'success.main',
                    p: 0.5,
                    '&:hover': { backgroundColor: 'rgba(76, 175, 80, 0.1)' }
                  }}
                >
                  <Check size={14} />
                </IconButton>
              </Tooltip>
              <Tooltip title="拒绝修改">
                <IconButton
                  size="small"
                  onClick={(e) => { e.stopPropagation(); onReject(); }}
                  sx={{ 
                    color: 'error.main',
                    p: 0.5,
                    '&:hover': { backgroundColor: 'rgba(244, 67, 54, 0.1)' }
                  }}
                >
                  <X size={14} />
                </IconButton>
              </Tooltip>
            </>
          )}
          <Tooltip title="移除记录">
            <IconButton
              size="small"
              onClick={(e) => { e.stopPropagation(); onRemove(); }}
              sx={{ 
                color: 'text.secondary',
                p: 0.5,
                '&:hover': { backgroundColor: 'rgba(0,0,0,0.1)' }
              }}
            >
              <Trash2 size={12} />
            </IconButton>
          </Tooltip>
          <IconButton
            size="small"
            sx={{ p: 0.5 }}
          >
            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </IconButton>
        </Box>
      </Box>

      {/* Diff 预览区域 */}
      <Collapse in={isExpanded}>
        <Box
          sx={{
            p: 1,
            backgroundColor: isDarkMode ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.03)',
            borderTop: '1px solid',
            borderColor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
            maxHeight: 300,
            overflow: 'auto',
          }}
        >
          {/* 文件路径 */}
          <Typography
            variant="caption"
            sx={{
              display: 'block',
              mb: 1,
              color: 'text.secondary',
              fontFamily: 'monospace',
              fontSize: '0.7rem',
            }}
          >
            {change.path}
          </Typography>

          {/* Diff 内容 */}
          <SimpleDiffViewer
            originalContent={change.originalContent || ''}
            newContent={change.newContent || ''}
            operation={change.operation}
            isDarkMode={isDarkMode}
          />
        </Box>
      </Collapse>
    </Box>
  );
};

/** Agentic Files List 主组件 */
const AgenticFilesList: React.FC = () => {
  const dispatch = useDispatch();
  const theme = useTheme();
  
  // 与 IntegratedChatInput 使用相同的断点检测逻辑
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.between('sm', 'md'));
  
  // 从 Redux 获取状态
  const { changes, expandedFileId, isPanelVisible } = useSelector(
    (state: RootState) => state.agenticFiles
  );
  
  // 获取主题模式
  const isDarkMode = useSelector((state: RootState) => {
    const themeMode = state.settings?.theme;
    return themeMode === 'dark' || (themeMode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  });

  // 过滤出待处理的修改
  const pendingChanges = useMemo(() => 
    changes.filter(c => c.status === 'pending'),
    [changes]
  );

  // 处理展开/折叠
  const handleToggleExpand = useCallback((id: string) => {
    dispatch(setExpandedFileId(expandedFileId === id ? null : id));
  }, [dispatch, expandedFileId]);

  // 处理接受修改
  const handleAccept = useCallback((id: string) => {
    dispatch(acceptFileChange(id));
  }, [dispatch]);

  // 处理拒绝修改 - 需要恢复原始内容
  const handleReject = useCallback(async (change: FileChange) => {
    try {
      // 如果有备份文件，从备份恢复
      if (change.backupPath && change.operation !== 'create') {
        const backup = await unifiedFileManager.readFile({ 
          path: change.backupPath, 
          encoding: 'utf8' 
        });
        await unifiedFileManager.writeFile({
          path: change.path,
          content: backup.content,
          encoding: 'utf8',
          append: false
        });
      } else if (change.operation === 'create') {
        // 如果是新建的文件，删除它
        try {
          await unifiedFileManager.deleteFile({ path: change.path });
        } catch {
          // 文件可能已不存在
        }
      } else if (change.originalContent !== undefined) {
        // 使用原始内容恢复
        await unifiedFileManager.writeFile({
          path: change.path,
          content: change.originalContent,
          encoding: 'utf8',
          append: false
        });
      }
    } catch (error) {
      logger.error('恢复文件失败:', error);
    }
    
    dispatch(rejectFileChange(change.id));
  }, [dispatch]);

  // 处理移除记录
  const handleRemove = useCallback((id: string) => {
    dispatch(removeFileChange(id));
  }, [dispatch]);

  // 处理全部接受
  const handleAcceptAll = useCallback(() => {
    dispatch(acceptAllChanges());
  }, [dispatch]);

  // 处理全部拒绝
  const handleRejectAll = useCallback(async () => {
    // 逐个恢复
    for (const change of pendingChanges) {
      await handleReject(change);
    }
  }, [pendingChanges, handleReject]);

  // 处理切换面板可见性
  const handleTogglePanel = useCallback(() => {
    dispatch(togglePanelVisibility());
  }, [dispatch]);

  // 计算总的 diff 统计
  const totalDiffStats = useMemo(() => {
    return changes.reduce(
      (acc, change) => ({
        added: acc.added + (change.diffStats?.added || 0),
        removed: acc.removed + (change.diffStats?.removed || 0),
      }),
      { added: 0, removed: 0 }
    );
  }, [changes]);

  // 如果没有修改记录，不显示
  if (changes.length === 0) {
    return null;
  }

  // 与 IntegratedChatInput/ExpandableContainer 完全一致的响应式样式
  const getResponsiveStyles = () => {
    if (isMobile) {
      return {
        maxWidth: '100%',
        marginLeft: '0',
        marginRight: '0',
        paddingLeft: '8px',
        paddingRight: '8px',
      };
    } else if (isTablet) {
      return {
        maxWidth: 'calc(100% - 40px)',
        marginLeft: 'auto',
        marginRight: 'auto',
        paddingLeft: '0',
        paddingRight: '0',
      };
    } else {
      return {
        maxWidth: 'calc(100% - 32px)',
        marginLeft: 'auto',
        marginRight: 'auto',
        paddingLeft: '0',
        paddingRight: '0',
      };
    }
  };

  const responsiveStyles = getResponsiveStyles();

  return (
    <Box
      sx={{
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        mb: 0.5,
        ...responsiveStyles,
      }}
    >
      <Paper
        elevation={0}
        sx={{
          width: '100%',
          borderRadius: 1,
          border: '1px solid',
          borderColor: isDarkMode ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)',
          background: 'var(--theme-bg-paper)',  // 与输入框使用相同的主题背景色
          overflow: 'hidden',
        }}
      >
      {/* 紧凑标题栏 - 类似 Cursor 样式 */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          px: 1.5,
          py: 0.75,
          backgroundColor: isDarkMode ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)',
          borderBottom: isPanelVisible ? '1px solid' : 'none',
          borderColor: isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
        }}
      >
        {/* 左侧：文件数量和 diff 统计 */}
        <Box 
          sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 1, 
            flex: 1,
            cursor: 'pointer',
          }}
          onClick={handleTogglePanel}
        >
          <Typography 
            variant="body2" 
            sx={{ 
              fontWeight: 500,
              color: 'text.primary',
              fontSize: '0.85rem',
            }}
          >
            {changes.length} 个文件
          </Typography>
          
          {/* Diff 统计 */}
          <Typography 
            component="span" 
            sx={{ 
              color: 'success.main', 
              fontFamily: 'monospace',
              fontSize: '0.8rem',
              fontWeight: 500,
            }}
          >
            +{totalDiffStats.added}
          </Typography>
          <Typography 
            component="span" 
            sx={{ 
              color: 'error.main', 
              fontFamily: 'monospace',
              fontSize: '0.8rem',
              fontWeight: 500,
            }}
          >
            -{totalDiffStats.removed}
          </Typography>

          <IconButton 
            size="small" 
            sx={{ p: 0.25, ml: 0.5 }}
            onClick={handleTogglePanel}
          >
            {isPanelVisible ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </IconButton>
        </Box>

        {/* 右侧：操作按钮 */}
        {pendingChanges.length > 0 && (
          <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
            <Button
              size="small"
              variant="text"
              color="error"
              onClick={handleRejectAll}
              sx={{ 
                fontSize: '0.75rem', 
                py: 0.25, 
                px: 1,
                minWidth: 'auto',
                textTransform: 'none',
              }}
            >
              全部拒绝
            </Button>
            <Button
              size="small"
              variant="contained"
              color="primary"
              onClick={handleAcceptAll}
              sx={{ 
                fontSize: '0.75rem', 
                py: 0.25, 
                px: 1.5,
                minWidth: 'auto',
                textTransform: 'none',
                boxShadow: 'none',
                '&:hover': { boxShadow: 'none' },
              }}
            >
              全部接受
            </Button>
          </Box>
        )}
      </Box>

      {/* 内容区域 */}
      <Collapse in={isPanelVisible}>
        <Box sx={{ maxHeight: 350, overflow: 'auto' }}>
          {changes.map((change) => (
            <FileChangeItem
              key={change.id}
              change={change}
              isExpanded={expandedFileId === change.id}
              onToggleExpand={() => handleToggleExpand(change.id)}
              onAccept={() => handleAccept(change.id)}
              onReject={() => handleReject(change)}
              onRemove={() => handleRemove(change.id)}
              isDarkMode={isDarkMode}
            />
          ))}
        </Box>
      </Collapse>
      </Paper>
    </Box>
  );
};

export default AgenticFilesList;
