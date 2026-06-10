import React, { useState, useMemo } from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
  Alert,
  InputAdornment,
  IconButton,
  CircularProgress,
  FormControl,
  Select,
  MenuItem,
} from '@mui/material';
import type { SelectChangeEvent } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, CheckCircle2, XCircle, RefreshCw, RotateCcw } from 'lucide-react';
import { useSelector, useDispatch } from 'react-redux';
import {
  SafeAreaContainer,
  Container,
  HeaderBar,
  YStack,
  SettingGroup,
  Row,
} from '../../components/settings/SettingComponents';
import CustomSwitch from '../../components/CustomSwitch';
import useScrollPosition from '../../hooks/useScrollPosition';
import type { RootState, AppDispatch } from '../../shared/store';
import {
  setVisionEnabled,
  setVisionModelSource,
  setVisionPresetModelRef,
  updateVisionCustomConfig,
  setVisionPrompt,
  setVisionFailureStrategy,
  setVisionTimeoutMs,
  DEFAULT_VISION_PROMPT,
  type VisionModelSource,
  type VisionFailureStrategy,
} from '../../shared/store/slices/visionRecognitionSlice';
import { testVisionModelConnection, type VisionTestResult } from '../../shared/services/vision/VisionRecognitionService';
import { ModelSelector } from '../ChatPage/components/ModelSelector';

/** API 厂商预设（点击快捷填充 Base URL） */
const PROVIDER_PRESETS: Array<{ name: string; baseUrl: string }> = [
  { name: 'OpenAI', baseUrl: 'https://api.openai.com/v1' },
  { name: '小米 MiMo', baseUrl: 'https://api.xiaomimimo.com/v1' },
  { name: 'Kimi (Moonshot)', baseUrl: 'https://api.moonshot.cn/v1' },
  { name: 'DeepSeek', baseUrl: 'https://api.deepseek.com/v1' },
  { name: '硅基流动', baseUrl: 'https://api.siliconflow.cn/v1' },
  { name: '智谱 GLM', baseUrl: 'https://open.bigmodel.cn/api/paas/v4' },
  { name: '阿里云百炼', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1' },
];

const VisionRecognitionSettings: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch<AppDispatch>();

  const { containerRef, handleScroll } = useScrollPosition('settings-vision-recognition', {
    autoRestore: true,
    restoreDelay: 0,
  });

  const visionState = useSelector((state: RootState) => state.visionRecognition);
  const providers = useSelector((state: RootState) => state.settings.providers || []);

  const [showApiKey, setShowApiKey] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<VisionTestResult | null>(null);
  const [modelSelectorOpen, setModelSelectorOpen] = useState(false);

  // 已启用供应商中的所有可用模型（与主模型选择器一致）
  const allModels = useMemo(() => (
    providers
      .filter((provider) => provider.isEnabled)
      .flatMap((provider) =>
        (provider.models || [])
          .filter((model) => model.enabled)
          .map((model) => ({
            ...model,
            providerName: provider.name,
            providerId: provider.id,
          }))
      )
  ), [providers]);

  const selectedPresetModel = useMemo(() => {
    const ref = visionState.presetModelRef;
    if (!ref) return null;
    return allModels.find((model) => model.providerId === ref.providerId && model.id === ref.modelId) || null;
  }, [allModels, visionState.presetModelRef]);

  const handleBack = () => navigate('/settings');

  const handleModelSourceChange = (event: SelectChangeEvent) => {
    dispatch(setVisionModelSource(event.target.value as VisionModelSource));
    setTestResult(null);
  };

  const handlePresetModelSelect = (model: any) => {
    dispatch(
      setVisionPresetModelRef({
        providerId: model.providerId || model.provider,
        modelId: model.id,
      })
    );
    setModelSelectorOpen(false);
    setTestResult(null);
  };

  const handleProviderPreset = (event: SelectChangeEvent) => {
    const preset = PROVIDER_PRESETS.find((p) => p.name === event.target.value);
    if (preset) {
      dispatch(updateVisionCustomConfig({ baseUrl: preset.baseUrl }));
      setTestResult(null);
    }
  };

  const handleCustomChange = (field: 'modelName' | 'baseUrl' | 'apiKey') =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      dispatch(updateVisionCustomConfig({ [field]: e.target.value }));
      setTestResult(null);
    };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const result = await testVisionModelConnection(visionState);
      setTestResult(result);
    } finally {
      setIsTesting(false);
    }
  };

  const handleTimeoutChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value === '') return;
    const seconds = parseInt(value, 10);
    if (!isNaN(seconds) && seconds >= 5 && seconds <= 600) {
      dispatch(setVisionTimeoutMs(seconds * 1000));
    }
  };

  const isCustom = visionState.modelSource === 'custom';
  const canTest = isCustom
    ? !!(visionState.custom.modelName && visionState.custom.baseUrl && visionState.custom.apiKey)
    : !!visionState.presetModelRef;

  return (
    <SafeAreaContainer>
      <HeaderBar title="视觉识别" onBackPress={handleBack} />
      <Container ref={containerRef} onScroll={handleScroll}>
        <YStack sx={{ gap: 3 }}>

          {/* ==================== 总开关 ==================== */}
          <SettingGroup title="视觉识别">
            <Row>
              <Box sx={{ flex: 1 }}>
                <Typography>启用视觉识别</Typography>
                <Typography variant="caption" color="text.secondary">
                  发送图片给不支持视觉的模型时，自动用视觉模型分析图片内容并提供给当前模型
                </Typography>
              </Box>
              <CustomSwitch
                checked={visionState.enabled}
                onChange={() => dispatch(setVisionEnabled(!visionState.enabled))}
              />
            </Row>
          </SettingGroup>

          {/* ==================== 模型来源 ==================== */}
          <SettingGroup title="视觉模型">
            <Row>
              <Typography sx={{ flex: 1 }}>模型来源</Typography>
              <FormControl size="small" sx={{ minWidth: 180 }}>
                <Select value={visionState.modelSource} onChange={handleModelSourceChange}>
                  <MenuItem value="preset">使用已配置的模型</MenuItem>
                  <MenuItem value="custom">自定义API配置</MenuItem>
                </Select>
              </FormControl>
            </Row>

            {!isCustom && (
              <Row>
                <Typography sx={{ minWidth: 80 }}>视觉模型</Typography>
                <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 1.5, flexWrap: 'wrap' }}>
                  <Typography variant="body2" color="text.secondary" sx={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {selectedPresetModel
                      ? `${(selectedPresetModel as any).providerName} / ${selectedPresetModel.name || selectedPresetModel.id}`
                      : '未选择'}
                  </Typography>
                  <Button variant="outlined" size="small" onClick={() => setModelSelectorOpen(true)} sx={{ textTransform: 'none' }}>
                    选择模型
                  </Button>
                  <ModelSelector
                    selectedModel={selectedPresetModel}
                    availableModels={allModels}
                    handleModelSelect={handlePresetModelSelect}
                    handleMenuClick={() => setModelSelectorOpen(true)}
                    handleMenuClose={() => setModelSelectorOpen(false)}
                    menuOpen={modelSelectorOpen}
                  />
                </Box>
              </Row>
            )}

            {isCustom && (
              <>
                <Row>
                  <Typography sx={{ minWidth: 80 }}>厂商预设</Typography>
                  <FormControl size="small" sx={{ flex: 1 }}>
                    <Select value="" onChange={handleProviderPreset} displayEmpty>
                      <MenuItem value="">
                        <em>选择厂商快捷填充 Base URL</em>
                      </MenuItem>
                      {PROVIDER_PRESETS.map((preset) => (
                        <MenuItem key={preset.name} value={preset.name}>
                          {preset.name}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Row>

                <Row>
                  <Typography sx={{ minWidth: 80 }}>模型名称</Typography>
                  <TextField
                    size="small"
                    placeholder="如 gpt-4o-mini、moonshot-v1-8k-vision-preview"
                    value={visionState.custom.modelName}
                    onChange={handleCustomChange('modelName')}
                    sx={{ flex: 1 }}
                  />
                </Row>

                <Row>
                  <Typography sx={{ minWidth: 80 }}>Base URL</Typography>
                  <TextField
                    size="small"
                    placeholder="https://api.openai.com/v1"
                    value={visionState.custom.baseUrl}
                    onChange={handleCustomChange('baseUrl')}
                    sx={{ flex: 1 }}
                  />
                </Row>

                <Row>
                  <Typography sx={{ minWidth: 80 }}>API 密钥</Typography>
                  <TextField
                    size="small"
                    type={showApiKey ? 'text' : 'password'}
                    placeholder="sk-..."
                    value={visionState.custom.apiKey}
                    onChange={handleCustomChange('apiKey')}
                    sx={{ flex: 1 }}
                    InputProps={{
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton size="small" onClick={() => setShowApiKey(!showApiKey)} edge="end">
                            {showApiKey ? <EyeOff size={16} /> : <Eye size={16} />}
                          </IconButton>
                        </InputAdornment>
                      ),
                    }}
                  />
                </Row>
              </>
            )}

            <Box sx={{ px: 2, pb: 2 }}>
              <Button
                fullWidth
                variant="outlined"
                size="small"
                onClick={handleTestConnection}
                disabled={isTesting || !canTest}
                startIcon={isTesting ? <CircularProgress size={16} /> : <RefreshCw size={16} />}
                sx={{ textTransform: 'none' }}
              >
                {isTesting ? '测试中...' : '测试 API 连接'}
              </Button>

              {testResult && (
                <Alert
                  severity={testResult.success ? 'success' : 'error'}
                  icon={testResult.success ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
                  sx={{ mt: 1.5, borderRadius: 2 }}
                >
                  <Typography variant="body2">{testResult.message}</Typography>
                  {testResult.success && testResult.latencyMs !== undefined && (
                    <Typography variant="caption" color="text.secondary">
                      响应时间: {testResult.latencyMs}ms
                    </Typography>
                  )}
                </Alert>
              )}
            </Box>
          </SettingGroup>

          {/* ==================== 高级设置 ==================== */}
          <SettingGroup title="高级设置">
            <Row sx={{ alignItems: 'flex-start', flexDirection: 'column', gap: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                <Box sx={{ flex: 1 }}>
                  <Typography>分析提示词</Typography>
                  <Typography variant="caption" color="text.secondary">
                    指导视觉模型如何描述图片
                  </Typography>
                </Box>
                <IconButton
                  size="small"
                  onClick={() => dispatch(setVisionPrompt(DEFAULT_VISION_PROMPT))}
                  title="恢复默认"
                >
                  <RotateCcw size={16} />
                </IconButton>
              </Box>
              <TextField
                fullWidth
                multiline
                minRows={3}
                maxRows={8}
                size="small"
                value={visionState.prompt}
                onChange={(e) => dispatch(setVisionPrompt(e.target.value))}
              />
            </Row>

            <Row>
              <Box sx={{ flex: 1 }}>
                <Typography>分析失败时</Typography>
                <Typography variant="caption" color="text.secondary">
                  视觉模型分析失败后的处理方式
                </Typography>
              </Box>
              <FormControl size="small" sx={{ minWidth: 160 }}>
                <Select
                  value={visionState.onFailure}
                  onChange={(e) => dispatch(setVisionFailureStrategy(e.target.value as VisionFailureStrategy))}
                >
                  <MenuItem value="abort">中止并报错</MenuItem>
                  <MenuItem value="continueWithoutImage">移除图片继续发送</MenuItem>
                </Select>
              </FormControl>
            </Row>

            <Row>
              <Typography sx={{ flex: 1 }}>分析超时（秒）</Typography>
              <TextField
                size="small"
                value={Math.round(visionState.timeoutMs / 1000)}
                onChange={handleTimeoutChange}
                inputProps={{ inputMode: 'numeric', pattern: '[0-9]*' }}
                sx={{ width: 100 }}
              />
            </Row>
          </SettingGroup>

          {/* ==================== 配置说明 ==================== */}
          <Box sx={{ px: 1.5 }}>
            <YStack sx={{ gap: 0.75 }}>
              {[
                { label: '使用已配置的模型', desc: '从现有供应商中选择一个支持视觉的模型，复用其密钥与地址' },
                { label: '自定义API配置', desc: '独立填写模型名、Base URL 与密钥（OpenAI 兼容协议），与主API互不影响' },
                { label: '工作方式', desc: '仅当当前对话模型不支持图片时触发；分析结果只注入本次请求，聊天记录仍保留原图' },
              ].map((item) => (
                <Typography key={item.label} variant="caption" color="text.secondary">
                  <strong>{item.label}</strong> — {item.desc}
                </Typography>
              ))}
            </YStack>
          </Box>

        </YStack>
      </Container>
    </SafeAreaContainer>
  );
};

export default VisionRecognitionSettings;
