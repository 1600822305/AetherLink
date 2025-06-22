import React, { useState, useMemo } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  InputAdornment,
  Box,
  Typography,
  Chip,
  Paper,
  Collapse,
  Divider,
  IconButton,
  List,
  ListItem,
  ListItemText,
  ListItemButton
} from '@mui/material';
import { Search as SearchIcon, ChevronDown as ExpandMoreIcon, ChevronUp as ExpandLessIcon, X as CloseIcon } from 'lucide-react';
import { getAgentPromptCategories, searchAgentPrompts } from '../../shared/config/agentPrompts';
import type { AgentPrompt, AgentPromptCategory } from '../../shared/types/AgentPrompt';

interface AgentPromptSelectorProps {
  open: boolean;
  onClose: () => void;
  onSelect: (prompt: string) => void;
  currentPrompt?: string;
}

/**
 * 智能体提示词选择器组件
 * 用于在编辑助手时选择预设的提示词
 */
const AgentPromptSelector: React.FC<AgentPromptSelectorProps> = ({
  open,
  onClose,
  onSelect
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['general']));
  const [selectedPrompt, setSelectedPrompt] = useState<AgentPrompt | null>(null);

  // 获取所有类别数据
  const categories = useMemo(() => getAgentPromptCategories(), []);

  // 搜索结果
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    return searchAgentPrompts(searchQuery);
  }, [searchQuery]);

  // 切换类别展开状态
  const toggleCategory = (categoryId: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(categoryId)) {
      newExpanded.delete(categoryId);
    } else {
      newExpanded.add(categoryId);
    }
    setExpandedCategories(newExpanded);
  };

  // 选择提示词
  const handleSelectPrompt = (prompt: AgentPrompt) => {
    setSelectedPrompt(prompt);
  };

  // 确认选择
  const handleConfirmSelect = () => {
    if (selectedPrompt) {
      onSelect(selectedPrompt.content);
      onClose();
      setSelectedPrompt(null);
      setSearchQuery('');
    }
  };

  // 关闭对话框
  const handleClose = () => {
    onClose();
    setSelectedPrompt(null);
    setSearchQuery('');
  };

  // 渲染提示词项
  const renderPromptItem = (prompt: AgentPrompt) => (
    <ListItem key={prompt.id} disablePadding>
      <ListItemButton
        selected={selectedPrompt?.id === prompt.id}
        onClick={() => handleSelectPrompt(prompt)}
        sx={{
          borderRadius: 1,
          mb: 0.5,
          border: selectedPrompt?.id === prompt.id ? 2 : 1,
          borderColor: selectedPrompt?.id === prompt.id ? 'primary.main' : 'divider',
          py: 1,
          px: 1.5,
          '&:hover': {
            borderColor: 'primary.main',
          }
        }}
      >
        <ListItemText
          primary={
            <Typography sx={{ fontSize: '0.85rem', fontWeight: 600 }}>
              {prompt.emoji} {prompt.name}
            </Typography>
          }
          secondary={
            <Box component="div">
              <Box component="div" sx={{ color: 'text.secondary', mb: 0.5, fontSize: '0.75rem', lineHeight: 1.2 }}>
                {prompt.description}
              </Box>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.3 }}>
                {prompt.tags.map((tag) => (
                  <Chip
                    key={tag}
                    label={tag}
                    size="small"
                    variant="outlined"
                    sx={{
                      fontSize: '0.6rem',
                      height: 16,
                      '& .MuiChip-label': {
                        px: 0.4
                      }
                    }}
                  />
                ))}
              </Box>
            </Box>
          }
        />
      </ListItemButton>
    </ListItem>
  );

  // 渲染类别
  const renderCategory = (category: AgentPromptCategory) => {
    const isExpanded = expandedCategories.has(category.id);

    return (
      <Paper
        key={category.id}
        elevation={0}
        sx={{
          mb: 1,
          borderRadius: 1,
          border: '1px solid',
          borderColor: 'divider',
          overflow: 'hidden',
        }}
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            cursor: 'pointer',
            p: 1.5,
            bgcolor: 'rgba(0,0,0,0.02)',
            '&:hover': {
              bgcolor: 'action.hover'
            }
          }}
          onClick={() => toggleCategory(category.id)}
        >
          <Typography variant="subtitle2" sx={{ flexGrow: 1, fontWeight: 600 }}>
            {category.emoji} {category.name}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ mr: 1 }}>
            {category.prompts.length}
          </Typography>
          {isExpanded ? <ExpandLessIcon size={16} /> : <ExpandMoreIcon size={16} />}
        </Box>

        <Collapse in={isExpanded}>
          <Divider />
          <Box sx={{ p: 1 }}>
            <List dense>
              {category.prompts.map(renderPromptItem)}
            </List>
          </Box>
        </Collapse>
      </Paper>
    );
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      slotProps={{
        paper: {
          sx: { height: '80vh' }
        }
      }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="h6">选择智能体提示词</Typography>
        <IconButton onClick={handleClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ p: 2 }}>
        {/* 搜索框 */}
        <TextField
          fullWidth
          placeholder="搜索提示词..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            }
          }}
          variant="outlined"
          size="small"
          sx={{ mb: 2 }}
        />

        <Box sx={{ height: 'calc(80vh - 200px)', overflowY: 'auto' }}>
          {/* 搜索结果 */}
          {searchQuery.trim() && (
            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                搜索结果 ({searchResults.length})
              </Typography>
              {searchResults.length > 0 ? (
                <List dense>
                  {searchResults.map(renderPromptItem)}
                </List>
              ) : (
                <Typography color="text.secondary" variant="body2">
                  没有找到匹配的提示词
                </Typography>
              )}
            </Box>
          )}

          {/* 类别列表 */}
          {!searchQuery.trim() && (
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                提示词类别
              </Typography>
              {categories.map(renderCategory)}
            </Box>
          )}
        </Box>

        {/* 选中的提示词预览 */}
        {selectedPrompt && (
          <Paper
            elevation={0}
            sx={{
              mt: 2,
              p: 2,
              border: '2px solid',
              borderColor: 'primary.main',
              borderRadius: 1,
              bgcolor: 'primary.50'
            }}
          >
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              已选择: {selectedPrompt.emoji} {selectedPrompt.name}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{
              maxHeight: 100,
              overflowY: 'auto',
              fontSize: '0.85rem'
            }}>
              {selectedPrompt.content}
            </Typography>
          </Paper>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose}>取消</Button>
        <Button
          onClick={handleConfirmSelect}
          variant="contained"
          disabled={!selectedPrompt}
        >
          使用此提示词
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default AgentPromptSelector;
