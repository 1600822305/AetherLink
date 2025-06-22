import React, { useState, useMemo } from 'react';
import {
  Box,
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  TextField,
  InputAdornment,
  Chip,
  Button,
  Collapse,
  Divider,
  Paper,
  alpha
} from '@mui/material';
import { ArrowLeft as ArrowBackIcon, Search as SearchIcon, ChevronDown as ExpandMoreIcon, ChevronUp as ExpandLessIcon, Copy as ContentCopyIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getAgentPromptCategories, searchAgentPrompts } from '../../../shared/config/agentPrompts';
import type { AgentPrompt, AgentPromptCategory } from '../../../shared/types/AgentPrompt';
import SystemPromptVariablesPanel from '../../../components/SystemPromptVariablesPanel';

/**
 * 智能体提示词集合 - 主页面组件
 * 展示内置的丰富提示词集合，按类别组织
 */
const AgentPromptsSettings: React.FC = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['general']));
  const [copiedPromptId, setCopiedPromptId] = useState<string | null>(null);

  // 获取所有类别数据
  const categories = useMemo(() => getAgentPromptCategories(), []);

  // 搜索结果
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    return searchAgentPrompts(searchQuery);
  }, [searchQuery]);

  // 返回上一页
  const handleBack = () => {
    navigate(-1);
  };

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

  // 复制提示词内容
  const handleCopyPrompt = async (prompt: AgentPrompt) => {
    try {
      await navigator.clipboard.writeText(prompt.content);
      setCopiedPromptId(prompt.id);
      setTimeout(() => setCopiedPromptId(null), 2000);
    } catch (error) {
      console.error('复制失败:', error);
    }
  };

  // 渲染提示词卡片
  const renderPromptCard = (prompt: AgentPrompt) => (
    <Paper
      key={prompt.id}
      elevation={0}
      sx={{
        borderRadius: 1,
        border: '1px solid',
        borderColor: 'divider',
        overflow: 'hidden',
        bgcolor: 'background.paper',
        transition: 'transform 0.2s, box-shadow 0.2s',
        '&:hover': {
          transform: 'translateY(-1px)',
          boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
        }
      }}
    >
      <Box sx={{ p: 1.2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.4 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 600, fontSize: '0.85rem' }}>
            {prompt.emoji} {prompt.name}
          </Typography>
          <Button
            size="small"
            startIcon={<ContentCopyIcon size={12} />}
            onClick={() => handleCopyPrompt(prompt)}
            color={copiedPromptId === prompt.id ? 'success' : 'primary'}
            variant="outlined"
            sx={{
              minWidth: 'auto',
              px: 0.8,
              py: 0.3,
              fontSize: '0.7rem',
              height: '24px'
            }}
          >
            {copiedPromptId === prompt.id ? '已复制' : '复制'}
          </Button>
        </Box>

        <Typography variant="body2" color="text.secondary" sx={{ mb: 0.8, fontSize: '0.75rem', lineHeight: 1.2 }}>
          {prompt.description}
        </Typography>

        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.25 }}>
          {prompt.tags.map((tag) => (
            <Chip
              key={tag}
              label={tag}
              size="small"
              variant="outlined"
              sx={{
                fontSize: '0.6rem',
                height: '16px',
                '& .MuiChip-label': {
                  px: 0.4
                }
              }}
            />
          ))}
        </Box>
      </Box>
    </Paper>
  );

  // 渲染类别
  const renderCategory = (category: AgentPromptCategory) => {
    const isExpanded = expandedCategories.has(category.id);

    return (
      <Paper
        key={category.id}
        elevation={0}
        sx={{
          mb: 2,
          borderRadius: 2,
          border: '1px solid',
          borderColor: 'divider',
          overflow: 'hidden',
          bgcolor: 'background.paper',
          boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
        }}
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            cursor: 'pointer',
            p: 2,
            bgcolor: 'rgba(0,0,0,0.01)',
            '&:hover': {
              bgcolor: 'action.hover'
            }
          }}
          onClick={() => toggleCategory(category.id)}
        >
          <Typography variant="subtitle1" sx={{ flexGrow: 1, fontWeight: 600 }}>
            {category.emoji} {category.name}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mr: 2 }}>
            {category.prompts.length} 个提示词
          </Typography>
          {isExpanded ? <ExpandLessIcon size={20} /> : <ExpandMoreIcon size={20} />}
        </Box>

        <Collapse in={isExpanded}>
          <Divider />
          <Box sx={{ p: 2 }}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {category.description}
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {category.prompts.map(renderPromptCard)}
            </Box>
          </Box>
        </Collapse>
      </Paper>
    );
  };

  return (
    <Box sx={{
      flexGrow: 1,
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      bgcolor: (theme) => theme.palette.mode === 'light'
        ? alpha(theme.palette.primary.main, 0.02)
        : alpha(theme.palette.background.default, 0.9),
    }}>
      {/* 顶部导航栏 */}
      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          zIndex: (theme) => theme.zIndex.drawer + 1,
          bgcolor: 'background.paper',
          color: 'text.primary',
          borderBottom: 1,
          borderColor: 'divider',
          backdropFilter: 'blur(8px)',
        }}
      >
        <Toolbar>
          <IconButton
            edge="start"
            color="inherit"
            onClick={handleBack}
            aria-label="back"
            sx={{
              color: (theme) => theme.palette.primary.main,
            }}
          >
            <ArrowBackIcon size={24} />
          </IconButton>
          <Typography
            variant="h6"
            component="div"
            sx={{
              flexGrow: 1,
              fontWeight: 600,
              backgroundImage: 'linear-gradient(90deg, #4f46e5, #8b5cf6)',
              backgroundClip: 'text',
              color: 'transparent',
            }}
          >
            智能体提示词集合
          </Typography>
        </Toolbar>
      </AppBar>

      {/* 主要内容区域 */}
      <Box
        sx={{
          flexGrow: 1,
          overflowY: 'auto',
          p: 2,
          mt: 8,
          '&::-webkit-scrollbar': {
            width: '6px',
          },
          '&::-webkit-scrollbar-thumb': {
            backgroundColor: 'rgba(0,0,0,0.1)',
            borderRadius: '3px',
          },
        }}
      >
        {/* 系统提示词变量注入面板 */}
        <SystemPromptVariablesPanel />

        {/* 搜索框 */}
        <Paper
          elevation={0}
          sx={{
            mb: 2,
            borderRadius: 2,
            border: '1px solid',
            borderColor: 'divider',
            overflow: 'hidden',
            bgcolor: 'background.paper',
            boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
          }}
        >
          <Box sx={{ p: 2, bgcolor: 'rgba(0,0,0,0.01)' }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
              搜索提示词
            </Typography>
            <Typography variant="body2" color="text.secondary">
              在丰富的提示词库中快速找到您需要的模板
            </Typography>
          </Box>

          <Divider />

          <Box sx={{ p: 2 }}>
            <TextField
              fullWidth
              placeholder="输入关键词搜索提示词..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon size={20} />
                    </InputAdornment>
                  ),
                }
              }}
              variant="outlined"
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: 1,
                },
              }}
            />
          </Box>
        </Paper>

        {/* 搜索结果 */}
        {searchQuery.trim() && searchResults.length > 0 && (
          <Paper
            elevation={0}
            sx={{
              mb: 2,
              borderRadius: 2,
              border: '1px solid',
              borderColor: 'divider',
              overflow: 'hidden',
              bgcolor: 'background.paper',
              boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
            }}
          >
            <Box sx={{ p: 2, bgcolor: 'rgba(0,0,0,0.01)' }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                搜索结果 ({searchResults.length})
              </Typography>
              <Typography variant="body2" color="text.secondary">
                找到 {searchResults.length} 个匹配的提示词
              </Typography>
            </Box>

            <Divider />

            <Box sx={{ p: 2 }}>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {searchResults.map(renderPromptCard)}
              </Box>
            </Box>
          </Paper>
        )}

        {/* 无搜索结果 */}
        {searchQuery.trim() && searchResults.length === 0 && (
          <Paper
            elevation={0}
            sx={{
              mb: 2,
              borderRadius: 2,
              border: '1px solid',
              borderColor: 'divider',
              overflow: 'hidden',
              bgcolor: 'background.paper',
              boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
            }}
          >
            <Box sx={{ p: 3, textAlign: 'center' }}>
              <Typography color="text.secondary">
                没有找到匹配的提示词
              </Typography>
            </Box>
          </Paper>
        )}

        {/* 类别列表 */}
        {!searchQuery.trim() && categories.map(renderCategory)}
      </Box>
    </Box>
  );
};

export default AgentPromptsSettings;
