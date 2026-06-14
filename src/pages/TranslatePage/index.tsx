/**
 * 翻译页面
 * - 移动端：上下布局
 * - 桌面端：左右布局 (类似 Cherry Studio)
 */
import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import {
  Box,
  IconButton,
  TextField,
  Typography,
  Select,
  MenuItem,
  FormControl,
  CircularProgress,
  Tooltip,
  Paper,
  useTheme,
  useMediaQuery,
  Fab,
  Drawer,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Divider,
} from '@mui/material';
import {
  ArrowLeft,
  Languages,
  Copy,
  Check,
  History,
  Trash2,
  Star,
  StarOff,
  Send,
  X,
  ArrowRightLeft,
  Camera,
  Image,
} from 'lucide-react';
import {
  translateText,
  saveTranslateHistory,
  getTranslateHistories,
  deleteTranslateHistory,
  toggleHistoryStar,
  clearTranslateHistory,
  getTranslateModel,
  recognizeImageText,
  type TranslateHistory,
} from '../../shared/services/translate';
import {
  builtinLanguages,
  getLanguageByLangcode,
  LanguagesEnum,
} from '../../shared/services/translate/TranslateConfig';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { selectProviders } from '../../shared/store/selectors/settingsSelectors';
import { SolidBridge } from '../../shared/bridges/SolidBridge';
import { DialogModelSelector as SolidDialogModelSelector } from '../../solid/components/ModelSelector/DialogModelSelector.solid';
import type { Model } from '../../shared/types';
import { getModelOrProviderIcon } from '../../shared/utils/providerIcons';
import { ImageUploadService } from '../../shared/services/files/ImageUploadService';
import { createLogger } from '../../shared/services/infra/logger';

const logger = createLogger('TranslatePage');

// 提取到组件外部，避免每次渲染都重新创建
const LanguageSelector = React.memo(({ value, onChange, showAuto = false }: {
  value: string;
  onChange: (value: string) => void;
  showAuto?: boolean;
}) => (
  <FormControl size="small" sx={{ minWidth: 120 }}>
    <Select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      sx={{
        '& .MuiSelect-select': {
          display: 'flex',
          alignItems: 'center',
          gap: 1,
        }
      }}
    >
      {showAuto && (
        <MenuItem value="auto">
          <span>🔍</span>
          <span style={{ marginLeft: 8 }}>自动检测</span>
        </MenuItem>
      )}
      {builtinLanguages.map((lang) => (
        <MenuItem key={lang.langCode} value={lang.langCode}>
          <span>{lang.emoji}</span>
          <span style={{ marginLeft: 8 }}>{lang.label}</span>
        </MenuItem>
      ))}
    </Select>
  </FormControl>
));

LanguageSelector.displayName = 'LanguageSelector';

const TranslatePage: React.FC = () => {
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));
  const themeMode = theme.palette.mode;
  
  // Redux 状态
  const providers = useSelector(selectProviders);
  
  // 获取所有可用模型
  const availableModels = useMemo(() => {
    const models: Model[] = [];
    providers.forEach((provider: any) => {
      if (provider.models && Array.isArray(provider.models)) {
        provider.models.forEach((model: Model) => {
          models.push({ ...model, provider: provider.id });
        });
      }
    });
    return models;
  }, [providers]);
  
  // 状态
  const [sourceText, setSourceText] = useState('');
  const [translatedText, setTranslatedText] = useState('');
  const [sourceLanguage, setSourceLanguage] = useState<'auto' | string>(() => {
    try {
      return localStorage.getItem('translate_source_language') || 'auto';
    } catch { return 'auto'; }
  });
  const [targetLanguage, setTargetLanguage] = useState<string>(() => {
    try {
      return localStorage.getItem('translate_target_language') || LanguagesEnum.enUS.langCode;
    } catch { return LanguagesEnum.enUS.langCode; }
  });
  const [isTranslating, setIsTranslating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [histories, setHistories] = useState<TranslateHistory[]>([]);
  const [modelMenuOpen, setModelMenuOpen] = useState(false);
  const [isOcrProcessing, setIsOcrProcessing] = useState(false);
  const [selectedModel, setSelectedModel] = useState<Model | null>(() => {
    // 从 localStorage 读取保存的翻译模型
    try {
      const savedModel = localStorage.getItem('translate_selected_model');
      if (savedModel) {
        return JSON.parse(savedModel);
      }
    } catch (e) {
      logger.error('读取保存的模型失败:', e);
    }
    // 如果没有保存的模型，使用默认翻译模型
    return getTranslateModel();
  });
  
  const abortControllerRef = useRef<AbortController | null>(null);

  // 语言选择持久化包装
  const handleSourceLanguageChange = useCallback((lang: string) => {
    setSourceLanguage(lang);
    try { localStorage.setItem('translate_source_language', lang); } catch {}
  }, []);

  const handleTargetLanguageChange = useCallback((lang: string) => {
    setTargetLanguage(lang);
    try { localStorage.setItem('translate_target_language', lang); } catch {}
  }, []);

  // 模型选择处理
  const handleModelSelect = useCallback((model: Model) => {
    setSelectedModel(model);
    setModelMenuOpen(false);
    // 保存到 localStorage
    try {
      localStorage.setItem('translate_selected_model', JSON.stringify(model));
    } catch (e) {
      logger.error('保存模型失败:', e);
    }
  }, []);

  // 加载历史记录
  useEffect(() => {
    getTranslateHistories().then(setHistories);
  }, []);

  // 翻译处理
  const handleTranslate = useCallback(async () => {
    if (!sourceText.trim() || isTranslating) return;

    // 使用用户选择的模型，如果没有选择则使用默认模型
    const model = selectedModel || getTranslateModel();
    if (!model) {
      alert('请先选择翻译模型');
      return;
    }

    setIsTranslating(true);
    setTranslatedText('');
    
    abortControllerRef.current = new AbortController();
    const targetLang = getLanguageByLangcode(targetLanguage);

    try {
      const result = await translateText(
        sourceText,
        targetLang,
        (text, _isComplete) => {
          setTranslatedText(text);
        },
        abortControllerRef.current.signal,
        model // 传递用户选择的模型
      );

      // 保存历史
      const sourceLang = sourceLanguage === 'auto' ? 'auto' : sourceLanguage;
      await saveTranslateHistory(sourceText, result, sourceLang, targetLanguage);
      setHistories(await getTranslateHistories());
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        logger.error('Translation failed:', error);
        setTranslatedText(`翻译失败: ${(error as Error).message}`);
      }
    } finally {
      setIsTranslating(false);
      abortControllerRef.current = null;
    }
  }, [sourceText, targetLanguage, sourceLanguage, isTranslating]);

  // 停止翻译
  const handleAbort = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  }, []);

  // 拍照翻译 - OCR 识别图片中的文字
  const handlePhotoTranslate = useCallback(async (source: 'camera' | 'photos') => {
    if (isOcrProcessing) return;
    
    try {
      setIsOcrProcessing(true);
      
      // 获取图片
      const images = await ImageUploadService.selectImages(source);
      if (!images || images.length === 0) {
        setIsOcrProcessing(false);
        return;
      }
      
      const image = images[0];
      if (!image.base64Data) {
        setIsOcrProcessing(false);
        return;
      }
      
      // 使用 TranslateService 的 OCR 函数，流式显示识别结果
      const model = selectedModel || getTranslateModel();
      const recognizedText = await recognizeImageText(
        image.base64Data,
        (ocrText, _isComplete) => {
          // 流式更新识别的文字到输入框
          setSourceText(ocrText);
        },
        undefined,
        model
      );
      
      // OCR 完成后自动翻译
      if (recognizedText && recognizedText !== '未识别到文字') {
        const text = recognizedText.trim();
        setSourceText(text);
        
        // 自动翻译成用户选择的目标语言
        setIsOcrProcessing(false);
        setIsTranslating(true);
        setTranslatedText('');
        
        const targetLang = getLanguageByLangcode(targetLanguage);
        try {
          const result = await translateText(
            text,
            targetLang,
            (translatedChunk, _isComplete) => {
              setTranslatedText(translatedChunk);
            },
            undefined,
            model
          );
          
          // 保存历史
          const sourceLang = sourceLanguage === 'auto' ? 'auto' : sourceLanguage;
          await saveTranslateHistory(text, result, sourceLang, targetLanguage);
          setHistories(await getTranslateHistories());
        } catch (translateError) {
          logger.error('Translation failed:', translateError);
          setTranslatedText(`翻译失败: ${(translateError as Error).message}`);
        } finally {
          setIsTranslating(false);
        }
      } else {
        alert('未能识别到图片中的文字');
        setIsOcrProcessing(false);
      }
    } catch (error) {
      logger.error('OCR failed:', error);
      alert(`图片识别失败: ${(error as Error).message}`);
      setIsOcrProcessing(false);
    }
  }, [isOcrProcessing, selectedModel, targetLanguage, sourceLanguage]);

  // 复制结果
  const handleCopy = useCallback(async () => {
    if (!translatedText) return;
    try {
      await navigator.clipboard.writeText(translatedText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      logger.error('Copy failed:', error);
    }
  }, [translatedText]);

  // 交换语言
  const handleSwapLanguages = useCallback(() => {
    if (sourceLanguage === 'auto') return;
    const temp = sourceLanguage;
    handleSourceLanguageChange(targetLanguage);
    handleTargetLanguageChange(temp);
    // 同时交换文本
    setSourceText(translatedText);
    setTranslatedText(sourceText);
  }, [sourceLanguage, targetLanguage, sourceText, translatedText]);

  // 选择历史记录
  const handleSelectHistory = useCallback((history: TranslateHistory) => {
    setSourceText(history.sourceText);
    setTranslatedText(history.targetText);
    handleSourceLanguageChange(history.sourceLanguage);
    handleTargetLanguageChange(history.targetLanguage);
    setHistoryOpen(false);
  }, []);

  // 删除历史
  const handleDeleteHistory = useCallback(async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await deleteTranslateHistory(id);
    setHistories(await getTranslateHistories());
  }, []);

  // 切换收藏
  const handleToggleStar = useCallback(async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await toggleHistoryStar(id);
    setHistories(await getTranslateHistories());
  }, []);

  // 清空历史
  const handleClearHistory = useCallback(async () => {
    if (confirm('确定要清空所有翻译历史吗？')) {
      await clearTranslateHistory();
      setHistories([]);
    }
  }, []);

  // 按 Enter 翻译
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      handleTranslate();
    }
  }, [handleTranslate]);

  // 关闭历史抽屉的回调
  const handleCloseHistory = useCallback(() => setHistoryOpen(false), []);

  // 模型选择器 props - 使用 useMemo 避免不必要的重渲染
  const modelSelectorProps = useMemo(() => ({
    selectedModel: selectedModel,
    availableModels: availableModels,
    handleModelSelect: handleModelSelect,
    handleMenuClose: () => setModelMenuOpen(false),
    menuOpen: modelMenuOpen,
    providers: providers,
    themeMode: themeMode as 'light' | 'dark',
    fullScreen: fullScreen,
  }), [selectedModel, availableModels, handleModelSelect, modelMenuOpen, providers, themeMode, fullScreen]);

  // 历史记录抽屉 - 使用 useMemo 避免不必要的重渲染
  const historyDrawer = useMemo(() => (
    <Drawer
      anchor={isMobile ? 'bottom' : 'right'}
      open={historyOpen}
      onClose={handleCloseHistory}
      PaperProps={{
        sx: {
          width: isMobile ? '100%' : 360,
          height: isMobile ? '70vh' : '100%',
          borderRadius: isMobile ? '16px 16px 0 0' : 0,
        }
      }}
    >
      <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h6">翻译历史</Typography>
        <Box>
          {histories.length > 0 && (
            <IconButton size="small" onClick={handleClearHistory} color="error">
              <Trash2 size={18} />
            </IconButton>
          )}
          <IconButton size="small" onClick={() => setHistoryOpen(false)}>
            <X size={18} />
          </IconButton>
        </Box>
      </Box>
      <Divider />
      <List sx={{ flex: 1, overflow: 'auto' }}>
        {histories.length === 0 ? (
          <Box sx={{ p: 4, textAlign: 'center', color: 'text.secondary' }}>
            暂无翻译历史
          </Box>
        ) : (
          histories.map((history) => (
            <ListItem
              key={history.id}
              onClick={() => handleSelectHistory(history)}
              sx={{
                cursor: 'pointer',
                '&:hover': { bgcolor: 'action.hover' },
                flexDirection: 'column',
                alignItems: 'flex-start',
              }}
            >
              <Box sx={{ display: 'flex', width: '100%', justifyContent: 'space-between', mb: 0.5 }}>
                <Typography variant="caption" color="text.secondary">
                  {getLanguageByLangcode(history.sourceLanguage).label} → {getLanguageByLangcode(history.targetLanguage).label}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {new Date(history.createdAt).toLocaleDateString()}
                </Typography>
              </Box>
              <ListItemText
                primary={
                  <Typography
                    variant="body2"
                    sx={{
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                    }}
                  >
                    {history.sourceText}
                  </Typography>
                }
                secondary={
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                    }}
                  >
                    {history.targetText}
                  </Typography>
                }
              />
              <ListItemSecondaryAction>
                <IconButton
                  size="small"
                  onClick={(e) => handleToggleStar(history.id, e)}
                >
                  {history.star ? <Star size={16} color="#f59e0b" fill="#f59e0b" /> : <StarOff size={16} />}
                </IconButton>
                <IconButton
                  size="small"
                  onClick={(e) => handleDeleteHistory(history.id, e)}
                >
                  <Trash2 size={16} />
                </IconButton>
              </ListItemSecondaryAction>
            </ListItem>
          ))
        )}
      </List>
    </Drawer>
  ), [isMobile, historyOpen, handleCloseHistory, histories, handleClearHistory, handleSelectHistory, handleToggleStar, handleDeleteHistory]);

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        bgcolor: 'background.default',
      }}
    >
      {/* 顶部导航栏 */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 2,
          py: 1,
          pt: `calc(var(--safe-area-top, 0px) + 8px)`,
          borderBottom: '1px solid',
          borderColor: 'divider',
          bgcolor: 'background.paper',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <IconButton onClick={() => navigate(-1)} size="small">
            <ArrowLeft size={20} />
          </IconButton>
          <Languages size={24} />
          <Typography variant="h6" fontWeight="medium">
            翻译
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          {/* 模型选择器按钮 - 只显示图标 */}
          <Tooltip title={selectedModel?.name || selectedModel?.id || '选择模型'}>
            <IconButton
              onClick={() => setModelMenuOpen(true)}
              sx={{
                width: 36,
                height: 36,
                borderRadius: '8px',
                bgcolor: 'action.hover',
                '&:hover': { bgcolor: 'action.selected' },
              }}
            >
              <Box
                component="img"
                src={selectedModel 
                  ? getModelOrProviderIcon(selectedModel.id, selectedModel.provider || '', themeMode === 'dark')
                  : '/images/providerIcons/dark/custom.png'
                }
                alt="model"
                sx={{
                  width: 22,
                  height: 22,
                  borderRadius: '4px',
                  objectFit: 'contain',
                }}
              />
            </IconButton>
          </Tooltip>
          <IconButton onClick={() => setHistoryOpen(true)}>
            <History size={20} />
          </IconButton>
        </Box>
      </Box>

      {/* SolidJS 模型选择器 */}
      <SolidBridge
        component={SolidDialogModelSelector as any}
        props={modelSelectorProps}
        debugName="TranslateModelSelector"
      />

      {/* 语言选择栏 */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 1,
          px: 2,
          py: 1.5,
          borderBottom: '1px solid',
          borderColor: 'divider',
          bgcolor: 'background.paper',
        }}
      >
        <LanguageSelector value={sourceLanguage} onChange={handleSourceLanguageChange} showAuto />
        <IconButton
          size="small"
          onClick={handleSwapLanguages}
          disabled={sourceLanguage === 'auto'}
          sx={{ mx: 1 }}
        >
          <ArrowRightLeft size={18} />
        </IconButton>
        <LanguageSelector value={targetLanguage} onChange={handleTargetLanguageChange} />
      </Box>

      {/* 内容区域 - 响应式布局 */}
      <Box
        sx={{
          flex: 1,
          display: 'flex',
          flexDirection: isMobile ? 'column' : 'row',
          overflow: 'hidden',
          gap: isMobile ? 0 : 2,
          p: isMobile ? 0 : 2,
        }}
      >
        {/* 输入区域 */}
        <Paper
          elevation={0}
          sx={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            borderRadius: isMobile ? 0 : 2,
            bgcolor: 'background.default',
            border: isMobile ? 'none' : '1px solid',
            borderColor: 'divider',
          }}
        >
          <TextField
            multiline
            fullWidth
            placeholder="输入要翻译的文本..."
            value={sourceText}
            onChange={(e) => setSourceText(e.target.value)}
            onKeyDown={handleKeyDown}
            sx={{
              flex: 1,
              '& .MuiOutlinedInput-root': {
                height: '100%',
                alignItems: 'flex-start',
                bgcolor: 'transparent',
                '& fieldset': { border: 'none' },
              },
              '& .MuiInputBase-input': {
                height: '100% !important',
                overflow: 'auto !important',
              },
            }}
            slotProps={{
              input: {
                sx: { p: 2, height: '100%' },
              }
            }}
          />
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              px: 2,
              py: 1,
              minHeight: 52,  // 统一底部栏高度
              borderTop: '1px solid',
              borderColor: 'divider',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="caption" color="text.secondary">
                {sourceText.length} 字符
              </Typography>
              {/* 拍照翻译按钮组 */}
              <Tooltip title="拍照识别文字">
                <IconButton
                  size="small"
                  onClick={() => handlePhotoTranslate('camera')}
                  disabled={isOcrProcessing}
                  sx={{ color: 'primary.main' }}
                >
                  {isOcrProcessing ? <CircularProgress size={16} /> : <Camera size={18} />}
                </IconButton>
              </Tooltip>
              <Tooltip title="从相册选择图片识别">
                <IconButton
                  size="small"
                  onClick={() => handlePhotoTranslate('photos')}
                  disabled={isOcrProcessing}
                  sx={{ color: 'secondary.main' }}
                >
                  <Image size={18} />
                </IconButton>
              </Tooltip>
            </Box>
            <Box sx={{ display: 'flex', gap: 1 }}>
              {sourceText && (
                <IconButton size="small" onClick={() => {
                  setSourceText('');
                  setTranslatedText('');
                }}>
                  <X size={18} />
                </IconButton>
              )}
              <Tooltip title={isTranslating ? '停止翻译' : '翻译 (Enter)'}>
                <span>
                  <Fab
                    size="small"
                    color="primary"
                    onClick={isTranslating ? handleAbort : handleTranslate}
                    disabled={!sourceText.trim() && !isTranslating}
                  >
                    {isTranslating ? <CircularProgress size={20} color="inherit" /> : <Send size={18} />}
                  </Fab>
                </span>
              </Tooltip>
            </Box>
          </Box>
        </Paper>

        {/* 分隔线 (仅移动端) */}
        {isMobile && <Divider />}

        {/* 输出区域 */}
        <Paper
          elevation={0}
          sx={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            borderRadius: isMobile ? 0 : 2,
            bgcolor: 'action.hover',
            border: isMobile ? 'none' : '1px solid',
            borderColor: 'divider',
          }}
        >
          <Box
            sx={{
              flex: 1,
              p: 2,
              overflow: 'auto',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
          >
            {translatedText ? (
              <Typography variant="body1">{translatedText}</Typography>
            ) : (
              <Typography variant="body1" color="text.secondary">
                翻译结果将显示在这里...
              </Typography>
            )}
          </Box>
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'flex-end',
              alignItems: 'center',
              px: 2,
              py: 1,
              pb: `calc(var(--safe-area-bottom, 0px) + 8px)`,
              minHeight: 52,  // 统一底部栏高度
              borderTop: '1px solid',
              borderColor: 'divider',
            }}
          >
            <Tooltip title={copied ? '已复制' : '复制'}>
              <span>
                <Fab
                  size="small"
                  onClick={handleCopy}
                  disabled={!translatedText}
                  color={copied ? 'success' : 'default'}
                  sx={{ boxShadow: 'none' }}
                >
                  {copied ? <Check size={18} /> : <Copy size={18} />}
                </Fab>
              </span>
            </Tooltip>
          </Box>
        </Paper>
      </Box>

      {/* 历史记录抽屉 */}
      {historyDrawer}
    </Box>
  );
};

export default TranslatePage;
