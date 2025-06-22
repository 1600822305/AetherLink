import React, { useState, useEffect } from 'react';
import {
  Box,
  AppBar,
  Toolbar,
  IconButton,
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
  InputLabel,
  OutlinedInput,
  Slider,
  FormGroup,
  alpha,
  Divider,
  Tooltip,
  Alert,
  Paper
} from '@mui/material';
import CustomSwitch from '../../components/CustomSwitch';
import type { SelectChangeEvent } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft as ArrowBackIcon, Plus as AddIcon, Trash2 as DeleteIcon, Edit as EditIcon, Globe as LanguageIcon, Info as InfoOutlinedIcon } from 'lucide-react';
import { useDispatch, useSelector } from 'react-redux';
import type { WebSearchProvider, WebSearchCustomProvider } from '../../shared/types';
import { v4 as uuidv4 } from 'uuid';
import {
  toggleWebSearchEnabled,
  setWebSearchProvider,
  setWebSearchApiKey,
  setWebSearchMaxResults,
  toggleIncludeInContext,
  toggleShowTimestamp,
  toggleFilterSafeSearch,
  setSearchMode,
  addCustomProvider,
  updateCustomProvider,
  deleteCustomProvider,
  toggleCustomProviderEnabled,
  toggleSearchWithTime,
  setExcludeDomains,

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

  // 🚀 新增：搜索引擎选择相关actions
  setSelectedSearchEngine
} from '../../shared/store/slices/webSearchSlice';
import type { RootState } from '../../shared/store';

const WebSearchSettings: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();

  // 从Redux获取设置
  const webSearchSettings = useSelector((state: RootState) => state.webSearch) || {
    enabled: false,
    provider: 'firecrawl' as WebSearchProvider,
    apiKey: '',
    includeInContext: true,
    maxResults: 5,
    showTimestamp: true,
    filterSafeSearch: true,
    searchMode: 'auto' as 'auto' | 'manual',
    searchWithTime: false,
    excludeDomains: [],
    providers: [],
    customProviders: []
  };

  const [editingProvider, setEditingProvider] = useState<WebSearchCustomProvider | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    // 初始化设置 - 这里不需要设置本地状态，因为我们直接使用Redux的状态
  }, [webSearchSettings]);

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

  const handleSearchModeChange = (event: SelectChangeEvent) => {
    dispatch(setSearchMode(event.target.value as 'auto' | 'manual'));
  };

  const handleAddCustomProvider = () => {
    const newProvider: WebSearchCustomProvider = {
      id: uuidv4(),
      name: '新搜索服务',
      apiKey: '',
      baseUrl: '',
      enabled: true
    };

    setEditingProvider(newProvider);
    setIsEditing(true);
  };

  const handleEditProvider = (provider: WebSearchCustomProvider) => {
    setEditingProvider({...provider});
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

    setEditingProvider(prev => ({
      ...prev!,
      [field]: value
    }));
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

  // 🚀 新增：搜索引擎选择处理函数
  const handleSearchEngineChange = (event: SelectChangeEvent) => {
    dispatch(setSelectedSearchEngine(event.target.value as any));
  };

  // 渲染主要内容
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
            onClick={handleBack}
            aria-label="back"
            sx={{
              color: (theme) => theme.palette.primary.main,
            }}
          >
            <ArrowBackIcon size={24} />
          </IconButton>
          <Typography
            variant="h6"
            component="div"
            sx={{
              flexGrow: 1,
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              color: (theme) => theme.palette.text.primary,
            }}
          >
            <LanguageIcon size={24} color="#3b82f6" style={{ marginRight: 8 }} /> 网络搜索设置
          </Typography>
        </Toolbar>
      </AppBar>

      <Box
        sx={{
          flexGrow: 1,
          overflow: 'auto',
          px: 2,
          py: 2,
          mt: 8,
          mb: 2,
          '&::-webkit-scrollbar': {
            width: '6px',
          },
          '&::-webkit-scrollbar-thumb': {
            backgroundColor: 'rgba(0,0,0,0.1)',
            borderRadius: '3px',
          },
        }}
      >
        <Paper
          elevation={0}
          sx={{
            p: 3,
            mb: 3,
            borderRadius: 2,
            border: '1px solid',
            borderColor: 'divider',
          }}
        >
          <Typography
            variant="h6"
            gutterBottom
            sx={{
              fontWeight: 600,
              color: (theme) => theme.palette.text.primary,
              mb: 2,
            }}
          >
            基本设置
          </Typography>

          <FormGroup>
            <FormControlLabel
              control={
                <CustomSwitch
                  checked={webSearchSettings.enabled}
                  onChange={handleToggleEnabled}
                />
              }
              label={
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <Typography sx={{ mr: 1 }}>启用网络搜索</Typography>
                  <Tooltip title="开启后，AI可以通过网络搜索获取最新信息">
                    <InfoOutlinedIcon size={16} color="var(--mui-palette-text-secondary)" />
                  </Tooltip>
                </Box>
              }
            />
          </FormGroup>

          <Divider sx={{ my: 2 }} />

          <FormControl fullWidth margin="normal">
            <InputLabel id="search-provider-label">搜索服务商</InputLabel>
            <Select
              labelId="search-provider-label"
              value={webSearchSettings.provider}
              onChange={handleProviderChange}
              input={<OutlinedInput label="搜索服务商" />}
              disabled={!webSearchSettings.enabled}
              MenuProps={{
                disableAutoFocus: true,
                disableRestoreFocus: true
              }}
            >
              <MenuItem value="bing-free">🆓 Bing 免费搜索 (推荐)</MenuItem>
              <MenuItem value="tavily">💎 Tavily (付费)</MenuItem>
              <MenuItem value="exa">🧠 Exa (神经搜索)</MenuItem>
              <MenuItem value="bocha">🤖 Bocha (AI搜索)</MenuItem>
              <MenuItem value="firecrawl"> Firecrawl (网页抓取)</MenuItem>
              <MenuItem value="custom">⚙️ 自定义服务</MenuItem>
            </Select>
          </FormControl>

          {webSearchSettings.provider !== 'custom' && (
            <>
              {/* 🚀 新增：搜索引擎选择器（仅在bing-free时显示） */}
              {webSearchSettings.provider === 'bing-free' && (
                <FormControl fullWidth margin="normal">
                  <InputLabel id="search-engine-label">搜索引擎</InputLabel>
                  <Select
                    labelId="search-engine-label"
                    value={webSearchSettings.selectedSearchEngine || 'bing'}
                    onChange={handleSearchEngineChange}
                    input={<OutlinedInput label="搜索引擎" />}
                    disabled={!webSearchSettings.enabled}
                    MenuProps={{
                      disableAutoFocus: true,
                      disableRestoreFocus: true
                    }}
                  >
                    <MenuItem value="bing">🔍 Bing</MenuItem>
                    <MenuItem value="google">🌐 Google</MenuItem>
                    <MenuItem value="baidu">🔍 百度</MenuItem>
                    <MenuItem value="sogou">🔍 搜狗</MenuItem>
                    <MenuItem value="yandex">🔍 Yandex</MenuItem>
                  </Select>
                </FormControl>
              )}

              <TextField
                fullWidth
                margin="normal"
                label="API 密钥"
                type="password"
                value={
                  // 🚀 优先使用当前提供商的独立API密钥，如果没有则使用通用密钥
                  (webSearchSettings.apiKeys && webSearchSettings.apiKeys[webSearchSettings.provider]) ||
                  webSearchSettings.apiKey ||
                  ''
                }
                onChange={handleApiKeyChange}
                disabled={!webSearchSettings.enabled}
                variant="outlined"
                placeholder={`请输入 ${webSearchSettings.provider} API 密钥`}
              />

              {/* 🚀 调试信息：显示当前存储的API密钥状态 */}
              {process.env.NODE_ENV === 'development' && (
                <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                  调试信息: 当前提供商({webSearchSettings.provider})的API密钥: {
                    webSearchSettings.apiKeys && webSearchSettings.apiKeys[webSearchSettings.provider]
                      ? '已设置'
                      : '未设置'
                  }
                  {webSearchSettings.apiKeys && Object.keys(webSearchSettings.apiKeys).length > 0 && (
                    <span> | 已保存的提供商: {Object.keys(webSearchSettings.apiKeys).join(', ')}</span>
                  )}
                </Typography>
              )}

              {webSearchSettings.provider === 'tavily' && (
                <Alert severity="info" sx={{ mt: 2 }}>
                  Tavily 是专为AI设计的搜索API，提供高质量的搜索结果。现在使用移动端兼容的 SDK，完全避免了 CORS 限制问题。访问
                  <a href="https://app.tavily.com" target="_blank" rel="noopener noreferrer" style={{ marginLeft: 5 }}>
                    app.tavily.com
                  </a>
                  获取 API 密钥。
                </Alert>
              )}

              {webSearchSettings.provider === 'exa' && (
                <Alert severity="info" sx={{ mt: 2 }}>
                  Exa 是基于神经网络的搜索引擎，提供语义搜索功能。访问
                  <a href="https://exa.ai" target="_blank" rel="noopener noreferrer" style={{ marginLeft: 5 }}>
                    exa.ai
                  </a>
                  获取 API 密钥。
                </Alert>
              )}

              {webSearchSettings.provider === 'bocha' && (
                <Alert severity="info" sx={{ mt: 2 }}>
                  Bocha 是AI驱动的搜索引擎，提供智能搜索结果。访问
                  <a href="https://bochaai.com" target="_blank" rel="noopener noreferrer" style={{ marginLeft: 5 }}>
                    bochaai.com
                  </a>
                  获取 API 密钥。
                </Alert>
              )}

              {webSearchSettings.provider === 'bing-free' && (
                <Alert severity="success" sx={{ mt: 2 }}>
                  免费搜索服务，无需API密钥。您可以选择不同的搜索引擎来获取搜索结果，包括Bing、Google、百度、搜狗等。
                  使用 capacitor-cors-bypass-enhanced 插件解决移动端CORS问题。
                </Alert>
              )}

              {webSearchSettings.provider === 'firecrawl' && (
                <Alert severity="info" sx={{ mt: 2 }}>
                  Firecrawl 提供强大的网络爬取和搜索功能。访问
                  <a href="https://firecrawl.dev" target="_blank" rel="noopener noreferrer" style={{ marginLeft: 5 }}>
                    firecrawl.dev
                  </a>
                  获取 API 密钥。
                </Alert>
              )}
            </>
          )}



          {webSearchSettings.provider === 'custom' && webSearchSettings.customProviders && webSearchSettings.customProviders.length > 0 && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="subtitle1" gutterBottom>
                自定义搜索服务列表
              </Typography>

              {webSearchSettings.customProviders.map((provider) => (
                <Card
                  key={provider.id}
                  variant="outlined"
                  sx={{
                    mb: 2,
                    borderColor: provider.enabled ? alpha('#3b82f6', 0.5) : 'divider'
                  }}
                >
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                      <Typography variant="h6">{provider.name}</Typography>
                      <FormControlLabel
                        control={
                          <CustomSwitch
                            checked={provider.enabled}
                            onChange={() => dispatch(toggleCustomProviderEnabled(provider.id))}
                          />
                        }
                        label="启用"
                      />
                    </Box>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      API URL: {provider.baseUrl}
                    </Typography>
                  </CardContent>
                  <CardActions>
                    <Button
                      size="small"
                      startIcon={<EditIcon size={16} />}
                      onClick={() => handleEditProvider(provider)}
                    >
                      编辑
                    </Button>
                    <Button
                      size="small"
                      startIcon={<DeleteIcon size={16} />}
                      color="error"
                      onClick={() => handleDeleteProvider(provider.id)}
                    >
                      删除
                    </Button>
                  </CardActions>
                </Card>
              ))}
            </Box>
          )}

          {webSearchSettings.provider === 'custom' && (
            <Button
              startIcon={<AddIcon size={16} />}
              variant="outlined"
              sx={{ mt: 2 }}
              onClick={handleAddCustomProvider}
              disabled={!webSearchSettings.enabled}
            >
              添加自定义搜索服务
            </Button>
          )}
        </Paper>

        <Paper
          elevation={0}
          sx={{
            p: 3,
            mb: 3,
            borderRadius: 2,
            border: '1px solid',
            borderColor: 'divider',
          }}
        >
          <Typography
            variant="h6"
            gutterBottom
            sx={{
              fontWeight: 600,
              color: (theme) => theme.palette.text.primary,
              mb: 2,
            }}
          >
            搜索选项
          </Typography>

          <FormControl fullWidth sx={{ mb: 3 }}>
            <InputLabel id="search-mode-label">搜索模式</InputLabel>
            <Select
              labelId="search-mode-label"
              value={webSearchSettings.searchMode}
              onChange={handleSearchModeChange}
              input={<OutlinedInput label="搜索模式" />}
              disabled={!webSearchSettings.enabled}
              MenuProps={{
                disableAutoFocus: true,
                disableRestoreFocus: true
              }}
            >
              <MenuItem value="auto">自动搜索 (AI 自动判断何时搜索)</MenuItem>
              <MenuItem value="manual">手动搜索 (点击搜索按钮启动)</MenuItem>
            </Select>
          </FormControl>

          <Box sx={{ mb: 3 }}>
            <Typography id="max-results-slider" gutterBottom>
              最大结果数量: {webSearchSettings.maxResults}
            </Typography>
            <Slider
              aria-labelledby="max-results-slider"
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
            />
          </Box>

          <FormGroup>
            <FormControlLabel
              control={
                <CustomSwitch
                  checked={webSearchSettings.includeInContext}
                  onChange={handleToggleIncludeInContext}
                  disabled={!webSearchSettings.enabled}
                />
              }
              label="将搜索结果包含在上下文中"
            />

            <FormControlLabel
              control={
                <CustomSwitch
                  checked={webSearchSettings.showTimestamp}
                  onChange={handleToggleShowTimestamp}
                  disabled={!webSearchSettings.enabled}
                />
              }
              label="显示搜索结果时间戳"
            />

            <FormControlLabel
              control={
                <CustomSwitch
                  checked={webSearchSettings.filterSafeSearch}
                  onChange={handleToggleFilterSafeSearch}
                  disabled={!webSearchSettings.enabled}
                />
              }
              label="启用安全搜索过滤"
            />

            <FormControlLabel
              control={
                <CustomSwitch
                  checked={webSearchSettings.searchWithTime}
                  onChange={() => dispatch(toggleSearchWithTime())}
                  disabled={!webSearchSettings.enabled}
                />
              }
              label="在搜索查询中添加当前日期"
            />
          </FormGroup>
        </Paper>

        {/* 🚀 Tavily最佳实践设置 */}
        {webSearchSettings.provider === 'tavily' && (
          <Paper
            elevation={0}
            sx={{
              p: 3,
              mb: 3,
              borderRadius: 2,
              border: '1px solid',
              borderColor: 'divider',
            }}
          >
            <Typography
              variant="h6"
              gutterBottom
              sx={{
                fontWeight: 600,
                color: (theme) => theme.palette.text.primary,
                mb: 2,
              }}
            >
              🚀 Tavily 最佳实践设置
            </Typography>

            <Alert severity="info" sx={{ mb: 3 }}>
              这些设置基于 Tavily 官方最佳实践，可以显著提升搜索质量和相关性。
            </Alert>

            {/* 智能搜索开关 */}
            <FormControlLabel
              control={
                <CustomSwitch
                  checked={webSearchSettings.enableSmartSearch || false}
                  onChange={() => dispatch(toggleSmartSearch())}
                  disabled={!webSearchSettings.enabled}
                />
              }
              label={
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <Typography sx={{ mr: 1 }}>启用智能搜索</Typography>
                  <Tooltip title="自动应用最佳实践设置，包括高级搜索深度、内容块优化等">
                    <InfoOutlinedIcon size={16} color="var(--mui-palette-text-secondary)" />
                  </Tooltip>
                </Box>
              }
              sx={{ mb: 3 }}
            />

            {/* 搜索深度 */}
            <FormControl fullWidth sx={{ mb: 3 }}>
              <InputLabel id="search-depth-label">搜索深度</InputLabel>
              <Select
                labelId="search-depth-label"
                value={webSearchSettings.searchDepth || 'basic'}
                onChange={handleSearchDepthChange}
                input={<OutlinedInput label="搜索深度" />}
                disabled={!webSearchSettings.enabled || webSearchSettings.enableSmartSearch}
                MenuProps={{
                  disableAutoFocus: true,
                  disableRestoreFocus: true
                }}
              >
                <MenuItem value="basic">基础搜索 (更快)</MenuItem>
                <MenuItem value="advanced">高级搜索 (更准确，推荐)</MenuItem>
              </Select>
            </FormControl>

            {/* 每个来源的内容块数量 */}
            <Box sx={{ mb: 3 }}>
              <Typography id="chunks-per-source-slider" gutterBottom>
                每个来源的内容块数量: {webSearchSettings.chunksPerSource || 3}
              </Typography>
              <Slider
                aria-labelledby="chunks-per-source-slider"
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
              />
            </Box>

            {/* 最小相关性分数 */}
            <Box sx={{ mb: 3 }}>
              <Typography id="min-score-slider" gutterBottom>
                最小相关性分数: {Math.round((webSearchSettings.minScore || 0.3) * 100)}%
              </Typography>
              <Slider
                aria-labelledby="min-score-slider"
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
              />
              <Typography variant="body2" color="text.secondary">
                过滤掉相关性分数低于此阈值的搜索结果
              </Typography>
            </Box>

            {/* 时间范围过滤 */}
            <FormControl fullWidth sx={{ mb: 3 }}>
              <InputLabel id="time-range-label">时间范围过滤</InputLabel>
              <Select
                labelId="time-range-label"
                value={webSearchSettings.timeRange || 'week'}
                onChange={handleTimeRangeChange}
                input={<OutlinedInput label="时间范围过滤" />}
                disabled={!webSearchSettings.enabled}
                MenuProps={{
                  disableAutoFocus: true,
                  disableRestoreFocus: true
                }}
              >
                <MenuItem value="day">最近一天</MenuItem>
                <MenuItem value="week">最近一周</MenuItem>
                <MenuItem value="month">最近一个月</MenuItem>
                <MenuItem value="year">最近一年</MenuItem>
              </Select>
            </FormControl>

            {/* 新闻搜索天数 */}
            <Box sx={{ mb: 3 }}>
              <Typography id="news-search-days-slider" gutterBottom>
                新闻搜索天数范围: {webSearchSettings.newsSearchDays || 7} 天
              </Typography>
              <Slider
                aria-labelledby="news-search-days-slider"
                value={webSearchSettings.newsSearchDays || 7}
                onChange={handleNewsSearchDaysChange}
                min={1}
                max={30}
                step={1}
                marks={[
                  { value: 1, label: '1天' },
                  { value: 7, label: '1周' },
                  { value: 14, label: '2周' },
                  { value: 30, label: '1月' },
                ]}
                disabled={!webSearchSettings.enabled}
              />
              <Typography variant="body2" color="text.secondary">
                当搜索主题设置为"新闻"时使用
              </Typography>
            </Box>

            {/* 高级选项 */}
            <FormGroup>
              <FormControlLabel
                control={
                  <CustomSwitch
                    checked={webSearchSettings.includeRawContent || false}
                    onChange={() => dispatch(toggleIncludeRawContent())}
                    disabled={!webSearchSettings.enabled || webSearchSettings.enableSmartSearch}
                  />
                }
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <Typography sx={{ mr: 1 }}>包含原始内容</Typography>
                    <Tooltip title="获取完整的网页内容，用于深度分析">
                      <InfoOutlinedIcon size={16} color="var(--mui-palette-text-secondary)" />
                    </Tooltip>
                  </Box>
                }
              />

              <FormControlLabel
                control={
                  <CustomSwitch
                    checked={webSearchSettings.includeAnswer || false}
                    onChange={() => dispatch(toggleIncludeAnswer())}
                    disabled={!webSearchSettings.enabled}
                  />
                }
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <Typography sx={{ mr: 1 }}>包含AI答案摘要</Typography>
                    <Tooltip title="Tavily生成的基于搜索结果的答案摘要">
                      <InfoOutlinedIcon size={16} color="var(--mui-palette-text-secondary)" />
                    </Tooltip>
                  </Box>
                }
              />

              <FormControlLabel
                control={
                  <CustomSwitch
                    checked={webSearchSettings.enableQueryValidation !== false}
                    onChange={() => dispatch(toggleQueryValidation())}
                    disabled={!webSearchSettings.enabled}
                  />
                }
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <Typography sx={{ mr: 1 }}>启用查询验证</Typography>
                    <Tooltip title="验证查询长度和格式，提供优化建议">
                      <InfoOutlinedIcon size={16} color="var(--mui-palette-text-secondary)" />
                    </Tooltip>
                  </Box>
                }
              />

              <FormControlLabel
                control={
                  <CustomSwitch
                    checked={webSearchSettings.enablePostProcessing !== false}
                    onChange={() => dispatch(togglePostProcessing())}
                    disabled={!webSearchSettings.enabled}
                  />
                }
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <Typography sx={{ mr: 1 }}>启用结果后处理</Typography>
                    <Tooltip title="基于相关性分数过滤和排序搜索结果">
                      <InfoOutlinedIcon size={16} color="var(--mui-palette-text-secondary)" />
                    </Tooltip>
                  </Box>
                }
              />
            </FormGroup>
          </Paper>
        )}

        {/* 高级设置 */}
        <Paper
          elevation={0}
          sx={{
            p: 3,
            mb: 3,
            borderRadius: 2,
            border: '1px solid',
            borderColor: 'divider',
          }}
        >
          <Typography
            variant="h6"
            gutterBottom
            sx={{
              fontWeight: 600,
              color: (theme) => theme.palette.text.primary,
              mb: 2,
            }}
          >
            高级设置
          </Typography>

          <Typography variant="subtitle2" gutterBottom>
            排除域名 (每行一个)
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
            placeholder="example.com&#10;spam-site.com"
            disabled={!webSearchSettings.enabled}
            variant="outlined"
            sx={{ mb: 2 }}
          />

          <Typography variant="body2" color="text.secondary" gutterBottom>
            这些域名将从搜索结果中排除
          </Typography>
        </Paper>
      </Box>

      {isEditing && editingProvider && (
        <Box
          sx={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            bgcolor: 'rgba(0, 0, 0, 0.5)',
            zIndex: 1300,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            p: 2,
          }}
        >
          <Paper
            sx={{
              p: 3,
              width: '100%',
              maxWidth: 500,
              maxHeight: '90vh',
              overflow: 'auto',
              borderRadius: 2,
            }}
          >
            <Typography variant="h6" gutterBottom>
              {editingProvider.id ? '编辑搜索服务' : '添加搜索服务'}
            </Typography>

            <TextField
              fullWidth
              margin="normal"
              label="服务名称"
              value={editingProvider.name}
              onChange={(e) => handleProviderFieldChange('name', e.target.value)}
              variant="outlined"
            />

            <TextField
              fullWidth
              margin="normal"
              label="基础 URL"
              value={editingProvider.baseUrl}
              onChange={(e) => handleProviderFieldChange('baseUrl', e.target.value)}
              variant="outlined"
              placeholder="https://api.example.com"
            />

            <TextField
              fullWidth
              margin="normal"
              label="API 密钥"
              type="password"
              value={editingProvider.apiKey}
              onChange={(e) => handleProviderFieldChange('apiKey', e.target.value)}
              variant="outlined"
            />

            <FormControlLabel
              control={
                <CustomSwitch
                  checked={editingProvider.enabled}
                  onChange={(e) => handleProviderFieldChange('enabled', e.target.checked)}
                />
              }
              label="启用此服务"
            />

            <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
              <Button onClick={handleCancelEdit}>取消</Button>
              <Button
                variant="contained"
                onClick={handleSaveProvider}
                sx={{
                  bgcolor: '#3b82f6',
                  '&:hover': {
                    bgcolor: '#2563eb',
                  }
                }}
              >
                保存
              </Button>
            </Box>
          </Paper>
        </Box>
      )}
    </Box>
  );
};

export default WebSearchSettings;