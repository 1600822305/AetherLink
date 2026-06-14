import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
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
  CircularProgress,
  Paper,
  alpha,
} from '@mui/material';
import type { SelectChangeEvent } from '@mui/material';
import { ChevronDown as ExpandMoreIcon, ChevronUp as ExpandLessIcon, Save, RotateCcw } from 'lucide-react';
import { getAvailableEmbeddingModels, getModelDimensions } from '../../shared/services/knowledge/MobileEmbeddingService';
import { MobileEmbeddingService } from '../../shared/services/knowledge/MobileEmbeddingService';
import { createLogger } from '../../shared/services/infra/logger';

const logger = createLogger('KnowledgeEditPage');
import {
  DEFAULT_KNOWLEDGE_DOCUMENT_COUNT,
  DEFAULT_DIMENSIONS,
  DEFAULT_CHUNK_SIZE,
  DEFAULT_CHUNK_OVERLAP,
  DEFAULT_KNOWLEDGE_THRESHOLD
} from '../../shared/constants/knowledge';
import type { KnowledgeBase, ChunkStrategy } from '../../shared/types/KnowledgeBase';
import type { Model } from '../../shared/types';
import { MobileKnowledgeService } from '../../shared/services/knowledge/MobileKnowledgeService';
import { useKnowledge } from '../../components/KnowledgeManagement/KnowledgeProvider';
import { toastManager } from '../../components/EnhancedToast';
import { SafeAreaContainer, HeaderBar } from '../../components/settings/SettingComponents';
import Scrollbar from '../../components/Scrollbar';

// ==================== Main Component ====================

const KnowledgeEditPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEditing = !!id;

  const { refreshKnowledgeBases } = useKnowledge();

  const [availableModels, setAvailableModels] = useState<Model[]>([]);
  const [loadingKB, setLoadingKB] = useState(isEditing);
  const [formData, setFormData] = useState<Partial<KnowledgeBase>>({
    name: '',
    model: '',
    dimensions: DEFAULT_DIMENSIONS,
    documentCount: DEFAULT_KNOWLEDGE_DOCUMENT_COUNT,
    chunkSize: DEFAULT_CHUNK_SIZE,
    chunkOverlap: DEFAULT_CHUNK_OVERLAP,
    chunkStrategy: 'fixed',
    threshold: DEFAULT_KNOWLEDGE_THRESHOLD,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);

  // 加载可用的嵌入模型
  useEffect(() => {
    const models = getAvailableEmbeddingModels();
    setAvailableModels(models);
  }, []);

  // 编辑模式：加载现有知识库数据
  useEffect(() => {
    if (!id) return;
    const loadKB = async () => {
      try {
        setLoadingKB(true);
        const kb = await MobileKnowledgeService.getInstance().getKnowledgeBase(id);
        if (kb) {
          setFormData({
            name: kb.name || '',
            model: kb.model || '',
            dimensions: kb.dimensions || DEFAULT_DIMENSIONS,
            documentCount: kb.documentCount || DEFAULT_KNOWLEDGE_DOCUMENT_COUNT,
            chunkSize: kb.chunkSize || DEFAULT_CHUNK_SIZE,
            chunkOverlap: kb.chunkOverlap || DEFAULT_CHUNK_OVERLAP,
            chunkStrategy: kb.chunkStrategy || 'fixed',
            threshold: kb.threshold || DEFAULT_KNOWLEDGE_THRESHOLD,
          });
          // 编辑模式默认展开高级设置
          setShowAdvanced(true);
        } else {
          toastManager.error('未找到该知识库', '加载失败');
          navigate(-1);
        }
      } catch (error) {
        logger.error('加载知识库失败:', error);
        toastManager.error('加载知识库失败', '加载失败');
        navigate(-1);
      } finally {
        setLoadingKB(false);
      }
    };
    loadKB();
  }, [id, navigate]);

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

    if (errors[name]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  const handleSliderChange = useCallback((field: string) => {
    return (_: Event, value: number | number[]) => {
      if (typeof value === 'number') {
        setFormData(prev => ({ ...prev, [field]: value }));
      }
    };
  }, []);

  const handleModelChange = useCallback(async (event: SelectChangeEvent<string>) => {
    const modelId = event.target.value;

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    let dimensions;
    try {
      const embeddingService = MobileEmbeddingService.getInstance();
      dimensions = await embeddingService.getEmbeddingDimensions(modelId);
    } catch (error) {
      logger.error('获取模型维度失败:', error);
      dimensions = getModelDimensions(modelId);
    }

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

    if (!formData.name?.trim()) {
      newErrors.name = '知识库名称不能为空';
    }

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

      if (isEditing && id) {
        const result = await MobileKnowledgeService.getInstance().updateKnowledgeBase(id, formData);
        if (!result) throw new Error('更新失败');
        refreshKnowledgeBases();
        toastManager.success('知识库已更新', '更新成功');
        navigate(-1);
      } else {
        const createdKB = await MobileKnowledgeService.getInstance().createKnowledgeBase(formData as any);
        refreshKnowledgeBases();
        toastManager.success('知识库创建成功！', '创建成功');
        navigate(`/knowledge/${createdKB.id}`, { replace: true });
      }
    } catch (error) {
      logger.error('保存知识库失败:', error);
      setSubmitError(error instanceof Error ? error.message : '保存知识库失败，请稍后再试');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    if (isEditing) {
      // 编辑模式重新加载
      if (id) {
        MobileKnowledgeService.getInstance().getKnowledgeBase(id).then(kb => {
          if (kb) {
            setFormData({
              name: kb.name || '',
              model: kb.model || '',
              dimensions: kb.dimensions || DEFAULT_DIMENSIONS,
              documentCount: kb.documentCount || DEFAULT_KNOWLEDGE_DOCUMENT_COUNT,
              chunkSize: kb.chunkSize || DEFAULT_CHUNK_SIZE,
              chunkOverlap: kb.chunkOverlap || DEFAULT_CHUNK_OVERLAP,
              chunkStrategy: kb.chunkStrategy || 'fixed',
              threshold: kb.threshold || DEFAULT_KNOWLEDGE_THRESHOLD,
            });
          }
        });
      }
    } else {
      setFormData({
        name: '',
        model: '',
        dimensions: DEFAULT_DIMENSIONS,
        documentCount: DEFAULT_KNOWLEDGE_DOCUMENT_COUNT,
        chunkSize: DEFAULT_CHUNK_SIZE,
        chunkOverlap: DEFAULT_CHUNK_OVERLAP,
        chunkStrategy: 'fixed',
        threshold: DEFAULT_KNOWLEDGE_THRESHOLD,
      });
    }
    setErrors({});
    setSubmitError(null);
  };

  const handleBack = () => navigate(-1);

  if (loadingKB) {
    return (
      <SafeAreaContainer>
        <HeaderBar title="加载中..." onBackPress={handleBack} />
        <Box display="flex" justifyContent="center" alignItems="center" height="50vh">
          <CircularProgress />
        </Box>
      </SafeAreaContainer>
    );
  }

  return (
    <SafeAreaContainer>
      <HeaderBar
        title={isEditing ? '编辑知识库' : '新建知识库'}
        onBackPress={handleBack}
        rightButton={
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            <IconButton size="small" onClick={handleReset} title="重置">
              <RotateCcw size={18} />
            </IconButton>
            <IconButton
              size="small"
              onClick={handleSubmit}
              disabled={isSubmitting}
              sx={{ color: 'primary.main' }}
              title={isEditing ? '保存更改' : '创建'}
            >
              {isSubmitting ? <CircularProgress size={18} /> : <Save size={18} />}
            </IconButton>
          </Box>
        }
      />

      <Scrollbar>
        <Box sx={{ px: { xs: 2, sm: 3 }, py: 2, pb: 'var(--content-bottom-padding)', maxWidth: 640, mx: 'auto' }}>
          <Stack spacing={3}>
            {/* 错误提示 */}
            {submitError && (
              <Alert severity="error" onClose={() => setSubmitError(null)}>
                {submitError}
              </Alert>
            )}

            {/* 基本信息 */}
            <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 3 }}>
              <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 2, color: 'text.secondary', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                基本信息
              </Typography>
              <Stack spacing={2.5}>
                {/* 知识库名称 */}
                <TextField
                  name="name"
                  label="知识库名称"
                  fullWidth
                  required
                  value={formData.name}
                  onChange={handleInputChange}
                  error={!!errors.name}
                  helperText={errors.name || '给知识库起一个描述性的名称'}
                  size="small"
                />

                {/* 嵌入模型 */}
                <FormControl fullWidth error={!!errors.model} size="small">
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
                          {model.name} (来自 {model.providerName || model.provider})
                        </MenuItem>
                      ))
                    ) : (
                      <MenuItem disabled value="">
                        未找到可用的嵌入模型，请先在设置中配置
                      </MenuItem>
                    )}
                  </Select>
                  <FormHelperText>
                    {errors.model || `用于将文本转换为向量的模型${formData.dimensions ? ` · 维度: ${formData.dimensions}` : ''}`}
                  </FormHelperText>
                </FormControl>
              </Stack>
            </Paper>

            {/* 检索设置 */}
            <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 3 }}>
              <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 2, color: 'text.secondary', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                检索设置
              </Typography>
              <Box>
                <Typography variant="body2" gutterBottom>
                  请求文档段数量: <strong>{formData.documentCount}</strong>
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
                  sx={{ mt: 1 }}
                />
                <Typography variant="caption" color="text.secondary">
                  搜索时返回的文档段数量，影响回答的详细程度
                </Typography>
              </Box>
            </Paper>

            {/* 高级设置 */}
            <Paper variant="outlined" sx={{ borderRadius: 3, overflow: 'hidden' }}>
              <Box
                onClick={() => setShowAdvanced(!showAdvanced)}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  px: 2.5,
                  py: 1.5,
                  cursor: 'pointer',
                  '&:hover': { bgcolor: (theme) => alpha(theme.palette.primary.main, 0.04) },
                  transition: 'background-color 0.15s',
                }}
              >
                <Typography variant="subtitle2" fontWeight={600} sx={{ color: 'text.secondary', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  高级设置
                </Typography>
                <IconButton size="small" sx={{ pointerEvents: 'none' }}>
                  {showAdvanced ? <ExpandLessIcon size={18} /> : <ExpandMoreIcon size={18} />}
                </IconButton>
              </Box>

              <Collapse in={showAdvanced}>
                <Divider />
                <Box sx={{ p: 2.5 }}>
                  <Stack spacing={2.5}>
                    {/* 分块策略 */}
                    <FormControl fullWidth size="small">
                      <InputLabel>分块策略</InputLabel>
                      <Select
                        name="chunkStrategy"
                        value={formData.chunkStrategy || 'fixed'}
                        onChange={(e) => setFormData(prev => ({ ...prev, chunkStrategy: e.target.value as ChunkStrategy }))}
                        label="分块策略"
                        MenuProps={{ disableAutoFocus: true, disableRestoreFocus: true }}
                      >
                        <MenuItem value="fixed">固定大小</MenuItem>
                        <MenuItem value="paragraph">按段落</MenuItem>
                        <MenuItem value="markdown">按 Markdown 标题</MenuItem>
                        <MenuItem value="code">按代码结构</MenuItem>
                      </Select>
                      <FormHelperText>
                        {{
                          fixed: '按固定字符数分割，保留句子边界',
                          paragraph: '按段落（双换行）分割，保持段落完整',
                          markdown: '按 Markdown 标题层级分割，适合文档类内容',
                          code: '按函数/类定义分割，适合代码文件',
                        }[formData.chunkStrategy || 'fixed']}
                      </FormHelperText>
                    </FormControl>

                    {/* 分块大小 + 重叠 */}
                    <Box sx={{ display: 'flex', gap: 2 }}>
                      <TextField
                        name="chunkSize"
                        label="分块大小"
                        type="number"
                        fullWidth
                        size="small"
                        value={formData.chunkSize}
                        onChange={handleInputChange}
                        helperText="块的字符数"
                        slotProps={{
                          htmlInput: { min: 100, max: 5000, step: 100 }
                        }}
                      />
                      <TextField
                        name="chunkOverlap"
                        label="重叠大小"
                        type="number"
                        fullWidth
                        size="small"
                        value={formData.chunkOverlap}
                        onChange={handleInputChange}
                        helperText="块间重叠字符数"
                        slotProps={{
                          htmlInput: { min: 0, max: 1000, step: 50 }
                        }}
                      />
                    </Box>

                    {/* 相似度阈值 */}
                    <Box>
                      <Typography variant="body2" gutterBottom>
                        相似度阈值: <strong>{formData.threshold}</strong>
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
                        sx={{ mt: 1 }}
                      />
                      <Typography variant="caption" color="text.secondary">
                        搜索结果的最低相似度分数，值越高结果越精确
                      </Typography>
                    </Box>
                  </Stack>
                </Box>
              </Collapse>
            </Paper>

            {/* 底部操作按钮 */}
            <Box sx={{ display: 'flex', gap: 1.5, justifyContent: 'flex-end', pt: 1, pb: 2 }}>
              <Button
                variant="outlined"
                onClick={handleBack}
                disabled={isSubmitting}
              >
                取消
              </Button>
              <Button
                variant="contained"
                onClick={handleSubmit}
                disabled={isSubmitting}
                startIcon={isSubmitting ? <CircularProgress size={16} /> : <Save size={16} />}
              >
                {isSubmitting ? '保存中...' : isEditing ? '保存更改' : '创建知识库'}
              </Button>
            </Box>
          </Stack>
        </Box>
      </Scrollbar>
    </SafeAreaContainer>
  );
};

export default KnowledgeEditPage;
