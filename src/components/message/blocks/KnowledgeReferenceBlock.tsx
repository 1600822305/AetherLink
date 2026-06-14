import React, { useState, useCallback } from 'react';
import { Box, Typography, Paper, IconButton, Chip, Tooltip } from '@mui/material';
import { ChevronDown as ExpandMoreIcon, ChevronUp as ExpandLessIcon, Link as LinkIcon, Copy, Check } from 'lucide-react';
import type { KnowledgeReferenceMessageBlock } from '../../../shared/types/newMessage';
import { styled } from '@mui/material/styles';
import { createLogger } from '../../../shared/services/infra/logger';

const logger = createLogger('KnowledgeReferenceBlock');

interface KnowledgeReferenceBlockProps {
  block: KnowledgeReferenceMessageBlock;
}

const StyledPaper = styled(Paper)(({ theme }) => {
  const isDark = theme.palette.mode === 'dark';
  return {
    padding: theme.spacing(1.5),
    marginBottom: theme.spacing(1),
    borderRadius: '16px',
    border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}`,
    backgroundColor: isDark ? 'rgba(30, 30, 30, 0.85)' : 'rgba(255, 255, 255, 0.85)',
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
    position: 'relative',
    cursor: 'pointer',
    transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
    WebkitTapHighlightColor: 'transparent',
    outline: 'none',
    userSelect: 'none',
    '&:hover': {
      backgroundColor: isDark ? 'rgba(45, 45, 45, 0.92)' : 'rgba(250, 250, 250, 0.95)',
      borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)',
      transform: 'translateY(-1px)',
      boxShadow: isDark
        ? '0 4px 12px rgba(0,0,0,0.3)'
        : '0 4px 12px rgba(0,0,0,0.08)',
    }
  };
});

const SimilarityChip = styled(Chip)(({ theme }) => ({
  marginLeft: theme.spacing(1),
  fontSize: '0.7rem',
  height: 18,
  fontWeight: 500,
  '& .MuiChip-label': {
    paddingLeft: theme.spacing(0.75),
    paddingRight: theme.spacing(0.75),
  }
}));

const HeaderBox = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  minHeight: 32,
  marginBottom: theme.spacing(0.5),
}));

const KnowledgeIcon = styled(Box)(({ theme }) => ({
  width: 16,
  height: 16,
  borderRadius: '50%',
  backgroundColor: theme.palette.primary.main,
  marginRight: theme.spacing(1),
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '10px',
  color: 'white',
  fontWeight: 'bold',
}));

const ResultItem = styled(Box)(({ theme }) => {
  const isDark = theme.palette.mode === 'dark';
  return {
    marginBottom: theme.spacing(1),
    padding: theme.spacing(1.25),
    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.03)',
    borderRadius: theme.spacing(0.75),
    border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'}`,
    transition: 'all 0.15s ease',
    cursor: 'pointer',
    WebkitTapHighlightColor: 'transparent',
    outline: 'none',
    userSelect: 'none',
    '&:hover': {
      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.07)' : 'rgba(0, 0, 0, 0.05)',
    },
    '&:last-child': {
      marginBottom: 0,
    }
  };
});

const ScrollableContent = styled(Box)(() => ({
  maxHeight: '120px',
  overflowY: 'auto',
  overflowX: 'hidden',
  '&::-webkit-scrollbar': {
    width: '4px',
  },
  '&::-webkit-scrollbar-track': {
    backgroundColor: 'transparent',
  },
  '&::-webkit-scrollbar-thumb': {
    backgroundColor: 'var(--theme-msg-block-scrollbar-thumb)',
    borderRadius: '2px',
    '&:hover': {
      opacity: 0.8,
    }
  },
  // Firefox滚动条样式
  scrollbarWidth: 'thin',
  scrollbarColor: 'var(--theme-msg-block-scrollbar-thumb) transparent',
}));

const KnowledgeReferenceBlock: React.FC<KnowledgeReferenceBlockProps> = ({ block }) => {
  const [expanded, setExpanded] = useState(false);
  const [activeReference, setActiveReference] = useState<number | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const handleCopyContent = useCallback((content: string, index: number) => {
    navigator.clipboard.writeText(content).then(() => {
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    }).catch(err => {
      logger.error('复制失败:', err);
    });
  }, []);

  const formatSimilarity = (similarity?: number) => {
    if (!similarity) return '匹配度未知';
    return `${Math.round(similarity * 100)}%`;
  };

  const sourceLabel = block.source || (block.metadata?.fileName || '知识库');

  const handleSourceClick = (fileId?: string) => {
    const targetFileId = fileId || block.metadata?.fileId;
    if (targetFileId) {
      // TODO: 实现文件打开功能
      logger.info('打开文件:', targetFileId);
    }
  };

  // 处理引用角标点击
  const handleReferenceClick = (referenceIndex: number) => {
    if (!expanded) {
      setExpanded(true);
    }
    setActiveReference(referenceIndex);

    // 滚动到对应的引用项
    setTimeout(() => {
      const element = document.getElementById(`reference-${block.id}-${referenceIndex}`);
      if (element) {
        element.scrollIntoView({
          behavior: 'auto',
          block: 'center'
        });

        // 添加高亮效果
        element.style.backgroundColor = 'rgba(25, 118, 210, 0.1)';

        setTimeout(() => {
          element.style.backgroundColor = '';
        }, 2000);
      }
    }, 0);
  };

  const handleResultToggle = (referenceIndex: number) => {
    setActiveReference((prev) => (prev === referenceIndex ? null : referenceIndex));
  };

  const toggleExpanded = () => {
    setExpanded(!expanded);
    if (expanded) {
      setActiveReference(null);
    }
  };

  const handleCardClick = (e: React.MouseEvent) => {
    // 防止点击列表项时触发
    if ((e.target as HTMLElement).closest('[data-result-item]')) {
      return;
    }
    // 防止点击按钮时触发
    if ((e.target as HTMLElement).closest('button')) {
      return;
    }
    toggleExpanded();
  };

  // 检查是否是综合引用块
  const isCombined = block.metadata?.isCombined;
  const resultCount = block.metadata?.resultCount || 1;
  const results = block.metadata?.results || [];
  const singleReferenceIndex = results[0]?.index ?? 1;
  const displayResults = isCombined
    ? results
    : [{
        index: singleReferenceIndex,
        content: block.content,
        similarity: block.similarity,
        metadata: block.metadata,
      }];

  const getSummary = (content: string) => {
    if (!content) return '暂无内容';
    return content.length > 90 ? `${content.slice(0, 90)}...` : content;
  };

  const getResultSource = (result: any) => {
    return result?.metadata?.fileName || result?.source || sourceLabel;
  };

  return (
    <StyledPaper elevation={0} onClick={handleCardClick}>
      {/* 显示来源和相似度 */}
      <HeaderBox>
        <KnowledgeIcon>
          {isCombined ? resultCount : '📚'}
        </KnowledgeIcon>
        <Typography variant="body2" fontWeight={500} color="text.primary">
          {isCombined ? `知识库引用` : '知识库引用'}
        </Typography>
        {!isCombined && block.similarity && (
          <SimilarityChip
            size="small"
            color={block.similarity > 0.8 ? "success" : "default"}
            label={formatSimilarity(block.similarity)}
          />
        )}
        {isCombined && (
          <SimilarityChip
            size="small"
            color="primary"
            label={`${resultCount}条结果`}
          />
        )}
        <Box flexGrow={1} />
        <IconButton
          size="small"
          onClick={(e) => {
            e.stopPropagation();
            toggleExpanded();
          }}
          sx={{
            padding: 0.5,
            '&:hover': { backgroundColor: 'rgba(0, 0, 0, 0.04)' }
          }}
        >
          {expanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
        </IconButton>
      </HeaderBox>

      {!expanded && (
        <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.85rem', lineHeight: 1.4 }}>
          {isCombined
            ? `找到 ${resultCount} 条相关内容，点击展开查看详情`
            : `${block.content.slice(0, 120)}${block.content.length > 120 ? '...' : ''}`}
        </Typography>
      )}

      {expanded && (
        <Box mt={1.5}>
        {displayResults.map((result: any, index: number) => {
          const referenceIndex = typeof result.index === 'number' ? result.index : index + 1;
          const isActive = activeReference === referenceIndex;
          const summary = getSummary(result.content || '');
          const resultSource = getResultSource(result);
          const similarity = typeof result.similarity === 'number' ? result.similarity : undefined;

          return (
            <ResultItem
              key={`reference-${block.id}-${referenceIndex}`}
              id={`reference-${block.id}-${referenceIndex}`}
              data-result-item
              onClick={(e) => {
                e.stopPropagation();
                handleResultToggle(referenceIndex);
              }}
            >
              <Box display="flex" alignItems="center" mb={0.75}>
                <Box
                  component="span"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleReferenceClick(referenceIndex);
                  }}
                  data-reference-index={referenceIndex}
                  sx={{
                    padding: '2px 6px',
                    borderRadius: '4px',
                    backgroundColor: 'primary.main',
                    color: 'white',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    marginRight: 1,
                  }}
                >
                  #{referenceIndex}
                </Box>
                <Typography
                  variant="body2"
                  color="text.primary"
                  sx={{ flexGrow: 1, fontWeight: 500, fontSize: '0.875rem' }}
                >
                  {summary}
                </Typography>
                <Tooltip title={copiedIndex === referenceIndex ? '已复制' : '复制内容'} arrow>
                  <IconButton
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCopyContent(result.content || '', referenceIndex);
                    }}
                    sx={{ opacity: 0.6, '&:hover': { opacity: 1 } }}
                  >
                    {copiedIndex === referenceIndex ? <Check size={14} /> : <Copy size={14} />}
                  </IconButton>
                </Tooltip>
                <IconButton
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleResultToggle(referenceIndex);
                  }}
                >
                  {isActive ? <ExpandLessIcon size={16} /> : <ExpandMoreIcon size={16} />}
                </IconButton>
              </Box>

              <Box display="flex" alignItems="center" gap={1} mb={isActive ? 1 : 0}>
                {similarity && (
                  <SimilarityChip
                    size="small"
                    color={similarity > 0.8 ? 'success' : similarity > 0.6 ? 'warning' : 'default'}
                    label={formatSimilarity(similarity)}
                  />
                )}
                <Typography variant="caption" color="text.secondary">
                  {resultSource}
                </Typography>
              </Box>

              {isActive && (
                <>
                  <ScrollableContent sx={{ mb: 1 }}>
                    <Typography
                      variant="body2"
                      sx={{
                        whiteSpace: 'pre-wrap',
                        lineHeight: 1.5,
                        fontSize: '0.875rem',
                        color: 'text.primary'
                      }}
                    >
                      {result.content}
                    </Typography>
                  </ScrollableContent>

                  <Box
                    p={1}
                    sx={{
                      backgroundColor: 'rgba(0, 0, 0, 0.02)',
                      borderRadius: 0.5,
                      border: '1px solid rgba(0, 0, 0, 0.05)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 1
                    }}
                  >
                    <Box>
                      <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                        📁 来源: {resultSource}
                      </Typography>
                      {block.metadata?.searchQuery && (
                        <Typography variant="caption" color="text.secondary" display="block">
                          🔍 查询: {block.metadata.searchQuery}
                        </Typography>
                      )}
                    </Box>
                    {(result?.metadata?.fileId || block.metadata?.fileId) && (
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSourceClick(result?.metadata?.fileId);
                        }}
                      >
                        <LinkIcon size={16} />
                      </IconButton>
                    )}
                  </Box>
                </>
              )}
            </ResultItem>
          );
        })}
        </Box>
      )}
    </StyledPaper>
  );
};

export default React.memo(KnowledgeReferenceBlock);