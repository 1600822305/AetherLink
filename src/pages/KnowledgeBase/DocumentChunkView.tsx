/**
 * 文档分块查看页面（Level 4）
 * 展示已分块文档的所有块内容
 * 支持：编辑(自动重新向量化)、删除、启用/禁用、搜索高亮、手动添加块
 * 路由：/knowledge/:id/document/:fileName
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  CircularProgress,
  Chip,
  Paper,
  Divider,
  alpha,
  IconButton,
  TextField,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
  InputAdornment,
} from '@mui/material';
import CustomSwitch from '../../components/CustomSwitch';
import { File as FileIcon, Copy, Check, Trash2, Pencil, Save, X, Plus, Search, List, CreditCard, ChevronLeft, ChevronRight } from 'lucide-react';
import BackButtonDialog from '../../components/common/BackButtonDialog';
import { SafeAreaContainer, HeaderBar } from '../../components/settings/SettingComponents';
import { MobileKnowledgeService } from '../../shared/services/knowledge/MobileKnowledgeService';
import { MobileEmbeddingService } from '../../shared/services/knowledge/MobileEmbeddingService';
import { dexieStorage } from '../../shared/services/storage/DexieStorageService';
import type { KnowledgeBase, KnowledgeDocument } from '../../shared/types/KnowledgeBase';
import { v4 as uuid } from 'uuid';

// 格式化字节大小
const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

// 搜索高亮渲染
const HighlightedText: React.FC<{ text: string; searchTerm: string }> = ({ text, searchTerm }) => {
  if (!searchTerm.trim()) {
    return <>{text}</>;
  }
  const escaped = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const parts = text.split(new RegExp(`(${escaped})`, 'gi'));
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === searchTerm.toLowerCase() ? (
          <Box key={i} component="mark" sx={{ bgcolor: 'warning.light', color: 'warning.contrastText', px: 0.25, borderRadius: 0.5 }}>
            {part}
          </Box>
        ) : (
          <React.Fragment key={i}>{part}</React.Fragment>
        )
      )}
    </>
  );
};

// 单个块卡片
const ChunkCard: React.FC<{
  doc: KnowledgeDocument;
  chunkIndex: number;
  searchTerm: string;
  saving: boolean;
  singleMode?: boolean;
  onDelete: (id: string) => void;
  onSave: (id: string, content: string) => void;
  onToggleEnabled: (id: string, enabled: boolean) => void;
}> = ({ doc, chunkIndex, searchTerm, saving, singleMode, onDelete, onSave, onToggleEnabled }) => {
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState(doc.content);
  const isEnabled = doc.metadata.enabled !== false;

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(doc.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = doc.content;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  }, [doc.content]);

  const handleStartEdit = useCallback(() => {
    setEditContent(doc.content);
    setEditing(true);
  }, [doc.content]);

  const handleCancelEdit = useCallback(() => {
    setEditing(false);
    setEditContent(doc.content);
  }, [doc.content]);

  const handleSave = useCallback(() => {
    if (editContent.trim() && editContent !== doc.content) {
      onSave(doc.id, editContent.trim());
    }
    setEditing(false);
  }, [editContent, doc.id, doc.content, onSave]);

  return (
    <Paper
      variant="outlined"
      sx={{
        overflow: 'hidden',
        borderRadius: 2,
        opacity: isEnabled ? 1 : 0.5,
        ...(editing && { borderColor: 'primary.main', borderWidth: 2 }),
        ...(singleMode && { display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }),
      }}
    >
      {/* 块头部 */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: { xs: 1.5, sm: 2 },
          py: 0.75,
          bgcolor: (theme) => alpha(theme.palette.primary.main, editing ? 0.08 : 0.04),
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Chip
            label={`块 ${chunkIndex + 1}`}
            size="small"
            sx={{
              height: 22,
              fontSize: '0.72rem',
              fontWeight: 600,
              bgcolor: isEnabled ? 'primary.main' : 'action.disabled',
              color: isEnabled ? 'primary.contrastText' : 'text.disabled',
            }}
          />
          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
            {formatFileSize(editing ? editContent.length : doc.content.length)}
          </Typography>
          {saving && <CircularProgress size={14} />}
          {!isEnabled && (
            <Chip label="已禁用" size="small" sx={{ height: 18, fontSize: '0.6rem' }} color="default" />
          )}
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
          {editing ? (
            <>
              <IconButton size="small" onClick={handleSave} sx={{ p: 0.5 }} title="保存并重新向量化">
                <Save size={14} color="#4caf50" />
              </IconButton>
              <IconButton size="small" onClick={handleCancelEdit} sx={{ p: 0.5 }} title="取消">
                <X size={14} />
              </IconButton>
            </>
          ) : (
            <>
              <CustomSwitch
                checked={isEnabled}
                onChange={(e) => onToggleEnabled(doc.id, e.target.checked)}
              />
              <IconButton size="small" onClick={handleCopy} sx={{ p: 0.5 }} title="复制内容">
                {copied ? <Check size={14} color="#4caf50" /> : <Copy size={14} />}
              </IconButton>
              <IconButton size="small" onClick={handleStartEdit} sx={{ p: 0.5 }} title="编辑">
                <Pencil size={14} />
              </IconButton>
              <IconButton size="small" onClick={() => onDelete(doc.id)} sx={{ p: 0.5 }} title="删除" color="error">
                <Trash2 size={14} />
              </IconButton>
            </>
          )}
        </Box>
      </Box>

      <Divider />

      {/* 块内容 */}
      <Box sx={{ px: { xs: 1.5, sm: 2 }, py: 1.5, ...(singleMode && !editing && { flex: 1, minHeight: 0, overflow: 'auto', WebkitOverflowScrolling: 'touch' }) }}>
        {editing ? (
          <TextField
            multiline
            fullWidth
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            variant="outlined"
            size="small"
            minRows={3}
            maxRows={15}
            sx={{
              '& .MuiOutlinedInput-root': {
                fontSize: '0.82rem',
                lineHeight: 1.7,
                fontFamily: 'inherit',
              },
            }}
          />
        ) : (
          <Typography
            variant="body2"
            sx={{
              fontSize: '0.82rem',
              lineHeight: 1.7,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              color: 'text.primary',
              fontFamily: 'inherit',
            }}
          >
            <HighlightedText text={doc.content} searchTerm={searchTerm} />
          </Typography>
        )}
      </Box>
    </Paper>
  );
};

const DocumentChunkView: React.FC = () => {
  const { id: knowledgeBaseId, fileName: encodedFileName } = useParams<{ id: string; fileName: string }>();
  const navigate = useNavigate();
  const [docs, setDocs] = useState<KnowledgeDocument[]>([]);
  const [knowledgeBase, setKnowledgeBase] = useState<KnowledgeBase | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newChunkContent, setNewChunkContent] = useState('');
  const [addingChunk, setAddingChunk] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'single'>('list');
  const [currentPage, setCurrentPage] = useState(1);
  const [singleIndex, setSingleIndex] = useState(0);
  const PAGE_SIZE = 10;

  const fileName = useMemo(() => {
    try {
      return decodeURIComponent(encodedFileName || '');
    } catch {
      return encodedFileName || '';
    }
  }, [encodedFileName]);

  useEffect(() => {
    const loadDocs = async () => {
      if (!knowledgeBaseId) return;
      try {
        setLoading(true);
        const service = MobileKnowledgeService.getInstance();
        const kb = await service.getKnowledgeBase(knowledgeBaseId);
        setKnowledgeBase(kb);
        const allDocs = await service.getDocumentsByKnowledgeBaseId(knowledgeBaseId);
        const filtered = allDocs
          .filter(d => (d.metadata.fileName || d.metadata.source) === fileName)
          .sort((a, b) => (a.metadata.chunkIndex || 0) - (b.metadata.chunkIndex || 0));
        setDocs(filtered);
      } catch (err) {
        console.error('加载文档块失败:', err);
      } finally {
        setLoading(false);
      }
    };
    loadDocs();
  }, [knowledgeBaseId, fileName]);

  const handleGoBack = () => {
    navigate(`/knowledge/${knowledgeBaseId}`);
  };

  const handleDeleteChunk = useCallback(async () => {
    if (!deleteTarget) return;
    try {
      const service = MobileKnowledgeService.getInstance();
      await service.deleteDocument(deleteTarget);
      setDocs(prev => prev.filter(d => d.id !== deleteTarget));
    } catch (err) {
      console.error('删除文档块失败:', err);
    } finally {
      setDeleteTarget(null);
    }
  }, [deleteTarget]);

  const handleSaveChunk = useCallback(async (docId: string, newContent: string) => {
    if (!knowledgeBase) return;
    setSavingIds(prev => new Set(prev).add(docId));
    try {
      const doc = docs.find(d => d.id === docId);
      if (!doc) return;

      // 重新生成 embedding 向量
      const embeddingService = MobileEmbeddingService.getInstance();
      const newVector = await embeddingService.getEmbedding(newContent, knowledgeBase.model);

      const updated: KnowledgeDocument = {
        ...doc,
        content: newContent,
        vector: newVector,
        metadata: { ...doc.metadata, timestamp: Date.now() },
      };
      await dexieStorage.knowledge_documents.put(updated);
      setDocs(prev => prev.map(d => d.id === docId ? updated : d));
    } catch (err) {
      console.error('保存文档块失败:', err);
    } finally {
      setSavingIds(prev => {
        const next = new Set(prev);
        next.delete(docId);
        return next;
      });
    }
  }, [docs, knowledgeBase]);

  const handleToggleEnabled = useCallback(async (docId: string, enabled: boolean) => {
    try {
      const doc = docs.find(d => d.id === docId);
      if (!doc) return;
      const updated: KnowledgeDocument = {
        ...doc,
        metadata: { ...doc.metadata, enabled },
      };
      await dexieStorage.knowledge_documents.put(updated);
      setDocs(prev => prev.map(d => d.id === docId ? updated : d));
    } catch (err) {
      console.error('切换块状态失败:', err);
    }
  }, [docs]);

  const handleAddChunk = useCallback(async () => {
    if (!knowledgeBaseId || !knowledgeBase || !newChunkContent.trim()) return;
    setAddingChunk(true);
    try {
      const embeddingService = MobileEmbeddingService.getInstance();
      const vector = await embeddingService.getEmbedding(newChunkContent.trim(), knowledgeBase.model);
      const maxIndex = docs.reduce((max, d) => Math.max(max, d.metadata.chunkIndex || 0), -1);
      const newDoc: KnowledgeDocument = {
        id: uuid(),
        knowledgeBaseId,
        content: newChunkContent.trim(),
        vector,
        metadata: {
          source: fileName,
          fileName,
          chunkIndex: maxIndex + 1,
          timestamp: Date.now(),
          enabled: true,
        },
      };
      await dexieStorage.knowledge_documents.put(newDoc);
      setDocs(prev => [...prev, newDoc]);
      setNewChunkContent('');
      setAddDialogOpen(false);
    } catch (err) {
      console.error('添加块失败:', err);
    } finally {
      setAddingChunk(false);
    }
  }, [knowledgeBaseId, knowledgeBase, newChunkContent, fileName, docs]);

  const totalSize = useMemo(() => docs.reduce((sum, d) => sum + d.content.length, 0), [docs]);

  const filteredDocs = useMemo(() => {
    if (!searchTerm.trim()) return docs;
    const term = searchTerm.toLowerCase();
    return docs.filter(d => d.content.toLowerCase().includes(term));
  }, [docs, searchTerm]);

  const enabledCount = useMemo(() => docs.filter(d => d.metadata.enabled !== false).length, [docs]);

  const totalPages = useMemo(() => Math.ceil(filteredDocs.length / PAGE_SIZE), [filteredDocs.length, PAGE_SIZE]);
  const pagedDocs = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredDocs.slice(start, start + PAGE_SIZE);
  }, [filteredDocs, currentPage, PAGE_SIZE]);

  // 搜索变化时重置分页
  useEffect(() => {
    setCurrentPage(1);
    setSingleIndex(0);
  }, [searchTerm]);

  return (
    <SafeAreaContainer>
      <HeaderBar
        title={fileName || '文档详情'}
        onBackPress={handleGoBack}
      />

      <Box
        sx={{
          flexGrow: 1,
          overflow: viewMode === 'single' ? 'hidden' : 'auto',
          display: viewMode === 'single' ? 'flex' : 'block',
          flexDirection: 'column',
          px: { xs: 1.5, sm: 2 },
          py: 1.5,
          pb: 'var(--content-bottom-padding)',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {loading ? (
          <Box display="flex" justifyContent="center" alignItems="center" height="50vh">
            <CircularProgress />
          </Box>
        ) : docs.length === 0 ? (
          <Box display="flex" flexDirection="column" alignItems="center" justifyContent="center" height="50vh" gap={1}>
            <FileIcon size={40} style={{ opacity: 0.2 }} />
            <Typography variant="body2" color="text.secondary">
              未找到文档块
            </Typography>
            <Button
              variant="outlined"
              size="small"
              startIcon={<Plus size={16} />}
              onClick={() => setAddDialogOpen(true)}
            >
              手动添加块
            </Button>
          </Box>
        ) : (
          <>
            {/* 文档概要信息 */}
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                mb: 1.5,
                flexWrap: 'wrap',
              }}
            >
              <Chip
                icon={<FileIcon size={12} />}
                label={fileName}
                size="small"
                variant="outlined"
                sx={{ height: 26, fontSize: '0.75rem', borderRadius: 1.5, maxWidth: '100%' }}
              />
              <Chip
                label={`${docs.length} 块`}
                size="small"
                color="primary"
                sx={{ height: 22, fontSize: '0.72rem' }}
              />
              {enabledCount < docs.length && (
                <Chip
                  label={`${enabledCount} 启用`}
                  size="small"
                  color="success"
                  variant="outlined"
                  sx={{ height: 20, fontSize: '0.65rem' }}
                />
              )}
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.72rem' }}>
                总计 {formatFileSize(totalSize)}
              </Typography>
              <Box sx={{ flex: 1 }} />
              {/* 视图切换 */}
              <Box sx={{ display: 'flex', alignItems: 'center', bgcolor: 'action.hover', borderRadius: 1.5, p: 0.25 }}>
                <IconButton
                  size="small"
                  onClick={() => setViewMode('list')}
                  color={viewMode === 'list' ? 'primary' : 'default'}
                  sx={{ p: 0.5 }}
                  title="分页列表"
                >
                  <List size={16} />
                </IconButton>
                <IconButton
                  size="small"
                  onClick={() => { setViewMode('single'); setSingleIndex(0); }}
                  color={viewMode === 'single' ? 'primary' : 'default'}
                  sx={{ p: 0.5 }}
                  title="单块浏览"
                >
                  <CreditCard size={16} />
                </IconButton>
              </Box>
              <IconButton
                size="small"
                onClick={() => setAddDialogOpen(true)}
                title="手动添加块"
                color="primary"
                sx={{ p: 0.5 }}
              >
                <Plus size={18} />
              </IconButton>
            </Box>

            {/* 搜索栏 */}
            <TextField
              size="small"
              fullWidth
              placeholder="搜索块内容..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              sx={{ mb: 1.5 }}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <Search size={16} style={{ opacity: 0.5 }} />
                    </InputAdornment>
                  ),
                  endAdornment: searchTerm ? (
                    <InputAdornment position="end">
                      <IconButton size="small" onClick={() => setSearchTerm('')} sx={{ p: 0.25 }}>
                        <X size={14} />
                      </IconButton>
                    </InputAdornment>
                  ) : null,
                  sx: { fontSize: '0.82rem', height: 36 },
                },
              }}
            />

            {searchTerm && (
              <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block', fontSize: '0.7rem' }}>
                找到 {filteredDocs.length} / {docs.length} 个匹配块
              </Typography>
            )}

            {viewMode === 'list' ? (
              <>
                {/* 分页列表 */}
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                  {pagedDocs.map((doc, idx) => (
                    <ChunkCard
                      key={doc.id}
                      doc={doc}
                      chunkIndex={doc.metadata.chunkIndex ?? ((currentPage - 1) * PAGE_SIZE + idx)}
                      searchTerm={searchTerm}
                      saving={savingIds.has(doc.id)}
                      onDelete={setDeleteTarget}
                      onSave={handleSaveChunk}
                      onToggleEnabled={handleToggleEnabled}
                    />
                  ))}
                </Box>

                {/* 分页控件 */}
                {totalPages > 1 && (
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, mt: 2, mb: 1 }}>
                    <IconButton
                      size="small"
                      disabled={currentPage <= 1}
                      onClick={() => setCurrentPage(p => p - 1)}
                    >
                      <ChevronLeft size={18} />
                    </IconButton>
                    {Array.from({ length: totalPages }, (_, i) => i + 1)
                      .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                      .reduce<(number | 'dots')[]>((acc, p, i, arr) => {
                        if (i > 0 && p - (arr[i - 1]) > 1) acc.push('dots');
                        acc.push(p);
                        return acc;
                      }, [])
                      .map((item, i) =>
                        item === 'dots' ? (
                          <Typography key={`dots-${i}`} variant="caption" sx={{ px: 0.5, opacity: 0.5 }}>…</Typography>
                        ) : (
                          <Button
                            key={item}
                            size="small"
                            variant={item === currentPage ? 'contained' : 'text'}
                            onClick={() => setCurrentPage(item as number)}
                            sx={{ minWidth: 32, height: 32, fontSize: '0.78rem', p: 0 }}
                          >
                            {item}
                          </Button>
                        )
                      )}
                    <IconButton
                      size="small"
                      disabled={currentPage >= totalPages}
                      onClick={() => setCurrentPage(p => p + 1)}
                    >
                      <ChevronRight size={18} />
                    </IconButton>
                  </Box>
                )}
              </>
            ) : (
              <>
                {/* 单块浏览模式 */}
                {filteredDocs.length > 0 && (
                  <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
                    <ChunkCard
                      doc={filteredDocs[singleIndex]}
                      chunkIndex={filteredDocs[singleIndex].metadata.chunkIndex ?? singleIndex}
                      searchTerm={searchTerm}
                      saving={savingIds.has(filteredDocs[singleIndex].id)}
                      singleMode
                      onDelete={setDeleteTarget}
                      onSave={handleSaveChunk}
                      onToggleEnabled={handleToggleEnabled}
                    />

                    {/* 单块导航 */}
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2, mt: 2, flexShrink: 0 }}>
                      <IconButton
                        disabled={singleIndex <= 0}
                        onClick={() => setSingleIndex(i => i - 1)}
                        sx={{ border: 1, borderColor: 'divider' }}
                      >
                        <ChevronLeft size={20} />
                      </IconButton>
                      <Typography variant="body2" sx={{ fontSize: '0.85rem', fontWeight: 500, minWidth: 80, textAlign: 'center' }}>
                        {singleIndex + 1} / {filteredDocs.length}
                      </Typography>
                      <IconButton
                        disabled={singleIndex >= filteredDocs.length - 1}
                        onClick={() => setSingleIndex(i => i + 1)}
                        sx={{ border: 1, borderColor: 'divider' }}
                      >
                        <ChevronRight size={20} />
                      </IconButton>
                    </Box>
                  </Box>
                )}
              </>
            )}
          </>
        )}
      </Box>

      {/* 删除确认对话框 */}
      <BackButtonDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
      >
        <DialogTitle>确认删除</DialogTitle>
        <DialogContent>
          <DialogContentText>
            确定要删除这个文档块吗？此操作不可撤销。
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)}>取消</Button>
          <Button onClick={handleDeleteChunk} color="error" variant="contained">删除</Button>
        </DialogActions>
      </BackButtonDialog>

      {/* 添加块对话框 */}
      <BackButtonDialog
        open={addDialogOpen}
        onClose={() => { setAddDialogOpen(false); setNewChunkContent(''); }}
        fullWidth
        maxWidth="md"
      >
        <DialogTitle>手动添加块</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            输入自定义块内容，保存后将自动生成向量嵌入。
          </DialogContentText>
          <TextField
            multiline
            fullWidth
            minRows={4}
            maxRows={12}
            value={newChunkContent}
            onChange={(e) => setNewChunkContent(e.target.value)}
            placeholder="输入块内容..."
            variant="outlined"
            sx={{
              '& .MuiOutlinedInput-root': {
                fontSize: '0.85rem',
                lineHeight: 1.7,
              },
            }}
          />
          {newChunkContent.trim() && (
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
              {formatFileSize(newChunkContent.trim().length)}
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setAddDialogOpen(false); setNewChunkContent(''); }}>取消</Button>
          <Button
            onClick={handleAddChunk}
            variant="contained"
            disabled={!newChunkContent.trim() || addingChunk}
          >
            {addingChunk ? <CircularProgress size={18} /> : '添加'}
          </Button>
        </DialogActions>
      </BackButtonDialog>
    </SafeAreaContainer>
  );
};

export default DocumentChunkView;
