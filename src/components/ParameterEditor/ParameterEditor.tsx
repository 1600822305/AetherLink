/**
 * 简洁参数编辑器组件
 * 每个参数带启用开关，简洁列表布局
 */
import React, { useMemo, useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Slider,
  TextField,
  Select,
  MenuItem,
  FormControl,
  Chip,
  useTheme,
  alpha,
  Tooltip,
  IconButton,
  Button,
  Collapse
} from '@mui/material';
import { Code, Plus, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import CustomSwitch from '../CustomSwitch';
import type { ProviderType } from '../../shared/api/parameters/types';
import {
  getParametersForProvider,
  getReasoningEffortOptions,
  type ParameterMetadata
} from '../../shared/config/parameterMetadata';

/** 自定义参数类型 */
interface CustomParameter {
  key: string;
  value: string;
  enabled: boolean;
}

interface ParameterEditorProps {
  /** 供应商类型 */
  providerType: ProviderType;
  /** 当前模型 ID（用于按模型动态生成「推理努力程度」等选项） */
  modelId?: string;
  /** 当前参数值 */
  values: Record<string, any>;
  /** 已启用的参数 */
  enabledParams?: Record<string, boolean>;
  /** 参数变化回调 */
  onChange: (key: string, value: any) => void;
  /** 参数启用状态变化 */
  onToggle?: (key: string, enabled: boolean) => void;
  /** 是否紧凑模式 */
  compact?: boolean;
  /** 自定义参数 */
  customParams?: CustomParameter[];
  /** 自定义参数变化回调 */
  onCustomParamsChange?: (params: CustomParameter[]) => void;
}

/**
 * 单行参数项
 */
const ParameterRow: React.FC<{
  param: ParameterMetadata;
  value: any;
  enabled: boolean;
  onChange: (value: any) => void;
  onToggle: (enabled: boolean) => void;
}> = ({ param, value, enabled, onChange, onToggle }) => {
  const theme = useTheme();
  const [showKey, setShowKey] = useState(false);
  const currentValue = value ?? param.defaultValue;

  // 格式化显示值
  const formatValue = (val: any): string => {
    if (val === null || val === undefined) return '默认';
    if (typeof val === 'boolean') return val ? '开' : '关';
    if (typeof val === 'number') {
      if (param.unit === 'tokens' && val >= 1000) {
        return `${(val / 1000).toFixed(1)}K`;
      }
      return val.toString();
    }
    if (param.options) {
      const opt = param.options.find(o => o.value === val);
      return opt?.label || val;
    }
    return String(val);
  };

  // 渲染简洁的输入控件
  const renderCompactInput = () => {
    if (!enabled) return null;

    switch (param.inputType) {
      case 'slider':
        return (
          <Box sx={{ width: '100%', mt: 1, px: 1 }}>
            <Slider
              value={currentValue}
              onChange={(_, v) => onChange(v)}
              min={param.range?.min}
              max={param.range?.max}
              step={param.range?.step}
              size="small"
              valueLabelDisplay="auto"
            />
          </Box>
        );

      case 'number':
        return (
          <Box sx={{ width: '100%', mt: 1, px: 1 }}>
            <TextField
              type="number"
              value={currentValue ?? ''}
              onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
              size="small"
              fullWidth
              variant="outlined"
            />
          </Box>
        );

      case 'select': {
        // 当前值不在选项中时（如切换到仅支持 关闭/高/最高 的模型），回退到默认档位，避免空白下拉
        const optionValues = param.options?.map(o => o.value) ?? [];
        const selectValue = optionValues.includes(currentValue)
          ? currentValue
          : (optionValues.includes(param.defaultValue) ? param.defaultValue : (param.options?.[0]?.value ?? ''));
        return (
          <Box sx={{ width: '100%', mt: 1, px: 1 }}>
            <FormControl size="small" fullWidth>
              <Select
                value={selectValue}
                onChange={(e) => onChange(e.target.value)}
                variant="outlined"
              >
                {param.options?.map((opt) => (
                  <MenuItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
        );
      }

      case 'text':
        return (
          <Box sx={{ width: '100%', mt: 1, px: 1 }}>
            <TextField
              value={currentValue ?? ''}
              onChange={(e) => onChange(e.target.value)}
              size="small"
              fullWidth
              placeholder="输入..."
            />
          </Box>
        );

      default:
        return null;
    }
  };

  // Switch 类型特殊处理 - 左边启用开关+标签，右边显示状态
  if (param.inputType === 'switch') {
    return (
      <Box
        sx={{
          py: 1,
          px: 1.5,
          borderRadius: 1,
          bgcolor: currentValue ? alpha(theme.palette.primary.main, 0.04) : 'transparent',
          opacity: 1,
          transition: 'all 0.2s',
          '&:hover': {
            bgcolor: alpha(theme.palette.primary.main, 0.04)
          }
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <CustomSwitch
            checked={!!currentValue}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.checked)}
          />
          <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Typography 
              variant="body2" 
              sx={{ color: currentValue ? 'text.primary' : 'text.secondary' }}
            >
              {showKey ? param.key : param.label}
            </Typography>
            <Tooltip title={showKey ? '显示中文名' : `API: ${param.key}`} arrow>
              <IconButton 
                size="small" 
                onClick={() => setShowKey(!showKey)}
                sx={{ 
                  p: 0.25, 
                  opacity: showKey ? 1 : 0.4,
                  '&:hover': { opacity: 1 }
                }}
              >
                <Code size={12} />
              </IconButton>
            </Tooltip>
          </Box>
          <Typography 
            variant="caption" 
            color={currentValue ? 'primary' : 'text.secondary'}
            sx={{ fontWeight: currentValue ? 500 : 400 }}
          >
            {currentValue ? '开' : '关'}
          </Typography>
        </Box>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        py: 1,
        px: 1.5,
        borderRadius: 1,
        bgcolor: enabled ? alpha(theme.palette.primary.main, 0.04) : 'transparent',
        opacity: enabled ? 1 : 0.6,
        transition: 'all 0.2s'
      }}
    >
      {/* 主行：开关 + 名称 + 当前值 */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <CustomSwitch
          checked={enabled}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => onToggle(e.target.checked)}
        />
        <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Typography 
            variant="body2" 
            sx={{ color: enabled ? 'text.primary' : 'text.secondary' }}
          >
            {showKey ? param.key : param.label}
          </Typography>
          <Tooltip title={showKey ? '显示中文名' : `API: ${param.key}`} arrow>
            <IconButton 
              size="small" 
              onClick={() => setShowKey(!showKey)}
              sx={{ 
                p: 0.25, 
                opacity: showKey ? 1 : 0.4,
                '&:hover': { opacity: 1 }
              }}
            >
              <Code size={12} />
            </IconButton>
          </Tooltip>
        </Box>
        {/* 始终显示当前值 */}
        <Typography 
          variant="caption" 
          color={enabled ? 'primary' : 'text.secondary'}
          sx={{ fontWeight: enabled ? 500 : 400 }}
        >
          {formatValue(currentValue)}
        </Typography>
      </Box>
      
      {/* 所有输入控件单独一行显示 */}
      {enabled && renderCompactInput()}
    </Box>
  );
};

/**
 * 参数编辑器主组件
 */
const ParameterEditor: React.FC<ParameterEditorProps> = ({
  providerType,
  modelId,
  values: externalValues = {},
  enabledParams: externalEnabledParams = {},
  onChange,
  onToggle,
  customParams: externalCustomParams = [],
  onCustomParamsChange
}) => {
  const theme = useTheme();
  
  // 内部状态管理启用的参数
  const [internalEnabled, setInternalEnabled] = useState<Record<string, boolean>>(externalEnabledParams);
  // 内部状态管理参数值
  const [internalValues, setInternalValues] = useState<Record<string, any>>(externalValues);
  // 自定义参数状态
  const [customParams, setCustomParams] = useState<CustomParameter[]>(externalCustomParams);
  // 自定义参数面板展开状态
  const [customExpanded, setCustomExpanded] = useState(false);
  // 新参数输入
  const [newParamKey, setNewParamKey] = useState('');
  const [newParamValue, setNewParamValue] = useState('');

  // 同步外部状态变化
  useEffect(() => {
    setInternalEnabled(externalEnabledParams);
  }, [externalEnabledParams]);
  
  useEffect(() => {
    setInternalValues(externalValues);
  }, [externalValues]);

  // 获取所有参数（按模型动态覆盖推理努力程度的可选项）
  const allParams = useMemo(() => {
    const params = getParametersForProvider(providerType);
    const reasoningEffortOptions = getReasoningEffortOptions(modelId);
    return params.map(param => {
      if (param.key !== 'reasoningEffort') return param;
      // 若全局默认值（medium）不在当前模型的档位中，回退到首个非「关闭/默认」档位，
      // 避免下拉出现空白（例如 DeepSeek V4 仅有 关闭/高/最高）。
      const hasGlobalDefault = reasoningEffortOptions.some(o => o.value === param.defaultValue);
      const fallbackDefault =
        reasoningEffortOptions.find(o => o.value !== 'none' && o.value !== 'default')?.value ??
        reasoningEffortOptions[0]?.value ??
        param.defaultValue;
      return {
        ...param,
        options: reasoningEffortOptions,
        defaultValue: hasGlobalDefault ? param.defaultValue : fallbackDefault
      };
    });
  }, [providerType, modelId]);
  
  // 处理开关切换
  const handleToggle = (key: string, enabled: boolean) => {
    setInternalEnabled(prev => ({ ...prev, [key]: enabled }));
    onToggle?.(key, enabled);
  };
  
  // 处理值变化
  const handleValueChange = (key: string, value: any) => {
    setInternalValues(prev => ({ ...prev, [key]: value }));
    onChange(key, value);
  };

  // 检查参数是否应该显示（基于 showWhen 条件）
  const shouldShowParam = useCallback((param: ParameterMetadata): boolean => {
    if (!param.showWhen) return true;
    
    const { key, value } = param.showWhen;
    const currentValue = internalValues[key];
    
    // value 可以是数组或单个值
    if (Array.isArray(value)) {
      return value.includes(currentValue);
    }
    return currentValue === value;
  }, [internalValues]);

  // 按分类分组（过滤掉不满足 showWhen 条件的参数）
  const groupedParams = useMemo(() => {
    const groups: Record<string, ParameterMetadata[]> = {
      basic: [],
      advanced: [],
      reasoning: [],
      tools: []
    };
    allParams.forEach(p => {
      if (groups[p.category] && shouldShowParam(p)) {
        groups[p.category].push(p);
      }
    });
    return groups;
  }, [allParams, shouldShowParam]);

  // 分类名称
  const categoryNames: Record<string, string> = {
    basic: '基础',
    advanced: '高级',
    reasoning: '推理',
    tools: '工具'
  };

  // 供应商名称
  const providerNames: Record<ProviderType, string> = {
    openai: 'OpenAI',
    anthropic: 'Claude',
    gemini: 'Gemini',
    'openai-compatible': '兼容API'
  };

  return (
    <Box>
      {/* 供应商标识 */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <Chip 
          label={providerNames[providerType]} 
          size="small" 
          color="primary"
          variant="filled"
        />
        <Typography variant="caption" color="text.secondary">
          {allParams.length} 个可用参数
        </Typography>
      </Box>

      {/* 参数列表 */}
      {Object.entries(groupedParams).map(([category, params]) => {
        if (params.length === 0) return null;
        
        return (
          <Box key={category} sx={{ mb: 2 }}>
            <Typography 
              variant="caption" 
              color="text.secondary"
              sx={{ 
                display: 'block', 
                mb: 0.5, 
                px: 1.5,
                fontWeight: 500,
                textTransform: 'uppercase',
                letterSpacing: 0.5
              }}
            >
              {categoryNames[category]}
            </Typography>
            <Box sx={{ 
              border: `1px solid ${theme.palette.divider}`,
              borderRadius: 1,
              overflow: 'hidden'
            }}>
              {params.map((param, idx) => (
                <Box 
                  key={param.key}
                  sx={{
                    borderBottom: idx < params.length - 1 
                      ? `1px solid ${theme.palette.divider}` 
                      : 'none'
                  }}
                >
                  <ParameterRow
                    param={param}
                    value={internalValues[param.key]}
                    enabled={internalEnabled[param.key] ?? false}
                    onChange={(v) => handleValueChange(param.key, v)}
                    onToggle={(e) => handleToggle(param.key, e)}
                  />
                </Box>
              ))}
            </Box>
          </Box>
        );
      })}

      {allParams.length === 0 && (
        <Typography 
          variant="body2" 
          color="text.secondary" 
          sx={{ textAlign: 'center', py: 4 }}
        >
          无可配置参数
        </Typography>
      )}

      {/* 自定义参数区域 */}
      <Box sx={{ mt: 2 }}>
        <Box 
          sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 1, 
            cursor: 'pointer',
            py: 0.5,
            px: 1.5
          }}
          onClick={() => setCustomExpanded(!customExpanded)}
        >
          <Typography 
            variant="caption" 
            color="text.secondary"
            sx={{ fontWeight: 500, textTransform: 'uppercase', letterSpacing: 0.5 }}
          >
            自定义参数
          </Typography>
          <Chip 
            label={customParams.length} 
            size="small" 
            sx={{ height: 16, fontSize: '0.65rem' }}
          />
          <Box sx={{ flex: 1 }} />
          <IconButton size="small" sx={{ p: 0.25 }}>
            {customExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </IconButton>
        </Box>
        
        <Collapse in={customExpanded}>
          <Box sx={{ 
            border: `1px solid ${theme.palette.divider}`,
            borderRadius: 1,
            overflow: 'hidden',
            mt: 0.5
          }}>
            {/* 已有的自定义参数列表 */}
            {customParams.map((param, idx) => (
              <Box 
                key={idx}
                sx={{
                  py: 1,
                  px: 1.5,
                  borderBottom: `1px solid ${theme.palette.divider}`,
                  bgcolor: param.enabled ? alpha(theme.palette.primary.main, 0.04) : 'transparent'
                }}
              >
                {/* 第一行：开关 + 参数名 + 删除按钮 */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                  <CustomSwitch
                    checked={param.enabled}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                      const updated = [...customParams];
                      updated[idx] = { ...param, enabled: e.target.checked };
                      setCustomParams(updated);
                      onCustomParamsChange?.(updated);
                    }}
                  />
                  <TextField
                    size="small"
                    value={param.key}
                    onChange={(e) => {
                      const updated = [...customParams];
                      updated[idx] = { ...param, key: e.target.value };
                      setCustomParams(updated);
                      onCustomParamsChange?.(updated);
                    }}
                    placeholder="参数名 (如: custom_param)"
                    sx={{ flex: 1 }}
                    InputProps={{ sx: { fontSize: '0.85rem' } }}
                  />
                  <IconButton 
                    size="small"
                    onClick={() => {
                      const updated = customParams.filter((_, i) => i !== idx);
                      setCustomParams(updated);
                      onCustomParamsChange?.(updated);
                    }}
                    sx={{ color: 'error.main' }}
                  >
                    <Trash2 size={14} />
                  </IconButton>
                </Box>
                {/* 第二行：值 */}
                <Box sx={{ pl: 5 }}>
                  <TextField
                    size="small"
                    fullWidth
                    value={param.value}
                    onChange={(e) => {
                      const updated = [...customParams];
                      updated[idx] = { ...param, value: e.target.value };
                      setCustomParams(updated);
                      onCustomParamsChange?.(updated);
                    }}
                    placeholder="值 (支持字符串、数字、JSON)"
                    InputProps={{ sx: { fontSize: '0.85rem' } }}
                  />
                </Box>
              </Box>
            ))}

            {/* 添加新参数 */}
            <Box sx={{ 
              py: 1, 
              px: 1.5,
              bgcolor: alpha(theme.palette.background.default, 0.5)
            }}>
              {/* 第一行：参数名 */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                <TextField
                  size="small"
                  fullWidth
                  value={newParamKey}
                  onChange={(e) => setNewParamKey(e.target.value)}
                  placeholder="参数名 (如: custom_param)"
                  InputProps={{ sx: { fontSize: '0.85rem' } }}
                />
              </Box>
              {/* 第二行：值 + 添加按钮 */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <TextField
                  size="small"
                  fullWidth
                  value={newParamValue}
                  onChange={(e) => setNewParamValue(e.target.value)}
                  placeholder="值 (支持字符串、数字、JSON)"
                  InputProps={{ sx: { fontSize: '0.85rem' } }}
                />
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<Plus size={14} />}
                  disabled={!newParamKey.trim()}
                  onClick={() => {
                    if (newParamKey.trim()) {
                      const newParam: CustomParameter = {
                        key: newParamKey.trim(),
                        value: newParamValue,
                        enabled: true
                      };
                      const updated = [...customParams, newParam];
                      setCustomParams(updated);
                      onCustomParamsChange?.(updated);
                      setNewParamKey('');
                      setNewParamValue('');
                    }
                  }}
                  sx={{ 
                    minWidth: 70,
                    px: 1.5, 
                    whiteSpace: 'nowrap',
                    flexShrink: 0
                  }}
                >
                  添加
                </Button>
              </Box>
            </Box>
          </Box>
        </Collapse>
      </Box>
    </Box>
  );
};

export { type CustomParameter };
export default ParameterEditor;
