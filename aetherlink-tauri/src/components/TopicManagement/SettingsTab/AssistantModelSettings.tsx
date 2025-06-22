import React, { useState, useEffect } from 'react';
import {
  Box,
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  List,
  ListItem,

  Slider,
  Button,
  Divider,
  TextField,
  Alert,
  Chip,
  Avatar,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Switch,
  Card,
  CardContent,
  CardActions,
  Tabs,
  Tab,
  Paper,
  alpha
} from '@mui/material';
import CustomSwitch from '../../CustomSwitch';
import { ArrowLeft as ArrowBackIcon, Save as SaveIcon, RotateCcw as RestoreIcon, Plus as AddIcon, Trash2 as DeleteIcon, Sliders as TuneOutlinedIcon } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { updateAssistant } from '../../../shared/store/slices/assistantsSlice';
import { dexieStorage } from '../../../shared/services/storage/DexieStorageService';
import type { Assistant } from '../../../shared/types/Assistant';
import type { ThinkingOption } from '../../../shared/config/reasoningConfig';
import { getAppSettings, saveAppSettings } from '../../../shared/utils/settingsUtils';
// import ModelSelector from './ModelSelector';

// 自定义参数类型定义
export type CustomParameterType = 'string' | 'number' | 'boolean' | 'json';

// TabPanel组件
interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`model-settings-tabpanel-${index}`}
      aria-labelledby={`model-settings-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ p: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

export interface CustomParameter {
  name: string;
  value: string | number | boolean | object;
  type: CustomParameterType;
}

// 默认值常量
const DEFAULT_TEMPERATURE = 0.7;
const DEFAULT_TOP_P = 1.0;

/**
 * 助手模型设置页面
 */
const AssistantModelSettings: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch();

  // 从路由状态获取助手信息
  const assistant = location.state?.assistant as Assistant;

  // 本地状态
  const [temperature, setTemperature] = useState(DEFAULT_TEMPERATURE);
  const [topP, setTopP] = useState(DEFAULT_TOP_P);
  const [topK, setTopK] = useState(40);
  const [frequencyPenalty, setFrequencyPenalty] = useState(0);
  const [presencePenalty, setPresencePenalty] = useState(0);
  const [seed, setSeed] = useState<number | null>(null);
  const [stopSequences, setStopSequences] = useState<string[]>([]);
  const [maxTokens, setMaxTokens] = useState<number>(4096);

  // OpenAI 专属参数
  const [logitBias, setLogitBias] = useState<Record<string, number>>({});
  const [responseFormat, setResponseFormat] = useState<'text' | 'json_object'>('text');
  const [toolChoice, setToolChoice] = useState<'none' | 'auto' | 'required'>('auto');
  const [parallelToolCalls, setParallelToolCalls] = useState(true);

  // Gemini 专属参数
  const [responseModalities, setResponseModalities] = useState<string[]>(['TEXT']);
  const [candidateCount, setCandidateCount] = useState(1);
  const [enableSpeech, setEnableSpeech] = useState(false);
  const [speechLanguage, setSpeechLanguage] = useState('zh-CN');
  const [enableThinking, setEnableThinking] = useState(false);
  const [thinkingBudget, setThinkingBudget] = useState(0);
  const [mediaResolution, setMediaResolution] = useState<'low' | 'medium' | 'high'>('medium');

  const [selectedModel, setSelectedModel] = useState('');
  const [customParameters, setCustomParameters] = useState<CustomParameter[]>([]);
  const [hasChanges, setHasChanges] = useState(false);
  const [saving, setSaving] = useState(false);

  // 上下文设置状态
  const [contextLength, setContextLength] = useState(16000);
  const [contextCount, setContextCount] = useState(5);
  const [thinkingEffort, setThinkingEffort] = useState<ThinkingOption>('medium');

  // 最大输出Token开关状态
  const [enableMaxTokens, setEnableMaxTokens] = useState(true);

  // Tab状态管理
  const [currentTab, setCurrentTab] = useState(0);

  // 初始化上下文设置
  useEffect(() => {
    const loadContextSettings = async () => {
      const appSettings = getAppSettings();
      setContextLength(appSettings.contextLength || 16000);
      setContextCount(appSettings.contextCount || 5);
      setThinkingEffort(appSettings.defaultThinkingEffort || 'medium');
      // 同步maxOutputTokens到上下文设置
      if (appSettings.maxOutputTokens && appSettings.maxOutputTokens !== maxTokens) {
        setMaxTokens(appSettings.maxOutputTokens);
      }
      // 初始化最大输出Token开关状态
      setEnableMaxTokens(appSettings.enableMaxOutputTokens !== false);
    };
    loadContextSettings();

    // 监听localStorage变化，实现双向同步
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'appSettings' && e.newValue) {
        try {
          const newSettings = JSON.parse(e.newValue);
          if (newSettings.maxOutputTokens && newSettings.maxOutputTokens !== maxTokens) {
            setMaxTokens(newSettings.maxOutputTokens);
          }
        } catch (error) {
          console.error('解析localStorage变化失败:', error);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [maxTokens]);

  // 初始化助手数据
  useEffect(() => {
    if (assistant) {
      console.log('AssistantModelSettings: 初始化助手数据', {
        assistant,
        temperature: assistant?.temperature,
        topP: assistant?.topP,
        model: assistant?.model
      });

      // 从助手数据初始化表单状态
      setTemperature(assistant.temperature ?? DEFAULT_TEMPERATURE);
      setTopP(assistant.topP ?? DEFAULT_TOP_P);
      setTopK((assistant as any).topK ?? 40);
      setFrequencyPenalty((assistant as any).frequencyPenalty ?? 0);
      setPresencePenalty((assistant as any).presencePenalty ?? 0);
      setSeed((assistant as any).seed ?? null);
      setStopSequences((assistant as any).stopSequences ?? []);
      setMaxTokens(assistant.maxTokens ?? 4096);

      // OpenAI 专属参数初始化
      setLogitBias((assistant as any).logitBias ?? {});
      setResponseFormat((assistant as any).responseFormat ?? 'text');
      setToolChoice((assistant as any).toolChoice ?? 'auto');
      setParallelToolCalls((assistant as any).parallelToolCalls ?? true);

      // Gemini 专属参数初始化
      setResponseModalities((assistant as any).responseModalities ?? ['TEXT']);
      setCandidateCount((assistant as any).candidateCount ?? 1);
      setEnableSpeech((assistant as any).enableSpeech ?? false);
      setSpeechLanguage((assistant as any).speechLanguage ?? 'zh-CN');
      setEnableThinking((assistant as any).enableThinking ?? false);
      setThinkingBudget((assistant as any).thinkingBudget ?? 0);
      setMediaResolution((assistant as any).mediaResolution ?? 'medium');

      setSelectedModel(assistant.model || '');

      // 这里需要从assistant中获取自定义参数，暂时使用空数组
      // TODO: 当Assistant类型支持customParameters时，从assistant.customParameters获取
      setCustomParameters([]);
    }
  }, [assistant]);



  // 检测是否有变更
  useEffect(() => {
    const hasChanged =
      temperature !== (assistant?.temperature ?? DEFAULT_TEMPERATURE) ||
      topP !== (assistant?.topP ?? DEFAULT_TOP_P) ||
      topK !== ((assistant as any)?.topK ?? 40) ||
      frequencyPenalty !== ((assistant as any)?.frequencyPenalty ?? 0) ||
      presencePenalty !== ((assistant as any)?.presencePenalty ?? 0) ||
      seed !== ((assistant as any)?.seed ?? null) ||
      JSON.stringify(stopSequences) !== JSON.stringify((assistant as any)?.stopSequences ?? []) ||
      maxTokens !== (assistant?.maxTokens ?? 4096) ||
      // OpenAI 专属参数变更检测
      JSON.stringify(logitBias) !== JSON.stringify((assistant as any)?.logitBias ?? {}) ||
      responseFormat !== ((assistant as any)?.responseFormat ?? 'text') ||
      toolChoice !== ((assistant as any)?.toolChoice ?? 'auto') ||
      parallelToolCalls !== ((assistant as any)?.parallelToolCalls ?? true) ||
      // Gemini 专属参数变更检测
      JSON.stringify(responseModalities) !== JSON.stringify((assistant as any)?.responseModalities ?? ['TEXT']) ||
      candidateCount !== ((assistant as any)?.candidateCount ?? 1) ||
      enableSpeech !== ((assistant as any)?.enableSpeech ?? false) ||
      speechLanguage !== ((assistant as any)?.speechLanguage ?? 'zh-CN') ||
      enableThinking !== ((assistant as any)?.enableThinking ?? false) ||
      thinkingBudget !== ((assistant as any)?.thinkingBudget ?? 0) ||
      mediaResolution !== ((assistant as any)?.mediaResolution ?? 'medium') ||
      selectedModel !== (assistant?.model || '') ||
      customParameters.length > 0; // 简单检测，实际应该比较具体内容

    setHasChanges(hasChanged);
  }, [
    temperature, topP, topK, frequencyPenalty, presencePenalty, seed, stopSequences, maxTokens,
    logitBias, responseFormat, toolChoice, parallelToolCalls,
    responseModalities, candidateCount, enableSpeech, speechLanguage, enableThinking, thinkingBudget, mediaResolution,
    selectedModel, customParameters, assistant
  ]);

  // 自定义参数处理函数
  const handleAddCustomParameter = () => {
    const newParam: CustomParameter = {
      name: '',
      value: '',
      type: 'string'
    };
    setCustomParameters([...customParameters, newParam]);
  };

  const handleUpdateCustomParameter = (
    index: number,
    field: 'name' | 'value' | 'type',
    value: string | number | boolean | object
  ) => {
    const newParams = [...customParameters];
    if (field === 'type') {
      // 当类型改变时，重置值为默认值
      let defaultValue: any = '';
      switch (value) {
        case 'number':
          defaultValue = 0;
          break;
        case 'boolean':
          defaultValue = false;
          break;
        case 'json':
          defaultValue = '';
          break;
        default:
          defaultValue = '';
      }
      newParams[index] = {
        ...newParams[index],
        type: value as CustomParameterType,
        value: defaultValue
      };
    } else {
      newParams[index] = { ...newParams[index], [field]: value };
    }
    setCustomParameters(newParams);
  };

  const handleDeleteCustomParameter = (index: number) => {
    const newParams = customParameters.filter((_, i) => i !== index);
    setCustomParameters(newParams);
  };

  // 渲染参数值输入组件
  const renderParameterValueInput = (param: CustomParameter, index: number) => {
    switch (param.type) {
      case 'number':
        return (
          <TextField
            type="number"
            value={param.value as number}
            onChange={(e) => handleUpdateCustomParameter(index, 'value', parseFloat(e.target.value) || 0)}
            size="small"
            fullWidth
            inputProps={{ step: 0.01 }}
          />
        );
      case 'boolean':
        return (
          <Switch
            checked={param.value as boolean}
            onChange={(e) => handleUpdateCustomParameter(index, 'value', e.target.checked)}
          />
        );
      case 'json':
        return (
          <TextField
            multiline
            rows={3}
            value={typeof param.value === 'string' ? param.value : JSON.stringify(param.value, null, 2)}
            onChange={(e) => {
              try {
                const jsonValue = JSON.parse(e.target.value);
                handleUpdateCustomParameter(index, 'value', jsonValue);
              } catch {
                handleUpdateCustomParameter(index, 'value', e.target.value);
              }
            }}
            size="small"
            fullWidth
            placeholder='{"key": "value"}'
          />
        );
      default:
        return (
          <TextField
            value={param.value as string}
            onChange={(e) => handleUpdateCustomParameter(index, 'value', e.target.value)}
            size="small"
            fullWidth
            placeholder="参数值"
          />
        );
    }
  };

  const handleBack = () => {
    navigate(-1);
  };

  const handleSave = async () => {
    if (!assistant) return;

    setSaving(true);
    try {
      const updatedAssistant: Assistant = {
        ...assistant,
        temperature,
        topP,
        ...(topK !== 40 && { topK }),
        ...(frequencyPenalty !== 0 && { frequencyPenalty }),
        ...(presencePenalty !== 0 && { presencePenalty }),
        ...(seed !== null && { seed }),
        ...(stopSequences.length > 0 && { stopSequences }),
        maxTokens,
        // 同时保存到上下文设置
        ...((() => {
          const appSettings = getAppSettings();
          saveAppSettings({
            ...appSettings,
            maxOutputTokens: maxTokens,
            enableMaxOutputTokens: enableMaxTokens
          });
          return {};
        })()),
        // OpenAI 专属参数
        ...(Object.keys(logitBias).length > 0 && { logitBias }),
        ...(responseFormat !== 'text' && { responseFormat }),
        ...(toolChoice !== 'auto' && { toolChoice }),
        ...(parallelToolCalls !== true && { parallelToolCalls }),
        // Gemini 专属参数
        ...(JSON.stringify(responseModalities) !== JSON.stringify(['TEXT']) && { responseModalities }),
        ...(candidateCount !== 1 && { candidateCount }),
        ...(enableSpeech && { enableSpeech, speechLanguage }),
        ...(enableThinking && { enableThinking, thinkingBudget }),
        ...(mediaResolution !== 'medium' && { mediaResolution }),
        model: selectedModel,
        // TODO: 当Assistant类型支持customParameters时，添加这行
        // customParameters,
        updatedAt: new Date().toISOString()
      } as any;

      console.log('AssistantModelSettings: 保存助手设置', {
        assistantId: assistant.id,
        assistantName: assistant.name,
        temperature,
        topP,
        selectedModel,
        updatedAssistant
      });

      // 保存到数据库
      await dexieStorage.saveAssistant(updatedAssistant);

      // 更新Redux状态
      dispatch(updateAssistant(updatedAssistant));

      setHasChanges(false);

      // 显示成功提示
      console.log('助手设置已保存成功');
    } catch (error) {
      console.error('保存助手设置失败:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setTemperature(DEFAULT_TEMPERATURE);
    setTopP(DEFAULT_TOP_P);
    setTopK(40);
    setFrequencyPenalty(0);
    setPresencePenalty(0);
    setSeed(null);
    setStopSequences([]);
    setMaxTokens(4096);

    // 重置 OpenAI 专属参数
    setLogitBias({});
    setResponseFormat('text');
    setToolChoice('auto');
    setParallelToolCalls(true);

    // 重置 Gemini 专属参数
    setResponseModalities(['TEXT']);
    setCandidateCount(1);
    setEnableSpeech(false);
    setSpeechLanguage('zh-CN');
    setEnableThinking(false);
    setThinkingBudget(0);
    setMediaResolution('medium');

    setSelectedModel('');
    setCustomParameters([]);
  };

  if (!assistant) {
    return (
      <Box sx={{ p: 2 }}>
        <Alert severity="error">
          未找到助手信息，请返回重新选择
        </Alert>
      </Box>
    );
  }

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
      {/* 顶部导航栏 */}
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
            {assistant.name} - 模型设置
          </Typography>
          {hasChanges && (
            <Button
              startIcon={<SaveIcon />}
              onClick={handleSave}
              disabled={saving}
              variant="contained"
              size="small"
              sx={{
                background: 'linear-gradient(90deg, #9333EA, #754AB4)',
                fontWeight: 600,
                '&:hover': {
                  background: 'linear-gradient(90deg, #8324DB, #6D3CAF)',
                },
              }}
            >
              {saving ? '保存中...' : '保存'}
            </Button>
          )}
        </Toolbar>
      </AppBar>

      {/* 内容区域 */}
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
        {/* 助手信息 */}
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
              助手信息
            </Typography>
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ fontSize: { xs: '0.8rem', sm: '0.875rem' } }}
            >
              当前正在配置的助手详细信息
            </Typography>
          </Box>

          <Divider />

          <Box sx={{ p: { xs: 1.5, sm: 2 } }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Avatar sx={{
                width: { xs: 40, sm: 48 },
                height: { xs: 40, sm: 48 },
                bgcolor: alpha('#9333EA', 0.12),
                color: '#9333EA',
                boxShadow: '0 2px 6px rgba(0,0,0,0.05)'
              }}>
                {assistant.emoji || assistant.name.charAt(0)}
              </Avatar>
              <Box sx={{ flex: 1 }}>
                <Typography
                  variant="h6"
                  sx={{
                    fontWeight: 600,
                    fontSize: { xs: '1rem', sm: '1.1rem' }
                  }}
                >
                  {assistant.name}
                </Typography>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ fontSize: { xs: '0.8rem', sm: '0.875rem' } }}
                >
                  配置模型参数和行为设置
                </Typography>
                {assistant.isSystem && (
                  <Chip
                    label="系统助手"
                    size="small"
                    sx={{
                      mt: 0.5,
                      bgcolor: alpha('#9333EA', 0.1),
                      color: '#9333EA',
                      fontWeight: 500,
                      fontSize: { xs: '0.7rem', sm: '0.75rem' },
                      height: { xs: 20, sm: 24 }
                    }}
                  />
                )}
              </Box>
            </Box>
          </Box>
        </Paper>

        {/* Tab导航 */}
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
          <Tabs
            value={currentTab}
            onChange={(_, newValue) => setCurrentTab(newValue)}
            variant="fullWidth"
            sx={{
              '& .MuiTab-root': {
                fontWeight: 600,
                fontSize: { xs: '0.8rem', sm: '0.875rem' },
                textTransform: 'none',
                '&.Mui-selected': {
                  color: '#9333EA',
                },
              },
              '& .MuiTabs-indicator': {
                backgroundColor: '#9333EA',
                height: 3,
              },
            }}
          >
            <Tab label="通用参数" />
            <Tab label="OpenAI 专属" />
            <Tab label="Gemini 专属" />
            <Tab label="自定义参数" />
          </Tabs>
        </Paper>

        {/* Tab内容 */}
        <TabPanel value={currentTab} index={0}>
          {/* 通用参数 */}
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
                通用参数设置
              </Typography>
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ fontSize: { xs: '0.8rem', sm: '0.875rem' } }}
              >
                配置模型的基础参数，适用于大多数AI模型
              </Typography>
            </Box>

            <Divider />

            <Box sx={{ p: { xs: 1.5, sm: 2 } }}>
              <List sx={{ p: 0 }}>
          {/* 模型选择 */}
          <ListItem sx={{ flexDirection: 'column', alignItems: 'stretch', py: 2 }}>
            <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 'medium' }}>
              默认模型
            </Typography>
            <TextField
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              placeholder="输入模型ID"
              size="small"
              fullWidth
            />
          </ListItem>

          <Divider />

          {/* 温度设置 */}
          <ListItem sx={{ flexDirection: 'column', alignItems: 'stretch', py: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 'medium' }}>
                温度 (Temperature)
              </Typography>
              <Chip label={temperature.toFixed(2)} size="small" />
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              控制回答的创造性和随机性。较低值更保守，较高值更有创意。
            </Typography>
            <Slider
              value={temperature}
              onChange={(_, value) => setTemperature(value as number)}
              min={0}
              max={2}
              step={0.01}
              marks={[
                { value: 0, label: '0' },
                { value: 0.7, label: '0.7' },
                { value: 2, label: '2' }
              ]}
            />
          </ListItem>

          <Divider />

          {/* Top-P设置 */}
          <ListItem sx={{ flexDirection: 'column', alignItems: 'stretch', py: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 'medium' }}>
                Top-P
              </Typography>
              <Chip label={topP.toFixed(2)} size="small" />
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              控制词汇选择的多样性。较低值更聚焦，较高值更多样。
            </Typography>
            <Slider
              value={topP}
              onChange={(_, value) => setTopP(value as number)}
              min={0}
              max={1}
              step={0.01}
              marks={[
                { value: 0, label: '0' },
                { value: 1, label: '1' }
              ]}
            />
          </ListItem>

          <Divider />

          {/* Top-K设置 */}
          <ListItem sx={{ flexDirection: 'column', alignItems: 'stretch', py: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 'medium' }}>
                Top-K
              </Typography>
              <Chip label={topK} size="small" />
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              限制每步采样时考虑的最可能的token数量。较低值更保守，较高值更多样。
            </Typography>
            <Slider
              value={topK}
              onChange={(_, value) => setTopK(value as number)}
              min={1}
              max={100}
              step={1}
              marks={[
                { value: 1, label: '1' },
                { value: 40, label: '40' },
                { value: 100, label: '100' }
              ]}
            />
          </ListItem>

          <Divider />

          {/* Frequency Penalty设置 */}
          <ListItem sx={{ flexDirection: 'column', alignItems: 'stretch', py: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 'medium' }}>
                频率惩罚 (Frequency Penalty)
              </Typography>
              <Chip label={frequencyPenalty.toFixed(2)} size="small" />
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              根据token在文本中出现的频率对其进行惩罚。正值减少重复，负值增加重复。
            </Typography>
            <Slider
              value={frequencyPenalty}
              onChange={(_, value) => setFrequencyPenalty(value as number)}
              min={-2}
              max={2}
              step={0.01}
              marks={[
                { value: -2, label: '-2' },
                { value: 0, label: '0' },
                { value: 2, label: '2' }
              ]}
            />
          </ListItem>

          <Divider />

          {/* Presence Penalty设置 */}
          <ListItem sx={{ flexDirection: 'column', alignItems: 'stretch', py: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 'medium' }}>
                存在惩罚 (Presence Penalty)
              </Typography>
              <Chip label={presencePenalty.toFixed(2)} size="small" />
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              对已出现的token进行惩罚，不考虑频率。正值鼓励新话题，负值保持话题。
            </Typography>
            <Slider
              value={presencePenalty}
              onChange={(_, value) => setPresencePenalty(value as number)}
              min={-2}
              max={2}
              step={0.01}
              marks={[
                { value: -2, label: '-2' },
                { value: 0, label: '0' },
                { value: 2, label: '2' }
              ]}
            />
          </ListItem>

          <Divider />

          {/* Seed设置 */}
          <ListItem sx={{ flexDirection: 'column', alignItems: 'stretch', py: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 'medium' }}>
                随机种子 (Seed)
              </Typography>
              <Chip label={seed ?? '随机'} size="small" />
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              设置随机种子以获得可重现的结果。留空使用随机种子。
            </Typography>
            <TextField
              type="number"
              value={seed ?? ''}
              onChange={(e) => setSeed(e.target.value ? parseInt(e.target.value) : null)}
              placeholder="留空使用随机种子"
              size="small"
              fullWidth
            />
          </ListItem>

          <Divider />

          {/* 最大输出Token设置 */}
          <ListItem sx={{ flexDirection: 'column', alignItems: 'stretch', py: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 'medium' }}>
                  最大输出Token (Max Output Tokens)
                </Typography>
                <CustomSwitch
                  checked={enableMaxTokens}
                  onChange={(e) => {
                    const newValue = e.target.checked;
                    setEnableMaxTokens(newValue);
                    // 保存到localStorage
                    const appSettings = getAppSettings();
                    saveAppSettings({ ...appSettings, enableMaxOutputTokens: newValue });
                    // 触发自定义事件通知其他组件
                    window.dispatchEvent(new CustomEvent('enableMaxTokensChanged', { detail: newValue }));
                  }}
                />
              </Box>
              <Chip
                label={enableMaxTokens ? `${maxTokens} tokens` : '已禁用'}
                size="small"
                color={enableMaxTokens ? 'default' : 'secondary'}
              />
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              限制模型生成的最大token数量。不同模型支持的最大输出长度不同，如果设置值超过模型限制，API会自动调整或返回错误。
              较高值允许更长的回复，但会消耗更多资源和时间。关闭开关后，API请求中不会包含此参数。
            </Typography>

            {/* 滑块控制 */}
            <Box sx={{ mb: 2, px: 1, opacity: enableMaxTokens ? 1 : 0.5 }}>
              <Slider
                value={Math.min(maxTokens, 65536)}
                onChange={(_, value) => {
                  const newValue = value as number;
                  setMaxTokens(newValue);
                  // 同步到上下文设置
                  const appSettings = getAppSettings();
                  saveAppSettings({ ...appSettings, maxOutputTokens: newValue });
                  // 触发自定义事件通知其他组件
                  window.dispatchEvent(new CustomEvent('maxOutputTokensChanged', { detail: newValue }));
                }}
                disabled={!enableMaxTokens}
                min={256}
                max={65536}
                step={256}
                marks={[
                  { value: 256, label: '256' },
                  { value: 2048, label: '2K' },
                  { value: 4096, label: '4K' },
                  { value: 8192, label: '8K' },
                  { value: 16384, label: '16K' },
                  { value: 32768, label: '32K' },
                  { value: 65536, label: '64K' }
                ]}
                sx={{
                  '& .MuiSlider-markLabel': {
                    fontSize: '0.7rem'
                  }
                }}
              />
            </Box>

            {/* 精确输入 */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <Typography variant="body2" color="text.secondary" sx={{ minWidth: 'fit-content' }}>
                精确值:
              </Typography>
              <TextField
                type="text"
                value={maxTokens}
                onChange={(e) => {
                  const value = e.target.value;
                  // 允许空值或纯数字
                  if (value === '' || /^\d+$/.test(value)) {
                    const numValue = value === '' ? 0 : parseInt(value);
                    if (numValue <= 2000000) {
                      setMaxTokens(numValue);
                      // 同步到上下文设置
                      const appSettings = getAppSettings();
                      saveAppSettings({ ...appSettings, maxOutputTokens: numValue });
                      // 触发自定义事件通知其他组件
                      window.dispatchEvent(new CustomEvent('maxOutputTokensChanged', { detail: numValue }));
                    }
                  }
                }}
                disabled={!enableMaxTokens}
                size="small"
                sx={{ width: 120 }}
              />
              <Typography variant="body2" color="text.secondary">
                tokens (最大2M)
              </Typography>
            </Box>
          </ListItem>

          <Divider />

          {/* 上下文设置快速访问 */}
          <ListItem sx={{ flexDirection: 'column', alignItems: 'stretch', py: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <TuneOutlinedIcon size={20} color="var(--mui-palette-primary-main)" />
                <Typography variant="subtitle2" sx={{ fontWeight: 'medium' }}>
                  上下文设置 (快速访问)
                </Typography>
              </Box>
              <Chip
                label={`${contextLength === 64000 ? '不限' : contextLength} 字符 | ${contextCount === 100 ? '最大' : contextCount} 条`}
                size="small"
                color="primary"
                variant="outlined"
              />
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              快速调整上下文长度、消息数量和思维链设置。这些设置会影响所有助手的对话行为。
            </Typography>

            {/* 上下文长度 */}
            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" sx={{ mb: 1, fontWeight: 'medium' }}>
                上下文长度: {contextLength === 64000 ? '不限' : contextLength} 字符
              </Typography>
              <Slider
                value={contextLength}
                onChange={(_, value) => {
                  const newValue = value as number;
                  setContextLength(newValue);
                  // 保存到localStorage
                  const appSettings = getAppSettings();
                  saveAppSettings({ ...appSettings, contextLength: newValue });
                }}
                min={0}
                max={64000}
                step={1000}
                marks={[
                  { value: 0, label: '0' },
                  { value: 16000, label: '16K' },
                  { value: 32000, label: '32K' },
                  { value: 64000, label: '64K' }
                ]}
              />
            </Box>

            {/* 上下文消息数 */}
            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" sx={{ mb: 1, fontWeight: 'medium' }}>
                上下文消息数: {contextCount === 100 ? '最大' : contextCount} 条
              </Typography>
              <Slider
                value={contextCount}
                onChange={(_, value) => {
                  const newValue = value as number;
                  setContextCount(newValue);
                  // 保存到localStorage
                  const appSettings = getAppSettings();
                  saveAppSettings({ ...appSettings, contextCount: newValue });
                }}
                min={0}
                max={100}
                step={1}
                marks={[
                  { value: 0, label: '0' },
                  { value: 25, label: '25' },
                  { value: 50, label: '50' },
                  { value: 100, label: '最大' }
                ]}
              />
            </Box>

            {/* 思维链设置 */}
            <Box>
              <Typography variant="body2" sx={{ mb: 1, fontWeight: 'medium' }}>
                默认思维链长度
              </Typography>
              <FormControl size="small" fullWidth>
                <InputLabel>思维链长度</InputLabel>
                <Select
                  value={thinkingEffort}
                  onChange={(e) => {
                    const newValue = e.target.value as ThinkingOption;
                    setThinkingEffort(newValue);
                    // 保存到localStorage
                    const appSettings = getAppSettings();
                    saveAppSettings({ ...appSettings, defaultThinkingEffort: newValue });
                  }}
                  label="思维链长度"
                >
                  <MenuItem value="off">关闭思考</MenuItem>
                  <MenuItem value="low">低强度思考</MenuItem>
                  <MenuItem value="medium">中强度思考（推荐）</MenuItem>
                  <MenuItem value="high">高强度思考</MenuItem>
                  <MenuItem value="auto">自动思考</MenuItem>
                </Select>
              </FormControl>
            </Box>
          </ListItem>

          <Divider />

          {/* Stop Sequences设置 */}
          <ListItem sx={{ flexDirection: 'column', alignItems: 'stretch', py: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 'medium' }}>
                停止序列 (Stop Sequences)
              </Typography>
              <Chip label={stopSequences.length} size="small" />
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              遇到这些字符序列时停止生成。每行一个序列。
            </Typography>
            <TextField
              multiline
              rows={3}
              value={stopSequences.join('\n')}
              onChange={(e) => setStopSequences(e.target.value.split('\n').filter(s => s.trim()))}
              placeholder="每行输入一个停止序列"
              size="small"
              fullWidth
            />
          </ListItem>

              </List>
            </Box>
          </Paper>
        </TabPanel>

        <TabPanel value={currentTab} index={1}>
          {/* OpenAI 专属参数 */}
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
                  color: '#06b6d4'
                }}
              >
                OpenAI 专属参数
              </Typography>
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ fontSize: { xs: '0.8rem', sm: '0.875rem' } }}
              >
                专门针对OpenAI模型的高级参数配置
              </Typography>
            </Box>

            <Divider />

            <Box sx={{ p: { xs: 1.5, sm: 2 } }}>
              <List sx={{ p: 0 }}>
                <ListItem sx={{ flexDirection: 'column', alignItems: 'stretch', py: 2 }}>

            {/* Response Format */}
            <Box sx={{ mb: 3 }}>
              <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 'medium' }}>
                响应格式 (Response Format)
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                指定模型响应的格式。JSON模式确保输出为有效JSON。
              </Typography>
              <FormControl size="small" fullWidth>
                <InputLabel>响应格式</InputLabel>
                <Select
                  value={responseFormat}
                  onChange={(e) => setResponseFormat(e.target.value as 'text' | 'json_object')}
                  label="响应格式"
                >
                  <MenuItem value="text">文本</MenuItem>
                  <MenuItem value="json_object">JSON对象</MenuItem>
                </Select>
              </FormControl>
            </Box>

            {/* Tool Choice */}
            <Box sx={{ mb: 3 }}>
              <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 'medium' }}>
                工具选择 (Tool Choice)
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                控制模型是否以及如何调用函数工具。
              </Typography>
              <FormControl size="small" fullWidth>
                <InputLabel>工具选择</InputLabel>
                <Select
                  value={toolChoice}
                  onChange={(e) => setToolChoice(e.target.value as 'none' | 'auto' | 'required')}
                  label="工具选择"
                >
                  <MenuItem value="none">禁用</MenuItem>
                  <MenuItem value="auto">自动</MenuItem>
                  <MenuItem value="required">必须</MenuItem>
                </Select>
              </FormControl>
            </Box>

            {/* Parallel Tool Calls */}
            <Box sx={{ mb: 3 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 'medium' }}>
                  并行工具调用 (Parallel Tool Calls)
                </Typography>
                <Switch
                  checked={parallelToolCalls}
                  onChange={(e) => setParallelToolCalls(e.target.checked)}
                />
              </Box>
              <Typography variant="body2" color="text.secondary">
                是否允许模型同时调用多个函数工具。
              </Typography>
            </Box>

            {/* Logit Bias */}
            <Box sx={{ mb: 3 }}>
              <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 'medium' }}>
                Logit偏置 (Logit Bias)
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                修改指定token出现的可能性。格式：token_id:bias_value，每行一个。
              </Typography>
              <TextField
                multiline
                rows={3}
                value={Object.entries(logitBias).map(([k, v]) => `${k}:${v}`).join('\n')}
                onChange={(e) => {
                  const bias: Record<string, number> = {};
                  e.target.value.split('\n').forEach(line => {
                    const [token, value] = line.split(':');
                    if (token && value && !isNaN(Number(value))) {
                      bias[token.trim()] = Number(value);
                    }
                  });
                  setLogitBias(bias);
                }}
                placeholder="例如：50256:-100"
                size="small"
                fullWidth
              />
            </Box>
                </ListItem>
              </List>
            </Box>
          </Paper>
        </TabPanel>

        <TabPanel value={currentTab} index={2}>
          {/* Gemini 专属参数 */}
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
                  color: '#8b5cf6'
                }}
              >
                Gemini 专属参数
              </Typography>
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ fontSize: { xs: '0.8rem', sm: '0.875rem' } }}
              >
                专门针对Google Gemini模型的高级参数配置
              </Typography>
            </Box>

            <Divider />

            <Box sx={{ p: { xs: 1.5, sm: 2 } }}>
              <List sx={{ p: 0 }}>
                <ListItem sx={{ flexDirection: 'column', alignItems: 'stretch', py: 2 }}>

            {/* Candidate Count */}
            <Box sx={{ mb: 3 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 'medium' }}>
                  候选数量 (Candidate Count)
                </Typography>
                <Chip label={candidateCount} size="small" />
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                生成的候选响应数量。注意：仅部分模型支持多候选。
              </Typography>
              <Slider
                value={candidateCount}
                onChange={(_, value) => setCandidateCount(value as number)}
                min={1}
                max={4}
                step={1}
                marks={[
                  { value: 1, label: '1' },
                  { value: 2, label: '2' },
                  { value: 3, label: '3' },
                  { value: 4, label: '4' }
                ]}
              />
            </Box>

            {/* Response Modalities */}
            <Box sx={{ mb: 3 }}>
              <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 'medium' }}>
                响应模态 (Response Modalities)
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                指定模型可以返回的内容类型。
              </Typography>
              <FormControl size="small" fullWidth>
                <InputLabel>响应模态</InputLabel>
                <Select
                  multiple
                  value={responseModalities}
                  onChange={(e) => setResponseModalities(e.target.value as string[])}
                  label="响应模态"
                >
                  <MenuItem value="TEXT">文本</MenuItem>
                  <MenuItem value="IMAGE">图像</MenuItem>
                  <MenuItem value="AUDIO">音频</MenuItem>
                </Select>
              </FormControl>
            </Box>

            {/* Speech Settings */}
            <Box sx={{ mb: 3 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 'medium' }}>
                  语音输出 (Speech Output)
                </Typography>
                <Switch
                  checked={enableSpeech}
                  onChange={(e) => setEnableSpeech(e.target.checked)}
                />
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                启用语音输出功能。
              </Typography>
              {enableSpeech && (
                <FormControl size="small" fullWidth sx={{ mt: 2 }}>
                  <InputLabel>语音语言</InputLabel>
                  <Select
                    value={speechLanguage}
                    onChange={(e) => setSpeechLanguage(e.target.value)}
                    label="语音语言"
                  >
                    <MenuItem value="zh-CN">中文（简体）</MenuItem>
                    <MenuItem value="en-US">英语（美国）</MenuItem>
                    <MenuItem value="ja-JP">日语</MenuItem>
                    <MenuItem value="ko-KR">韩语</MenuItem>
                  </Select>
                </FormControl>
              )}
            </Box>

            {/* Thinking Settings */}
            <Box sx={{ mb: 3 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 'medium' }}>
                  思维链 (Thinking)
                </Typography>
                <Switch
                  checked={enableThinking}
                  onChange={(e) => setEnableThinking(e.target.checked)}
                />
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                启用思维链功能，显示模型的推理过程。Gemini使用token数量控制(0-24576)，OpenAI使用强度等级控制。
              </Typography>
              {enableThinking && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="body2" sx={{ mb: 1 }}>
                    思维预算: {thinkingBudget} tokens
                  </Typography>
                  <Slider
                    value={thinkingBudget}
                    onChange={(_, value) => setThinkingBudget(value as number)}
                    min={0}
                    max={24576}
                    step={256}
                    marks={[
                      { value: 0, label: '0' },
                      { value: 2048, label: '2K' },
                      { value: 8192, label: '8K' },
                      { value: 16384, label: '16K' },
                      { value: 24576, label: '24K' }
                    ]}
                  />
                </Box>
              )}
            </Box>

            {/* Media Resolution */}
            <Box sx={{ mb: 3 }}>
              <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 'medium' }}>
                媒体分辨率 (Media Resolution)
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                处理图像和视频时的分辨率设置。
              </Typography>
              <FormControl size="small" fullWidth>
                <InputLabel>媒体分辨率</InputLabel>
                <Select
                  value={mediaResolution}
                  onChange={(e) => setMediaResolution(e.target.value as 'low' | 'medium' | 'high')}
                  label="媒体分辨率"
                >
                  <MenuItem value="low">低 (64 tokens)</MenuItem>
                  <MenuItem value="medium">中 (256 tokens)</MenuItem>
                  <MenuItem value="high">高 (256 tokens + 缩放)</MenuItem>
                </Select>
              </FormControl>
            </Box>
                </ListItem>
              </List>
            </Box>
          </Paper>
        </TabPanel>

        <TabPanel value={currentTab} index={3}>
          {/* 自定义参数 */}
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
                  color: '#10b981'
                }}
              >
                自定义参数
              </Typography>
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ fontSize: { xs: '0.8rem', sm: '0.875rem' } }}
              >
                为模型添加自定义参数，支持多种数据类型
              </Typography>
            </Box>

            <Divider />

            <Box sx={{ p: { xs: 1.5, sm: 2 } }}>
              <List sx={{ p: 0 }}>
          <ListItem sx={{ flexDirection: 'column', alignItems: 'stretch', py: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 'medium' }}>
                自定义参数
              </Typography>
              <Button
                startIcon={<AddIcon />}
                onClick={handleAddCustomParameter}
                variant="outlined"
                size="small"
              >
                添加参数
              </Button>
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              为模型添加自定义参数，支持字符串、数字、布尔值和JSON格式。
            </Typography>

            {customParameters.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 3, color: 'text.secondary' }}>
                <Typography variant="body2">
                  暂无自定义参数，点击"添加参数"开始配置
                </Typography>
              </Box>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {customParameters.map((param, index) => (
                  <Card key={index} variant="outlined" sx={{ p: 0 }}>
                    <CardContent sx={{ pb: 1 }}>
                      <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
                        <Box sx={{ flex: '1 1 200px', minWidth: '150px' }}>
                          <TextField
                            label="参数名"
                            value={param.name}
                            onChange={(e) => handleUpdateCustomParameter(index, 'name', e.target.value)}
                            size="small"
                            fullWidth
                            placeholder="参数名称"
                          />
                        </Box>
                        <Box sx={{ flex: '0 0 120px' }}>
                          <FormControl size="small" fullWidth>
                            <InputLabel>类型</InputLabel>
                            <Select
                              value={param.type}
                              onChange={(e) => handleUpdateCustomParameter(index, 'type', e.target.value)}
                              label="类型"
                            >
                              <MenuItem value="string">字符串</MenuItem>
                              <MenuItem value="number">数字</MenuItem>
                              <MenuItem value="boolean">布尔值</MenuItem>
                              <MenuItem value="json">JSON</MenuItem>
                            </Select>
                          </FormControl>
                        </Box>
                        <Box sx={{ flex: '1 1 200px', minWidth: '150px' }}>
                          {renderParameterValueInput(param, index)}
                        </Box>
                      </Box>
                    </CardContent>
                    <CardActions sx={{ pt: 0, justifyContent: 'flex-end' }}>
                      <IconButton
                        onClick={() => handleDeleteCustomParameter(index)}
                        color="error"
                        size="small"
                      >
                        <DeleteIcon />
                      </IconButton>
                    </CardActions>
                  </Card>
                ))}
              </Box>
            )}
          </ListItem>

          {/* 重置按钮 */}
          <ListItem sx={{ justifyContent: 'center', py: 3 }}>
            <Button
              startIcon={<RestoreIcon />}
              onClick={handleReset}
              variant="outlined"
              color="secondary"
            >
              重置为默认值
            </Button>
          </ListItem>
              </List>
            </Box>
          </Paper>
        </TabPanel>
      </Box>
    </Box>
  );
};

export default AssistantModelSettings;
