/**
 * 记忆设置页面
 * 管理长期记忆系统的配置和记忆列表
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Button,
  Switch,
  TextField,
  IconButton,
  Paper,
  Chip,
  CircularProgress,
  Alert,
  FormControl,
  Select,
  MenuItem,
} from '@mui/material';
import {
  Plus,
  Trash2,
  Edit3,
  Search,
  RefreshCw,
  Brain,
  Users,
  Settings,
  AlertTriangle,
} from 'lucide-react';
import { styled } from '@mui/material/styles';
import { useNavigate } from 'react-router-dom';
import { useTheme, useMediaQuery } from '@mui/material';
import { useAppDispatch, useAppSelector } from '../../shared/store';
import {
  selectMemoryConfig,
  selectCurrentAssistantId,
  selectGlobalMemoryEnabled,
  setCurrentAssistantId,
  setGlobalMemoryEnabled,
  patchMemoryConfig,
} from '../../shared/store/slices/memorySlice';
import { selectProviders } from '../../shared/store/selectors/settingsSelectors';
import type { Model, MemoryConfig } from '../../shared/types';
import { useSelector } from 'react-redux';
import { memoryService } from '../../shared/services/memory/MemoryService';
import { getEmbeddingDimensions, EMBEDDING_MODELS } from '../../shared/config/embeddingModels';
import type { MemoryItem } from '../../shared/types/memory';
import { dexieStorage } from '../../shared/services/storage/DexieStorageService';
import { SafeAreaContainer, HeaderBar, Container } from '../../components/settings/SettingComponents';
import { AddMemoryDialog, EditMemoryDialog, ModelConfigDialog, PromptEditDialog } from './MemorySettings/';
import { toastManager } from '../../components/EnhancedToast';

// ========================================================================
// 样式组件
// ========================================================================

const Section = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(2),
  marginBottom: theme.spacing(2),
  borderRadius: Number(theme.shape.borderRadius) * 2,
}));

const SectionTitle = styled(Typography)(({ theme }) => ({
  fontWeight: 600,
  marginBottom: theme.spacing(1.5),
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1),
}));

const MemoryCard = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(1.5),
  marginBottom: theme.spacing(1),
  borderRadius: theme.shape.borderRadius,
  backgroundColor: theme.palette.mode === 'dark' 
    ? 'rgba(255,255,255,0.05)' 
    : 'rgba(0,0,0,0.02)',
}));

const StatsCard = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1),
  padding: theme.spacing(1.5),
  borderRadius: theme.shape.borderRadius,
  backgroundColor: theme.palette.primary.main + '15',
}));

// ========================================================================
// 主组件
// ========================================================================

const MemorySettings: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();

  // Redux 状态
  const memoryConfig = useAppSelector(selectMemoryConfig);
  const currentAssistantId = useAppSelector(selectCurrentAssistantId);
  const globalMemoryEnabled = useAppSelector(selectGlobalMemoryEnabled);

  // 本地状态
  const [memories, setMemories] = useState<MemoryItem[]>([]);
  const [assistants, setAssistants] = useState<{id: string; name: string; memoryEnabled?: boolean}[]>([]);
  const [currentAssistantMemoryEnabled, setCurrentAssistantMemoryEnabled] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingMemory, setEditingMemory] = useState<MemoryItem | null>(null);
  const [newMemoryText, setNewMemoryText] = useState('');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [loadingMemories, setLoadingMemories] = useState(false);
  const [stats, setStats] = useState({ total: 0, assistants: 0 });
  const [showConfigDialog, setShowConfigDialog] = useState(false);
  const [showPromptDialog, setShowPromptDialog] = useState(false);
  const [selectedLLMModel, setSelectedLLMModel] = useState<Model | null>(memoryConfig.llmModel || null);
  const [selectedEmbeddingModel, setSelectedEmbeddingModel] = useState<Model | null>(memoryConfig.embeddingModel || null);
  const [embeddingDimensions, setEmbeddingDimensions] = useState<number>(memoryConfig.embeddingDimensions || 1536);

  // 获取提供商和主题
  const providers = useSelector(selectProviders);
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));
  const themeMode = theme.palette.mode;

  // LLM 模型选择器状态
  const [llmMenuOpen, setLlmMenuOpen] = useState(false);
  // 嵌入模型选择器状态
  const [embeddingMenuOpen, setEmbeddingMenuOpen] = useState(false);

  // 从 providers 中提取所有启用的模型（与 useModelSelection 保持一致）
  const models = React.useMemo(() => {
    const allModels: Model[] = [];
    if (providers) {
      providers.forEach(provider => {
        if (provider.isEnabled && provider.models) {
          provider.models.forEach((model: Model) => {
            if (model.enabled) {
              allModels.push({
                ...model,
                apiKey: model.apiKey || provider.apiKey,
                baseUrl: model.baseUrl || provider.baseUrl,
                providerType: model.providerType || provider.providerType || provider.id,
              });
            }
          });
        }
      });
    }
    return allModels;
  }, [providers]);

  // 加载记忆列表
  const loadMemories = useCallback(async () => {
    setLoadingMemories(true);
    try {
      const result = await memoryService.list({ assistantId: currentAssistantId, limit: 100 });
      setMemories(result.memories);
      setStats(prev => ({ ...prev, total: result.count }));
    } catch (error) {
      console.error('[MemorySettings] 加载记忆失败:', error);
      toastManager.error('加载记忆失败');
    } finally {
      setLoadingMemories(false);
    }
  }, [currentAssistantId]);

  // 加载助手列表
  const loadAssistants = useCallback(async () => {
    try {
      const allAssistants = await dexieStorage.getAllAssistants();
      const assistantList = allAssistants.map(a => ({ id: a.id, name: a.name, memoryEnabled: a.memoryEnabled }));
      const finalList = assistantList.length > 0 ? assistantList : [{ id: 'default', name: '默认助手', memoryEnabled: false }];
      setAssistants(finalList);
      setStats(prev => ({ ...prev, assistants: finalList.length }));
      
      // 迁移旧记忆：将 'default-user' 的记忆迁移到第一个助手
      if (finalList.length > 0 && finalList[0].id !== 'default') {
        const allMemories = await dexieStorage.memories.toArray();
        const oldMemories = allMemories.filter(m => m.userId === 'default-user' && !m.isDeleted);
        if (oldMemories.length > 0) {
          console.log(`[MemorySettings] 迁移 ${oldMemories.length} 条旧记忆到助手 ${finalList[0].id}`);
          for (const memory of oldMemories) {
            await dexieStorage.memories.update(memory.id, { userId: finalList[0].id });
          }
          // 绕过 MemoryService 直接改了库，需失效其记忆缓存
          memoryService.invalidateMemoryCache();
        }
      }
      
      // 如果当前选中的助手不在列表中，自动选择第一个
      if (!currentAssistantId || !finalList.find(a => a.id === currentAssistantId)) {
        dispatch(setCurrentAssistantId(finalList[0].id));
        setCurrentAssistantMemoryEnabled(finalList[0].memoryEnabled || false);
      } else {
        // 更新当前助手的记忆开关状态
        const currentAst = finalList.find(a => a.id === currentAssistantId);
        setCurrentAssistantMemoryEnabled(currentAst?.memoryEnabled || false);
      }
    } catch (error) {
      console.error('[MemorySettings] 加载助手列表失败:', error);
    }
  }, [currentAssistantId, dispatch]);

  // 初始化
  useEffect(() => {
    loadMemories();
    loadAssistants();
  }, [loadMemories, loadAssistants]);

  // 搜索记忆
  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      loadMemories();
      return;
    }

    setLoadingMemories(true);
    try {
      const result = await memoryService.textSearch(searchQuery, { assistantId: currentAssistantId });
      setMemories(result.memories);
    } catch (error) {
      console.error('[MemorySettings] 搜索失败:', error);
    } finally {
      setLoadingMemories(false);
    }
  };

  // 添加记忆
  const handleAddMemory = async () => {
    if (!newMemoryText.trim()) return;

    try {
      const memory = await memoryService.add(newMemoryText, {
        assistantId: currentAssistantId,
        metadata: { source: 'manual' },
      });

      if (memory) {
        toastManager.success('记忆已添加');
        setNewMemoryText('');
        setShowAddDialog(false);
        loadMemories();
      }
    } catch (error) {
      console.error('[MemorySettings] 添加记忆失败:', error);
      toastManager.error('添加记忆失败');
    }
  };

  // 更新记忆
  const handleUpdateMemory = async () => {
    if (!editingMemory || !newMemoryText.trim()) return;

    try {
      const updated = await memoryService.update(editingMemory.id, newMemoryText);
      if (updated) {
        toastManager.success('记忆已更新');
        setEditingMemory(null);
        setNewMemoryText('');
        setShowEditDialog(false);
        loadMemories();
      }
    } catch (error) {
      console.error('[MemorySettings] 更新记忆失败:', error);
      toastManager.error('更新记忆失败');
    }
  };

  // 删除记忆
  const handleDeleteMemory = async (id: string) => {
    try {
      const deleted = await memoryService.delete(id);
      if (deleted) {
        toastManager.success('记忆已删除');
        loadMemories();
      }
    } catch (error) {
      console.error('[MemorySettings] 删除记忆失败:', error);
      toastManager.error('删除记忆失败');
    }
  };

  // 清空所有记忆
  const handleClearAllMemories = async () => {
    try {
      await memoryService.deleteAllMemoriesForAssistant(currentAssistantId);
      toastManager.success('已清空所有记忆');
      loadMemories();
    } catch (error) {
      console.error('[MemorySettings] 清空记忆失败:', error);
      toastManager.error('清空记忆失败');
    }
  };

  // 切换助手
  const handleAssistantChange = (assistantId: string) => {
    dispatch(setCurrentAssistantId(assistantId));
    // 更新当前助手的记忆开关状态
    const assistant = assistants.find(a => a.id === assistantId);
    setCurrentAssistantMemoryEnabled(assistant?.memoryEnabled || false);
  };

  // 切换助手记忆开关
  const handleAssistantMemoryToggle = async (enabled: boolean) => {
    if (!currentAssistantId || currentAssistantId === 'default') return;
    
    try {
      const assistant = await dexieStorage.getAssistant(currentAssistantId);
      if (assistant) {
        const updatedAssistant = { ...assistant, memoryEnabled: enabled };
        await dexieStorage.saveAssistant(updatedAssistant);
        setCurrentAssistantMemoryEnabled(enabled);
        // 更新本地列表
        setAssistants(prev => prev.map(a => 
          a.id === currentAssistantId ? { ...a, memoryEnabled: enabled } : a
        ));
        toastManager.success(enabled ? '已开启助手记忆功能' : '已关闭助手记忆功能');
      }
    } catch (error) {
      console.error('[MemorySettings] 切换助手记忆失败:', error);
      toastManager.error('切换助手记忆失败');
    }
  };

  // 切换全局开关
  const handleToggleEnabled = (enabled: boolean) => {
    if (enabled && !memoryConfig.llmModel) {
      // 如果开启但未配置模型，打开配置对话框
      setShowConfigDialog(true);
    }
    dispatch(setGlobalMemoryEnabled(enabled));
  };

  // 保存模型配置
  const handleSaveConfig = () => {
    const config: Partial<MemoryConfig> = {
      llmModel: selectedLLMModel || undefined,
      embeddingModel: selectedEmbeddingModel || undefined,
      embeddingDimensions: embeddingDimensions,
    };
    dispatch(patchMemoryConfig(config));

    toastManager.success('配置已保存');
    setShowConfigDialog(false);
  };

  // 检测嵌入维度 - 使用项目中的嵌入模型配置
  const handleDetectDimensions = async () => {
    if (!selectedEmbeddingModel) {
      toastManager.warning('请先选择嵌入模型');
      return;
    }
    
    const modelId = selectedEmbeddingModel.id;
    
    // 1. 首先尝试从配置表中精确匹配
    const dimensions = getEmbeddingDimensions(modelId);
    
    // 2. 如果没找到精确匹配，尝试模糊匹配
    if (dimensions === 1536) {
      // 1536 是默认值，可能没找到，尝试模糊匹配
      const lowerModelId = modelId.toLowerCase();
      const matchedModel = EMBEDDING_MODELS.find(m => 
        lowerModelId.includes(m.id.toLowerCase()) || 
        m.id.toLowerCase().includes(lowerModelId)
      );
      if (matchedModel) {
        setEmbeddingDimensions(matchedModel.dimensions);
        toastManager.success(`已检测维度: ${matchedModel.dimensions}`);
        return;
      }
    }
    
    setEmbeddingDimensions(dimensions);
    toastManager.success(`已检测维度: ${dimensions}`);
  };

  // 返回
  const handleBack = () => {
    navigate('/settings');
  };

  return (
    <SafeAreaContainer>
      <HeaderBar title="记忆设置" onBackPress={handleBack} />
      
      <Container sx={{ overflow: 'auto', pb: 4 }}>
        {/* 全局开关 */}
        <Section elevation={0}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Box>
              <SectionTitle variant="subtitle1">
                <Brain size={20} />
                启用记忆功能
              </SectionTitle>
              <Typography variant="body2" color="text.secondary">
                开启后，AI 将自动记住对话中的重要信息
              </Typography>
            </Box>
            <Switch
              checked={globalMemoryEnabled}
              onChange={(e) => handleToggleEnabled(e.target.checked)}
              color="primary"
            />
          </Box>
        </Section>

        {/* 警告：未配置模型 */}
        {globalMemoryEnabled && !memoryConfig.llmModel && (
          <Alert 
            severity="warning" 
            sx={{ mb: 2 }} 
            icon={<AlertTriangle size={20} />}
            action={
              <Button color="inherit" size="small" onClick={() => setShowConfigDialog(true)}>
                配置
              </Button>
            }
          >
            记忆功能需要配置 LLM 模型和嵌入模型才能正常工作。
          </Alert>
        )}

        {/* 模型配置 */}
        <Section elevation={0}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Box>
              <SectionTitle variant="subtitle1">
                <Settings size={20} />
                模型配置
              </SectionTitle>
              <Typography variant="body2" color="text.secondary">
                {memoryConfig.llmModel ? `LLM: ${memoryConfig.llmModel.name || memoryConfig.llmModel.id}` : 'LLM: 未配置'}
                {' | '}
                {memoryConfig.embeddingModel ? `嵌入: ${memoryConfig.embeddingModel.name || memoryConfig.embeddingModel.id}` : '嵌入: 未配置'}
              </Typography>
            </Box>
            <Button
              variant="outlined"
              size="small"
              onClick={() => setShowConfigDialog(true)}
            >
              配置
            </Button>
          </Box>
        </Section>

        {/* 记忆方式控制 */}
        {globalMemoryEnabled && (
          <Section elevation={0}>
            <SectionTitle variant="subtitle1">
              <Brain size={20} />
              记忆方式
            </SectionTitle>
            
            {/* 记忆工具方式 */}
            <Box sx={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between',
              p: 1.5,
              mb: 1,
              borderRadius: 1,
              backgroundColor: (theme) => theme.palette.mode === 'dark' 
                ? 'rgba(255,255,255,0.05)' 
                : 'rgba(0,0,0,0.02)'
            }}>
              <Box>
                <Typography variant="body2" fontWeight="medium">记忆工具（推荐）</Typography>
                <Typography variant="caption" color="text.secondary">
                  AI 自主判断何时记忆，通过工具调用保存，节省成本
                </Typography>
              </Box>
              <Switch
                checked={memoryConfig.memoryToolEnabled || false}
                onChange={(e) => dispatch(patchMemoryConfig({ memoryToolEnabled: e.target.checked }))}
                color="primary"
              />
            </Box>
            
            {/* 自动分析方式 */}
            <Box sx={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between',
              p: 1.5,
              borderRadius: 1,
              backgroundColor: (theme) => theme.palette.mode === 'dark' 
                ? 'rgba(255,255,255,0.05)' 
                : 'rgba(0,0,0,0.02)'
            }}>
              <Box>
                <Typography variant="body2" fontWeight="medium">自动分析</Typography>
                <Typography variant="caption" color="text.secondary">
                  每次对话后 LLM 自动分析提取事实，会增加 API 成本
                </Typography>
              </Box>
              <Switch
                checked={memoryConfig.autoAnalyzeEnabled || false}
                onChange={(e) => dispatch(patchMemoryConfig({ autoAnalyzeEnabled: e.target.checked }))}
                color="primary"
              />
            </Box>
            
            {/* 自定义提示词按钮 */}
            {memoryConfig.autoAnalyzeEnabled && (
              <Box sx={{ mt: 1, display: 'flex', justifyContent: 'flex-end' }}>
                <Button
                  size="small"
                  variant="text"
                  onClick={() => setShowPromptDialog(true)}
                >
                  自定义提示词
                </Button>
              </Box>
            )}
          </Section>
        )}

        {/* 统计信息 */}
        <Section elevation={0}>
          <SectionTitle variant="subtitle1">
            <Settings size={20} />
            统计信息
          </SectionTitle>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <StatsCard>
              <Brain size={18} />
              <Typography variant="body2">
                <strong>{stats.total}</strong> 条记忆
              </Typography>
            </StatsCard>
            <StatsCard>
              <Users size={18} />
              <Typography variant="body2">
                <strong>{stats.assistants}</strong> 个助手
              </Typography>
            </StatsCard>
          </Box>
        </Section>

        {/* 助手选择 */}
        <Section elevation={0}>
          <SectionTitle variant="subtitle1">
            <Users size={20} />
            当前助手
          </SectionTitle>
          <FormControl fullWidth size="small">
            <Select
              value={assistants.length > 0 ? (currentAssistantId || '') : ''}
              onChange={(e) => handleAssistantChange(e.target.value)}
              displayEmpty
            >
              {assistants.length === 0 ? (
                <MenuItem value="">
                  加载中...
                </MenuItem>
              ) : (
                assistants.map((assistant) => (
                  <MenuItem key={assistant.id} value={assistant.id}>
                    {assistant.name}
                  </MenuItem>
                ))
              )}
            </Select>
          </FormControl>
          
          {/* 助手记忆开关 */}
          {currentAssistantId && currentAssistantId !== 'default' && (
            <Box sx={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between',
              mt: 2,
              p: 1.5,
              borderRadius: 1,
              backgroundColor: (theme) => theme.palette.mode === 'dark' 
                ? 'rgba(255,255,255,0.05)' 
                : 'rgba(0,0,0,0.02)'
            }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Brain size={18} />
                <Box>
                  <Typography variant="body2">启用此助手的记忆功能</Typography>
                  <Typography variant="caption" color="text.secondary">
                    开启后，此助手会记住与你的对话内容
                  </Typography>
                </Box>
              </Box>
              <Switch
                checked={currentAssistantMemoryEnabled}
                onChange={(e) => handleAssistantMemoryToggle(e.target.checked)}
                color="primary"
              />
            </Box>
          )}
        </Section>

        {/* 搜索和操作栏 */}
        <Section elevation={0}>
          <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
            <TextField
              fullWidth
              size="small"
              placeholder="搜索记忆..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              InputProps={{
                startAdornment: <Search size={18} style={{ marginRight: 8, opacity: 0.5 }} />,
              }}
            />
            <IconButton onClick={handleSearch} size="small">
              <Search size={18} />
            </IconButton>
            <IconButton onClick={loadMemories} size="small">
              <RefreshCw size={18} />
            </IconButton>
          </Box>

          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              variant="contained"
              size="small"
              startIcon={<Plus size={16} />}
              onClick={() => {
                setNewMemoryText('');
                setShowAddDialog(true);
              }}
            >
              添加记忆
            </Button>
            <Button
              variant="outlined"
              size="small"
              color="error"
              startIcon={<Trash2 size={16} />}
              onClick={handleClearAllMemories}
            >
              清空全部
            </Button>
          </Box>
        </Section>

        {/* 记忆列表 */}
        <Section elevation={0}>
          <SectionTitle variant="subtitle1">
            <Brain size={20} />
            记忆列表 ({memories.length})
          </SectionTitle>

          {loadingMemories ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress size={24} />
            </Box>
          ) : memories.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
              暂无记忆
            </Typography>
          ) : (
            <Box>
              {memories.map((memory) => (
                <MemoryCard key={memory.id} elevation={0}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <Box sx={{ flex: 1, mr: 1 }}>
                      <Typography variant="body2">
                        {memory.memory}
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 0.5, mt: 1, flexWrap: 'wrap' }}>
                        {memory.metadata?.source && (
                          <Chip
                            label={memory.metadata.source === 'auto' ? '自动' : '手动'}
                            size="small"
                            variant="outlined"
                            sx={{ height: 20, fontSize: '0.7rem' }}
                          />
                        )}
                        {memory.score && (
                          <Chip
                            label={`相似度: ${(memory.score * 100).toFixed(0)}%`}
                            size="small"
                            color="primary"
                            variant="outlined"
                            sx={{ height: 20, fontSize: '0.7rem' }}
                          />
                        )}
                        <Typography variant="caption" color="text.secondary">
                          {new Date(memory.createdAt).toLocaleDateString()}
                        </Typography>
                      </Box>
                    </Box>
                    <Box sx={{ display: 'flex', gap: 0.5 }}>
                      <IconButton
                        size="small"
                        onClick={() => {
                          setEditingMemory(memory);
                          setNewMemoryText(memory.memory);
                          setShowEditDialog(true);
                        }}
                      >
                        <Edit3 size={16} />
                      </IconButton>
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => handleDeleteMemory(memory.id)}
                      >
                        <Trash2 size={16} />
                      </IconButton>
                    </Box>
                  </Box>
                </MemoryCard>
              ))}
            </Box>
          )}
        </Section>
      </Container>

      {/* 添加记忆对话框 */}
      <AddMemoryDialog
        open={showAddDialog}
        onClose={() => setShowAddDialog(false)}
        memoryText={newMemoryText}
        onMemoryTextChange={setNewMemoryText}
        onAdd={handleAddMemory}
      />

      {/* 编辑记忆对话框 */}
      <EditMemoryDialog
        open={showEditDialog}
        onClose={() => setShowEditDialog(false)}
        memoryText={newMemoryText}
        onMemoryTextChange={setNewMemoryText}
        onSave={handleUpdateMemory}
      />

      {/* 模型配置对话框 */}
      <ModelConfigDialog
        open={showConfigDialog}
        onClose={() => setShowConfigDialog(false)}
        selectedLLMModel={selectedLLMModel}
        llmMenuOpen={llmMenuOpen}
        onLlmMenuOpen={() => setLlmMenuOpen(true)}
        onLlmMenuClose={() => setLlmMenuOpen(false)}
        onLlmModelSelect={(model) => {
          setSelectedLLMModel(model);
          setLlmMenuOpen(false);
        }}
        selectedEmbeddingModel={selectedEmbeddingModel}
        embeddingMenuOpen={embeddingMenuOpen}
        onEmbeddingMenuOpen={() => setEmbeddingMenuOpen(true)}
        onEmbeddingMenuClose={() => setEmbeddingMenuOpen(false)}
        onEmbeddingModelSelect={(model) => {
          setSelectedEmbeddingModel(model);
          setEmbeddingMenuOpen(false);
        }}
        embeddingDimensions={embeddingDimensions}
        onEmbeddingDimensionsChange={setEmbeddingDimensions}
        onDetectDimensions={handleDetectDimensions}
        models={models}
        providers={providers}
        themeMode={themeMode as 'light' | 'dark'}
        fullScreen={fullScreen}
        onSave={handleSaveConfig}
      />

      {/* 自定义提示词编辑对话框 */}
      <PromptEditDialog
        open={showPromptDialog}
        onClose={() => setShowPromptDialog(false)}
        currentPrompt={memoryConfig.customFactExtractionPrompt}
        onSave={(prompt) => {
          dispatch(patchMemoryConfig({ customFactExtractionPrompt: prompt }));
          toastManager.success('提示词已保存');
        }}
      />
    </SafeAreaContainer>
  );
};

export default MemorySettings;
