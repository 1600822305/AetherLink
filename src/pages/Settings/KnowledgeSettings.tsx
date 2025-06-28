import React, { useState, useEffect } from 'react';
import {
  Box,
  AppBar,
  Toolbar,
  IconButton,
  Typography,
  Paper,
  Button,
  Alert,
  CircularProgress,
  Card,
  CardContent,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Divider,
  alpha,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft as ArrowBackIcon, Trash2 as DeleteIcon, Download as DownloadIcon, Database as StorageIcon, Plus as AddIcon, ExternalLink as LaunchIcon } from 'lucide-react';
import { MobileKnowledgeService } from '../../shared/services/knowledge/MobileKnowledgeService';
import { dexieStorage } from '../../shared/services/storage/DexieStorageService';
import CreateKnowledgeDialog from '../../components/KnowledgeManagement/CreateKnowledgeDialog';
import type { KnowledgeBase } from '../../shared/types/KnowledgeBase';
import { toastManager } from '../../components/EnhancedToast';
import { useTranslation, Trans } from 'react-i18next';

interface KnowledgeStats {
  totalKnowledgeBases: number;
  totalDocuments: number;
  totalVectors: number;
  storageSize: string;
}

const KnowledgeSettings: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<KnowledgeStats>({
    totalKnowledgeBases: 0,
    totalDocuments: 0,
    totalVectors: 0,
    storageSize: '0 MB'
  });

  // 对话框状态
  const [clearDialogOpen, setClearDialogOpen] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  const handleBack = () => {
    navigate('/settings');
  };

  // 加载统计信息
  const loadStats = async () => {
    try {
      setLoading(true);

      // 获取知识库数量
      const knowledgeBases = await dexieStorage.knowledge_bases.toArray();
      const totalKnowledgeBases = knowledgeBases.length;

      // 获取文档数量
      const documents = await dexieStorage.knowledge_documents.toArray();
      const totalDocuments = documents.length;

      // 计算向量数量（每个文档都有向量）
      const totalVectors = totalDocuments;

      // 估算存储大小（简化计算）
      const avgVectorSize = 1536 * 4; // 假设1536维向量，每个float 4字节
      const estimatedSize = totalVectors * avgVectorSize;
      const storageSize = formatBytes(estimatedSize);

      setStats({
        totalKnowledgeBases,
        totalDocuments,
        totalVectors,
        storageSize
      });
    } catch (error) {
      console.error('加载知识库统计信息失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 格式化字节数
  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // 清理所有知识库数据
  const handleClearAllData = async () => {
    try {
      setLoading(true);

      // 清理知识库相关表
      await dexieStorage.knowledge_bases.clear();
      await dexieStorage.knowledge_documents.clear();

      // 重新加载统计信息
      await loadStats();

      setClearDialogOpen(false);
      toastManager.success('知识库数据已清理完成', '清理成功');
    } catch (error) {
      console.error('清理知识库数据失败:', error);
      toastManager.error('清理失败，请重试', '清理失败');
    } finally {
      setLoading(false);
    }
  };

  // 创建知识库
  const handleCreateKnowledge = () => {
    setCreateDialogOpen(true);
  };

  // 处理知识库创建
  const handleSubmitKnowledgeBase = async (formData: Partial<KnowledgeBase>) => {
    try {
      setLoading(true);
      await MobileKnowledgeService.getInstance().createKnowledgeBase(formData as any);
      setCreateDialogOpen(false);
      await loadStats(); // 重新加载统计信息
      toastManager.success('知识库创建成功！', '创建成功');
      // 可以选择导航到知识库详情页
      // navigate(`/knowledge/${createdKB.id}`);
    } catch (error) {
      console.error('创建知识库失败:', error);
      toastManager.error('创建失败，请重试', '创建失败');
    } finally {
      setLoading(false);
    }
  };

  // 导出知识库数据
  const handleExportData = async () => {
    try {
      setLoading(true);

      const knowledgeBases = await dexieStorage.knowledge_bases.toArray();
      const documents = await dexieStorage.knowledge_documents.toArray();

      const exportData = {
        version: '1.0',
        timestamp: new Date().toISOString(),
        knowledgeBases,
        documents
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], {
        type: 'application/json'
      });

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `knowledge-backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setExportDialogOpen(false);
      toastManager.success('知识库数据导出成功', '导出成功');
    } catch (error) {
      console.error('导出知识库数据失败:', error);
      toastManager.error('导出失败，请重试', '导出失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, []);

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
            <ArrowBackIcon />
          </IconButton>
          <Typography
            variant="h6"
            component="div"
            sx={{
              flexGrow: 1,
              fontWeight: 600,
              backgroundImage: 'linear-gradient(90deg, #9333EA, #754AB4)',
              backgroundClip: 'text',
              color: 'transparent',
            }}
          >
            {t('settings.knowledge.title')}
          </Typography>
        </Toolbar>
      </AppBar>

      <Box
        sx={{
          flexGrow: 1,
          overflowY: 'auto',
          p: { xs: 1, sm: 2 },
          mt: 8,
          '&::-webkit-scrollbar': {
            width: { xs: '4px', sm: '6px' },
          },
          '&::-webkit-scrollbar-thumb': {
            backgroundColor: 'rgba(0,0,0,0.1)',
            borderRadius: '3px',
          },
        }}
      >
        {/* 统计信息卡片 */}
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
          <Box sx={{ p: { xs: 1.5, sm: 2 }, bgcolor: 'rgba(0,0,0,0.01)' }}>
            <Typography
              variant="subtitle1"
              sx={{
                fontWeight: 600,
                fontSize: { xs: '1rem', sm: '1.1rem' },
                display: 'flex',
                alignItems: 'center',
                gap: 1
              }}
            >
              <StorageIcon size={20} color="#059669" />
              {t('settings.knowledge.stats.title')}
            </Typography>
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ fontSize: { xs: '0.8rem', sm: '0.875rem' } }}
            >
              {t('settings.knowledge.stats.subtitle')}
            </Typography>
          </Box>

          <Divider />

          <Box sx={{ p: { xs: 1.5, sm: 2 } }}>

          {loading ? (
            <Box display="flex" justifyContent="center" py={3}>
              <CircularProgress />
            </Box>
          ) : (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', margin: -1 }}>
              <Box sx={{ width: { xs: '50%', sm: '25%' }, p: 1 }}>
                <Card variant="outlined">
                  <CardContent sx={{ textAlign: 'center', py: 2 }}>
                    <Typography variant="h4" color="primary" fontWeight="bold">
                      {stats.totalKnowledgeBases}
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      {t('settings.knowledge.stats.bases')}
                    </Typography>
                  </CardContent>
                </Card>
              </Box>
              <Box sx={{ width: { xs: '50%', sm: '25%' }, p: 1 }}>
                <Card variant="outlined">
                  <CardContent sx={{ textAlign: 'center', py: 2 }}>
                    <Typography variant="h4" color="success.main" fontWeight="bold">
                      {stats.totalDocuments}
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      {t('settings.knowledge.stats.documents')}
                    </Typography>
                  </CardContent>
                </Card>
              </Box>
              <Box sx={{ width: { xs: '50%', sm: '25%' }, p: 1 }}>
                <Card variant="outlined">
                  <CardContent sx={{ textAlign: 'center', py: 2 }}>
                    <Typography variant="h4" color="warning.main" fontWeight="bold">
                      {stats.totalVectors}
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      {t('settings.knowledge.stats.vectors')}
                    </Typography>
                  </CardContent>
                </Card>
              </Box>
              <Box sx={{ width: { xs: '50%', sm: '25%' }, p: 1 }}>
                <Card variant="outlined">
                  <CardContent sx={{ textAlign: 'center', py: 2 }}>
                    <Typography variant="h4" color="info.main" fontWeight="bold">
                      {stats.storageSize}
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      {t('settings.knowledge.stats.storage')}
                    </Typography>
                  </CardContent>
                </Card>
              </Box>
            </Box>
          )}
          </Box>
        </Paper>

        {/* 快速操作 */}
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
          <Box sx={{ p: { xs: 1.5, sm: 2 }, bgcolor: 'rgba(0,0,0,0.01)' }}>
            <Typography
              variant="subtitle1"
              sx={{
                fontWeight: 600,
                fontSize: { xs: '1rem', sm: '1.1rem' }
              }}
            >
              {t('settings.knowledge.quickActions.title')}
            </Typography>
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ fontSize: { xs: '0.8rem', sm: '0.875rem' } }}
            >
              {t('settings.knowledge.quickActions.subtitle')}
            </Typography>
          </Box>

          <Divider />

          <Box sx={{ p: { xs: 1.5, sm: 2 } }}>

          <Box sx={{ display: 'flex', flexWrap: 'wrap', margin: -1 }}>
            <Box sx={{ width: { xs: '100%', sm: '50%' }, p: 1 }}>
              <Button
                fullWidth
                variant="contained"
                startIcon={<AddIcon />}
                onClick={handleCreateKnowledge}
                disabled={loading}
                sx={{
                  py: 1.5,
                  background: 'linear-gradient(45deg, #059669 30%, #10b981 90%)',
                  '&:hover': {
                    background: 'linear-gradient(45deg, #047857 30%, #059669 90%)',
                  }
                }}
              >
                {t('settings.knowledge.quickActions.create')}
              </Button>
            </Box>

            <Box sx={{ width: { xs: '100%', sm: '50%' }, p: 1 }}>
              <Button
                fullWidth
                variant="outlined"
                startIcon={<LaunchIcon />}
                onClick={() => navigate('/knowledge')}
                sx={{ py: 1.5 }}
              >
                {t('settings.knowledge.quickActions.manage')}
              </Button>
            </Box>
          </Box>

          {stats.totalKnowledgeBases === 0 && (
            <Alert severity="info" sx={{ mt: 2 }}>
              {t('settings.knowledge.quickActions.emptyTip')}
            </Alert>
          )}
          </Box>
        </Paper>

        {/* 知识库配置说明 */}
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
          <Box sx={{ p: { xs: 1.5, sm: 2 }, bgcolor: 'rgba(0,0,0,0.01)' }}>
            <Typography
              variant="subtitle1"
              sx={{
                fontWeight: 600,
                fontSize: { xs: '1rem', sm: '1.1rem' }
              }}
            >
              {t('settings.knowledge.config.title')}
            </Typography>
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ fontSize: { xs: '0.8rem', sm: '0.875rem' } }}
            >
              {t('settings.knowledge.config.subtitle')}
            </Typography>
          </Box>

          <Divider />

          <Box sx={{ p: { xs: 1.5, sm: 2 } }}>

          <Alert severity="info" sx={{ mb: 2 }}>
            {t('settings.knowledge.config.info')}
          </Alert>

          <Typography variant="body2" color="text.secondary">
            <Trans i18nKey="settings.knowledge.config.details.embeddingModel" components={{0: <strong/>}} />
            <br/>
            <Trans i18nKey="settings.knowledge.config.details.chunkSize" components={{0: <strong/>}} />
            <br/>
            <Trans i18nKey="settings.knowledge.config.details.similarity" components={{0: <strong/>}} />
            <br/>
            <Trans i18nKey="settings.knowledge.config.details.docCount" components={{0: <strong/>}} />
          </Typography>
          </Box>
        </Paper>

        {/* 数据管理 */}
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
          <Box sx={{ p: { xs: 1.5, sm: 2 }, bgcolor: 'rgba(0,0,0,0.01)' }}>
            <Typography
              variant="subtitle1"
              sx={{
                fontWeight: 600,
                fontSize: { xs: '1rem', sm: '1.1rem' }
              }}
            >
              {t('settings.knowledge.data.title')}
            </Typography>
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ fontSize: { xs: '0.8rem', sm: '0.875rem' } }}
            >
              {t('settings.knowledge.data.subtitle')}
            </Typography>
          </Box>

          <Divider />

          <Box sx={{ p: { xs: 1.5, sm: 2 } }}>

          {stats.totalKnowledgeBases === 0 ? (
            <Alert severity="warning" sx={{ mb: 3 }}>
              {t('settings.knowledge.data.noData')}
            </Alert>
          ) : (
            <Alert severity="info" sx={{ mb: 3 }}>
              {t('settings.knowledge.data.warning')}
            </Alert>
          )}

          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            {stats.totalKnowledgeBases === 0 ? (
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={handleCreateKnowledge}
                disabled={loading}
                sx={{
                  background: 'linear-gradient(45deg, #059669 30%, #10b981 90%)',
                  '&:hover': {
                    background: 'linear-gradient(45deg, #047857 30%, #059669 90%)',
                  }
                }}
              >
                {t('settings.knowledge.data.createFirst')}
              </Button>
            ) : (
              <>
                <Button
                  variant="outlined"
                  startIcon={<DownloadIcon />}
                  onClick={() => setExportDialogOpen(true)}
                  disabled={loading}
                >
                  {t('settings.knowledge.data.export')}
                </Button>

                <Button
                  variant="outlined"
                  color="error"
                  startIcon={<DeleteIcon />}
                  onClick={() => setClearDialogOpen(true)}
                  disabled={loading}
                >
                  {t('settings.knowledge.data.clear')}
                </Button>
              </>
            )}
          </Box>
          </Box>
        </Paper>
      </Box>

      {/* 清理确认对话框 */}
      <Dialog open={clearDialogOpen} onClose={() => setClearDialogOpen(false)}>
        <DialogTitle>{t('settings.knowledge.dialogs.clear.title')}</DialogTitle>
        <DialogContent>
          <Typography>{t('settings.knowledge.dialogs.clear.content')}</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setClearDialogOpen(false)}>{t('settings.knowledge.dialogs.clear.cancel')}</Button>
          <Button onClick={handleClearAllData} color="error" disabled={loading}>
            {loading ? <CircularProgress size={20} /> : t('settings.knowledge.dialogs.clear.confirm')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* 导出确认对话框 */}
      <Dialog open={exportDialogOpen} onClose={() => setExportDialogOpen(false)}>
        <DialogTitle>{t('settings.knowledge.dialogs.export.title')}</DialogTitle>
        <DialogContent>
          <Typography>{t('settings.knowledge.dialogs.export.content')}</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setExportDialogOpen(false)}>{t('settings.knowledge.dialogs.export.cancel')}</Button>
          <Button onClick={handleExportData} disabled={loading}>
            {loading ? <CircularProgress size={20} /> : t('settings.knowledge.dialogs.export.confirm')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* 创建知识库对话框 */}
      <CreateKnowledgeDialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        onSave={handleSubmitKnowledgeBase}
        isEditing={false}
      />
    </Box>
  );
};

export default KnowledgeSettings;
