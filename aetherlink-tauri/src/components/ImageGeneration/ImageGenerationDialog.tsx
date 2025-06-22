import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Box,
  Typography,
  Collapse,
  Slider,
  FormControlLabel,
  Switch,
  CircularProgress,
  Alert
} from '@mui/material';
import { ChevronDown as ExpandMoreIcon, ChevronUp as ExpandLessIcon } from 'lucide-react';
import { useSelector, useDispatch } from 'react-redux';
import type { RootState } from '../../shared/store';
import { generateImage } from '../../shared/services/network/APIService';
import { addGeneratedImage } from '../../shared/store/settingsSlice';
import type { ImageGenerationParams, Model } from '../../shared/types';
import { ModelType } from '../../shared/types';
import type { ModelProvider } from '../../shared/config/defaultModels';

interface ImageGenerationDialogProps {
  open: boolean;
  onClose: () => void;
  onImageGenerated: (imageUrl: string) => void; // 回调函数，用于在生成图像后将其添加到聊天中
}

const ImageGenerationDialog: React.FC<ImageGenerationDialogProps> = ({
  open,
  onClose,
  onImageGenerated
}) => {
  const dispatch = useDispatch();

  // 从Redux获取支持图像生成的模型
  const models = useSelector((state: RootState) =>
    state.settings.models?.filter((model: Model) =>
      model.enabled && (model.modelTypes?.includes(ModelType.ImageGen) || model.imageGeneration || model.capabilities?.imageGeneration)
    ) || []
  );

  // 从providers获取支持图像生成的模型
  const providersModels = useSelector((state: RootState) =>
    state.settings.providers
      .filter((provider: ModelProvider) => provider.isEnabled)
      .flatMap((provider: ModelProvider) =>
        provider.models.filter((model: Model) =>
          model.enabled && (model.modelTypes?.includes(ModelType.ImageGen) || model.imageGeneration || model.capabilities?.imageGeneration)
        )
      )
  );

  // 合并两个模型列表并去重
  const availableModels = [...models, ...providersModels]
    .filter((model, index, self) =>
      index === self.findIndex(m => m.id === model.id)
    );

  // 状态
  const [selectedModelId, setSelectedModelId] = useState('');
  const [prompt, setPrompt] = useState('');
  const [negativePrompt, setNegativePrompt] = useState('');
  const [imageSize, setImageSize] = useState('1024x1024');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [steps, setSteps] = useState(20);
  const [guidance, setGuidance] = useState(7.5);
  const [seed, setSeed] = useState<number | null>(null);
  const [randomSeed, setRandomSeed] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 图像尺寸选项
  const imageSizeOptions = [
    { value: '512x512', label: '512x512' },
    { value: '768x768', label: '768x768' },
    { value: '1024x1024', label: '1024x1024' },
    { value: '1024x1536', label: '1024x1536 (竖向)' },
    { value: '1536x1024', label: '1536x1024 (横向)' }
  ];

  // 初始化默认选择的模型
  useEffect(() => {
    if (availableModels.length > 0 && !selectedModelId) {
      setSelectedModelId(availableModels[0].id);
    }
  }, [availableModels, selectedModelId]);

  // 重置表单
  const resetForm = () => {
    setPrompt('');
    setNegativePrompt('');
    setImageSize('1024x1024');
    setSteps(20);
    setGuidance(7.5);
    setSeed(null);
    setRandomSeed(true);
    setError(null);
  };

  // 处理对话框关闭
  const handleClose = () => {
    if (!isGenerating) {
      resetForm();
      onClose();
    }
  };

  // 生成图像
  const handleGenerateImage = async () => {
    if (!prompt.trim()) {
      setError('请输入提示词');
      return;
    }

    const selectedModel = availableModels.find(m => m.id === selectedModelId);
    if (!selectedModel) {
      setError('请选择有效的模型');
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      // 准备参数
      const params: ImageGenerationParams = {
        prompt: prompt.trim(),
        negativePrompt: negativePrompt.trim(),
        imageSize: imageSize,
        steps: steps,
        guidanceScale: guidance,
      };

      // 添加种子如果不是随机
      if (!randomSeed && seed !== null) {
        params.seed = seed;
      }

      // 调用生成API
      const generatedImage = await generateImage(selectedModel, params);

      // 保存到Redux状态
      dispatch(addGeneratedImage(generatedImage));

      // 调用回调函数将图像添加到聊天中
      onImageGenerated(generatedImage.url);

      // 关闭对话框
      handleClose();
    } catch (error: any) {
      setError(`图像生成失败: ${error.message || '未知错误'}`);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      fullWidth
      maxWidth="sm"
      slotProps={{
        paper: {
          sx: {
            borderRadius: 2,
            overflow: 'hidden'
          }
        }
      }}
    >
      <DialogTitle
        sx={{
          fontWeight: 600,
          p: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}
      >
        <span>图像生成</span>
      </DialogTitle>

      <DialogContent sx={{ p: 2 }}>
        {/* 错误提示 */}
        {error && (
          <Alert
            severity="error"
            sx={{ mb: 2 }}
            onClose={() => setError(null)}
          >
            {error}
          </Alert>
        )}

        {/* 模型选择 */}
        <FormControl fullWidth variant="outlined" sx={{ mb: 2 }}>
          <InputLabel>选择模型</InputLabel>
          <Select
            value={selectedModelId}
            onChange={(e) => setSelectedModelId(e.target.value)}
            label="选择模型"
            disabled={isGenerating}
            MenuProps={{
              disableAutoFocus: true,
              disableRestoreFocus: true
            }}
          >
            {availableModels.length === 0 && (
              <MenuItem value="" disabled>
                没有可用的图像生成模型
              </MenuItem>
            )}
            {availableModels.map((model) => (
              <MenuItem key={model.id} value={model.id}>
                {model.name} ({model.provider})
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {/* 提示词输入 */}
        <TextField
          label="提示词"
          placeholder="描述你想要生成的图像"
          multiline
          rows={3}
          fullWidth
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          variant="outlined"
          sx={{ mb: 2 }}
          disabled={isGenerating}
        />

        {/* 负面提示词 */}
        <TextField
          label="负面提示词(可选)"
          placeholder="描述你不希望出现在图像中的内容"
          multiline
          rows={2}
          fullWidth
          value={negativePrompt}
          onChange={(e) => setNegativePrompt(e.target.value)}
          variant="outlined"
          sx={{ mb: 2 }}
          disabled={isGenerating}
        />

        {/* 图像尺寸选择 */}
        <FormControl fullWidth variant="outlined" sx={{ mb: 2 }}>
          <InputLabel>图像尺寸</InputLabel>
          <Select
            value={imageSize}
            onChange={(e) => setImageSize(e.target.value)}
            label="图像尺寸"
            disabled={isGenerating}
          >
            {imageSizeOptions.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {/* 高级选项 */}
        <Box sx={{ mb: 2 }}>
          <Button
            variant="text"
            onClick={() => setShowAdvanced(!showAdvanced)}
            endIcon={showAdvanced ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            disabled={isGenerating}
            sx={{ mb: 1 }}
          >
            高级选项
          </Button>

          <Collapse in={showAdvanced}>
            <Box sx={{ mt: 1, p: 2, bgcolor: '#f9f9f9', borderRadius: 1 }}>
              {/* 推理步数 */}
              <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle2" gutterBottom>
                  推理步数: {steps}
                </Typography>
                <Slider
                  min={10}
                  max={50}
                  step={1}
                  value={steps}
                  onChange={(_, value) => setSteps(value as number)}
                  valueLabelDisplay="auto"
                  disabled={isGenerating}
                />
              </Box>

              {/* 引导系数 */}
              <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle2" gutterBottom>
                  引导系数: {guidance}
                </Typography>
                <Slider
                  min={1}
                  max={20}
                  step={0.5}
                  value={guidance}
                  onChange={(_, value) => setGuidance(value as number)}
                  valueLabelDisplay="auto"
                  disabled={isGenerating}
                />
              </Box>

              {/* 随机种子 */}
              <FormControlLabel
                control={
                  <Switch
                    checked={randomSeed}
                    onChange={(e) => setRandomSeed(e.target.checked)}
                    disabled={isGenerating}
                  />
                }
                label="随机种子"
              />

              {/* 种子输入 */}
              {!randomSeed && (
                <TextField
                  label="种子"
                  type="number"
                  value={seed === null ? '' : seed}
                  onChange={(e) => setSeed(e.target.value ? parseInt(e.target.value, 10) : null)}
                  variant="outlined"
                  fullWidth
                  sx={{ mt: 2 }}
                  disabled={isGenerating}
                />
              )}
            </Box>
          </Collapse>
        </Box>
      </DialogContent>

      <DialogActions sx={{ p: 2, justifyContent: 'space-between' }}>
        <Button
          onClick={handleClose}
          color="inherit"
          disabled={isGenerating}
        >
          取消
        </Button>
        <Button
          variant="contained"
          color="primary"
          onClick={handleGenerateImage}
          disabled={isGenerating || !selectedModelId || !prompt.trim()}
          startIcon={isGenerating ? <CircularProgress size={20} color="inherit" /> : null}
        >
          {isGenerating ? '生成中...' : '生成图像'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ImageGenerationDialog;