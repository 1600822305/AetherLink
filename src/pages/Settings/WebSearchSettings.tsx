import React, { useState } from 'react';
import {
  Box,
  Typography,
  FormControl,
  FormControlLabel,
  TextField,
  Button,
  Card,
  CardContent,
  CardActions,
  Select,
  MenuItem,
  Slider,
  Tooltip,
  Alert,
  DialogTitle,
  DialogContent,
  DialogActions,
  Chip,
  alpha,
  InputAdornment,
  IconButton,
} from '@mui/material';
import BackButtonDialog from '../../components/common/BackButtonDialog';
import CustomSwitch from '../../components/CustomSwitch';
import type { SelectChangeEvent } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { Plus as AddIcon, Trash2 as DeleteIcon, Edit as EditIcon, Info as InfoOutlinedIcon, Key as KeyIcon, Eye, EyeOff, CheckCircle2, XCircle } from 'lucide-react';
import { useDispatch, useSelector } from 'react-redux';
import type { WebSearchProvider, WebSearchCustomProvider, CustomSearchProtocol } from '../../shared/types';
import EnhancedWebSearchService from '../../shared/services/webSearch/EnhancedWebSearchService';
import { customProviderToConfig, parseCustomJsonTemplate, getCustomProviderProtocol } from '../../shared/services/webSearch/customProtocols';
import { v4 as uuidv4 } from 'uuid';
import { useTranslation } from '../../i18n';
import { SafeAreaContainer, Container, HeaderBar, YStack, SettingGroup, Row } from '../../components/settings/SettingComponents';
import useScrollPosition from '../../hooks/useScrollPosition';
import {
  toggleWebSearchEnabled,
  setWebSearchProvider,
  setWebSearchApiKey,
  setWebSearchMaxResults,
  toggleIncludeInContext,
  toggleShowTimestamp,
  toggleFilterSafeSearch,
  addCustomProvider,
  updateCustomProvider,
  deleteCustomProvider,
  toggleCustomProviderEnabled,
  toggleSearchWithTime,
  setExcludeDomains,
  updateProvider,

  // 🚀 新增：Tavily最佳实践相关actions
  setSearchDepth,
  setChunksPerSource,
  toggleIncludeRawContent,
  toggleIncludeAnswer,
  setMinScore,
  toggleQueryValidation,
  togglePostProcessing,
  toggleSmartSearch,
  setTimeRange,
  setNewsSearchDays,
} from '../../shared/store/slices/webSearchSlice';
import type { RootState } from '../../shared/store';

const WebSearchSettings: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { t } = useTranslation();

  // 使用滚动位置保存功能
  const {
    containerRef,
    handleScroll
  } = useScrollPosition('settings-websearch', {
    autoRestore: true,
    restoreDelay: 0
  });

  // 从Redux获取设置
  const webSearchSettings = useSelector((state: RootState) => state.webSearch) || {
    enabled: false,
    provider: 'firecrawl' as WebSearchProvider,
    apiKey: '',
    includeInContext: true,
    maxResults: 5,
    showTimestamp: true,
    filterSafeSearch: true,
    searchWithTime: false,
    excludeDomains: [],
    providers: [],
    customProviders: []
  };

  const [editingProvider, setEditingProvider] = useState<WebSearchCustomProvider | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [testState, setTestState] = useState<{ status: 'idle' | 'testing' | 'success' | 'error'; error?: string }>({ status: 'idle' });

  // 获取提供商状态配置
  const getProviderStatusConfig = (providerId: string) => {
    const configs: Record<string, { labelKey: string; color: 'success' | 'primary' | 'warning' | 'info' }> = {
      'tavily': { labelKey: 'settings.webSearch.basic.provider.status.recommended', color: 'primary' },
      'exa': { labelKey: 'settings.webSearch.basic.provider.status.neuralSearch', color: 'info' },
      'bocha': { labelKey: 'settings.webSearch.basic.provider.status.aiSearch', color: 'warning' },
      'firecrawl': { labelKey: 'settings.webSearch.basic.provider.status.webScraping', color: 'info' },
      'custom': { labelKey: 'settings.webSearch.basic.provider.status.custom', color: 'info' },
    };
    const config = configs[providerId] || { labelKey: 'settings.webSearch.basic.provider.status.unknown', color: 'info' };
    return { label: t(config.labelKey), color: config.color };
  };

  const handleBack = () => {
    navigate('/settings');
  };

  const handleToggleEnabled = () => {
    dispatch(toggleWebSearchEnabled());
  };

  const handleProviderChange = (event: SelectChangeEvent) => {
    dispatch(setWebSearchProvider(event.target.value as WebSearchProvider));
  };

  const handleApiKeyChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    dispatch(setWebSearchApiKey(event.target.value));
  };

  const handleMaxResultsChange = (_: Event, newValue: number | number[]) => {
    dispatch(setWebSearchMaxResults(newValue as number));
  };

  const handleToggleIncludeInContext = () => {
    dispatch(toggleIncludeInContext());
  };

  const handleToggleShowTimestamp = () => {
    dispatch(toggleShowTimestamp());
  };

  const handleToggleFilterSafeSearch = () => {
    dispatch(toggleFilterSafeSearch());
  };

  const handleAddCustomProvider = () => {
    const newProvider: WebSearchCustomProvider = {
      id: uuidv4(),
      name: t('settings.webSearch.basic.customProviders.newName'),
      apiKey: '',
      baseUrl: '',
      enabled: true,
      protocol: 'searxng'
    };

    setTestState({ status: 'idle' });
    setEditingProvider(newProvider);
    setIsEditing(true);
  };

  const handleEditProvider = (provider: WebSearchCustomProvider) => {
    setTestState({ status: 'idle' });
    setEditingProvider({ ...provider, protocol: getCustomProviderProtocol(provider) });
    setIsEditing(true);
  };

  const handleDeleteProvider = (id: string) => {
    dispatch(deleteCustomProvider(id));
  };

  const handleSaveProvider = () => {
    if (!editingProvider) return;

    if (editingProvider.id && webSearchSettings.customProviders?.some(p => p.id === editingProvider.id)) {
      dispatch(updateCustomProvider(editingProvider));
    } else {
      dispatch(addCustomProvider(editingProvider));
    }

    setEditingProvider(null);
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setEditingProvider(null);
    setIsEditing(false);
  };

  const handleProviderFieldChange = (field: keyof WebSearchCustomProvider, value: string | boolean) => {
    if (!editingProvider) return;

    setTestState({ status: 'idle' });
    setEditingProvider(prev => ({
      ...prev!,
      [field]: value
    }));
  };

  const editingProtocol: CustomSearchProtocol = editingProvider?.protocol || 'searxng';
  const editingTemplateInvalid =
    editingProtocol === 'custom-json' &&
    !!editingProvider?.customTemplateJson?.trim() &&
    !parseCustomJsonTemplate(editingProvider.customTemplateJson);

  const handleTestProvider = async () => {
    if (!editingProvider) return;
    setTestState({ status: 'testing' });
    const result = await EnhancedWebSearchService.checkSearch(customProviderToConfig(editingProvider));
    if (result.valid) {
      setTestState({ status: 'success' });
    } else {
      setTestState({ status: 'error', error: result.error?.message || String(result.error || '') });
    }
  };

  // 🚀 新增：Tavily最佳实践相关处理函数
  const handleSearchDepthChange = (event: SelectChangeEvent) => {
    dispatch(setSearchDepth(event.target.value as 'basic' | 'advanced'));
  };

  const handleChunksPerSourceChange = (_: Event, newValue: number | number[]) => {
    dispatch(setChunksPerSource(newValue as number));
  };

  const handleMinScoreChange = (_: Event, newValue: number | number[]) => {
    dispatch(setMinScore((newValue as number) / 100)); // 转换为0-1范围
  };

  const handleTimeRangeChange = (event: SelectChangeEvent) => {
    dispatch(setTimeRange(event.target.value as 'day' | 'week' | 'month' | 'year'));
  };

  const handleNewsSearchDaysChange = (_: Event, newValue: number | number[]) => {
    dispatch(setNewsSearchDays(newValue as number));
  };

  // 🚀 新增：Cloudflare AI Search 配置处理函数
  const handleCloudflareFieldChange = (field: 'accountId' | 'autoragName', value: string) => {
    const currentProvider = webSearchSettings.providers.find(p => p.id === 'cloudflare-ai-search');
    if (currentProvider) {
      dispatch(updateProvider({
        ...currentProvider,
        [field]: value
      }));
    }
  };

  const getCurrentCloudflareProvider = () => {
    return webSearchSettings.providers.find(p => p.id === 'cloudflare-ai-search');
  };

  // 渲染主要内容
  return (
    <SafeAreaContainer>
      <HeaderBar title={t('settings.webSearch.title')} onBackPress={handleBack} />
      <Container ref={containerRef} onScroll={handleScroll}>
        <YStack sx={{ gap: 3 }}>
          {/* 基本设置 */}
          <SettingGroup title={t('settings.webSearch.basic.title')}>
            <Row>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1 }}>
                <Typography>{t('settings.webSearch.basic.enable.label')}</Typography>
                <Tooltip title={t('settings.webSearch.basic.enable.tooltip')}>
                  <InfoOutlinedIcon size={16} style={{ opacity: 0.6 }} />
                </Tooltip>
              </Box>
              <CustomSwitch
                checked={webSearchSettings.enabled}
                onChange={handleToggleEnabled}
              />
            </Row>

            <Row>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 100 }}>
                <Typography>{t('settings.webSearch.basic.provider.label')}</Typography>
                <Chip
                  label={getProviderStatusConfig(webSearchSettings.provider).label}
                  size="small"
                  color={getProviderStatusConfig(webSearchSettings.provider).color}
                  sx={{
                    height: 20,
                    fontSize: '0.7rem',
                    fontWeight: 600,
                    '& .MuiChip-label': { px: 1 }
                  }}
                />
              </Box>
              <FormControl size="small" sx={{ flex: 1 }}>
                <Select
                  value={webSearchSettings.provider}
                  onChange={handleProviderChange}
                  disabled={!webSearchSettings.enabled}
                  MenuProps={{
                    disableAutoFocus: true,
                    disableRestoreFocus: true
                  }}
                >
                  <MenuItem value="tavily">{t('settings.webSearch.basic.provider.options.tavily')}</MenuItem>
                  <MenuItem value="exa">{t('settings.webSearch.basic.provider.options.exa')}</MenuItem>
                  <MenuItem value="bocha">{t('settings.webSearch.basic.provider.options.bocha')}</MenuItem>
                  <MenuItem value="firecrawl">{t('settings.webSearch.basic.provider.options.firecrawl')}</MenuItem>
                  <MenuItem value="cloudflare-ai-search">Cloudflare AI Search</MenuItem>
                  <MenuItem value="custom">{t('settings.webSearch.basic.provider.options.custom')}</MenuItem>
                </Select>
              </FormControl>
            </Row>

            {webSearchSettings.provider !== 'custom' && (
              <>
                <Row>
                  <Box sx={{ minWidth: 100 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography>{t('settings.webSearch.basic.apiKey.label')}</Typography>
                      {((webSearchSettings.apiKeys && webSearchSettings.apiKeys[webSearchSettings.provider]) || webSearchSettings.apiKey) ? (
                        <CheckCircle2 size={14} style={{ color: '#10b981' }} />
                      ) : (
                        <XCircle size={14} style={{ color: '#ef4444', opacity: 0.5 }} />
                      )}
                    </Box>
                    {process.env.NODE_ENV === 'development' && (
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                        {t('settings.webSearch.basic.debug.currentProvider', {
                          provider: webSearchSettings.provider,
                          status: webSearchSettings.apiKeys && webSearchSettings.apiKeys[webSearchSettings.provider]
                            ? t('settings.webSearch.basic.debug.set')
                            : t('settings.webSearch.basic.debug.notSet')
                        })}
                        {webSearchSettings.apiKeys && Object.keys(webSearchSettings.apiKeys).length > 0 && (
                          <span>{t('settings.webSearch.basic.debug.savedProviders', {
                            providers: Object.keys(webSearchSettings.apiKeys).join(', ')
                          })}</span>
                        )}
                      </Typography>
                    )}
                  </Box>
                  <TextField
                    size="small"
                    type={showApiKey ? 'text' : 'password'}
                    value={
                      (webSearchSettings.apiKeys && webSearchSettings.apiKeys[webSearchSettings.provider]) ||
                      webSearchSettings.apiKey ||
                      ''
                    }
                    onChange={handleApiKeyChange}
                    disabled={!webSearchSettings.enabled}
                    placeholder={t('settings.webSearch.basic.apiKey.placeholder', { provider: webSearchSettings.provider })}
                    sx={{ flex: 1 }}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <KeyIcon size={16} style={{ opacity: 0.5 }} />
                        </InputAdornment>
                      ),
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton
                            size="small"
                            onClick={() => setShowApiKey(!showApiKey)}
                            edge="end"
                            disabled={!webSearchSettings.enabled}
                          >
                            {showApiKey ? <EyeOff size={16} /> : <Eye size={16} />}
                          </IconButton>
                        </InputAdornment>
                      ),
                    }}
                  />
                </Row>

                {/* Alert 提示信息 - 优化样式 */}
                {webSearchSettings.provider === 'tavily' && (
                  <Box sx={{ px: 2, pb: 2, pt: 0 }}>
                    <Alert 
                      severity="info" 
                      icon={false}
                      sx={{ 
                        py: 1,
                        fontSize: '0.875rem',
                        borderLeft: 3,
                        borderColor: 'info.main',
                        bgcolor: (theme) => alpha(theme.palette.info.main, 0.08)
                      }}
                    >
                      {t('settings.webSearch.basic.alerts.tavily.text')}{' '}
                      <a href="https://app.tavily.com" target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', fontWeight: 600 }}>
                        {t('settings.webSearch.basic.alerts.tavily.link')}
                      </a>{' '}
                      {t('settings.webSearch.basic.alerts.tavily.linkText')}
                    </Alert>
                  </Box>
                )}

                {webSearchSettings.provider === 'exa' && (
                  <Box sx={{ px: 2, pb: 2, pt: 0 }}>
                    <Alert 
                      severity="info" 
                      icon={false}
                      sx={{ 
                        py: 1,
                        fontSize: '0.875rem',
                        borderLeft: 3,
                        borderColor: 'info.main',
                        bgcolor: (theme) => alpha(theme.palette.info.main, 0.08)
                      }}
                    >
                      {t('settings.webSearch.basic.alerts.exa.text')}{' '}
                      <a href="https://exa.ai" target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', fontWeight: 600 }}>
                        {t('settings.webSearch.basic.alerts.exa.link')}
                      </a>{' '}
                      {t('settings.webSearch.basic.alerts.exa.linkText')}
                    </Alert>
                  </Box>
                )}

                {webSearchSettings.provider === 'bocha' && (
                  <Box sx={{ px: 2, pb: 2, pt: 0 }}>
                    <Alert 
                      severity="info" 
                      icon={false}
                      sx={{ 
                        py: 1,
                        fontSize: '0.875rem',
                        borderLeft: 3,
                        borderColor: 'info.main',
                        bgcolor: (theme) => alpha(theme.palette.info.main, 0.08)
                      }}
                    >
                      {t('settings.webSearch.basic.alerts.bocha.text')}{' '}
                      <a href="https://bochaai.com" target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', fontWeight: 600 }}>
                        {t('settings.webSearch.basic.alerts.bocha.link')}
                      </a>{' '}
                      {t('settings.webSearch.basic.alerts.bocha.linkText')}
                    </Alert>
                  </Box>
                )}

                {webSearchSettings.provider === 'firecrawl' && (
                  <Box sx={{ px: 2, pb: 2, pt: 0 }}>
                    <Alert 
                      severity="info" 
                      icon={false}
                      sx={{ 
                        py: 1,
                        fontSize: '0.875rem',
                        borderLeft: 3,
                        borderColor: 'info.main',
                        bgcolor: (theme) => alpha(theme.palette.info.main, 0.08)
                      }}
                    >
                      {t('settings.webSearch.basic.alerts.firecrawl.text')}{' '}
                      <a href="https://firecrawl.dev" target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', fontWeight: 600 }}>
                        {t('settings.webSearch.basic.alerts.firecrawl.link')}
                      </a>{' '}
                      {t('settings.webSearch.basic.alerts.firecrawl.linkText')}
                    </Alert>
                  </Box>
                )}

                {webSearchSettings.provider === 'cloudflare-ai-search' && (
                  <>
                    <Box sx={{ px: 2, pb: 2, pt: 0 }}>
                      <Alert 
                        severity="info" 
                        icon={false}
                        sx={{ 
                          py: 1,
                          fontSize: '0.875rem',
                          borderLeft: 3,
                          borderColor: 'info.main',
                          bgcolor: (theme) => alpha(theme.palette.info.main, 0.08)
                        }}
                      >
                        获取 API Token 和配置：访问{' '}
                        <a href="https://developers.cloudflare.com/ai-search/get-started/" target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', fontWeight: 600 }}>
                          Cloudflare AI Search 文档
                        </a>{' '}
                        了解如何创建 AI Search 并获取所需的 Account ID 和 AutoRAG 名称。
                      </Alert>
                    </Box>

                    <Row>
                      <Typography sx={{ flex: 1 }}>Account ID</Typography>
                      <TextField
                        size="small"
                        value={getCurrentCloudflareProvider()?.accountId || ''}
                        onChange={(e) => handleCloudflareFieldChange('accountId', e.target.value)}
                        disabled={!webSearchSettings.enabled}
                        placeholder="输入 Cloudflare Account ID"
                        sx={{ minWidth: 220 }}
                      />
                    </Row>

                    <Row>
                      <Typography sx={{ flex: 1 }}>AutoRAG Name</Typography>
                      <TextField
                        size="small"
                        value={getCurrentCloudflareProvider()?.autoragName || ''}
                        onChange={(e) => handleCloudflareFieldChange('autoragName', e.target.value)}
                        disabled={!webSearchSettings.enabled}
                        placeholder="输入 AutoRAG 名称"
                        sx={{ minWidth: 220 }}
                      />
                    </Row>
                  </>
                )}
              </>
            )}

            {/* 自定义提供商 - 优化样式 */}
            {webSearchSettings.provider === 'custom' && webSearchSettings.customProviders && webSearchSettings.customProviders.length > 0 && (
              <Box sx={{ px: 2, pb: 2 }}>
                <Typography variant="subtitle2" gutterBottom sx={{ mb: 1.5, fontWeight: 600 }}>
                  {t('settings.webSearch.basic.customProviders.title')}
                </Typography>
                {webSearchSettings.customProviders.map((provider) => (
                  <Card
                    key={provider.id}
                    variant="outlined"
                    sx={{
                      mb: 1.5,
                      borderColor: provider.enabled ? 'primary.main' : 'divider',
                      borderWidth: provider.enabled ? 2 : 1,
                      borderRadius: 2,
                      transition: 'all 0.2s',
                      '&:hover': {
                        boxShadow: 1,
                        borderColor: 'primary.main',
                      }
                    }}
                  >
                    <CardContent sx={{ pb: 1.5 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                        <Box sx={{ flex: 1 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                            <Typography variant="subtitle1" fontWeight={600}>{provider.name}</Typography>
                            <Chip
                              label={provider.enabled ? t('settings.webSearch.basic.customProviders.enabled') : t('settings.webSearch.basic.customProviders.disabled')}
                              size="small"
                              color={provider.enabled ? 'success' : 'default'}
                              sx={{
                                height: 20,
                                fontSize: '0.7rem',
                                fontWeight: 600,
                                '& .MuiChip-label': { px: 1 }
                              }}
                            />
                          </Box>
                          <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8rem' }}>
                            {provider.baseUrl || t('settings.webSearch.basic.customProviders.urlNotSet')}
                          </Typography>
                        </Box>
                        <CustomSwitch
                          checked={provider.enabled}
                          onChange={() => dispatch(toggleCustomProviderEnabled(provider.id))}
                        />
                      </Box>
                    </CardContent>
                    <CardActions sx={{ pt: 0, px: 2, pb: 1.5, gap: 1 }}>
                      <Button
                        size="small"
                        startIcon={<EditIcon size={14} />}
                        onClick={() => handleEditProvider(provider)}
                        variant="text"
                        sx={{ fontSize: '0.8rem' }}
                      >
                        {t('settings.webSearch.basic.customProviders.edit')}
                      </Button>
                      <Button
                        size="small"
                        startIcon={<DeleteIcon size={14} />}
                        color="error"
                        onClick={() => handleDeleteProvider(provider.id)}
                        variant="text"
                        sx={{ fontSize: '0.8rem' }}
                      >
                        {t('settings.webSearch.basic.customProviders.delete')}
                      </Button>
                    </CardActions>
                  </Card>
                ))}
              </Box>
            )}

            {webSearchSettings.provider === 'custom' && (
              <Box sx={{ px: 2, pb: 2 }}>
                <Button
                  startIcon={<AddIcon size={16} />}
                  variant="outlined"
                  fullWidth
                  onClick={handleAddCustomProvider}
                  disabled={!webSearchSettings.enabled}
                >
                  {t('settings.webSearch.basic.customProviders.add')}
                </Button>
              </Box>
            )}
          </SettingGroup>

          {/* 搜索选项 */}
          <SettingGroup title={t('settings.webSearch.searchOptions.title')}>
            <Row>
              <Box sx={{ minWidth: 100 }}>
                <Typography>{t('settings.webSearch.searchOptions.maxResults.label', { count: webSearchSettings.maxResults })}</Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.3 }}>
                  {t('settings.webSearch.searchOptions.maxResults.description')}
                </Typography>
              </Box>
              <Box sx={{ flex: 1, maxWidth: 280 }}>
                <Slider
                  value={webSearchSettings.maxResults}
                  onChange={handleMaxResultsChange}
                  min={1}
                  max={20}
                  step={1}
                  marks={[
                    { value: 1, label: '1' },
                    { value: 5, label: '5' },
                    { value: 10, label: '10' },
                    { value: 20, label: '20' },
                  ]}
                  disabled={!webSearchSettings.enabled}
                  size="small"
                  sx={{
                    '& .MuiSlider-thumb': {
                      width: 16,
                      height: 16,
                    },
                    '& .MuiSlider-markLabel': {
                      fontSize: '0.7rem',
                    }
                  }}
                />
              </Box>
            </Row>

            <Row>
              <Typography sx={{ flex: 1 }}>{t('settings.webSearch.searchOptions.includeInContext.label')}</Typography>
              <CustomSwitch
                checked={webSearchSettings.includeInContext}
                onChange={handleToggleIncludeInContext}
                disabled={!webSearchSettings.enabled}
              />
            </Row>

            <Row>
              <Typography sx={{ flex: 1 }}>{t('settings.webSearch.searchOptions.showTimestamp.label')}</Typography>
              <CustomSwitch
                checked={webSearchSettings.showTimestamp}
                onChange={handleToggleShowTimestamp}
                disabled={!webSearchSettings.enabled}
              />
            </Row>

            <Row>
              <Typography sx={{ flex: 1 }}>{t('settings.webSearch.searchOptions.filterSafeSearch.label')}</Typography>
              <CustomSwitch
                checked={webSearchSettings.filterSafeSearch}
                onChange={handleToggleFilterSafeSearch}
                disabled={!webSearchSettings.enabled}
              />
            </Row>

            <Row>
              <Typography sx={{ flex: 1 }}>{t('settings.webSearch.searchOptions.searchWithTime.label')}</Typography>
              <CustomSwitch
                checked={webSearchSettings.searchWithTime}
                onChange={() => dispatch(toggleSearchWithTime())}
                disabled={!webSearchSettings.enabled}
              />
            </Row>

            {/* 🚀 AI 意图分析设置入口 */}
            <Box
              sx={{ 
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                py: 1.5,
                px: 2,
                cursor: 'pointer',
                '&:hover': { bgcolor: 'action.hover' },
                borderRadius: 1
              }}
              onClick={() => navigate('/settings/assistant-model')}
            >
              <Box sx={{ flex: 1 }}>
                <Typography>{t('settings.webSearch.searchOptions.aiIntentAnalysis.label', 'AI 意图分析')}</Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.3 }}>
                  {t('settings.webSearch.searchOptions.aiIntentAnalysis.description', '配置 AI 意图分析模型，提取更精准的搜索关键词')}
                </Typography>
              </Box>
              <Typography 
                variant="body2" 
                color="primary"
                sx={{ 
                  display: 'flex', 
                  alignItems: 'center',
                  gap: 0.5
                }}
              >
                {t('settings.webSearch.searchOptions.aiIntentAnalysis.configure', '去配置')} →
              </Typography>
            </Box>
          </SettingGroup>

          {/* 🚀 Tavily最佳实践设置 */}
          {webSearchSettings.provider === 'tavily' && (
            <SettingGroup title={t('settings.webSearch.tavily.title')}>
              <Box sx={{ px: 2, pt: 2 }}>
                <Alert 
                  severity="info" 
                  icon={false}
                  sx={{ 
                    mb: 2,
                    py: 1,
                    fontSize: '0.875rem',
                    borderLeft: 3,
                    borderColor: 'info.main',
                    bgcolor: (theme) => alpha(theme.palette.info.main, 0.08)
                  }}
                >
                  {t('settings.webSearch.tavily.description')}
                </Alert>
              </Box>

              <Row>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1 }}>
                  <Typography>{t('settings.webSearch.tavily.smartSearch.label')}</Typography>
                  <Tooltip title={t('settings.webSearch.tavily.smartSearch.tooltip')}>
                    <InfoOutlinedIcon size={16} style={{ opacity: 0.6 }} />
                  </Tooltip>
                </Box>
                <CustomSwitch
                  checked={webSearchSettings.enableSmartSearch || false}
                  onChange={() => dispatch(toggleSmartSearch())}
                  disabled={!webSearchSettings.enabled}
                />
              </Row>

              <Row>
                <Typography sx={{ flex: 1 }}>{t('settings.webSearch.tavily.searchDepth.label')}</Typography>
                <FormControl size="small" sx={{ minWidth: 200 }}>
                  <Select
                    value={webSearchSettings.searchDepth || 'basic'}
                    onChange={handleSearchDepthChange}
                    disabled={!webSearchSettings.enabled || webSearchSettings.enableSmartSearch}
                    MenuProps={{
                      disableAutoFocus: true,
                      disableRestoreFocus: true
                    }}
                  >
                    <MenuItem value="basic">{t('settings.webSearch.tavily.searchDepth.basic')}</MenuItem>
                    <MenuItem value="advanced">{t('settings.webSearch.tavily.searchDepth.advanced')}</MenuItem>
                  </Select>
                </FormControl>
              </Row>

              <Row>
                <Box sx={{ flex: 1 }}>
                  <Typography>{t('settings.webSearch.tavily.chunksPerSource.label', { count: webSearchSettings.chunksPerSource || 3 })}</Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.3 }}>
                    {t('settings.webSearch.tavily.chunksPerSource.description')}
                  </Typography>
                </Box>
                <Box sx={{ minWidth: 220 }}>
                  <Slider
                    value={webSearchSettings.chunksPerSource || 3}
                    onChange={handleChunksPerSourceChange}
                    min={1}
                    max={5}
                    step={1}
                    marks={[
                      { value: 1, label: '1' },
                      { value: 3, label: '3' },
                      { value: 5, label: '5' },
                    ]}
                    disabled={!webSearchSettings.enabled || webSearchSettings.enableSmartSearch}
                    size="small"
                    sx={{
                      '& .MuiSlider-thumb': {
                        width: 16,
                        height: 16,
                      },
                      '& .MuiSlider-markLabel': {
                        fontSize: '0.7rem',
                      }
                    }}
                  />
                </Box>
              </Row>

              <Row>
                <Box sx={{ flex: 1 }}>
                  <Typography>{t('settings.webSearch.tavily.minScore.label', { score: Math.round((webSearchSettings.minScore || 0.3) * 100) })}</Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.3 }}>
                    {t('settings.webSearch.tavily.minScore.description')}
                  </Typography>
                </Box>
                <Box sx={{ minWidth: 220 }}>
                  <Slider
                    value={Math.round((webSearchSettings.minScore || 0.3) * 100)}
                    onChange={handleMinScoreChange}
                    min={0}
                    max={100}
                    step={5}
                    marks={[
                      { value: 0, label: '0%' },
                      { value: 30, label: '30%' },
                      { value: 70, label: '70%' },
                      { value: 100, label: '100%' },
                    ]}
                    disabled={!webSearchSettings.enabled || webSearchSettings.enableSmartSearch}
                    size="small"
                    sx={{
                      '& .MuiSlider-thumb': {
                        width: 16,
                        height: 16,
                      },
                      '& .MuiSlider-markLabel': {
                        fontSize: '0.7rem',
                      }
                    }}
                  />
                </Box>
              </Row>

              <Row>
                <Typography sx={{ flex: 1 }}>{t('settings.webSearch.tavily.timeRange.label')}</Typography>
                <FormControl size="small" sx={{ minWidth: 200 }}>
                  <Select
                    value={webSearchSettings.timeRange || 'week'}
                    onChange={handleTimeRangeChange}
                    disabled={!webSearchSettings.enabled}
                    MenuProps={{
                      disableAutoFocus: true,
                      disableRestoreFocus: true
                    }}
                  >
                    <MenuItem value="day">{t('settings.webSearch.tavily.timeRange.day')}</MenuItem>
                    <MenuItem value="week">{t('settings.webSearch.tavily.timeRange.week')}</MenuItem>
                    <MenuItem value="month">{t('settings.webSearch.tavily.timeRange.month')}</MenuItem>
                    <MenuItem value="year">{t('settings.webSearch.tavily.timeRange.year')}</MenuItem>
                  </Select>
                </FormControl>
              </Row>

              <Row>
                <Box sx={{ flex: 1 }}>
                  <Typography>{t('settings.webSearch.tavily.newsSearchDays.label', { days: webSearchSettings.newsSearchDays || 7 })}</Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.3 }}>
                    {t('settings.webSearch.tavily.newsSearchDays.description')}
                  </Typography>
                </Box>
                <Box sx={{ minWidth: 220 }}>
                  <Slider
                    value={webSearchSettings.newsSearchDays || 7}
                    onChange={handleNewsSearchDaysChange}
                    min={1}
                    max={30}
                    step={1}
                    marks={[
                      { value: 1, label: t('settings.webSearch.tavily.newsSearchDays.marks.1day') },
                      { value: 7, label: t('settings.webSearch.tavily.newsSearchDays.marks.1week') },
                      { value: 14, label: t('settings.webSearch.tavily.newsSearchDays.marks.2weeks') },
                      { value: 30, label: t('settings.webSearch.tavily.newsSearchDays.marks.1month') },
                    ]}
                    disabled={!webSearchSettings.enabled}
                    size="small"
                    sx={{
                      '& .MuiSlider-thumb': {
                        width: 16,
                        height: 16,
                      },
                      '& .MuiSlider-markLabel': {
                        fontSize: '0.7rem',
                      }
                    }}
                  />
                </Box>
              </Row>

              <Row>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1 }}>
                  <Typography>{t('settings.webSearch.tavily.includeRawContent.label')}</Typography>
                  <Tooltip title={t('settings.webSearch.tavily.includeRawContent.tooltip')}>
                    <InfoOutlinedIcon size={16} style={{ opacity: 0.6 }} />
                  </Tooltip>
                </Box>
                <CustomSwitch
                  checked={webSearchSettings.includeRawContent || false}
                  onChange={() => dispatch(toggleIncludeRawContent())}
                  disabled={!webSearchSettings.enabled || webSearchSettings.enableSmartSearch}
                />
              </Row>

              <Row>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1 }}>
                  <Typography>{t('settings.webSearch.tavily.includeAnswer.label')}</Typography>
                  <Tooltip title={t('settings.webSearch.tavily.includeAnswer.tooltip')}>
                    <InfoOutlinedIcon size={16} style={{ opacity: 0.6 }} />
                  </Tooltip>
                </Box>
                <CustomSwitch
                  checked={webSearchSettings.includeAnswer || false}
                  onChange={() => dispatch(toggleIncludeAnswer())}
                  disabled={!webSearchSettings.enabled}
                />
              </Row>

              <Row>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1 }}>
                  <Typography>{t('settings.webSearch.tavily.enableQueryValidation.label')}</Typography>
                  <Tooltip title={t('settings.webSearch.tavily.enableQueryValidation.tooltip')}>
                    <InfoOutlinedIcon size={16} style={{ opacity: 0.6 }} />
                  </Tooltip>
                </Box>
                <CustomSwitch
                  checked={webSearchSettings.enableQueryValidation !== false}
                  onChange={() => dispatch(toggleQueryValidation())}
                  disabled={!webSearchSettings.enabled}
                />
              </Row>

              <Row>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1 }}>
                  <Typography>{t('settings.webSearch.tavily.enablePostProcessing.label')}</Typography>
                  <Tooltip title={t('settings.webSearch.tavily.enablePostProcessing.tooltip')}>
                    <InfoOutlinedIcon size={16} style={{ opacity: 0.6 }} />
                  </Tooltip>
                </Box>
                <CustomSwitch
                  checked={webSearchSettings.enablePostProcessing !== false}
                  onChange={() => dispatch(togglePostProcessing())}
                  disabled={!webSearchSettings.enabled}
                />
              </Row>
            </SettingGroup>
          )}

          {/* 高级设置 */}
          <SettingGroup title={t('settings.webSearch.advanced.title')}>
            <Box sx={{ px: 2, pt: 2, pb: 2 }}>
              <Typography variant="subtitle2" gutterBottom sx={{ mb: 1 }}>
                {t('settings.webSearch.advanced.excludeDomains.label')}
              </Typography>
              <TextField
                fullWidth
                multiline
                rows={3}
                value={webSearchSettings.excludeDomains?.join('\n') || ''}
                onChange={(e) => {
                  const domains = e.target.value.split('\n').filter(d => d.trim());
                  dispatch(setExcludeDomains(domains));
                }}
                placeholder={t('settings.webSearch.advanced.excludeDomains.placeholder')}
                disabled={!webSearchSettings.enabled}
                size="small"
                sx={{ mb: 1 }}
              />
              <Typography variant="caption" color="text.secondary">
                {t('settings.webSearch.advanced.excludeDomains.description')}
              </Typography>
            </Box>
          </SettingGroup>
        </YStack>
      </Container>

      {isEditing && editingProvider && (
        <BackButtonDialog open={isEditing} onClose={handleCancelEdit} maxWidth="sm" fullWidth>
          <DialogTitle>
            {editingProvider.id ? t('settings.webSearch.basic.editDialog.editTitle') : t('settings.webSearch.basic.editDialog.addTitle')}
          </DialogTitle>
          <DialogContent>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
              <TextField
                fullWidth
                label={t('settings.webSearch.basic.editDialog.name')}
                value={editingProvider.name}
                onChange={(e) => handleProviderFieldChange('name', e.target.value)}
                size="small"
              />

              <FormControl size="small" fullWidth>
                <Select
                  value={editingProtocol}
                  onChange={(e) => handleProviderFieldChange('protocol', e.target.value)}
                  MenuProps={{ disableAutoFocus: true, disableRestoreFocus: true }}
                >
                  <MenuItem value="searxng">{t('settings.webSearch.basic.editDialog.protocolSearxng')}</MenuItem>
                  <MenuItem value="tavily-compatible">{t('settings.webSearch.basic.editDialog.protocolTavilyCompatible')}</MenuItem>
                  <MenuItem value="custom-json">{t('settings.webSearch.basic.editDialog.protocolCustomJson')}</MenuItem>
                </Select>
              </FormControl>

              {editingProtocol !== 'custom-json' && (
                <TextField
                  fullWidth
                  label={t('settings.webSearch.basic.editDialog.baseUrl')}
                  value={editingProvider.baseUrl}
                  onChange={(e) => handleProviderFieldChange('baseUrl', e.target.value)}
                  placeholder={editingProtocol === 'searxng'
                    ? t('settings.webSearch.basic.editDialog.searxngBaseUrlPlaceholder')
                    : t('settings.webSearch.basic.editDialog.baseUrlPlaceholder')}
                  size="small"
                />
              )}

              {editingProtocol !== 'searxng' && (
                <TextField
                  fullWidth
                  label={editingProtocol === 'custom-json'
                    ? t('settings.webSearch.basic.editDialog.apiKeyOptional')
                    : t('settings.webSearch.basic.editDialog.apiKey')}
                  type="password"
                  value={editingProvider.apiKey}
                  onChange={(e) => handleProviderFieldChange('apiKey', e.target.value)}
                  size="small"
                />
              )}

              {editingProtocol === 'searxng' && (
                <>
                  <TextField
                    fullWidth
                    label={t('settings.webSearch.basic.editDialog.basicAuthUsername')}
                    value={editingProvider.basicAuthUsername || ''}
                    onChange={(e) => handleProviderFieldChange('basicAuthUsername', e.target.value)}
                    size="small"
                  />
                  <TextField
                    fullWidth
                    label={t('settings.webSearch.basic.editDialog.basicAuthPassword')}
                    type="password"
                    value={editingProvider.basicAuthPassword || ''}
                    onChange={(e) => handleProviderFieldChange('basicAuthPassword', e.target.value)}
                    size="small"
                  />
                </>
              )}

              {editingProtocol === 'custom-json' && (
                <TextField
                  fullWidth
                  multiline
                  minRows={8}
                  label={t('settings.webSearch.basic.editDialog.template')}
                  value={editingProvider.customTemplateJson || ''}
                  onChange={(e) => handleProviderFieldChange('customTemplateJson', e.target.value)}
                  error={editingTemplateInvalid}
                  helperText={editingTemplateInvalid
                    ? t('settings.webSearch.basic.editDialog.templateInvalid')
                    : t('settings.webSearch.basic.editDialog.templateHelp')}
                  placeholder={'{\n  "request": {\n    "url": "https://api.example.com/search?q={{query}}",\n    "method": "GET",\n    "headers": { "Authorization": "Bearer {{apiKey}}" }\n  },\n  "response": {\n    "resultsPath": "data.items",\n    "fields": { "title": "name", "url": "link", "snippet": "summary" }\n  }\n}'}
                  size="small"
                  slotProps={{ htmlInput: { style: { fontFamily: 'monospace', fontSize: '0.8rem' } } }}
                />
              )}

              {testState.status === 'success' && (
                <Alert severity="success">{t('settings.webSearch.basic.editDialog.testSuccess')}</Alert>
              )}
              {testState.status === 'error' && (
                <Alert severity="error">{t('settings.webSearch.basic.editDialog.testFailed', { error: testState.error })}</Alert>
              )}

              <FormControlLabel
                control={
                  <CustomSwitch
                    checked={editingProvider.enabled}
                    onChange={(e) => handleProviderFieldChange('enabled', e.target.checked)}
                  />
                }
                label={t('settings.webSearch.basic.editDialog.enable')}
              />
            </Box>
          </DialogContent>
          <DialogActions>
            <Button
              onClick={handleTestProvider}
              disabled={testState.status === 'testing' || editingTemplateInvalid}
            >
              {testState.status === 'testing'
                ? t('settings.webSearch.basic.editDialog.testing')
                : t('settings.webSearch.basic.editDialog.test')}
            </Button>
            <Button onClick={handleCancelEdit}>{t('settings.webSearch.basic.editDialog.cancel')}</Button>
            <Button
              variant="contained"
              onClick={handleSaveProvider}
              color="primary"
            >
              {t('settings.webSearch.basic.editDialog.save')}
            </Button>
          </DialogActions>
        </BackButtonDialog>
      )}
    </SafeAreaContainer>
  );
};

export default WebSearchSettings;