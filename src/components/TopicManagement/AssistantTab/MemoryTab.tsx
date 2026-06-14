import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  TextField,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  Paper,
  Chip,
  useTheme,
} from '@mui/material';
import CustomSwitch from '../../../components/CustomSwitch';
import { Brain, Plus, Trash2, Edit3, Search, RefreshCw } from 'lucide-react';
import { memoryService } from '../../../shared/services/memory/MemoryService';
import type { MemoryItem } from '../../../shared/types/memory';
import { toastManager } from '../../EnhancedToast';
import { createLogger } from '../../../shared/services/infra/logger';

const logger = createLogger('MemoryTab');

interface MemoryTabProps {
  /** 助手 ID */
  assistantId: string;
  /** 助手是否启用记忆 */
  memoryEnabled?: boolean;
  /** 记忆开关变化回调 */
  onMemoryEnabledChange?: (enabled: boolean) => void;
}

/**
 * 助手记忆管理 Tab
 */
export const MemoryTab: React.FC<MemoryTabProps> = ({
  assistantId,
  memoryEnabled = false,
  onMemoryEnabledChange,
}) => {
  const theme = useTheme();
  const [memories, setMemories] = useState<MemoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [newMemoryText, setNewMemoryText] = useState('');
  const [editingMemory, setEditingMemory] = useState<MemoryItem | null>(null);
  const [editMemoryText, setEditMemoryText] = useState('');

  // 加载记忆列表
  const loadMemories = useCallback(async () => {
    if (!assistantId) return;
    
    setLoading(true);
    try {
      const result = await memoryService.list({ assistantId, limit: 100 });
      setMemories(result.memories);
    } catch (error) {
      logger.error('加载记忆失败:', error);
    } finally {
      setLoading(false);
    }
  }, [assistantId]);

  // 搜索记忆
  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      loadMemories();
      return;
    }

    setLoading(true);
    try {
      const result = await memoryService.textSearch(searchQuery, { assistantId });
      setMemories(result.memories);
    } catch (error) {
      logger.error('搜索失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 添加记忆
  const handleAddMemory = async () => {
    if (!newMemoryText.trim()) return;

    try {
      const memory = await memoryService.add(newMemoryText, {
        assistantId,
        metadata: { source: 'manual' },
      });

      if (memory) {
        toastManager.success('记忆已添加');
        setNewMemoryText('');
        setShowAddDialog(false);
        loadMemories();
      }
    } catch (error) {
      logger.error('添加记忆失败:', error);
      toastManager.error('添加记忆失败');
    }
  };

  // 编辑记忆
  const handleEditMemory = async () => {
    if (!editingMemory || !editMemoryText.trim()) return;

    try {
      const updated = await memoryService.update(editingMemory.id, editMemoryText);
      if (updated) {
        toastManager.success('记忆已更新');
        setShowEditDialog(false);
        setEditingMemory(null);
        loadMemories();
      }
    } catch (error) {
      logger.error('更新记忆失败:', error);
      toastManager.error('更新记忆失败');
    }
  };

  // 删除记忆
  const handleDeleteMemory = async (id: string) => {
    try {
      const success = await memoryService.delete(id);
      if (success) {
        toastManager.success('记忆已删除');
        loadMemories();
      }
    } catch (error) {
      logger.error('删除记忆失败:', error);
      toastManager.error('删除记忆失败');
    }
  };

  // 清空所有记忆
  const handleClearAll = async () => {
    if (!window.confirm('确定要清空该助手的所有记忆吗？此操作不可恢复。')) return;

    try {
      await memoryService.deleteAllMemoriesForAssistant(assistantId);
      toastManager.success('已清空所有记忆');
      loadMemories();
    } catch (error) {
      logger.error('清空记忆失败:', error);
      toastManager.error('清空记忆失败');
    }
  };

  // 初始化加载
  useEffect(() => {
    if (memoryEnabled) {
      loadMemories();
    }
  }, [memoryEnabled, loadMemories]);

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 2 }}>
      {/* 记忆开关 */}
      <Paper
        elevation={0}
        sx={{
          p: 2,
          borderRadius: 2,
          backgroundColor: theme.palette.mode === 'dark'
            ? 'rgba(255, 255, 255, 0.05)'
            : 'rgba(0, 0, 0, 0.02)',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Brain size={20} />
            <Box>
              <Typography variant="subtitle2">启用记忆功能</Typography>
              <Typography variant="caption" color="text.secondary">
                开启后，助手会记住与你的对话内容
              </Typography>
            </Box>
          </Box>
          <CustomSwitch
            checked={memoryEnabled}
            onChange={(e) => onMemoryEnabledChange?.(e.target.checked)}
          />
        </Box>
      </Paper>

      {/* 记忆管理区域 */}
      {memoryEnabled && (
        <>
          {/* 搜索和操作栏 */}
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <TextField
              size="small"
              placeholder="搜索记忆..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              sx={{ flex: 1 }}
              InputProps={{
                startAdornment: <Search size={16} style={{ marginRight: 8, opacity: 0.5 }} />,
              }}
            />
            <IconButton size="small" onClick={handleSearch}>
              <Search size={18} />
            </IconButton>
            <IconButton size="small" onClick={loadMemories}>
              <RefreshCw size={18} />
            </IconButton>
          </Box>

          {/* 操作按钮 */}
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              size="small"
              variant="contained"
              startIcon={<Plus size={16} />}
              onClick={() => setShowAddDialog(true)}
            >
              添加记忆
            </Button>
            <Button
              size="small"
              variant="outlined"
              color="error"
              startIcon={<Trash2 size={16} />}
              onClick={handleClearAll}
              disabled={memories.length === 0}
            >
              清空全部
            </Button>
          </Box>

          {/* 记忆列表 */}
          <Paper
            elevation={0}
            sx={{
              flex: 1,
              overflow: 'auto',
              borderRadius: 2,
              backgroundColor: theme.palette.mode === 'dark'
                ? 'rgba(255, 255, 255, 0.03)'
                : 'rgba(0, 0, 0, 0.01)',
            }}
          >
            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                <CircularProgress size={24} />
              </Box>
            ) : memories.length === 0 ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', p: 4 }}>
                <Typography color="text.secondary">暂无记忆</Typography>
              </Box>
            ) : (
              <List dense>
                {memories.map((memory) => (
                  <ListItem
                    key={memory.id}
                    sx={{
                      borderBottom: `1px solid ${theme.palette.divider}`,
                      '&:last-child': { borderBottom: 'none' },
                    }}
                  >
                    <ListItemText
                      primary={memory.memory}
                      secondary={
                        <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5 }}>
                          {memory.metadata?.source && (
                            <Chip
                              size="small"
                              label={memory.metadata.source === 'manual' ? '手动' : '自动'}
                              sx={{ height: 20, fontSize: '0.7rem' }}
                            />
                          )}
                          <Typography variant="caption" color="text.secondary">
                            {new Date(memory.createdAt).toLocaleDateString()}
                          </Typography>
                        </Box>
                      }
                      primaryTypographyProps={{
                        variant: 'body2',
                        sx: { wordBreak: 'break-word' },
                      }}
                    />
                    <ListItemSecondaryAction>
                      <IconButton
                        size="small"
                        onClick={() => {
                          setEditingMemory(memory);
                          setEditMemoryText(memory.memory);
                          setShowEditDialog(true);
                        }}
                      >
                        <Edit3 size={16} />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={() => handleDeleteMemory(memory.id)}
                      >
                        <Trash2 size={16} />
                      </IconButton>
                    </ListItemSecondaryAction>
                  </ListItem>
                ))}
              </List>
            )}
          </Paper>

          {/* 统计信息 */}
          <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center' }}>
            共 {memories.length} 条记忆
          </Typography>
        </>
      )}

      {/* 添加记忆对话框 */}
      <Dialog open={showAddDialog} onClose={() => setShowAddDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>添加记忆</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            multiline
            rows={3}
            fullWidth
            placeholder="输入要记住的内容..."
            value={newMemoryText}
            onChange={(e) => setNewMemoryText(e.target.value)}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowAddDialog(false)}>取消</Button>
          <Button onClick={handleAddMemory} variant="contained" disabled={!newMemoryText.trim()}>
            添加
          </Button>
        </DialogActions>
      </Dialog>

      {/* 编辑记忆对话框 */}
      <Dialog open={showEditDialog} onClose={() => setShowEditDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>编辑记忆</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            multiline
            rows={3}
            fullWidth
            value={editMemoryText}
            onChange={(e) => setEditMemoryText(e.target.value)}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowEditDialog(false)}>取消</Button>
          <Button onClick={handleEditMemory} variant="contained" disabled={!editMemoryText.trim()}>
            保存
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default MemoryTab;
