import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Typography,
  Button,
  CircularProgress,
  Paper,
  Divider,
  IconButton,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Chip,
  Tab,
  Tabs,
  Tooltip,
  alpha,
  LinearProgress,
} from '@mui/material';
import BackButtonDialog from '../../components/common/BackButtonDialog';
import { styled } from '@mui/material/styles';
import {
  Folder,
  Trash2,
  Plus,
  Download,
  Upload,
  AlertTriangle,
  FileText,
  Database,
  Settings,
  Cloud,
  HardDrive,
  Zap,
  ChevronRight,
  BookOpen,
  Key,
  Link as LinkIcon,
  Cpu,
  RefreshCw,
  Info,
} from 'lucide-react';
import { MobileKnowledgeService } from '../../shared/services/knowledge/MobileKnowledgeService';
import { dexieStorage } from '../../shared/services/storage/DexieStorageService';
import { useNavigate } from 'react-router-dom';
import { useKnowledge } from '../../components/KnowledgeManagement/KnowledgeProvider';
import { toastManager } from '../../components/EnhancedToast';
import { SafeAreaContainer, HeaderBar } from '../../components/settings/SettingComponents';
import Scrollbar from '../../components/Scrollbar';
import { useDispatch, useSelector } from 'react-redux';
import type { RootState } from '../../shared/store';
import { PREPROCESS_PROVIDER_METAS } from '../../shared/services/knowledge/preprocess/types';
import type { PreprocessProviderId } from '../../shared/services/knowledge/preprocess/types';
import { setPdfParseMode, setActiveProvider, updateProviderConfig, clearProviderConfig } from '../../shared/store/slices/pdfPreprocessSlice';

// ==================== Styled Components ====================

const PageContainer = styled(SafeAreaContainer)(() => ({
  position: 'relative',
  overflow: 'hidden',
}));

const StyledTabs = styled(Tabs)(({ theme }) => ({
  minHeight: 40,
  borderBottom: `1px solid ${theme.palette.divider}`,
  backgroundColor: theme.palette.background.paper,
  '& .MuiTab-root': {
    minHeight: 40,
    textTransform: 'none',
    fontWeight: 500,
    fontSize: '0.875rem',
  },
}));

const SectionCard = styled(Paper)(({ theme }) => ({
  borderRadius: 12,
  border: `1px solid ${theme.palette.divider}`,
  overflow: 'hidden',
  marginBottom: theme.spacing(2),
}));

const SectionHeader = styled(Box)(({ theme }) => ({
  padding: theme.spacing(1.5, 2),
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1),
}));

const SectionContent = styled(Box)(({ theme }) => ({
  padding: theme.spacing(2),
}));

const StatBox = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1.5),
  padding: theme.spacing(1.5, 2),
  borderRadius: 10,
  backgroundColor: alpha(theme.palette.primary.main, 0.04),
  border: `1px solid ${alpha(theme.palette.primary.main, 0.08)}`,
  flex: 1,
  minWidth: 0,
}));

const KBListItem = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  padding: theme.spacing(1.5, 2),
  cursor: 'pointer',
  transition: 'background-color 0.15s',
  '&:hover': {
    backgroundColor: alpha(theme.palette.primary.main, 0.04),
  },
  '&:not(:last-child)': {
    borderBottom: `1px solid ${theme.palette.divider}`,
  },
}));

const ModeCard = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'active',
})<{ active?: boolean }>(({ theme, active }) => ({
  flex: 1,
  padding: theme.spacing(1.5),
  borderRadius: 10,
  border: `2px solid ${active ? theme.palette.primary.main : theme.palette.divider}`,
  backgroundColor: active ? alpha(theme.palette.primary.main, 0.04) : 'transparent',
  cursor: 'pointer',
  transition: 'all 0.2s',
  textAlign: 'center',
  '&:hover': {
    borderColor: theme.palette.primary.main,
    backgroundColor: alpha(theme.palette.primary.main, 0.04),
  },
}));

// ==================== Types ====================

interface KnowledgeStats {
  totalKnowledgeBases: number;
  totalDocuments: number;
  totalVectors: number;
  storageSize: string;
  storageSizeBytes: number;
}

// ==================== Main Component ====================

const KnowledgeSettings: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [activeTab, setActiveTab] = useState(0);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [clearDialogOpen, setClearDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [stats, setStats] = useState<KnowledgeStats>({
    totalKnowledgeBases: 0,
    totalDocuments: 0,
    totalVectors: 0,
    storageSize: '0 B',
    storageSizeBytes: 0,
  });

  const { knowledgeBases, isLoading, refreshKnowledgeBases } = useKnowledge();
  const pdfPreprocess = useSelector((state: RootState) => state.pdfPreprocess);
  const activeProviderId = pdfPreprocess.activeProviderId;
  const activeProviderConfig = activeProviderId ? pdfPreprocess.providers[activeProviderId] : null;

  // ==================== Helpers ====================

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString: string) => {
    const d = new Date(dateString);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  // ==================== Data Loading ====================

  const loadStats = async () => {
    try {
      const documents = await dexieStorage.knowledge_documents.toArray();
      const totalDocuments = documents.length;
      const totalVectors = totalDocuments;
      const avgVectorSize = 1536 * 4;
      const storageSizeBytes = totalVectors * avgVectorSize;

      setStats({
        totalKnowledgeBases: knowledgeBases.length,
        totalDocuments,
        totalVectors,
        storageSize: formatBytes(storageSizeBytes),
        storageSizeBytes,
      });
    } catch (error) {
      console.error('加载统计信息失败:', error);
    }
  };

  useEffect(() => {
    loadStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [knowledgeBases]);

  // ==================== Handlers ====================

  const handleBack = () => navigate('/settings');
  const handleViewDetails = (id: string) => navigate(`/knowledge/${id}`);

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('确认要删除这个知识库吗？此操作将删除所有相关文档，无法撤销。')) return;
    try {
      await MobileKnowledgeService.getInstance().deleteKnowledgeBase(id);
      refreshKnowledgeBases();
      toastManager.success('知识库删除成功', '删除成功');
    } catch (error) {
      console.error('删除知识库失败:', error);
      toastManager.error('删除失败，请重试', '删除失败');
    }
  };

  const handleExportData = async () => {
    try {
      setLoading(true);
      const kbs = await dexieStorage.knowledge_bases.toArray();
      const documents = await dexieStorage.knowledge_documents.toArray();
      const exportData = { version: '1.0', timestamp: new Date().toISOString(), knowledgeBases: kbs, documents };
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
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

  const handleImportData = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      setLoading(true);
      const text = await file.text();
      const importData = JSON.parse(text);
      if (!importData.version || !importData.knowledgeBases || !importData.documents) {
        throw new Error('无效的备份文件格式');
      }
      for (const kb of importData.knowledgeBases) await dexieStorage.knowledge_bases.put(kb);
      for (const doc of importData.documents) await dexieStorage.knowledge_documents.put(doc);
      refreshKnowledgeBases();
      setImportDialogOpen(false);
      toastManager.success(`成功导入 ${importData.knowledgeBases.length} 个知识库和 ${importData.documents.length} 个文档`, '导入成功');
    } catch (error) {
      console.error('导入知识库数据失败:', error);
      toastManager.error('导入失败，请检查文件格式', '导入失败');
    } finally {
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleClearAllData = async () => {
    try {
      setLoading(true);
      await dexieStorage.knowledge_bases.clear();
      await dexieStorage.knowledge_documents.clear();
      refreshKnowledgeBases();
      setClearDialogOpen(false);
      toastManager.success('知识库数据已清理完成', '清理成功');
    } catch (error) {
      console.error('清理知识库数据失败:', error);
      toastManager.error('清理失败，请重试', '清理失败');
    } finally {
      setLoading(false);
    }
  };

  // ==================== Parse Mode Config ====================

  const parseModes = useMemo(() => [
    { value: 'local' as const, label: '仅本地', icon: HardDrive, desc: '使用本地 pdfjs 解析，零成本' },
    { value: 'auto' as const, label: '智能降级', icon: Zap, desc: '本地失败时自动切换云端' },
    { value: 'cloud' as const, label: '强制云端', icon: Cloud, desc: '全部使用云端，效果最佳' },
  ], []);

  // ==================== Tab: 知识库管理 ====================

  const renderKnowledgeTab = () => (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {/* 统计概览 */}
      <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
        <StatBox>
          <Database size={18} style={{ opacity: 0.6, flexShrink: 0 }} />
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="h6" fontWeight={700} lineHeight={1.2}>{stats.totalKnowledgeBases}</Typography>
            <Typography variant="caption" color="text.secondary" noWrap>知识库</Typography>
          </Box>
        </StatBox>
        <StatBox>
          <FileText size={18} style={{ opacity: 0.6, flexShrink: 0 }} />
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="h6" fontWeight={700} lineHeight={1.2}>{stats.totalDocuments}</Typography>
            <Typography variant="caption" color="text.secondary" noWrap>文档</Typography>
          </Box>
        </StatBox>
        <StatBox>
          <HardDrive size={18} style={{ opacity: 0.6, flexShrink: 0 }} />
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="h6" fontWeight={700} lineHeight={1.2}>{stats.storageSize}</Typography>
            <Typography variant="caption" color="text.secondary" noWrap>存储</Typography>
          </Box>
        </StatBox>
      </Box>

      {/* 知识库列表 */}
      <SectionCard elevation={0}>
        <SectionHeader>
          <BookOpen size={18} style={{ opacity: 0.6 }} />
          <Typography variant="subtitle2" fontWeight={600} sx={{ flex: 1 }}>
            知识库列表
          </Typography>
          <Chip label={knowledgeBases.length} size="small" variant="outlined" />
          <Tooltip title="刷新">
            <IconButton size="small" onClick={() => refreshKnowledgeBases()}>
              <RefreshCw size={16} />
            </IconButton>
          </Tooltip>
        </SectionHeader>
        <Divider />

        {isLoading ? (
          <Box display="flex" justifyContent="center" py={4}>
            <CircularProgress size={28} />
          </Box>
        ) : knowledgeBases.length === 0 ? (
          <Box sx={{ py: 6, textAlign: 'center' }}>
            <Database size={40} style={{ opacity: 0.15, marginBottom: 12 }} />
            <Typography variant="body2" color="text.secondary">
              暂无知识库，点击上方按钮创建
            </Typography>
          </Box>
        ) : (
          knowledgeBases.map((kb) => (
            <KBListItem key={kb.id} onClick={() => handleViewDetails(kb.id)}>
              <Box sx={{
                width: 36, height: 36, borderRadius: '10px', display: 'flex',
                alignItems: 'center', justifyContent: 'center', mr: 1.5, flexShrink: 0,
                bgcolor: (theme) => alpha(theme.palette.primary.main, 0.08),
                color: 'primary.main',
              }}>
                <Folder size={18} />
              </Box>
              <Box sx={{ flex: 1, minWidth: 0, mr: 1 }}>
                <Typography variant="body2" fontWeight={600} noWrap>{kb.name}</Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.25 }}>
                  <Typography variant="caption" color="text.secondary" noWrap>
                    {kb.model}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {formatDate(kb.created_at)}
                  </Typography>
                </Box>
              </Box>
              <Tooltip title="删除">
                <IconButton
                  size="small"
                  onClick={(e) => handleDelete(kb.id, e)}
                  sx={{ opacity: 0.4, '&:hover': { opacity: 1, color: 'error.main' } }}
                >
                  <Trash2 size={15} />
                </IconButton>
              </Tooltip>
              <ChevronRight size={16} style={{ opacity: 0.3, marginLeft: 4 }} />
            </KBListItem>
          ))
        )}
      </SectionCard>
    </Box>
  );

  // ==================== Tab: 文档处理 ====================

  const renderProcessingTab = () => (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {/* PDF 解析模式 */}
      <SectionCard elevation={0}>
        <SectionHeader>
          <FileText size={18} style={{ opacity: 0.6 }} />
          <Box sx={{ flex: 1 }}>
            <Typography variant="subtitle2" fontWeight={600}>PDF 解析模式</Typography>
            <Typography variant="caption" color="text.secondary">选择 PDF 文件的解析策略</Typography>
          </Box>
        </SectionHeader>
        <Divider />
        <SectionContent>
          <Box sx={{ display: 'flex', gap: 1.5 }}>
            {parseModes.map(({ value, label, icon: Icon, desc }) => (
              <ModeCard
                key={value}
                active={pdfPreprocess.parseMode === value}
                onClick={() => {
                  if (value === 'cloud' && !activeProviderId) return;
                  dispatch(setPdfParseMode(value));
                }}
                sx={{ opacity: value === 'cloud' && !activeProviderId ? 0.4 : 1 }}
              >
                <Icon size={22} style={{ marginBottom: 6, opacity: 0.7 }} />
                <Typography variant="body2" fontWeight={600} sx={{ mb: 0.25 }}>{label}</Typography>
                <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.3, display: 'block' }}>
                  {desc}
                </Typography>
              </ModeCard>
            ))}
          </Box>
          {pdfPreprocess.parseMode === 'cloud' && !activeProviderId && (
            <Typography variant="caption" color="warning.main" sx={{ mt: 1, display: 'block' }}>
              需要先配置云端提供商才能使用强制云端模式
            </Typography>
          )}
        </SectionContent>
      </SectionCard>

      {/* 云端预处理提供商 */}
      <SectionCard elevation={0}>
        <SectionHeader>
          <Cloud size={18} style={{ opacity: 0.6 }} />
          <Box sx={{ flex: 1 }}>
            <Typography variant="subtitle2" fontWeight={600}>云端预处理</Typography>
            <Typography variant="caption" color="text.secondary">配置 PDF 云端解析服务</Typography>
          </Box>
          {activeProviderId && (
            <Chip
              label={PREPROCESS_PROVIDER_METAS[activeProviderId]?.name || activeProviderId}
              size="small"
              color="primary"
              variant="outlined"
            />
          )}
        </SectionHeader>
        <Divider />
        <SectionContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <FormControl fullWidth size="small">
              <InputLabel id="preprocess-provider-label" shrink>选择提供商</InputLabel>
              <Select
                labelId="preprocess-provider-label"
                value={activeProviderId || ''}
                label="选择提供商"
                displayEmpty
                onChange={(e) => {
                  const selectedId = e.target.value as PreprocessProviderId;
                  if (!selectedId) {
                    dispatch(setActiveProvider(null));
                    return;
                  }
                  const meta = PREPROCESS_PROVIDER_METAS[selectedId];
                  dispatch(setActiveProvider(selectedId));
                  dispatch(updateProviderConfig({
                    id: selectedId,
                    updates: {
                      name: meta.name,
                      apiHost: pdfPreprocess.providers[selectedId]?.apiHost || meta.defaultApiHost,
                      model: pdfPreprocess.providers[selectedId]?.model || meta.defaultModel || '',
                    },
                  }));
                }}
              >
                <MenuItem value="">
                  <em>未启用</em>
                </MenuItem>
                {Object.values(PREPROCESS_PROVIDER_METAS).map((meta) => (
                  <MenuItem key={meta.id} value={meta.id}>
                    <Box>
                      <Typography variant="body2" fontWeight={500}>{meta.name}</Typography>
                      <Typography variant="caption" color="text.secondary">{meta.description}</Typography>
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {activeProviderId && (
              <>
                {PREPROCESS_PROVIDER_METAS[activeProviderId]?.requiresApiKey && (
                  <TextField
                    label="API Key"
                    value={activeProviderConfig?.apiKey || ''}
                    onChange={(e) => dispatch(updateProviderConfig({ id: activeProviderId, updates: { apiKey: e.target.value } }))}
                    fullWidth
                    size="small"
                    type="password"
                    placeholder="输入提供商 API 密钥"
                    InputProps={{ startAdornment: <Key size={16} style={{ marginRight: 8, opacity: 0.5 }} /> }}
                  />
                )}
                <TextField
                  label="API Host"
                  value={activeProviderConfig?.apiHost || ''}
                  onChange={(e) => dispatch(updateProviderConfig({ id: activeProviderId, updates: { apiHost: e.target.value } }))}
                  fullWidth
                  size="small"
                  placeholder={PREPROCESS_PROVIDER_METAS[activeProviderId]?.defaultApiHost}
                  InputProps={{ startAdornment: <LinkIcon size={16} style={{ marginRight: 8, opacity: 0.5 }} /> }}
                />
                {PREPROCESS_PROVIDER_METAS[activeProviderId]?.defaultModel && (
                  <TextField
                    label="模型"
                    value={activeProviderConfig?.model || ''}
                    onChange={(e) => dispatch(updateProviderConfig({ id: activeProviderId, updates: { model: e.target.value } }))}
                    fullWidth
                    size="small"
                    placeholder={PREPROCESS_PROVIDER_METAS[activeProviderId]?.defaultModel}
                    InputProps={{ startAdornment: <Cpu size={16} style={{ marginRight: 8, opacity: 0.5 }} /> }}
                  />
                )}
                <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <Button
                    variant="text"
                    color="error"
                    size="small"
                    startIcon={<Trash2 size={14} />}
                    onClick={() => dispatch(clearProviderConfig(activeProviderId))}
                  >
                    清除配置
                  </Button>
                </Box>
              </>
            )}
          </Box>
        </SectionContent>
      </SectionCard>

      {/* 提示信息 */}
      <Box sx={{
        display: 'flex', alignItems: 'flex-start', gap: 1, p: 1.5, borderRadius: 2,
        bgcolor: (theme) => alpha(theme.palette.info.main, 0.06),
        border: (theme) => `1px solid ${alpha(theme.palette.info.main, 0.12)}`,
      }}>
        <Info size={16} style={{ opacity: 0.5, marginTop: 2, flexShrink: 0 }} />
        <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.5 }}>
          分块参数（块大小、重叠、策略）在创建知识库时单独配置。每个知识库可以使用不同的分块设置以获得最佳效果。
        </Typography>
      </Box>
    </Box>
  );

  // ==================== Tab: 数据管理 ====================

  const renderDataTab = () => (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {/* 存储概览 */}
      <SectionCard elevation={0}>
        <SectionHeader>
          <HardDrive size={18} style={{ opacity: 0.6 }} />
          <Typography variant="subtitle2" fontWeight={600} sx={{ flex: 1 }}>存储概览</Typography>
        </SectionHeader>
        <Divider />
        <SectionContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="body2" color="text.secondary">已使用存储</Typography>
              <Typography variant="body2" fontWeight={600}>{stats.storageSize}</Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={Math.min((stats.storageSizeBytes / (100 * 1024 * 1024)) * 100, 100)}
              sx={{ height: 6, borderRadius: 3 }}
            />
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography variant="caption" color="text.secondary">
                {stats.totalKnowledgeBases} 个知识库 · {stats.totalDocuments} 个文档 · {stats.totalVectors} 个向量
              </Typography>
            </Box>
          </Box>
        </SectionContent>
      </SectionCard>

      {/* 导入导出 */}
      <SectionCard elevation={0}>
        <SectionHeader>
          <Database size={18} style={{ opacity: 0.6 }} />
          <Typography variant="subtitle2" fontWeight={600} sx={{ flex: 1 }}>备份与恢复</Typography>
        </SectionHeader>
        <Divider />
        <SectionContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            <Box
              sx={{
                display: 'flex', alignItems: 'center', gap: 2, p: 2, borderRadius: 2,
                border: (theme) => `1px solid ${theme.palette.divider}`,
                cursor: 'pointer', transition: 'all 0.15s',
                '&:hover': { bgcolor: (theme) => alpha(theme.palette.primary.main, 0.04) },
              }}
              onClick={() => setExportDialogOpen(true)}
            >
              <Download size={20} style={{ opacity: 0.6 }} />
              <Box sx={{ flex: 1 }}>
                <Typography variant="body2" fontWeight={600}>导出数据</Typography>
                <Typography variant="caption" color="text.secondary">
                  将所有知识库和文档导出为 JSON 备份文件
                </Typography>
              </Box>
              <ChevronRight size={16} style={{ opacity: 0.3 }} />
            </Box>

            <Box
              sx={{
                display: 'flex', alignItems: 'center', gap: 2, p: 2, borderRadius: 2,
                border: (theme) => `1px solid ${theme.palette.divider}`,
                cursor: 'pointer', transition: 'all 0.15s',
                '&:hover': { bgcolor: (theme) => alpha(theme.palette.primary.main, 0.04) },
              }}
              onClick={() => setImportDialogOpen(true)}
            >
              <Upload size={20} style={{ opacity: 0.6 }} />
              <Box sx={{ flex: 1 }}>
                <Typography variant="body2" fontWeight={600}>导入数据</Typography>
                <Typography variant="caption" color="text.secondary">
                  从 JSON 备份文件恢复知识库和文档
                </Typography>
              </Box>
              <ChevronRight size={16} style={{ opacity: 0.3 }} />
            </Box>
          </Box>
        </SectionContent>
      </SectionCard>

      {/* 危险区域 */}
      <SectionCard elevation={0} sx={{ borderColor: (theme) => alpha(theme.palette.error.main, 0.2) }}>
        <SectionHeader>
          <AlertTriangle size={18} color="#ef4444" style={{ opacity: 0.8 }} />
          <Typography variant="subtitle2" fontWeight={600} color="error.main" sx={{ flex: 1 }}>
            危险操作
          </Typography>
        </SectionHeader>
        <Divider />
        <SectionContent>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box>
              <Typography variant="body2" fontWeight={500}>清除所有数据</Typography>
              <Typography variant="caption" color="text.secondary">
                删除所有知识库、文档和向量数据，此操作不可撤销
              </Typography>
            </Box>
            <Button
              variant="outlined"
              color="error"
              size="small"
              onClick={() => setClearDialogOpen(true)}
              disabled={loading || knowledgeBases.length === 0}
            >
              清除
            </Button>
          </Box>
        </SectionContent>
      </SectionCard>
    </Box>
  );

  // ==================== Render ====================

  return (
    <PageContainer>
      <HeaderBar
        title="知识库设置"
        onBackPress={handleBack}
        rightButton={
          <Button
            variant="contained"
            size="small"
            startIcon={<Plus size={16} />}
            onClick={() => navigate('/knowledge/create')}
            sx={{
              borderRadius: 2,
              textTransform: 'none',
              boxShadow: 'none',
              background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
              '&:hover': { background: 'linear-gradient(135deg, #047857 0%, #059669 100%)', boxShadow: 'none' },
            }}
          >
            新建
          </Button>
        }
      />

      <StyledTabs
        value={activeTab}
        onChange={(_, v) => setActiveTab(v)}
        variant="fullWidth"
      >
        <Tab icon={<Database size={16} />} iconPosition="start" label="知识库" />
        <Tab icon={<Settings size={16} />} iconPosition="start" label="文档处理" />
        <Tab icon={<HardDrive size={16} />} iconPosition="start" label="数据管理" />
      </StyledTabs>

      <Scrollbar
        style={{
          flexGrow: 1,
          padding: '16px',
          paddingBottom: 'var(--content-bottom-padding)',
        }}
      >
        {activeTab === 0 && renderKnowledgeTab()}
        {activeTab === 1 && renderProcessingTab()}
        {activeTab === 2 && renderDataTab()}
      </Scrollbar>

      {/* ==================== Dialogs ==================== */}

      <BackButtonDialog open={importDialogOpen} onClose={() => setImportDialogOpen(false)}>
        <DialogTitle>导入知识库数据</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            选择之前导出的 JSON 备份文件进行导入。导入的数据将与现有数据合并。
          </Typography>
          <input ref={fileInputRef} type="file" accept=".json" onChange={handleImportData} style={{ display: 'none' }} />
          <Button variant="outlined" fullWidth onClick={() => fileInputRef.current?.click()} disabled={loading}>
            {loading ? <CircularProgress size={20} /> : '选择文件'}
          </Button>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setImportDialogOpen(false)}>关闭</Button>
        </DialogActions>
      </BackButtonDialog>

      <BackButtonDialog open={exportDialogOpen} onClose={() => setExportDialogOpen(false)}>
        <DialogTitle>导出知识库数据</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            将导出所有知识库和文档数据为 JSON 文件，可用于备份或迁移。
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setExportDialogOpen(false)}>取消</Button>
          <Button onClick={handleExportData} disabled={loading} variant="contained">
            {loading ? <CircularProgress size={20} /> : '确认导出'}
          </Button>
        </DialogActions>
      </BackButtonDialog>

      <BackButtonDialog open={clearDialogOpen} onClose={() => setClearDialogOpen(false)}>
        <DialogTitle>确认清理所有数据</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            此操作将删除所有知识库、文档和向量数据，且无法恢复。确定要继续吗？
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setClearDialogOpen(false)}>取消</Button>
          <Button onClick={handleClearAllData} color="error" disabled={loading} variant="contained">
            {loading ? <CircularProgress size={20} /> : '确认清理'}
          </Button>
        </DialogActions>
      </BackButtonDialog>
    </PageContainer>
  );
};

export default KnowledgeSettings;