/**
 * 设置 Tab：全局开关、模型配置、记忆方式、助手记忆、记忆整理
 */
import React from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  FormControl,
  MenuItem,
  Select,
  Switch,
} from '@mui/material';
import { AlertTriangle, Brain, Settings, Sparkles, Users } from 'lucide-react';
import { SectionCard, SettingRow } from './components';
import { DEFAULT_MAINTENANCE_INTERVAL_DAYS } from '../../../shared/services/memory/maintenance';
import type { MemoryConfig } from '../../../shared/types';
import type { AssistantOption } from './hooks';

interface ConfigTabProps {
  globalMemoryEnabled: boolean;
  memoryConfig: MemoryConfig;
  assistants: AssistantOption[];
  currentAssistantId: string;
  currentAssistantMemoryEnabled: boolean;
  maintenanceRunning: boolean;
  onToggleEnabled: (enabled: boolean) => void;
  onOpenModelConfig: () => void;
  onPatchConfig: (patch: Partial<MemoryConfig>) => void;
  onEditPrompt: () => void;
  onAssistantChange: (assistantId: string) => void;
  onToggleAssistantMemory: (enabled: boolean) => void;
  onPreviewMaintenance: () => void;
  onRunMaintenance: () => void;
}

const ConfigTab: React.FC<ConfigTabProps> = ({
  globalMemoryEnabled,
  memoryConfig,
  assistants,
  currentAssistantId,
  currentAssistantMemoryEnabled,
  maintenanceRunning,
  onToggleEnabled,
  onOpenModelConfig,
  onPatchConfig,
  onEditPrompt,
  onAssistantChange,
  onToggleAssistantMemory,
  onPreviewMaintenance,
  onRunMaintenance,
}) => (
  <>
    {/* 全局开关 */}
    <SectionCard
      icon={<Brain size={18} />}
      title="启用记忆功能"
      description="开启后，AI 将自动记住对话中的重要信息"
      action={
        <Switch
          checked={globalMemoryEnabled}
          onChange={(e) => onToggleEnabled(e.target.checked)}
          color="primary"
        />
      }
    />

    {/* 警告：未配置模型 */}
    {globalMemoryEnabled && !memoryConfig.llmModel && (
      <Alert
        severity="warning"
        icon={<AlertTriangle size={20} />}
        action={
          <Button color="inherit" size="small" onClick={onOpenModelConfig}>
            配置
          </Button>
        }
      >
        记忆功能需要配置 LLM 模型和嵌入模型才能正常工作。
      </Alert>
    )}

    {/* 模型配置 */}
    <SectionCard
      icon={<Settings size={18} />}
      title="模型配置"
      description={`LLM: ${memoryConfig.llmModel ? memoryConfig.llmModel.name || memoryConfig.llmModel.id : '未配置'} | 嵌入: ${memoryConfig.embeddingModel ? memoryConfig.embeddingModel.name || memoryConfig.embeddingModel.id : '未配置'}`}
      action={
        <Button variant="outlined" size="small" onClick={onOpenModelConfig}>
          配置
        </Button>
      }
    />

    {/* 记忆方式 */}
    {globalMemoryEnabled && (
      <SectionCard icon={<Brain size={18} />} title="记忆方式">
        <SettingRow
          title="记忆工具（推荐）"
          description="AI 自主判断何时记忆，通过工具调用保存，节省成本"
          divider
          control={
            <Switch
              checked={memoryConfig.memoryToolEnabled || false}
              onChange={(e) => onPatchConfig({ memoryToolEnabled: e.target.checked })}
              color="primary"
            />
          }
        />
        <SettingRow
          title="自动分析"
          description="每次对话后 LLM 自动分析提取事实，会增加 API 成本"
          control={
            <Switch
              checked={memoryConfig.autoAnalyzeEnabled || false}
              onChange={(e) => onPatchConfig({ autoAnalyzeEnabled: e.target.checked })}
              color="primary"
            />
          }
        />
        {memoryConfig.autoAnalyzeEnabled && (
          <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button size="small" variant="text" onClick={onEditPrompt}>
              自定义提示词
            </Button>
          </Box>
        )}
      </SectionCard>
    )}

    {/* 助手记忆 */}
    <SectionCard icon={<Users size={18} />} title="当前助手">
      <FormControl fullWidth size="small">
        <Select
          value={assistants.length > 0 ? (currentAssistantId || '') : ''}
          onChange={(e) => onAssistantChange(e.target.value)}
          displayEmpty
        >
          {assistants.length === 0 ? (
            <MenuItem value="">加载中...</MenuItem>
          ) : (
            assistants.map((assistant) => (
              <MenuItem key={assistant.id} value={assistant.id}>
                {assistant.name}
              </MenuItem>
            ))
          )}
        </Select>
      </FormControl>
      {currentAssistantId && currentAssistantId !== 'default' && (
        <SettingRow
          title="启用此助手的记忆功能"
          description="开启后，此助手会记住与你的对话内容"
          control={
            <Switch
              checked={currentAssistantMemoryEnabled}
              onChange={(e) => onToggleAssistantMemory(e.target.checked)}
              color="primary"
            />
          }
        />
      )}
    </SectionCard>

    {/* 记忆整理 */}
    <SectionCard
      icon={<Sparkles size={18} />}
      title="记忆整理"
      description={
        '清理过期的已删除记忆，并检测近重复记忆' +
        (memoryConfig.lastMaintenanceAt
          ? ` · 上次整理：${new Date(memoryConfig.lastMaintenanceAt).toLocaleDateString()}`
          : '')
      }
      action={
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button variant="outlined" size="small" disabled={maintenanceRunning} onClick={onPreviewMaintenance}>
            预览
          </Button>
          <Button
            variant="contained"
            size="small"
            disabled={maintenanceRunning}
            startIcon={maintenanceRunning ? <CircularProgress size={14} /> : <Sparkles size={16} />}
            onClick={onRunMaintenance}
          >
            立即整理
          </Button>
        </Box>
      }
    >
      <SettingRow
        title="自动整理"
        description={`每 ${memoryConfig.maintenanceIntervalDays ?? DEFAULT_MAINTENANCE_INTERVAL_DAYS} 天在应用空闲时自动执行一次整理`}
        divider
        control={
          <Switch
            checked={memoryConfig.autoMaintenanceEnabled || false}
            onChange={(e) => onPatchConfig({ autoMaintenanceEnabled: e.target.checked })}
            color="primary"
          />
        }
      />
      <SettingRow
        title="回顾提取"
        description="整理时回看近期话题的新消息，补提实时分析遗漏的记忆，会增加 API 成本"
        control={
          <Switch
            checked={memoryConfig.maintenanceHarvestEnabled ?? true}
            onChange={(e) => onPatchConfig({ maintenanceHarvestEnabled: e.target.checked })}
            color="primary"
          />
        }
      />
    </SectionCard>
  </>
);

export default ConfigTab;
