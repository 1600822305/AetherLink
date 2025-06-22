import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Button,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  IconButton,
  Paper,
  Divider,
  LinearProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  TextField,
  InputAdornment,
  Chip,
  Stack,
  CircularProgress,
  Alert,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import {
  Upload as CloudUploadIcon,
  File as InsertDriveFileIcon,
  Search as SearchIcon,
  Trash2 as DeleteIcon,
  X as CloseIcon
} from 'lucide-react';

import { MobileKnowledgeService } from '../../shared/services/knowledge/MobileKnowledgeService';
import type { KnowledgeDocument } from '../../shared/types/KnowledgeBase';

const VisuallyHiddenInput = styled('input')({
  clip: 'rect(0 0 0 0)',
  clipPath: 'inset(50%)',
  height: 1,
  overflow: 'hidden',
  position: 'absolute',
  bottom: 0,
  left: 0,
  whiteSpace: 'nowrap',
  width: 1,
});

interface DocumentManagerProps {
  knowledgeBaseId: string;
  onDocumentsAdded?: () => void;
}

interface ProgressState {
  active: boolean;
  current: number;
  total: number;
  documentId?: string;
}

const DocumentManager: React.FC<DocumentManagerProps> = ({
  knowledgeBaseId,
  onDocumentsAdded,
}) => {
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [progress, setProgress] = useState<ProgressState>({
    active: false,
    current: 0,
    total: 0,
  });
  const [clearAllDialogOpen, setClearAllDialogOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const knowledgeService = MobileKnowledgeService.getInstance();

  // 加载文档列表
  const loadDocuments = async () => {
    try {
      setLoading(true);
      // 在实际应用中，这里应该从服务中获取知识库的所有文档
      // 这里是临时实现，实际项目中应该替换为实际的API调用
      const docs = await knowledgeService.getDocumentsByKnowledgeBaseId(knowledgeBaseId);
      setDocuments(docs);
    } catch (err) {
      console.error('加载文档失败:', err);
      setError('无法加载文档列表，请稍后再试');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (knowledgeBaseId) {
      loadDocuments();
    }

    // 清理函数：组件卸载时取消正在进行的操作
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [knowledgeBaseId]);

  // 处理文件上传
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    setError(null);

    try {
      setProgress({
        active: true,
        current: 0,
        total: files.length
      });

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        try {
          // 读取文件内容
          const content = await readFileAsText(file);

          // 更新进度
          setProgress(prev => ({
            ...prev,
            current: i + 1,
          }));

          // 添加到知识库
          await knowledgeService.addDocument({
            knowledgeBaseId,
            content,
            metadata: {
              source: file.name,
              fileName: file.name,
            }
          });
        } catch (err) {
          console.error(`处理文件 ${file.name} 失败:`, err);
          setError(`处理文件 ${file.name} 失败，请检查文件格式`);
        }
      }

      // 完成后重新加载文档
      loadDocuments();
      if (onDocumentsAdded) {
        onDocumentsAdded();
      }
    } catch (err) {
      console.error('文件上传失败:', err);
      setError('文件上传失败，请稍后再试');
    } finally {
      setUploading(false);
      setProgress({
        active: false,
        current: 0,
        total: 0
      });
      // 清空文件输入
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // 读取文件为文本
  const readFileAsText = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = event => {
        if (event.target?.result) {
          resolve(event.target.result as string);
        } else {
          reject(new Error('读取文件失败'));
        }
      };
      reader.onerror = () => reject(new Error('读取文件出错'));
      reader.readAsText(file);
    });
  };

  // 处理搜索
  const handleSearch = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(event.target.value);
  };

  // 直接删除文档（无需确认）
  const handleDeleteDocument = async (documentId: string) => {
    try {
      await knowledgeService.deleteDocument(documentId);
      loadDocuments();
    } catch (err) {
      console.error('删除文档失败:', err);
      setError('删除文档失败，请稍后再试');
    }
  };



  // 一键清理所有文档 - 使用并行删除提高效率
  const handleClearAllDocuments = useCallback(async () => {
    try {
      setLoading(true);
      // 并行删除所有文档以提高效率
      await Promise.all(documents.map(doc => knowledgeService.deleteDocument(doc.id)));
      loadDocuments();
    } catch (err) {
      console.error('清理文档失败:', err);
      setError('清理文档失败，请稍后再试');
    } finally {
      setClearAllDialogOpen(false);
      setLoading(false);
    }
  }, [documents, knowledgeService]);

  // 过滤文档
  const filteredDocuments = documents.filter(doc => {
    if (!searchTerm) return true;

    const searchTermLower = searchTerm.toLowerCase();
    return (
      doc.content.toLowerCase().includes(searchTermLower) ||
      doc.metadata.fileName?.toLowerCase().includes(searchTermLower) ||
      doc.metadata.source.toLowerCase().includes(searchTermLower)
    );
  });

  return (
    <Box sx={{ width: '100%', overflow: 'auto', maxHeight: 'calc(100vh - 300px)' }}>
      {/* 头部控件 */}
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} mb={2} alignItems="center">
        <TextField
          placeholder="搜索文档..."
          variant="outlined"
          size="small"
          fullWidth
          value={searchTerm}
          onChange={handleSearch}
          disabled={loading}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon size={20} />
                </InputAdornment>
              ),
              endAdornment: searchTerm ? (
                <InputAdornment position="end">
                  <IconButton
                    onClick={() => setSearchTerm('')}
                    size="small"
                    aria-label="清除搜索"
                  >
                    <CloseIcon size={20} />
                  </IconButton>
                </InputAdornment>
              ) : null,
            }
          }}
        />

        <Button
          component="label"
          variant="contained"
          startIcon={<CloudUploadIcon />}
          disabled={uploading}
        >
          {uploading ? '上传中...' : '上传文档'}
          <VisuallyHiddenInput
            ref={fileInputRef}
            type="file"
            onChange={handleFileUpload}
            multiple
            accept=".txt,.md,.csv,.json"
          />
        </Button>

        {documents.length > 0 && (
          <Button
            variant="outlined"
            color="error"
            startIcon={<DeleteIcon />}
            onClick={() => setClearAllDialogOpen(true)}
            disabled={uploading || loading}
          >
            一键清理
          </Button>
        )}
      </Stack>

      {/* 错误消息 */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* 上传进度条 */}
      {progress.active && (
        <Box mb={2}>
          <Typography variant="body2" gutterBottom>
            处理文件 ({progress.current}/{progress.total})
          </Typography>
          <LinearProgress
            variant="determinate"
            value={(progress.current / progress.total) * 100}
          />
        </Box>
      )}

      {/* 文档列表 */}
      <Paper variant="outlined">
        {loading ? (
          <Box display="flex" justifyContent="center" alignItems="center" p={4}>
            <CircularProgress size={32} />
            <Typography ml={2} variant="body1">加载文档中...</Typography>
          </Box>
        ) : filteredDocuments.length > 0 ? (
          <List>
            {filteredDocuments.map((doc, index) => (
              <React.Fragment key={doc.id}>
                {index > 0 && <Divider />}
                <ListItem
                  secondaryAction={
                    <IconButton
                      edge="end"
                      onClick={() => handleDeleteDocument(doc.id)}
                      aria-label="删除"
                      size="small"
                    >
                      <DeleteIcon size={20} />
                    </IconButton>
                  }
                >
                  <ListItemIcon>
                    <InsertDriveFileIcon />
                  </ListItemIcon>
                  <ListItemText
                    primary={doc.metadata.fileName || '未命名文档'}
                    secondary={
                      <Box component="span">
                        <Typography
                          sx={{ display: 'inline' }}
                          component="span"
                          variant="body2"
                          color="text.primary"
                        >
                          {doc.content.substring(0, 100)}
                          {doc.content.length > 100 ? '...' : ''}
                        </Typography>
                        <br />
                        <Box mt={0.5}>
                          <Chip
                            label={`块 #${doc.metadata.chunkIndex || 0}`}
                            size="small"
                            sx={{ mr: 0.5 }}
                          />
                          <Chip
                            label={new Date(doc.metadata.timestamp).toLocaleDateString()}
                            size="small"
                            variant="outlined"
                          />
                        </Box>
                      </Box>
                    }
                  />
                </ListItem>
              </React.Fragment>
            ))}
          </List>
        ) : (
          <Box p={4} textAlign="center">
            <Typography color="textSecondary">
              {searchTerm ? '没有找到匹配的文档' : '暂无文档，请上传文件或添加URL'}
            </Typography>
          </Box>
        )}
      </Paper>

      {/* 一键清理确认对话框 */}
      <Dialog
        open={clearAllDialogOpen}
        onClose={() => setClearAllDialogOpen(false)}
      >
        <DialogTitle>确认清理所有文档</DialogTitle>
        <DialogContent>
          <DialogContentText>
            确定要删除知识库中的所有 {documents.length} 个文档吗？此操作不可撤销。
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setClearAllDialogOpen(false)}>
            取消
          </Button>
          <Button onClick={handleClearAllDocuments} color="error">
            清理全部
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default DocumentManager;