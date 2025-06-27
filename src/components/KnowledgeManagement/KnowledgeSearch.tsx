import React, { useState, useEffect } from 'react';
import {
  Box,
  TextField,
  Button,
  Typography,
  List,
  Paper,
  InputAdornment,
  IconButton,
  CircularProgress,
  Alert,
  Card,
  CardContent,
  Stack,
  FormControlLabel,
  Chip,
  Tooltip
} from '@mui/material';
import { Search, X, Copy, Sparkles, Zap } from 'lucide-react';
import CustomSwitch from '../CustomSwitch';
import { MobileKnowledgeService } from '../../shared/services/knowledge/MobileKnowledgeService';
import type { KnowledgeSearchResult } from '../../shared/types/KnowledgeBase';
import { BlockManager } from '../../shared/services/messages/BlockManager';
import { useSelector } from 'react-redux';
import type { RootState } from '../../shared/store';

interface KnowledgeSearchProps {
  knowledgeBaseId: string;
  onInsertReference?: (contentId: string, content: string) => void;
}

export const KnowledgeSearch: React.FC<KnowledgeSearchProps> = ({
  knowledgeBaseId,
  onInsertReference
}) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<KnowledgeSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [threshold, setThreshold] = useState(0.7);
  const [maxResults, setMaxResults] = useState(5); // 改为可变状态，从知识库配置获取
  const [useEnhancedRAG, setUseEnhancedRAG] = useState(true); // 新增：RAG模式开关
  const [searchTime, setSearchTime] = useState<number | null>(null); // 新增：搜索耗时
  const currentTopicId = useSelector((state: RootState) => state.messages.currentTopicId);

  useEffect(() => {
    const fetchKnowledgeBase = async () => {
      try {
        const kb = await MobileKnowledgeService.getInstance().getKnowledgeBase(knowledgeBaseId);
        if (kb) {
          setThreshold(kb.threshold || 0.7);
          // 使用知识库配置的文档数量，而不是硬编码的5
          setMaxResults(kb.documentCount || 5);
        }
      } catch (err) {
        console.error('Error fetching knowledge base details:', err);
      }
    };

    fetchKnowledgeBase();
  }, [knowledgeBaseId]);

  const handleSearch = async () => {
    if (!query.trim()) {
      setError('请输入搜索内容');
      return;
    }

    setLoading(true);
    setError(null);
    setSearchTime(null);

    const startTime = Date.now();

    try {
      const searchResults = await MobileKnowledgeService.getInstance().search({
        knowledgeBaseId,
        query: query.trim(),
        threshold,
        limit: maxResults,
        useEnhancedRAG // 使用RAG模式开关
      });

      const endTime = Date.now();
      setSearchTime(endTime - startTime);

      setResults(searchResults);

      if (searchResults.length === 0) {
        setError('没有找到匹配的内容');
      }
    } catch (err) {
      console.error('Search error:', err);
      setError('搜索过程中发生错误');
    } finally {
      setLoading(false);
    }
  };

  const handleClearSearch = () => {
    setQuery('');
    setResults([]);
    setError(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const handleInsertReference = async (result: KnowledgeSearchResult) => {
    try {
      if (!currentTopicId) {
        setError('未选择会话');
        return;
      }

      // 使用BlockManager创建引用块
      await BlockManager.createKnowledgeReferenceBlockFromSearchResult(
        currentTopicId,
        result,
        knowledgeBaseId,
        query
      );

      // 如果传入了回调函数，调用它
      if (onInsertReference) {
        onInsertReference(result.documentId, result.content);
      }
    } catch (err) {
      console.error('Error inserting reference:', err);
      setError('插入引用失败');
    }
  };

  return (
    <Box sx={{ width: '100%', overflow: 'auto', maxHeight: 'calc(100vh - 300px)' }}>
      <Paper elevation={0} sx={{ p: 2, mb: 2 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="subtitle1">
            知识库搜索
          </Typography>

          <Tooltip title={useEnhancedRAG ? "增强RAG搜索：使用查询扩展、混合搜索和重排序" : "简单搜索：仅使用向量相似度"}>
            <FormControlLabel
              control={
                <CustomSwitch
                  checked={useEnhancedRAG}
                  onChange={(e) => setUseEnhancedRAG(e.target.checked)}
                />
              }
              label={
                <Box display="flex" alignItems="center" gap={0.5}>
                  {useEnhancedRAG ? <Sparkles size={16} /> : <Zap size={16} />}
                  <Typography variant="caption">
                    {useEnhancedRAG ? '增强RAG' : '简单搜索'}
                  </Typography>
                </Box>
              }
            />
          </Tooltip>
        </Box>

        <TextField
          fullWidth
          variant="outlined"
          size="small"
          placeholder="输入搜索内容..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <Search size={20} />
                </InputAdornment>
              ),
              endAdornment: query && (
                <InputAdornment position="end">
                  <IconButton size="small" onClick={handleClearSearch}>
                    <X size={16} />
                  </IconButton>
                </InputAdornment>
              )
            }
          }}
          sx={{ mb: 1 }}
        />

        <Button
          variant="contained"
          color="primary"
          onClick={handleSearch}
          disabled={loading || !query.trim()}
          fullWidth
        >
          {loading ? <CircularProgress size={24} color="inherit" /> : '搜索'}
        </Button>
      </Paper>

      {error && (
        <Alert severity="info" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {results.length > 0 && (
        <Box>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
            <Typography variant="subtitle2">
              搜索结果 ({results.length})
            </Typography>

            <Box display="flex" gap={1}>
              {searchTime && (
                <Chip
                  label={`${searchTime}ms`}
                  size="small"
                  variant="outlined"
                  color="primary"
                />
              )}
              <Chip
                label={useEnhancedRAG ? '增强RAG' : '简单搜索'}
                size="small"
                color={useEnhancedRAG ? 'success' : 'default'}
                icon={useEnhancedRAG ? <Sparkles size={16} /> : <Zap size={16} />}
              />
            </Box>
          </Box>

          <List disablePadding>
            {results.map((result) => (
              <Card key={result.documentId} variant="outlined" sx={{ mb: 1 }}>
                <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                  <Stack spacing={1}>
                    <Typography variant="body2" component="div" sx={{
                      fontSize: '0.875rem',
                      mb: 1,
                      maxHeight: 100,
                      overflow: 'auto'
                    }}>
                      {result.content}
                    </Typography>

                    <Box display="flex" justifyContent="space-between" alignItems="center">
                      <Typography variant="caption" color="text.secondary">
                        相似度: {(result.similarity * 100).toFixed(1)}%
                      </Typography>

                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<Copy size={16} />}
                        onClick={() => handleInsertReference(result)}
                      >
                        插入引用
                      </Button>
                    </Box>
                  </Stack>
                </CardContent>
              </Card>
            ))}
          </List>
        </Box>
      )}
    </Box>
  );
};

export default KnowledgeSearch;