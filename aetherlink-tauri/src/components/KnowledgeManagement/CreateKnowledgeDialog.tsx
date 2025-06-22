import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  FormHelperText,
  Typography,
  Box,
  Slider,
  Stack,
  Collapse,
  IconButton,
  Divider,
  Alert,
} from '@mui/material';
import type { SelectChangeEvent } from '@mui/material';
import { ChevronDown as ExpandMoreIcon, ChevronUp as ExpandLessIcon } from 'lucide-react';
import { getAvailableEmbeddingModels, getModelDimensions } from '../../shared/services/knowledge/MobileEmbeddingService';
import { MobileEmbeddingService } from '../../shared/services/knowledge/MobileEmbeddingService';
import {
  DEFAULT_KNOWLEDGE_DOCUMENT_COUNT,
  DEFAULT_DIMENSIONS,
  DEFAULT_CHUNK_SIZE,
  DEFAULT_CHUNK_OVERLAP,
  DEFAULT_KNOWLEDGE_THRESHOLD
} from '../../shared/constants/knowledge';
import type { KnowledgeBase } from '../../shared/types/KnowledgeBase';
import type { Model } from '../../shared/types';

interface CreateKnowledgeDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (knowledgeBase: Partial<KnowledgeBase>) => Promise<void>;
  initialData?: Partial<KnowledgeBase>;
  isEditing?: boolean;
}

const CreateKnowledgeDialog: React.FC<CreateKnowledgeDialogProps> = ({
  open,
  onClose,
  onSave,
  initialData,
  isEditing = false,
}) => {
  const [availableModels, setAvailableModels] = useState<Model[]>([]);
  const [formData, setFormData] = useState<Partial<KnowledgeBase>>({
    name: initialData?.name || '',
    model: initialData?.model || '',
    dimensions: initialData?.dimensions || DEFAULT_DIMENSIONS,
    documentCount: initialData?.documentCount || DEFAULT_KNOWLEDGE_DOCUMENT_COUNT,
    chunkSize: initialData?.chunkSize || DEFAULT_CHUNK_SIZE,
    chunkOverlap: initialData?.chunkOverlap || DEFAULT_CHUNK_OVERLAP,
    threshold: initialData?.threshold || DEFAULT_KNOWLEDGE_THRESHOLD,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // 用于取消异步操作的引用
  const abortControllerRef = useRef<AbortController | null>(null);

  // 加载可用的嵌入模型
  useEffect(() => {
    const models = getAvailableEmbeddingModels();
    setAvailableModels(models);

    // 只在编辑模式下设置初始模型，新建时让用户手动选择
    if (isEditing && !formData.model && models.length > 0) {
      const firstModel = models[0];
      const dimensions = getModelDimensions(firstModel.id);
      setFormData(prev => ({
        ...prev,
        model: firstModel.id,
        dimensions: dimensions
      }));
    }
  }, [isEditing, formData.model]);

  // 当initialData变化时更新formData
  useEffect(() => {
    if (initialData) {
      setFormData({
        name: initialData.name || '',
        model: initialData.model || '',
        dimensions: initialData.dimensions || DEFAULT_DIMENSIONS,
        documentCount: initialData.documentCount || DEFAULT_KNOWLEDGE_DOCUMENT_COUNT,
        chunkSize: initialData.chunkSize || DEFAULT_CHUNK_SIZE,
        chunkOverlap: initialData.chunkOverlap || DEFAULT_CHUNK_OVERLAP,
        threshold: initialData.threshold || DEFAULT_KNOWLEDGE_THRESHOLD,
      });
    } else {
      // 重置为默认值（新建模式）
      setFormData({
        name: '',
        model: '',
        dimensions: DEFAULT_DIMENSIONS,
        documentCount: DEFAULT_KNOWLEDGE_DOCUMENT_COUNT,
        chunkSize: DEFAULT_CHUNK_SIZE,
        chunkOverlap: DEFAULT_CHUNK_OVERLAP,
        threshold: DEFAULT_KNOWLEDGE_THRESHOLD,
      });
    }
  }, [initialData]);

  // 当对话框打开/关闭时清除错误状态
  useEffect(() => {
    if (!open) {
      setErrors({});
      setSubmitError(null);
    }
  }, [open]);

  // 组件卸载时清理异步操作
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    if (!name) return;

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

    // 清除对应字段的错误
    if (errors[name]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  // 处理Slider变化的防抖函数
  const handleSliderChange = useCallback((field: string) => {
    return (_: Event, value: number | number[]) => {
      if (typeof value === 'number') {
        setFormData(prev => ({ ...prev, [field]: value }));
      }
    };
  }, []);

  const handleModelChange = useCallback(async (event: SelectChangeEvent<string>) => {
    const modelId = event.target.value;

    // 取消之前的异步操作
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // 创建新的 AbortController
    abortControllerRef.current = new AbortController();

    // 获取模型的真实维度
    let dimensions;
    try {
      const embeddingService = MobileEmbeddingService.getInstance();
      dimensions = await embeddingService.getEmbeddingDimensions(modelId);
    } catch (error) {
      console.error('获取模型维度失败:', error);
      // 回退到配置文件中的维度
      dimensions = getModelDimensions(modelId);
    }

    // 检查操作是否被取消
    if (!abortControllerRef.current?.signal.aborted) {
      setFormData((prev) => ({
        ...prev,
        model: modelId,
        dimensions,
      }));
    }
  }, []);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    // 验证名称
    if (!formData.name?.trim()) {
      newErrors.name = '知识库名称不能为空';
    }

    // 验证模型
    if (!formData.model) {
      newErrors.model = '请选择嵌入模型';
    }



    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    try {
      setIsSubmitting(true);
      setSubmitError(null);
      await onSave(formData);
      onClose();
    } catch (error) {
      console.error('保存知识库失败:', error);
      setSubmitError(error instanceof Error ? error.message : '保存知识库失败，请稍后再试');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>{isEditing ? '编辑知识库' : '创建知识库'}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={3}>
          {/* 错误提示 */}
          {submitError && (
            <Alert severity="error" onClose={() => setSubmitError(null)}>
              {submitError}
            </Alert>
          )}
          {/* 知识库名称 */}
          <TextField
            autoFocus
            name="name"
            label="知识库名称"
            fullWidth
            required
            value={formData.name}
            onChange={handleInputChange}
            error={!!errors.name}
            helperText={errors.name || '给知识库起一个描述性的名称'}
          />

          {/* 嵌入模型 */}
          <FormControl fullWidth error={!!errors.model}>
            <InputLabel>嵌入模型 *</InputLabel>
            <Select
              name="model"
              value={formData.model || ''}
              onChange={handleModelChange}
              label="嵌入模型 *"
              MenuProps={{
                disableAutoFocus: true,
                disableRestoreFocus: true
              }}
            >
              {availableModels.length > 0 ? (
                availableModels.map((model: Model) => (
                  <MenuItem key={model.id} value={model.id}>
                    {model.name} (来自 {model.provider})
                  </MenuItem>
                ))
              ) : (
                <MenuItem disabled value="">
                  未找到可用的嵌入模型，请先在设置中配置
                </MenuItem>
              )}
            </Select>
            <FormHelperText>
              {errors.model || '用于将文本转换为向量的模型'}
            </FormHelperText>
          </FormControl>

          {/* 文档数量限制 */}
          <Box>
            <Typography gutterBottom>
              请求文档段数量: {formData.documentCount}
            </Typography>
            <Slider
              name="documentCount"
              value={formData.documentCount || 6}
              onChange={handleSliderChange('documentCount')}
              min={1}
              max={30}
              step={1}
              marks={[
                { value: 1, label: '1' },
                { value: 6, label: '默认' },
                { value: 30, label: '30' },
              ]}
              valueLabelDisplay="auto"
              aria-label="文档数量"
            />
            <Typography variant="caption" color="text.secondary">
              搜索时返回的文档段数量，影响回答的详细程度
            </Typography>
          </Box>

          {/* 高级设置 */}
          <Divider />

          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography variant="subtitle1" fontWeight="bold">
              高级设置
            </Typography>
            <IconButton
              onClick={() => setShowAdvanced(!showAdvanced)}
              size="small"
            >
              {showAdvanced ? <ExpandLessIcon size={20} /> : <ExpandMoreIcon size={20} />}
            </IconButton>
          </Box>

          <Collapse in={showAdvanced}>
            <Stack spacing={3} sx={{ mt: 2 }}>
              {/* 分块大小 */}
              <TextField
                name="chunkSize"
                label="分块大小"
                type="number"
                fullWidth
                value={formData.chunkSize}
                onChange={handleInputChange}
                helperText="将文档分割成的块的大小（字符数）"
                slotProps={{
                  htmlInput: { min: 100, max: 5000, step: 100 }
                }}
              />

              {/* 重叠大小 */}
              <TextField
                name="chunkOverlap"
                label="重叠大小"
                type="number"
                fullWidth
                value={formData.chunkOverlap}
                onChange={handleInputChange}
                helperText="每个块之间重叠的字符数"
                slotProps={{
                  htmlInput: { min: 0, max: 1000, step: 50 }
                }}
              />

              {/* 相似度阈值 */}
              <Box>
                <Typography gutterBottom>
                  相似度阈值: {formData.threshold}
                </Typography>
                <Slider
                  name="threshold"
                  value={formData.threshold || 0.7}
                  onChange={handleSliderChange('threshold')}
                  min={0}
                  max={1}
                  step={0.05}
                  marks={[
                    { value: 0, label: '0' },
                    { value: 0.5, label: '0.5' },
                    { value: 1, label: '1' },
                  ]}
                  valueLabelDisplay="auto"
                  aria-label="相似度阈值"
                />
                <Typography variant="caption" color="text.secondary">
                  搜索结果的最低相似度分数，值越高结果越精确
                </Typography>
              </Box>
            </Stack>
          </Collapse>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={isSubmitting}>
          取消
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          color="primary"
          disabled={isSubmitting}
        >
          {isSubmitting ? '保存中...' : isEditing ? '更新' : '创建'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default CreateKnowledgeDialog;

// 增加命名导出以兼容现有导入方式
export { CreateKnowledgeDialog };