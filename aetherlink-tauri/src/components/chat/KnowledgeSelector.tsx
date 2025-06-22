import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
  Box,
  TextField,
  InputAdornment,
  Chip,
  CircularProgress,
  Alert,
  Divider,
  IconButton,
} from '@mui/material';
import {
  BookOpen as MenuBookIcon,
  Search as SearchIcon,
  FileText as DocumentIcon,
  X as CloseIcon,
} from 'lucide-react';
import { MobileKnowledgeService } from '../../shared/services/knowledge/MobileKnowledgeService';
import { dexieStorage } from '../../shared/services/storage/DexieStorageService';

interface KnowledgeBase {
  id: string;
  name: string;
  description?: string;
  documentCount: number;
  createdAt: Date;
}

interface SearchResult {
  title?: string;
  content: string;
  similarity: number;
  documentId: string;
}

interface KnowledgeSelectorProps {
  open: boolean;
  onClose: () => void;
  onSelect: (knowledgeBase: KnowledgeBase, searchResults: SearchResult[]) => void;
  searchQuery?: string;
}

const KnowledgeSelector: React.FC<KnowledgeSelectorProps> = ({
  open,
  onClose,
  onSelect,
  searchQuery = ''
}) => {
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedKB, setSelectedKB] = useState<string>('');
  const [localSearchQuery, setLocalSearchQuery] = useState(searchQuery);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [error, setError] = useState<string>('');

  // 组件卸载标记
  const isMountedRef = useRef(true);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 组件卸载时清理
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  // 加载知识库列表
  const loadKnowledgeBases = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const kbs = await dexieStorage.knowledge_bases.toArray();

      // 获取每个知识库的文档数量
      const kbsWithCount = await Promise.all(
        kbs.map(async (kb) => {
          const docs = await dexieStorage.knowledge_documents
            .where('knowledgeBaseId')
            .equals(kb.id)
            .toArray();

          return {
            id: kb.id,
            name: kb.name,
            description: kb.description,
            documentCount: docs.length,
            createdAt: kb.createdAt
          };
        })
      );

      // 检查组件是否仍然挂载
      if (isMountedRef.current) {
        setKnowledgeBases(kbsWithCount);
      }
    } catch (error) {
      console.error('加载知识库失败:', error);
      if (isMountedRef.current) {
        setError('加载知识库失败，请重试');
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, []);

  // 搜索知识库内容
  const handleSearch = useCallback(async () => {
    if (!selectedKB || !localSearchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    try {
      setSearchLoading(true);
      setError('');

      // 获取选中知识库的配置
      const selectedKnowledgeBase = knowledgeBases.find(kb => kb.id === selectedKB);
      const limit = Math.min(selectedKnowledgeBase?.documentCount || 5, 10); // 限制最大搜索数量

      const results = await MobileKnowledgeService.getInstance().searchKnowledge(
        selectedKB,
        localSearchQuery.trim(),
        limit
      );

      // 检查组件是否仍然挂载
      if (isMountedRef.current) {
        setSearchResults(results || []);
      }
    } catch (error) {
      console.error('搜索知识库失败:', error);
      if (isMountedRef.current) {
        setSearchResults([]);
        setError('搜索失败，请重试');
      }
    } finally {
      if (isMountedRef.current) {
        setSearchLoading(false);
      }
    }
  }, [selectedKB, localSearchQuery, knowledgeBases]);

  // 防抖搜索
  const debouncedSearch = useCallback(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      handleSearch();
    }, 300); // 减少防抖时间到300ms
  }, [handleSearch]);

  // 确认选择
  const handleConfirm = useCallback(() => {
    const selectedKnowledgeBase = knowledgeBases.find(kb => kb.id === selectedKB);
    if (selectedKnowledgeBase) {
      onSelect(selectedKnowledgeBase, searchResults);
      handleClose();
    }
  }, [selectedKB, knowledgeBases, searchResults, onSelect]);

  // 关闭对话框
  const handleClose = useCallback(() => {
    setSelectedKB('');
    setLocalSearchQuery('');
    setSearchResults([]);
    setError('');
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    onClose();
  }, [onClose]);

  // 选择知识库
  const handleSelectKB = useCallback((kbId: string) => {
    setSelectedKB(kbId);
    setSearchResults([]);
    setError('');

    // 如果有搜索词，触发防抖搜索
    if (localSearchQuery.trim()) {
      debouncedSearch();
    }
  }, [localSearchQuery, debouncedSearch]);

  // 直接使用知识库（双击或长按）
  const handleDirectUse = useCallback((kb: KnowledgeBase) => {
    onSelect(kb, []);
    handleClose();
  }, [onSelect, handleClose]);

  // 当对话框打开时加载知识库
  useEffect(() => {
    if (open) {
      isMountedRef.current = true;
      loadKnowledgeBases();
      setLocalSearchQuery(searchQuery);
    }
  }, [open, searchQuery, loadKnowledgeBases]);

  // 当搜索词或选中知识库变化时，触发防抖搜索
  useEffect(() => {
    if (selectedKB && localSearchQuery.trim()) {
      debouncedSearch();
    } else {
      setSearchResults([]);
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    }
  }, [localSearchQuery, selectedKB, debouncedSearch]);

  // 搜索输入变化处理
  const handleSearchInputChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setLocalSearchQuery(event.target.value);
    setError('');
  }, []);

  // 计算是否显示搜索结果区域
  const showSearchResults = useMemo(() => {
    return selectedKB && localSearchQuery.trim();
  }, [selectedKB, localSearchQuery]);

  // 计算知识库列表的显示状态
  const knowledgeBaseListStatus = useMemo(() => {
    if (loading) return 'loading';
    if (error) return 'error';
    if (knowledgeBases.length === 0) return 'empty';
    return 'loaded';
  }, [loading, error, knowledgeBases.length]);

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      slotProps={{
        paper: {
          sx: {
            borderRadius: 2,
            maxHeight: '80vh'
          }
        }
      }}
    >
      <DialogTitle sx={{ pb: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box display="flex" alignItems="center" gap={1}>
          <MenuBookIcon color="primary" />
          <Typography variant="h6">选择知识库</Typography>
        </Box>
        <IconButton onClick={handleClose} edge="end">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ px: 3, py: 2 }}>
        {/* 错误提示 */}
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {/* 搜索输入框 */}
        <TextField
          fullWidth
          placeholder="输入搜索内容..."
          value={localSearchQuery}
          onChange={handleSearchInputChange}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
              endAdornment: searchLoading && (
                <InputAdornment position="end">
                  <CircularProgress size={20} />
                </InputAdornment>
              )
            }
          }}
          sx={{ mb: 2 }}
        />

        {/* 知识库列表 */}
        <Typography variant="subtitle2" gutterBottom>
          选择知识库 ({knowledgeBases.length})
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ mb: 2, display: 'block' }}>
          单击选择，双击直接使用知识库
        </Typography>

        {knowledgeBaseListStatus === 'loading' ? (
          <Box display="flex" justifyContent="center" py={3}>
            <CircularProgress />
          </Box>
        ) : knowledgeBaseListStatus === 'empty' ? (
          <Alert severity="info" sx={{ mb: 2 }}>
            暂无知识库，请先创建知识库
          </Alert>
        ) : (
          <List sx={{ maxHeight: 200, overflow: 'auto', mb: 2 }}>
            {knowledgeBases.map((kb) => (
              <ListItem key={kb.id} disablePadding>
                <ListItemButton
                  selected={selectedKB === kb.id}
                  onClick={() => handleSelectKB(kb.id)}
                  onDoubleClick={() => handleDirectUse(kb)}
                  sx={{
                    borderRadius: 1,
                    mb: 0.5,
                    '&.Mui-selected': {
                      backgroundColor: 'primary.main',
                      color: 'primary.contrastText',
                      '&:hover': {
                        backgroundColor: 'primary.dark',
                      }
                    }
                  }}
                >
                  <ListItemIcon>
                    <MenuBookIcon color={selectedKB === kb.id ? 'inherit' : 'primary'} />
                  </ListItemIcon>
                  <ListItemText
                    primary={kb.name}
                    secondary={
                      <span style={{ display: 'block' }}>
                        {kb.description && (
                          <span style={{ display: 'block', fontSize: '0.75rem', lineHeight: 1.2 }}>
                            {kb.description}
                          </span>
                        )}
                        <span style={{ display: 'inline-block', marginTop: '4px' }}>
                          <Chip
                            size="small"
                            label={`${kb.documentCount} 个文档`}
                            component="span"
                          />
                        </span>
                      </span>
                    }
                  />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        )}

        {/* 搜索结果 */}
        {showSearchResults && (
          <>
            <Divider sx={{ my: 2 }} />
            <Typography variant="subtitle2" gutterBottom>
              搜索结果 ({searchResults.length})
            </Typography>

            {searchLoading ? (
              <Box display="flex" justifyContent="center" py={2}>
                <CircularProgress size={24} />
              </Box>
            ) : searchResults.length === 0 ? (
              <Alert severity="warning">
                未找到相关内容，请尝试其他关键词
              </Alert>
            ) : (
              <List sx={{ maxHeight: 150, overflow: 'auto' }}>
                {searchResults.map((result, index) => (
                  <ListItem key={`${result.documentId}-${index}`} sx={{ py: 1 }}>
                    <ListItemIcon>
                      <DocumentIcon size={16} />
                    </ListItemIcon>
                    <ListItemText
                      primary={
                        <Typography variant="body2" noWrap>
                          {result.title || `文档 ${index + 1}`}
                        </Typography>
                      }
                      secondary={
                        <Typography variant="caption" color="textSecondary">
                          相似度: {(result.similarity * 100).toFixed(1)}%
                        </Typography>
                      }
                    />
                  </ListItem>
                ))}
              </List>
            )}
          </>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={handleClose} startIcon={<CloseIcon />}>
          取消
        </Button>
        <Button
          onClick={handleConfirm}
          variant="contained"
          disabled={!selectedKB}
          startIcon={<MenuBookIcon />}
        >
          使用知识库
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default KnowledgeSelector;
