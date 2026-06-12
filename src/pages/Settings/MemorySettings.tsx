/**
 * 记忆设置页面
 * 管理长期记忆系统的配置和记忆列表
 */

import React, { useState } from 'react';
import { Tab, Tabs, useMediaQuery, useTheme } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../../shared/store';
import {
  selectMemoryConfig,
  selectCurrentAssistantId,
  selectGlobalMemoryEnabled,
  setGlobalMemoryEnabled,
  patchMemoryConfig,
} from '../../shared/store/slices/memorySlice';
import type { Model, MemoryConfig } from '../../shared/types';
import type { MemoryItem } from '../../shared/types/memory';
import { getEmbeddingDimensions, EMBEDDING_MODELS } from '../../shared/config/embeddingModels';
import { SafeAreaContainer, HeaderBar, Container } from '../../components/settings/SettingComponents';
import {
  AddMemoryDialog,
  EditMemoryDialog,
  ModelConfigDialog,
  PromptEditDialog,
  MaintenanceReportDialog,
  ConfirmClearDialog,
} from './MemorySettings/';
import LibraryTab from './MemorySettings/LibraryTab';
import ConfigTab from './MemorySettings/ConfigTab';
import { useMemoryLibrary, useAssistants, useMaintenance, useEnabledModels } from './MemorySettings/hooks';
import { toastManager } from '../../components/EnhancedToast';

const MemorySettings: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();

  const memoryConfig = useAppSelector(selectMemoryConfig);
  const currentAssistantId = useAppSelector(selectCurrentAssistantId);
  const globalMemoryEnabled = useAppSelector(selectGlobalMemoryEnabled);

  const [tab, setTab] = useState(0);

  // 数据逻辑
  const library = useMemoryLibrary(currentAssistantId);
  const { assistants, currentMemoryEnabled, changeAssistant, toggleMemoryEnabled } = useAssistants(currentAssistantId);
  const maintenance = useMaintenance(currentAssistantId, memoryConfig.maintenanceRetentionDays, memoryConfig.maintenanceHarvestEnabled, library.load);
  const { models, providers } = useEnabledModels();

  // 对话框状态
  const [editingMemory, setEditingMemory] = useState<MemoryItem | null>(null);
  const [memoryText, setMemoryText] = useState('');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showConfigDialog, setShowConfigDialog] = useState(false);
  const [showPromptDialog, setShowPromptDialog] = useState(false);
  const [showClearDialog, setShowClearDialog] = useState(false);

  // 模型配置状态
  const [selectedLLMModel, setSelectedLLMModel] = useState<Model | null>(memoryConfig.llmModel || null);
  const [selectedEmbeddingModel, setSelectedEmbeddingModel] = useState<Model | null>(memoryConfig.embeddingModel || null);
  const [embeddingDimensions, setEmbeddingDimensions] = useState<number>(memoryConfig.embeddingDimensions || 1536);
  const [llmMenuOpen, setLlmMenuOpen] = useState(false);
  const [embeddingMenuOpen, setEmbeddingMenuOpen] = useState(false);

  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));
  const themeMode = theme.palette.mode;

  const handleToggleEnabled = (enabled: boolean) => {
    if (enabled && !memoryConfig.llmModel) {
      setShowConfigDialog(true);
    }
    dispatch(setGlobalMemoryEnabled(enabled));
  };

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

  const currentAssistantName = assistants.find(a => a.id === currentAssistantId)?.name;

  return (
    <SafeAreaContainer>
      <HeaderBar title="记忆设置" onBackPress={() => navigate('/settings')} />

      <Tabs
        value={tab}
        onChange={(_, value) => setTab(value)}
        sx={{
          backgroundColor: 'background.paper',
          borderBottom: theme => `1px solid ${theme.palette.divider}`,
          minHeight: 44,
          '& .MuiTab-root': { minHeight: 44 },
        }}
      >
        <Tab label="记忆库" />
        <Tab label="设置" />
      </Tabs>

      <Container sx={{ overflow: 'auto', pb: 4, gap: 2 }}>
        {tab === 0 ? (
          <LibraryTab
            memories={library.memories}
            loading={library.loading}
            total={library.total}
            searchQuery={library.searchQuery}
            assistants={assistants}
            currentAssistantId={currentAssistantId}
            onSearchQueryChange={library.setSearchQuery}
            onSearch={library.search}
            onRefresh={library.load}
            onAssistantChange={changeAssistant}
            onAdd={() => {
              setMemoryText('');
              setShowAddDialog(true);
            }}
            onEdit={(memory) => {
              setEditingMemory(memory);
              setMemoryText(memory.memory);
              setShowEditDialog(true);
            }}
            onDelete={library.deleteMemory}
            onClearAll={() => setShowClearDialog(true)}
          />
        ) : (
          <ConfigTab
            globalMemoryEnabled={globalMemoryEnabled}
            memoryConfig={memoryConfig}
            assistants={assistants}
            currentAssistantId={currentAssistantId}
            currentAssistantMemoryEnabled={currentMemoryEnabled}
            maintenanceRunning={maintenance.running}
            onToggleEnabled={handleToggleEnabled}
            onOpenModelConfig={() => setShowConfigDialog(true)}
            onPatchConfig={(patch) => dispatch(patchMemoryConfig(patch))}
            onEditPrompt={() => setShowPromptDialog(true)}
            onAssistantChange={changeAssistant}
            onToggleAssistantMemory={toggleMemoryEnabled}
            onPreviewMaintenance={() => maintenance.run(true)}
            onRunMaintenance={() => maintenance.run(false)}
          />
        )}
      </Container>

      {/* 添加记忆对话框 */}
      <AddMemoryDialog
        open={showAddDialog}
        onClose={() => setShowAddDialog(false)}
        memoryText={memoryText}
        onMemoryTextChange={setMemoryText}
        onAdd={async () => {
          if (await library.addMemory(memoryText)) {
            setMemoryText('');
            setShowAddDialog(false);
          }
        }}
      />

      {/* 编辑记忆对话框 */}
      <EditMemoryDialog
        open={showEditDialog}
        onClose={() => setShowEditDialog(false)}
        memoryText={memoryText}
        onMemoryTextChange={setMemoryText}
        onSave={async () => {
          if (editingMemory && (await library.updateMemory(editingMemory.id, memoryText))) {
            setEditingMemory(null);
            setMemoryText('');
            setShowEditDialog(false);
          }
        }}
      />

      {/* 清空全部确认对话框 */}
      <ConfirmClearDialog
        open={showClearDialog}
        assistantName={currentAssistantName}
        onClose={() => setShowClearDialog(false)}
        onConfirm={() => {
          setShowClearDialog(false);
          library.clearAll();
        }}
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

      {/* 记忆整理报告对话框 */}
      <MaintenanceReportDialog
        open={maintenance.showReport}
        onClose={() => maintenance.setShowReport(false)}
        report={maintenance.report}
        onRunForReal={() => {
          maintenance.setShowReport(false);
          maintenance.run(false);
        }}
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
