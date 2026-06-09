/**
 * 动态上下文设置组件
 * 上下文窗口和消息数常驻，参数使用共享的 ParameterEditor 组件
 */
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Box,
  Typography,
  Slider,
  TextField,
  Collapse,
  IconButton,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Divider,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  Tooltip
} from '@mui/material';
import { ChevronDown, ChevronUp, Settings, X } from 'lucide-react';
import type { ThinkingOption } from '../../../shared/config/reasoningConfig';
import { collapsibleHeaderStyle } from './scrollOptimization';
import type { ProviderType } from '../../../shared/api/parameters/types';
import { detectProviderFromModel } from '../../../shared/config/parameterMetadata';
import ParameterEditor from '../../ParameterEditor/ParameterEditor';
import { parameterSyncService, PARAMETER_EVENT_MAP, type SyncableParameterKey } from '../../../shared/services/assistant/ParameterSyncService';

interface DynamicContextSettingsProps {
  /** 当前模型 ID */
  modelId?: string;
  /** 上下文窗口大小（Token数） */
  contextWindowSize: number;
  /** 上下文消息数 */
  contextCount: number;
  /** 最大输出 Token */
  maxOutputTokens: number;
  /** 是否启用最大输出 Token */
  enableMaxOutputTokens: boolean;
  /** 思维链长度 (保留接口兼容) */
  thinkingEffort?: ThinkingOption;
  /** 思考预算 */
  thinkingBudget: number;
  /** 扩展参数设置 (保留接口兼容) */
  extendedSettings?: Record<string, any>;
  
  // 回调函数
  onContextWindowSizeChange: (value: number) => void;
  onContextCountChange: (value: number) => void;
  onMaxOutputTokensChange: (value: number) => void;
  onEnableMaxOutputTokensChange: (value: boolean) => void;
  onThinkingEffortChange?: (value: ThinkingOption) => void;
  onThinkingBudgetChange: (value: number) => void;
  onExtendedSettingChange?: (key: string, value: any) => void;
}

/**
 * 动态上下文设置组件
 */
// 导入类型
import type { CustomParameter as EditorCustomParameter } from '../../ParameterEditor/ParameterEditor';
import type { CustomParameter as AssistantCustomParameter, CustomParameterType } from '../../../shared/types/Assistant';
export type { EditorCustomParameter as CustomParameter };

export default function DynamicContextSettings({
  modelId = 'gpt-4',
  contextWindowSize,
  contextCount,
  maxOutputTokens,
  onContextWindowSizeChange,
  onContextCountChange,
  onMaxOutputTokensChange,
  onEnableMaxOutputTokensChange
}: DynamicContextSettingsProps) {
  const [expanded, setExpanded] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  
  // 使用 useMemo 计算初始值，避免在 useState 初始化中调用 setState
  const initialData = useMemo(() => {
    const params = parameterSyncService.getCustomParameters();
    const types: Record<string, CustomParameterType> = {};
    params.forEach(p => {
      types[p.name] = p.type;
    });
    const editorParams = params.map(p => ({
      key: p.name,
      value: typeof p.value === 'object' ? JSON.stringify(p.value) : String(p.value),
      enabled: true
    }));
    return { types, editorParams };
  }, []);
  
  // 保存原始类型信息的映射
  const [typeMap, setTypeMap] = useState<Record<string, CustomParameterType>>(initialData.types);
  
  // 自定义参数状态
  const [customParams, setCustomParams] = useState<EditorCustomParameter[]>(initialData.editorParams);
  
  // 推断参数类型
  const inferType = useCallback((value: string, existingType?: CustomParameterType): CustomParameterType => {
    // 如果有现有类型，保留它
    if (existingType) return existingType;
    // 尝试推断类型
    if (value === 'true' || value === 'false') return 'boolean';
    if (!isNaN(Number(value)) && value.trim() !== '') return 'number';
    try {
      const parsed = JSON.parse(value);
      if (typeof parsed === 'object' && parsed !== null) return 'json';
    } catch { /* ignore parse errors */ }
    return 'string';
  }, []);
  
  // 处理自定义参数变化
  const handleCustomParamsChange = useCallback((params: EditorCustomParameter[]) => {
    setCustomParams(params);
    // 转换为 Assistant 格式并保存，保留类型信息
    const syncParams: AssistantCustomParameter[] = params.map(p => {
      const paramType = inferType(p.value, typeMap[p.key]);
      let parsedValue: string | number | boolean | object = p.value;
      
      // 根据类型转换值
      if (paramType === 'number') {
        parsedValue = Number(p.value);
      } else if (paramType === 'boolean') {
        parsedValue = p.value === 'true';
      } else if (paramType === 'json') {
        try {
          parsedValue = JSON.parse(p.value);
        } catch {
          parsedValue = p.value;
        }
      }
      
      // 更新类型映射
      setTypeMap(prev => ({ ...prev, [p.key]: paramType }));
      
      return {
        name: p.key,
        value: parsedValue,
        type: paramType
      };
    });
    parameterSyncService.setCustomParameters(syncParams);
  }, [typeMap, inferType]);
  
  // 检测供应商类型
  const providerType = useMemo(() => detectProviderFromModel(modelId), [modelId]);
  
  // 供应商名称
  const providerNames: Record<ProviderType, string> = {
    openai: 'OpenAI',
    anthropic: 'Claude',
    gemini: 'Gemini',
    'openai-compatible': '兼容 API'
  };

  // 参数配置列表（统一管理）
  const paramConfig = [
    { key: 'temperature', defaultValue: 0.7, defaultEnabled: false },
    { key: 'topP', defaultValue: 1.0, defaultEnabled: false },
    { key: 'maxOutputTokens', defaultValue: maxOutputTokens, defaultEnabled: true },
    { key: 'topK', defaultValue: 40, defaultEnabled: false },
    { key: 'frequencyPenalty', defaultValue: 0, defaultEnabled: false },
    { key: 'presencePenalty', defaultValue: 0, defaultEnabled: false },
    { key: 'seed', defaultValue: null, defaultEnabled: false },
    { key: 'stopSequences', defaultValue: '', defaultEnabled: false },
    { key: 'responseFormat', defaultValue: 'text', defaultEnabled: false },
    { key: 'parallelToolCalls', defaultValue: true, defaultEnabled: true },
    { key: 'user', defaultValue: '', defaultEnabled: false },
    { key: 'thinkingBudget', defaultValue: 1024, defaultEnabled: false },
    { key: 'reasoningEffort', defaultValue: 'medium', defaultEnabled: false },
    { key: 'streamOutput', defaultValue: true, defaultEnabled: true },
  ];

  // 参数值状态（从 parameterSyncService 加载）
  const [paramValues, setParamValues] = useState<Record<string, any>>(() => {
    const settings = parameterSyncService.getSettings();
    return Object.fromEntries(
      paramConfig.map(({ key, defaultValue }) => [key, settings[key] ?? defaultValue])
    );
  });

  // 参数启用状态
  const [enabledParams, setEnabledParams] = useState<Record<string, boolean>>(() => {
    const settings = parameterSyncService.getSettings();
    return Object.fromEntries(
      paramConfig.map(({ key, defaultEnabled }) => {
        const enableKey = `enable${key.charAt(0).toUpperCase()}${key.slice(1)}`;
        return [key, settings[enableKey] ?? defaultEnabled];
      })
    );
  });

  // 处理参数值变化
  const handleParamChange = useCallback((key: string, value: any) => {
    setParamValues(prev => ({ ...prev, [key]: value }));
    parameterSyncService.setParameter(key as SyncableParameterKey, value, enabledParams[key]);
    
    // 特殊处理 maxOutputTokens
    if (key === 'maxOutputTokens') {
      onMaxOutputTokensChange(value);
    }
  }, [enabledParams, onMaxOutputTokensChange]);

  // 处理参数启用状态变化
  const handleParamToggle = useCallback((key: string, enabled: boolean) => {
    setEnabledParams(prev => ({ ...prev, [key]: enabled }));
    parameterSyncService.setParameterEnabled(key as SyncableParameterKey, enabled);
    
    // 特殊处理 maxOutputTokens
    if (key === 'maxOutputTokens') {
      onEnableMaxOutputTokensChange(enabled);
    }
  }, [onEnableMaxOutputTokensChange]);

  // 监听外部参数变化（从其他组件同步过来）
  useEffect(() => {
    const handleParamChanged = (e: CustomEvent) => {
      const { key, value, enabled } = e.detail;
      if (key) {
        if (value !== undefined) {
          setParamValues(prev => ({ ...prev, [key]: value }));
        }
        if (enabled !== undefined) {
          setEnabledParams(prev => ({ ...prev, [key]: enabled }));
        }
      }
    };

    window.addEventListener('parameterChanged', handleParamChanged as EventListener);

    // 监听特定参数变化事件
    const eventHandlers: Array<[string, EventListener]> = [];
    Object.entries(PARAMETER_EVENT_MAP).forEach(([key, eventName]) => {
      const handler = ((e: CustomEvent) => {
        const { value, enabled } = e.detail;
        if (value !== undefined) {
          setParamValues(prev => ({ ...prev, [key]: value }));
        }
        if (enabled !== undefined) {
          setEnabledParams(prev => ({ ...prev, [key]: enabled }));
        }
      }) as EventListener;
      window.addEventListener(eventName, handler);
      eventHandlers.push([eventName, handler]);
    });

    return () => {
      window.removeEventListener('parameterChanged', handleParamChanged as EventListener);
      eventHandlers.forEach(([eventName, handler]) => {
        window.removeEventListener(eventName, handler);
      });
    };
  }, []);

  // 启动后异步加载持久化设置并回填状态
  // parameterSyncService.getSettings() 使用的是同步内存缓存，应用刚启动时
  // 缓存尚未从 Dexie 加载完成（返回空对象），导致非默认开启的参数（如推理努力程度）
  // 在初始化时被错误地重置为默认关闭状态。这里在缓存就绪后重新读取并同步 UI。
  useEffect(() => {
    let cancelled = false;
    parameterSyncService.getSettingsAsync().then((settings) => {
      if (cancelled) return;
      setParamValues(prev => {
        const next = { ...prev };
        paramConfig.forEach(({ key, defaultValue }) => {
          next[key] = settings[key] ?? defaultValue;
        });
        return next;
      });
      setEnabledParams(prev => {
        const next = { ...prev };
        paramConfig.forEach(({ key, defaultEnabled }) => {
          const enableKey = `enable${key.charAt(0).toUpperCase()}${key.slice(1)}`;
          next[key] = settings[enableKey] ?? defaultEnabled;
        });
        return next;
      });
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 处理上下文窗口大小变化
  const handleContextWindowSizeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value === '' || /^\d+$/.test(value)) {
      const numValue = value === '' ? 0 : parseInt(value);
      if (numValue >= 0 && numValue <= 2000000) {
        onContextWindowSizeChange(numValue);
      }
    }
  };

  // 处理上下文消息数变化
  const handleContextCountChange = (_event: Event, newValue: number | number[]) => {
    onContextCountChange(newValue as number);
  };

  return (
    <Box>
      {/* 可折叠的标题栏 */}
      <ListItem
        component="div"
        onClick={() => setExpanded(!expanded)}
        sx={collapsibleHeaderStyle(expanded)}
      >
        <ListItemText
          primary={
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <span>上下文设置</span>
              <Chip 
                label={providerNames[providerType]} 
                size="small" 
                variant="outlined"
                sx={{ height: 20, fontSize: '0.65rem' }}
              />
            </Box>
          }
          secondary={`窗口: ${contextWindowSize > 0 ? contextWindowSize.toLocaleString() : '自动'} | 输出: ${maxOutputTokens}`}
          primaryTypographyProps={{ fontWeight: 'medium', fontSize: '0.95rem', lineHeight: 1.2, component: 'div' }}
          secondaryTypographyProps={{ fontSize: '0.75rem', lineHeight: 1.2 }}
        />
        <ListItemSecondaryAction sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Tooltip title="参数编辑器" arrow>
            <IconButton 
              size="small" 
              sx={{ padding: '2px' }}
              onClick={(e) => {
                e.stopPropagation();
                setDialogOpen(true);
              }}
            >
              <Settings size={14} />
            </IconButton>
          </Tooltip>
          <IconButton edge="end" size="small" sx={{ padding: '2px' }}>
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </IconButton>
        </ListItemSecondaryAction>
      </ListItem>

      {/* 可折叠的内容区域 */}
      <Collapse
        in={expanded}
        timeout={{ enter: 300, exit: 200 }}
        easing={{ enter: 'cubic-bezier(0.4, 0, 0.2, 1)', exit: 'cubic-bezier(0.4, 0, 0.6, 1)' }}
        unmountOnExit
      >
        <Box sx={{ px: 2, pb: 2 }}>
          {/* 上下文窗口大小控制 */}
          <Box sx={{ mb: 3 }}>
            <Typography variant="body2" fontWeight="medium">
              上下文窗口大小
            </Typography>
            <Typography variant="caption" color="text.secondary">
              模型可以处理的总Token数
            </Typography>
            <TextField
              fullWidth
              size="small"
              type="text"
              value={contextWindowSize || ''}
              onChange={handleContextWindowSizeChange}
              placeholder="0 表示使用模型默认值"
              sx={{ mt: 1 }}
            />
          </Box>
          <Divider sx={{ my: 2 }} />

          {/* 上下文消息数量控制 */}
          <Box sx={{ mb: 3 }}>
            <Typography variant="body2" fontWeight="medium">
              上下文消息数: {contextCount === 100 ? '最大' : contextCount} 条
            </Typography>
            <Slider
              value={contextCount}
              onChange={handleContextCountChange}
              min={0}
              max={100}
              step={1}
              marks={[
                { value: 0, label: '0' },
                { value: 50, label: '50' },
                { value: 100, label: '最大' }
              ]}
            />
          </Box>
          <Divider sx={{ my: 2 }} />

          {/* 使用共享的 ParameterEditor 组件 */}
          <ParameterEditor
            providerType={providerType}
            values={paramValues}
            enabledParams={enabledParams}
            onChange={handleParamChange}
            onToggle={handleParamToggle}
            customParams={customParams}
            onCustomParamsChange={handleCustomParamsChange}
          />
        </Box>
      </Collapse>

      {/* 参数编辑器对话框 */}
      <Dialog 
        open={dialogOpen} 
        onClose={() => setDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: { maxHeight: '80vh' }
        }}
      >
        <DialogTitle sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          pb: 1
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Settings size={20} />
            <span>参数编辑器</span>
            <Chip 
              label={providerNames[providerType]} 
              size="small" 
              color="primary"
              sx={{ height: 20, fontSize: '0.65rem' }}
            />
          </Box>
          <IconButton size="small" onClick={() => setDialogOpen(false)}>
            <X size={18} />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers sx={{ p: 2 }}>
          <ParameterEditor
            providerType={providerType}
            values={paramValues}
            enabledParams={enabledParams}
            onChange={handleParamChange}
            onToggle={handleParamToggle}
            customParams={customParams}
            onCustomParamsChange={handleCustomParamsChange}
          />
        </DialogContent>
      </Dialog>
    </Box>
  );
}
