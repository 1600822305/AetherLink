import React, { useState } from 'react';
import { Box, Typography, Paper, IconButton, Collapse, Chip } from '@mui/material';
import { ChevronDown as ExpandMoreIcon, ChevronUp as ExpandLessIcon, Link as LinkIcon } from 'lucide-react';
import type { KnowledgeReferenceMessageBlock } from '../../../shared/types/newMessage';
import { styled } from '@mui/material/styles';

interface KnowledgeReferenceBlockProps {
  block: KnowledgeReferenceMessageBlock;
}

const StyledPaper = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(1.5),
  marginBottom: theme.spacing(1),
  borderRadius: theme.spacing(1),
  border: `1px solid ${theme.palette.divider}`,
  backgroundColor: theme.palette.mode === 'dark'
    ? 'rgba(255, 255, 255, 0.02)'
    : 'rgba(0, 0, 0, 0.02)',
  position: 'relative',
  transition: 'all 0.2s ease-in-out',
  '&:hover': {
    backgroundColor: theme.palette.mode === 'dark'
      ? 'rgba(255, 255, 255, 0.04)'
      : 'rgba(0, 0, 0, 0.04)',
    borderColor: theme.palette.primary.main,
    transform: 'translateY(-1px)',
    boxShadow: theme.shadows[3],
  }
}));

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

const ResultItem = styled(Box)(({ theme }) => ({
  marginBottom: theme.spacing(1.5),
  padding: theme.spacing(1.5),
  backgroundColor: theme.palette.mode === 'dark'
    ? 'rgba(255, 255, 255, 0.03)'
    : 'rgba(0, 0, 0, 0.03)',
  borderRadius: theme.spacing(0.75),
  border: `1px solid ${theme.palette.divider}`,
  '&:last-child': {
    marginBottom: 0,
  }
}));

const ScrollableContent = styled(Box)(({ theme }) => ({
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
    backgroundColor: theme.palette.mode === 'dark'
      ? 'rgba(255, 255, 255, 0.2)'
      : 'rgba(0, 0, 0, 0.2)',
    borderRadius: '2px',
    '&:hover': {
      backgroundColor: theme.palette.mode === 'dark'
        ? 'rgba(255, 255, 255, 0.3)'
        : 'rgba(0, 0, 0, 0.3)',
    }
  },
  // Firefox滚动条样式
  scrollbarWidth: 'thin',
  scrollbarColor: theme.palette.mode === 'dark'
    ? 'rgba(255, 255, 255, 0.2) transparent'
    : 'rgba(0, 0, 0, 0.2) transparent',
}));

const KnowledgeReferenceBlock: React.FC<KnowledgeReferenceBlockProps> = ({ block }) => {
  const [expanded, setExpanded] = useState(false);

  const toggleExpanded = () => {
    setExpanded(!expanded);
  };

  const formatSimilarity = (similarity?: number) => {
    if (!similarity) return '匹配度未知';
    return `${Math.round(similarity * 100)}%`;
  };

  const sourceLabel = block.source || (block.metadata?.fileName || '知识库');

  const handleSourceClick = () => {
    // 如果有文件ID，可以打开文件
    if (block.metadata?.fileId) {
      // TODO: 实现文件打开功能
      console.log('打开文件:', block.metadata.fileId);
    }
  };

  // 处理引用角标点击
  const handleReferenceClick = (referenceIndex: number) => {
    // 如果没有展开，先展开
    if (!expanded) {
      setExpanded(true);
    }

    // 滚动到对应的引用项
    setTimeout(() => {
      const element = document.getElementById(`reference-${block.id}-${referenceIndex}`);
      if (element) {
        element.scrollIntoView({
          behavior: 'smooth',
          block: 'center'
        });

        // 添加高亮效果
        element.style.backgroundColor = 'rgba(25, 118, 210, 0.1)';
        element.style.transition = 'background-color 0.3s ease';

        setTimeout(() => {
          element.style.backgroundColor = '';
        }, 2000);
      }
    }, 300); // 等待展开动画完成
  };

  // 检查是否是综合引用块
  const isCombined = block.metadata?.isCombined;
  const resultCount = block.metadata?.resultCount || 1;
  const results = block.metadata?.results || [];

  return (
    <StyledPaper elevation={0}>
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
          onClick={toggleExpanded}
          sx={{
            padding: 0.5,
            '&:hover': { backgroundColor: 'rgba(0, 0, 0, 0.04)' }
          }}
        >
          {expanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
        </IconButton>
      </HeaderBox>

      {/* 显示内容摘要 */}
      {!expanded && (
        <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.875rem', lineHeight: 1.4 }}>
          {isCombined
            ? `找到 ${resultCount} 条相关内容，点击展开查看详情`
            : `${block.content.slice(0, 120)}${block.content.length > 120 ? '...' : ''}`
          }
        </Typography>
      )}

      {/* 展开时显示的详细信息 */}
      <Collapse in={expanded}>
        <Box mt={1.5}>
          {isCombined ? (
            // 综合引用块：显示所有结果
            <Box>
              {results.map((result: any, index: number) => (
                <ResultItem
                  key={index}
                  id={`reference-${block.id}-${result.index}`}
                >
                  <Box display="flex" alignItems="center" mb={1}>
                    <Box
                      component="span"
                      onClick={() => handleReferenceClick(result.index)}
                      sx={{
                        cursor: 'pointer',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        backgroundColor: 'primary.main',
                        color: 'white',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        marginRight: 1,
                        transition: 'all 0.2s ease',
                        '&:hover': {
                          backgroundColor: 'primary.dark',
                          transform: 'scale(1.05)',
                        }
                      }}
                    >
                      #{result.index}
                    </Box>
                    <SimilarityChip
                      size="small"
                      color={result.similarity > 0.8 ? "success" : result.similarity > 0.6 ? "warning" : "default"}
                      label={formatSimilarity(result.similarity)}
                    />
                  </Box>
                  <ScrollableContent>
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
                </ResultItem>
              ))}

              {/* 搜索查询信息 */}
              <Box
                mt={1.5}
                p={1}
                sx={{
                  backgroundColor: 'rgba(0, 0, 0, 0.02)',
                  borderRadius: 0.5,
                  border: '1px solid rgba(0, 0, 0, 0.05)'
                }}
              >
                <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                  📁 来源: {sourceLabel}
                </Typography>
                {block.metadata?.searchQuery && (
                  <Typography variant="caption" color="text.secondary" display="block">
                    🔍 查询: {block.metadata.searchQuery}
                  </Typography>
                )}
              </Box>
            </Box>
          ) : (
            // 单个引用块：显示完整内容
            <Box>
              <ScrollableContent sx={{ mb: 1.5 }}>
                <Typography
                  variant="body2"
                  sx={{
                    whiteSpace: 'pre-wrap',
                    lineHeight: 1.5,
                    fontSize: '0.875rem'
                  }}
                >
                  {block.content}
                </Typography>
              </ScrollableContent>

              <Box
                p={1}
                sx={{
                  backgroundColor: 'rgba(0, 0, 0, 0.02)',
                  borderRadius: 0.5,
                  border: '1px solid rgba(0, 0, 0, 0.05)'
                }}
              >
                <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                  📁 来源: {sourceLabel}
                </Typography>
                {block.metadata?.searchQuery && (
                  <Typography variant="caption" color="text.secondary" display="block">
                    🔍 查询: {block.metadata.searchQuery}
                  </Typography>
                )}
              </Box>
            </Box>
          )}
        </Box>
      </Collapse>

      {/* 来源链接 */}
      {!isCombined && (block.metadata?.fileId || block.metadata?.fileName) && (
        <IconButton
          size="small"
          sx={{
            position: 'absolute',
            bottom: 6,
            right: 6,
            padding: 0.5,
            '&:hover': { backgroundColor: 'rgba(0, 0, 0, 0.04)' }
          }}
          onClick={handleSourceClick}
        >
          <LinkIcon fontSize="small" />
        </IconButton>
      )}
    </StyledPaper>
  );
};

export default React.memo(KnowledgeReferenceBlock);