/**
 * 记忆库 Tab：助手选择 + 搜索/添加工具栏 + 记忆列表
 */
import React, { useState } from 'react';
import {
  Box,
  Button,
  CircularProgress,
  FormControl,
  IconButton,
  Menu,
  MenuItem,
  Paper,
  Select,
  TextField,
  Typography,
} from '@mui/material';
import { Brain, MoreVertical, Plus, RefreshCw, Search, Trash2 } from 'lucide-react';
import { MemoryListItem } from './components';
import type { MemoryItem } from '../../../shared/types/memory';
import type { AssistantOption } from './hooks';

interface LibraryTabProps {
  memories: MemoryItem[];
  loading: boolean;
  total: number;
  searchQuery: string;
  assistants: AssistantOption[];
  currentAssistantId: string;
  onSearchQueryChange: (query: string) => void;
  onSearch: () => void;
  onRefresh: () => void;
  onAssistantChange: (assistantId: string) => void;
  onAdd: () => void;
  onEdit: (memory: MemoryItem) => void;
  onDelete: (id: string) => void;
  onClearAll: () => void;
}

const LibraryTab: React.FC<LibraryTabProps> = ({
  memories,
  loading,
  total,
  searchQuery,
  assistants,
  currentAssistantId,
  onSearchQueryChange,
  onSearch,
  onRefresh,
  onAssistantChange,
  onAdd,
  onEdit,
  onDelete,
  onClearAll,
}) => {
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);

  return (
    <>
      {/* 摘要条：助手选择 + 统计 */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
        <FormControl size="small" sx={{ minWidth: 180, flex: 1 }}>
          <Select
            value={assistants.length > 0 ? (currentAssistantId || '') : ''}
            onChange={(e) => onAssistantChange(e.target.value)}
            displayEmpty
          >
            {assistants.length === 0 ? (
              <MenuItem value="">加载中...</MenuItem>
            ) : (
              assistants.map((assistant) => (
                <MenuItem key={assistant.id} value={assistant.id}>
                  {assistant.name}
                </MenuItem>
              ))
            )}
          </Select>
        </FormControl>
        <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0 }}>
          {total} 条记忆 · {assistants.length} 个助手
        </Typography>
      </Box>

      {/* 工具栏：搜索 + 添加 + 更多 */}
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
        <TextField
          fullWidth
          size="small"
          placeholder="搜索记忆..."
          value={searchQuery}
          onChange={(e) => onSearchQueryChange(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && onSearch()}
          InputProps={{
            startAdornment: <Search size={18} style={{ marginRight: 8, opacity: 0.5 }} />,
          }}
        />
        <IconButton onClick={onRefresh} size="small" aria-label="刷新">
          <RefreshCw size={18} />
        </IconButton>
        <Button
          variant="contained"
          size="small"
          startIcon={<Plus size={16} />}
          onClick={onAdd}
          sx={{ flexShrink: 0, whiteSpace: 'nowrap' }}
        >
          添加记忆
        </Button>
        <IconButton size="small" aria-label="更多操作" onClick={(e) => setMenuAnchor(e.currentTarget)}>
          <MoreVertical size={18} />
        </IconButton>
        <Menu anchorEl={menuAnchor} open={!!menuAnchor} onClose={() => setMenuAnchor(null)}>
          <MenuItem
            onClick={() => {
              setMenuAnchor(null);
              onClearAll();
            }}
            sx={{ color: 'error.main' }}
          >
            <Trash2 size={16} style={{ marginRight: 8 }} />
            清空全部
          </MenuItem>
        </Menu>
      </Box>

      {/* 记忆列表 */}
      <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress size={24} />
          </Box>
        ) : memories.length === 0 ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 6, gap: 1 }}>
            <Brain size={32} style={{ opacity: 0.3 }} />
            <Typography variant="body2" color="text.secondary">
              {searchQuery.trim() ? '没有匹配的记忆' : '暂无记忆，点击「添加记忆」手动创建'}
            </Typography>
          </Box>
        ) : (
          memories.map((memory) => (
            <MemoryListItem key={memory.id} memory={memory} onEdit={onEdit} onDelete={onDelete} />
          ))
        )}
      </Paper>
    </>
  );
};

export default LibraryTab;
