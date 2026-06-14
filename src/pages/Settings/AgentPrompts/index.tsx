import React, { useState, useMemo, useCallback } from 'react';
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
  Divider,
  Paper,
  alpha
} from '@mui/material';
import { ArrowLeft as ArrowBackIcon, Search as SearchIcon, ChevronDown as ExpandMoreIcon, ChevronUp as ExpandLessIcon, Copy as ContentCopyIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getAgentPromptCategories, searchAgentPrompts } from '../../../shared/config/agentPrompts';
import type { AgentPrompt, AgentPromptCategory } from '../../../shared/types/AgentPrompt';
import SystemPromptVariablesPanel from '../../../components/prompts/SystemPromptVariablesPanel';
// 🚀 性能优化：虚拟滚动
import VirtualScroller from '../../../components/common/VirtualScroller';
import { SafeAreaContainer } from '../../../components/settings/SettingComponents';
import Scrollbar from '../../../components/Scrollbar';
import { createLogger } from '../../../shared/services/infra/logger';

const logger = createLogger('AgentPromptsPage');

/**
 * 智能体提示词集合 - 主页面组件
 * 展示内置的丰富提示词集合，按类别组织
 */
const AgentPromptsSettings: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
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
    navigate('/settings');
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
  const handleCopyPrompt = useCallback(async (prompt: AgentPrompt) => {
    try {
      await navigator.clipboard.writeText(prompt.content);
      setCopiedPromptId(prompt.id);
      setTimeout(() => setCopiedPromptId(null), 2000);
    } catch (error) {
      logger.error(t('settings.agentPromptsPage.promptCard.copyFailed') + ':', error);
    }
  }, [t]);

  // 🚀 性能优化：使用useCallback缓存渲染函数
  const renderPromptCard = useCallback((prompt: AgentPrompt) => (
    <Paper
      elevation={0}
      sx={{
        borderRadius: 1,
        border: '1px solid',
        borderColor: 'divider',
        overflow: 'hidden',
        bgcolor: 'background.paper',
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
            {copiedPromptId === prompt.id ? t('settings.agentPromptsPage.promptCard.copied') : t('settings.agentPromptsPage.promptCard.copy')}
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
  ), [handleCopyPrompt, copiedPromptId, t]);

  // 🚀 性能优化：提示词键值函数
  const getPromptKey = useCallback((prompt: AgentPrompt) => prompt.id, []);

  // 🚀 性能优化：虚拟滚动阈值
  const VIRTUALIZATION_THRESHOLD = 20;
  const PROMPT_CARD_HEIGHT = 120; // 提示词卡片高度（包括间距）

  // 渲染类别
  const renderCategory = (category: AgentPromptCategory) => {
    const isExpanded = expandedCategories.has(category.id);
    const shouldVirtualize = category.prompts.length > VIRTUALIZATION_THRESHOLD;

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
            {category.prompts.length} {t('settings.agentPromptsPage.category.promptsCount')}
            {shouldVirtualize && isExpanded && ' (虚拟化)'}
          </Typography>
          {isExpanded ? <ExpandLessIcon size={20} /> : <ExpandMoreIcon size={20} />}
        </Box>

        {isExpanded && (
          <>
            <Divider />
            <Box sx={{ p: 2 }}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {category.description}
              </Typography>
              
              {/* 🚀 性能优化：根据提示词数量选择渲染方式 */}
              {shouldVirtualize ? (
                <VirtualScroller<AgentPrompt>
                  items={category.prompts}
                  itemHeight={PROMPT_CARD_HEIGHT}
                  renderItem={(prompt) => (
                    <Box sx={{ mb: 1 }}>
                      {renderPromptCard(prompt)}
                    </Box>
                  )}
                  itemKey={getPromptKey}
                  height={Math.min(500, category.prompts.length * PROMPT_CARD_HEIGHT)}
                  overscanCount={3}
                  style={{
                    borderRadius: '8px',
                    border: '1px solid rgba(0,0,0,0.05)',
                  }}
                />
              ) : (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {category.prompts.map((prompt) => (
                    <Box key={prompt.id}>
                      {renderPromptCard(prompt)}
                    </Box>
                  ))}
                </Box>
              )}
            </Box>
          </>
        )}
      </Paper>
    );
  };

  return (
    <SafeAreaContainer sx={{
      bgcolor: (theme) => theme.palette.mode === 'light'
        ? alpha(theme.palette.primary.main, 0.02)
        : alpha(theme.palette.background.default, 0.9),
    }}>
      {/* 顶部导航栏 */}
      <AppBar
        position="static"
        elevation={0}
        sx={{
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
            }}
          >
            {t('settings.agentPromptsPage.title')}
          </Typography>
        </Toolbar>
      </AppBar>

      {/* 主要内容区域 */}
      <Scrollbar
        style={{
          flexGrow: 1,
          padding: '16px',
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
              {t('settings.agentPromptsPage.searchSection.title')}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {t('settings.agentPromptsPage.searchSection.description')}
            </Typography>
          </Box>

          <Divider />

          <Box sx={{ p: 2 }}>
            <TextField
              fullWidth
              placeholder={t('settings.agentPromptsPage.searchSection.placeholder')}
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
                {t('settings.agentPromptsPage.searchResults.title')} ({searchResults.length})
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {t('settings.agentPromptsPage.searchResults.found', { count: searchResults.length })}
              </Typography>
            </Box>

            <Divider />

            <Box sx={{ p: 2 }}>
              {/* 🚀 性能优化：搜索结果也使用虚拟滚动 */}
              {searchResults.length > VIRTUALIZATION_THRESHOLD ? (
                <VirtualScroller<AgentPrompt>
                  items={searchResults}
                  itemHeight={PROMPT_CARD_HEIGHT}
                  renderItem={(prompt) => (
                    <Box sx={{ mb: 1 }}>
                      {renderPromptCard(prompt)}
                    </Box>
                  )}
                  itemKey={getPromptKey}
                  height={Math.min(500, searchResults.length * PROMPT_CARD_HEIGHT)}
                  overscanCount={3}
                  style={{
                    borderRadius: '8px',
                    border: '1px solid rgba(0,0,0,0.05)',
                  }}
                />
              ) : (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {searchResults.map((prompt) => (
                    <Box key={prompt.id}>
                      {renderPromptCard(prompt)}
                    </Box>
                  ))}
                </Box>
              )}
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
                {t('settings.agentPromptsPage.searchResults.noResults')}
              </Typography>
            </Box>
          </Paper>
        )}

        {/* 类别列表 */}
        {!searchQuery.trim() && categories.map(renderCategory)}
      </Scrollbar>
    </SafeAreaContainer>
  );
};

export default AgentPromptsSettings;
