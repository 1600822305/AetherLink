import React, { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import {
  Box,
  List,
  ListItem,
  Typography,
  TextField,
  InputAdornment,
  FormControlLabel,
  Chip,
  DialogTitle,
  DialogContent,
  IconButton,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Paper,
  Divider,
  alpha,
  Tooltip,
  Checkbox,
} from '@mui/material';
import BackButtonDialog from '../common/BackButtonDialog';
import {
  Search as SearchIcon,
  Globe as HttpIcon,
  X as ClearIcon,
  ChevronDown as ExpandMoreIcon,
  AlertCircle as ErrorIcon,
  CheckCircle2 as SuccessIcon,
  Clock as PendingIcon,
  XCircle as CancelledIcon,
  Copy as CopyIcon,
  Share2 as ShareIcon,
} from 'lucide-react';
import { useTheme } from '@mui/material/styles';
import { useMediaQuery } from '@mui/material';
import { useTranslation } from '../../i18n';
import EnhancedNetworkService from '../../shared/services/network/EnhancedNetworkService';
import type { NetworkEntry, NetworkFilter } from '../../shared/services/network/EnhancedNetworkService';
import CustomSwitch from '../CustomSwitch';
import { shareTextAsFile } from '../../utils/exportUtils';
import dayjs from 'dayjs';
import { createLogger } from '../../shared/services/infra/logger';

const logger = createLogger('NetworkPanel');

interface NetworkPanelProps {
  selectionMode?: boolean;
  selectedIds?: Set<string>;
  onSelectionChange?: (ids: Set<string>) => void;
}

export interface NetworkPanelRef {
  getFilteredEntries: () => NetworkEntry[];
}

const NetworkPanel = forwardRef<NetworkPanelRef, NetworkPanelProps>(({
  selectionMode = false,
  selectedIds = new Set(),
  onSelectionChange,
}, ref) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [, setEntries] = useState<NetworkEntry[]>([]);
  const [filter, setFilter] = useState<NetworkFilter>({
    methods: new Set(['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS']),
    statuses: new Set(['pending', 'success', 'error', 'cancelled']),
    searchText: '',
    hideDataUrls: true,
    onlyErrors: false
  });
  const [selectedEntry, setSelectedEntry] = useState<NetworkEntry | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  const networkService = EnhancedNetworkService.getInstance();

  useEffect(() => {
    const unsubscribe = networkService.addListener((newEntries) => {
      setEntries(newEntries);
    });

    setEntries(networkService.getEntries());
    return unsubscribe;
  }, []);

  const filteredEntries = networkService.getFilteredEntries(filter);

  // 暴露方法给父组件
  useImperativeHandle(ref, () => ({
    getFilteredEntries: () => filteredEntries,
  }), [filteredEntries]);

  // 切换选中状态
  const handleToggleSelect = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!onSelectionChange) return;
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    onSelectionChange(newSelected);
  };

  const handleEntryClick = (entry: NetworkEntry) => {
    setSelectedEntry(entry);
    setShowDetails(true);
  };

  // 生成网络请求详情文本
  const generateDetailsText = () => {
    if (!selectedEntry) return '';
    
    return [
      `=== 网络请求详情 ===`,
      ``,
      `URL: ${selectedEntry.url}`,
      `Method: ${selectedEntry.method}`,
      `Status: ${selectedEntry.statusCode || selectedEntry.status}`,
      selectedEntry.duration ? `Duration: ${networkService.formatDuration(selectedEntry.duration)}` : null,
      selectedEntry.responseSize ? `Response Size: ${networkService.formatSize(selectedEntry.responseSize)}` : null,
      ``,
      `=== Request Headers ===`,
      JSON.stringify(selectedEntry.requestHeaders, null, 2),
      selectedEntry.requestPayload ? `\n=== Request Body ===\n${typeof selectedEntry.requestPayload === 'string' ? selectedEntry.requestPayload : JSON.stringify(selectedEntry.requestPayload, null, 2)}` : null,
      ``,
      `=== Response Headers ===`,
      JSON.stringify(selectedEntry.responseHeaders, null, 2),
      selectedEntry.responseData ? `\n=== Response Body ===\n${typeof selectedEntry.responseData === 'string' ? selectedEntry.responseData : JSON.stringify(selectedEntry.responseData, null, 2)}` : null,
    ].filter(Boolean).join('\n');
  };

  // 复制网络请求详情
  const handleCopyDetails = async () => {
    const details = generateDetailsText();
    if (!details) return;

    try {
      await navigator.clipboard.writeText(details);
      // 可以添加一个提示，但为了简单起见暂时不加
    } catch (error) {
      logger.error('复制失败:', error);
    }
  };

  // 分享网络请求详情为文本文件
  const handleShareDetails = async () => {
    const details = generateDetailsText();
    if (!details) return;
    const timestamp = dayjs().format('YYYY-MM-DD-HH-mm-ss');
    await shareTextAsFile(details, `network_request_${timestamp}.txt`);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <SuccessIcon size={16} />;
      case 'error':
        return <ErrorIcon size={16} />;
      case 'pending':
        return <PendingIcon size={16} />;
      case 'cancelled':
        return <CancelledIcon size={16} />;
      default:
        return null;
    }
  };

  const renderDetailsDialog = () => (
    <BackButtonDialog
      open={showDetails}
      onClose={() => setShowDetails(false)}
      maxWidth="md"
      fullWidth
      fullScreen={isMobile}
      PaperProps={{
        sx: {
          borderRadius: 2,
        },
      }}
    >
      <DialogTitle sx={{
        pb: 1,
        ...(isMobile && {
          minHeight: '64px'
        })
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 40,
              height: 40,
              borderRadius: 1,
              bgcolor: alpha(theme.palette.primary.main, 0.1),
              color: 'primary.main',
            }}
          >
            <HttpIcon size={20} />
          </Box>
          <Typography variant="h6" component="span" sx={{ fontWeight: 600, flexGrow: 1 }}>
            {t('devtools.network.detailsTitle')}
          </Typography>
          <Tooltip title={t('devtools.network.copyAll') || '复制全部'}>
            <IconButton
              size="small"
              onClick={handleCopyDetails}
              sx={{
                color: 'text.secondary',
                '&:hover': {
                  bgcolor: alpha(theme.palette.primary.main, 0.08),
                  color: 'primary.main',
                },
              }}
            >
              <CopyIcon size={18} />
            </IconButton>
          </Tooltip>
          <Tooltip title={t('devtools.network.shareAsText') || '分享为文本'}>
            <IconButton
              size="small"
              onClick={handleShareDetails}
              sx={{
                color: 'text.secondary',
                '&:hover': {
                  bgcolor: alpha(theme.palette.info.main, 0.08),
                  color: 'info.main',
                },
              }}
            >
              <ShareIcon size={18} />
            </IconButton>
          </Tooltip>
          <IconButton
            size="small"
            onClick={() => setShowDetails(false)}
            sx={{
              color: 'text.secondary',
              '&:hover': {
                bgcolor: alpha(theme.palette.error.main, 0.08),
                color: 'error.main',
              },
            }}
          >
            <ClearIcon size={18} />
          </IconButton>
        </Box>
      </DialogTitle>
      <Divider />
      <DialogContent sx={{
        pt: 3,
      }}>
        {selectedEntry && (
          <Box>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, mb: 3 }}>
              <Paper
                elevation={0}
                sx={{
                  p: 2,
                  bgcolor: theme.palette.mode === 'dark'
                    ? alpha(theme.palette.common.white, 0.03)
                    : alpha(theme.palette.common.black, 0.02),
                  borderRadius: 1,
                }}
              >
                <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600, color: 'text.secondary' }}>
                  {t('devtools.network.url')}
                </Typography>
                <Typography 
                  variant="body2" 
                  sx={{ 
                    wordBreak: 'break-all',
                    fontFamily: 'monospace',
                    fontSize: '0.875rem',
                    color: 'text.primary',
                  }}
                >
                  {selectedEntry.url}
                </Typography>
              </Paper>
              <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                <Box>
                  <Typography variant="caption" sx={{ color: 'text.secondary', mb: 0.5, display: 'block', fontWeight: 500 }}>
                    {t('devtools.network.method')}
                  </Typography>
                  <Chip
                    label={selectedEntry.method}
                    size="small"
                    sx={{ 
                      bgcolor: networkService.getMethodColor(selectedEntry.method), 
                      color: 'white',
                      fontWeight: 600,
                      height: '28px',
                    }}
                  />
                </Box>
                <Box>
                  <Typography variant="caption" sx={{ color: 'text.secondary', mb: 0.5, display: 'block', fontWeight: 500 }}>
                    {t('devtools.network.status')}
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    {getStatusIcon(selectedEntry.status)}
                    <Chip
                      label={selectedEntry.statusCode || selectedEntry.status}
                      size="small"
                      color={selectedEntry.status === 'success' ? 'success' : selectedEntry.status === 'error' ? 'error' : 'default'}
                      sx={{ height: '28px' }}
                    />
                  </Box>
                </Box>
                {selectedEntry.duration && (
                  <Box>
                    <Typography variant="caption" sx={{ color: 'text.secondary', mb: 0.5, display: 'block', fontWeight: 500 }}>
                      {t('devtools.network.duration')}
                    </Typography>
                    <Typography 
                      variant="body2"
                      sx={{ 
                        fontFamily: 'monospace',
                        fontWeight: 500,
                      }}
                    >
                      {networkService.formatDuration(selectedEntry.duration)}
                    </Typography>
                  </Box>
                )}
                {selectedEntry.responseSize && (
                  <Box>
                    <Typography variant="caption" sx={{ color: 'text.secondary', mb: 0.5, display: 'block', fontWeight: 500 }}>
                      {t('devtools.network.responseSize')}
                    </Typography>
                    <Typography 
                      variant="body2"
                      sx={{ 
                        fontFamily: 'monospace',
                        fontWeight: 500,
                      }}
                    >
                      {networkService.formatSize(selectedEntry.responseSize)}
                    </Typography>
                  </Box>
                )}
              </Box>
            </Box>

            <Accordion 
              defaultExpanded
              sx={{
                '&:before': { display: 'none' },
                boxShadow: 'none',
                border: `1px solid ${theme.palette.divider}`,
                borderRadius: 1,
                mb: 1,
              }}
            >
              <AccordionSummary 
                expandIcon={<ExpandMoreIcon size={18} />}
                sx={{
                  bgcolor: theme.palette.mode === 'dark'
                    ? alpha(theme.palette.common.white, 0.03)
                    : alpha(theme.palette.common.black, 0.01),
                  borderRadius: '8px 8px 0 0',
                  '&:hover': {
                    bgcolor: theme.palette.mode === 'dark'
                      ? alpha(theme.palette.common.white, 0.05)
                      : alpha(theme.palette.common.black, 0.02),
                  },
                }}
              >
                <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                  {t('devtools.network.requestHeaders')}
                </Typography>
              </AccordionSummary>
              <AccordionDetails sx={{ bgcolor: 'transparent', p: 2 }}>
                <Box
                  component="pre"
                  sx={{
                    fontSize: '0.8125rem',
                    margin: 0,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    fontFamily: 'monospace',
                    bgcolor: theme.palette.mode === 'dark'
                      ? alpha(theme.palette.common.black, 0.3)
                      : alpha(theme.palette.common.black, 0.02),
                    p: 2,
                    borderRadius: 1,
                    border: `1px solid ${alpha(theme.palette.divider, 0.5)}`,
                    maxHeight: '300px',
                    overflow: 'auto',
                  }}
                >
                  {JSON.stringify(selectedEntry.requestHeaders, null, 2)}
                </Box>
              </AccordionDetails>
            </Accordion>

            {selectedEntry.requestPayload && (
              <Accordion
                sx={{
                  '&:before': { display: 'none' },
                  boxShadow: 'none',
                  border: `1px solid ${theme.palette.divider}`,
                  borderRadius: 1,
                  mb: 1,
                }}
              >
                <AccordionSummary 
                  expandIcon={<ExpandMoreIcon size={18} />}
                  sx={{
                    bgcolor: theme.palette.mode === 'dark'
                      ? alpha(theme.palette.common.white, 0.03)
                      : alpha(theme.palette.common.black, 0.01),
                    borderRadius: '8px 8px 0 0',
                    '&:hover': {
                      bgcolor: theme.palette.mode === 'dark'
                        ? alpha(theme.palette.common.white, 0.05)
                        : alpha(theme.palette.common.black, 0.02),
                    },
                  }}
                >
                  <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                    {t('devtools.network.requestBody')}
                  </Typography>
                </AccordionSummary>
                <AccordionDetails sx={{ bgcolor: 'transparent', p: 2 }}>
                  <Box
                    component="pre"
                    sx={{
                      fontSize: '0.8125rem',
                      margin: 0,
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                      fontFamily: 'monospace',
                      bgcolor: theme.palette.mode === 'dark'
                        ? alpha(theme.palette.common.black, 0.3)
                        : alpha(theme.palette.common.black, 0.02),
                      p: 2,
                      borderRadius: 1,
                      border: `1px solid ${alpha(theme.palette.divider, 0.5)}`,
                      maxHeight: '300px',
                      overflow: 'auto',
                    }}
                  >
                    {typeof selectedEntry.requestPayload === 'string'
                      ? selectedEntry.requestPayload
                      : JSON.stringify(selectedEntry.requestPayload, null, 2)}
                  </Box>
                </AccordionDetails>
              </Accordion>
            )}

            <Accordion
              sx={{
                '&:before': { display: 'none' },
                boxShadow: 'none',
                border: `1px solid ${theme.palette.divider}`,
                borderRadius: 1,
                mb: 1,
              }}
            >
              <AccordionSummary 
                expandIcon={<ExpandMoreIcon size={18} />}
                sx={{
                  bgcolor: theme.palette.mode === 'dark'
                    ? alpha(theme.palette.common.white, 0.03)
                    : alpha(theme.palette.common.black, 0.01),
                  borderRadius: '8px 8px 0 0',
                  '&:hover': {
                    bgcolor: theme.palette.mode === 'dark'
                      ? alpha(theme.palette.common.white, 0.05)
                      : alpha(theme.palette.common.black, 0.02),
                  },
                }}
              >
                  <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                    {t('devtools.network.responseHeaders')}
                  </Typography>
              </AccordionSummary>
              <AccordionDetails sx={{ bgcolor: 'transparent', p: 2 }}>
                <Box
                  component="pre"
                  sx={{
                    fontSize: '0.8125rem',
                    margin: 0,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    fontFamily: 'monospace',
                    bgcolor: theme.palette.mode === 'dark'
                      ? alpha(theme.palette.common.black, 0.3)
                      : alpha(theme.palette.common.black, 0.02),
                    p: 2,
                    borderRadius: 1,
                    border: `1px solid ${alpha(theme.palette.divider, 0.5)}`,
                    maxHeight: '300px',
                    overflow: 'auto',
                  }}
                >
                  {JSON.stringify(selectedEntry.responseHeaders, null, 2)}
                </Box>
              </AccordionDetails>
            </Accordion>

            {selectedEntry.responseData && (
              <Accordion
                sx={{
                  '&:before': { display: 'none' },
                  boxShadow: 'none',
                  border: `1px solid ${theme.palette.divider}`,
                  borderRadius: 1,
                }}
              >
                <AccordionSummary
                  expandIcon={<ExpandMoreIcon size={18} />}
                  sx={{
                    bgcolor: theme.palette.mode === 'dark'
                      ? alpha(theme.palette.common.white, 0.03)
                      : alpha(theme.palette.common.black, 0.01),
                    borderRadius: '8px 8px 0 0',
                    '&:hover': {
                      bgcolor: theme.palette.mode === 'dark'
                        ? alpha(theme.palette.common.white, 0.05)
                        : alpha(theme.palette.common.black, 0.02),
                    },
                  }}
                >
                  <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                    {t('devtools.network.responseBody')}
                    {selectedEntry.responseHeaders?.['content-type']?.includes('text/event-stream') && (
                      <Chip
                        label="SSE Stream"
                        size="small"
                        sx={{
                          ml: 1,
                          height: '20px',
                          fontSize: '0.7rem',
                          bgcolor: alpha(theme.palette.info.main, 0.1),
                          color: 'info.main'
                        }}
                      />
                    )}
                  </Typography>
                </AccordionSummary>
                <AccordionDetails sx={{ bgcolor: 'transparent', p: 2 }}>
                  <Box
                    component="pre"
                    sx={{
                      fontSize: '0.8125rem',
                      margin: 0,
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                      fontFamily: 'monospace',
                      bgcolor: theme.palette.mode === 'dark'
                        ? alpha(theme.palette.common.black, 0.3)
                        : alpha(theme.palette.common.black, 0.02),
                      p: 2,
                      borderRadius: 1,
                      border: `1px solid ${alpha(theme.palette.divider, 0.5)}`,
                      maxHeight: '300px',
                      overflow: 'auto',
                    }}
                  >
                    {typeof selectedEntry.responseData === 'string'
                      ? selectedEntry.responseData
                      : JSON.stringify(selectedEntry.responseData, null, 2)}
                  </Box>
                </AccordionDetails>
              </Accordion>
            )}
          </Box>
        )}
      </DialogContent>
    </BackButtonDialog>
  );

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', bgcolor: 'transparent' }}>
      {/* 过滤器 - 优化设计 */}
      <Paper
        elevation={0}
        sx={{
          p: 2,
          borderBottom: `1px solid ${theme.palette.divider}`,
          bgcolor: theme.palette.mode === 'dark'
            ? alpha(theme.palette.background.paper, 0.4)
            : theme.palette.background.paper,
          borderRadius: 0,
        }}
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField
            size="small"
            placeholder={t('devtools.network.searchPlaceholder')}
            value={filter.searchText}
            onChange={(e) => setFilter(prev => ({ ...prev, searchText: e.target.value }))}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon size={18} style={{ color: theme.palette.text.secondary }} />
                </InputAdornment>
              ),
              endAdornment: filter.searchText && (
                <InputAdornment position="end">
                  <IconButton
                    size="small"
                    onClick={() => setFilter(prev => ({ ...prev, searchText: '' }))}
                    sx={{ p: 0.5 }}
                  >
                    <ClearIcon size={14} />
                  </IconButton>
                </InputAdornment>
              ),
            }}
            fullWidth
            sx={{
              '& .MuiOutlinedInput-root': {
                bgcolor: theme.palette.mode === 'dark' 
                  ? alpha(theme.palette.common.white, 0.05)
                  : alpha(theme.palette.common.black, 0.02),
                '&:hover': {
                  bgcolor: theme.palette.mode === 'dark' 
                    ? alpha(theme.palette.common.white, 0.08)
                    : alpha(theme.palette.common.black, 0.04),
                },
                '&.Mui-focused': {
                  bgcolor: theme.palette.mode === 'dark' 
                    ? alpha(theme.palette.common.white, 0.08)
                    : alpha(theme.palette.common.black, 0.04),
                },
              },
            }}
          />
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
            <FormControlLabel
              control={
                <CustomSwitch
                  checked={filter.onlyErrors}
                  onChange={(e) => setFilter(prev => ({ ...prev, onlyErrors: e.target.checked }))}
                />
              }
              label={<Typography variant="body2">{t('devtools.network.onlyErrors')}</Typography>}
              sx={{ m: 0 }}
            />
            <FormControlLabel
              control={
                <CustomSwitch
                  checked={!filter.hideDataUrls}
                  onChange={(e) => setFilter(prev => ({ ...prev, hideDataUrls: !e.target.checked }))}
                />
              }
              label={<Typography variant="body2">{t('devtools.network.showDataUrls')}</Typography>}
              sx={{ m: 0 }}
            />
          </Box>
        </Box>
      </Paper>

      {/* 网络请求列表 - 优化设计 */}
      <Box 
        sx={{ 
          flexGrow: 1, 
          overflow: 'auto',
          bgcolor: theme.palette.mode === 'dark' 
            ? alpha(theme.palette.background.default, 0.5)
            : theme.palette.background.default,
        }}
      >
        <List dense sx={{ p: 0 }}>
          {filteredEntries.length === 0 ? (
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                py: 8,
                color: 'text.secondary',
              }}
            >
              <HttpIcon size={48} style={{ opacity: 0.3, marginBottom: 16 }} />
              <Typography variant="body2" color="text.secondary">
                {filter.searchText ? t('devtools.network.noResults') : t('devtools.network.empty')}
              </Typography>
            </Box>
          ) : (
            filteredEntries.map((entry, index) => {
              const isSelected = selectedIds.has(entry.id);
              return (
              <ListItem
                key={entry.id}
                sx={{
                  py: 1.5,
                  px: 2,
                  borderBottom: index < filteredEntries.length - 1 
                    ? `1px solid ${alpha(theme.palette.divider, 0.5)}` 
                    : 'none',
                  bgcolor: isSelected 
                    ? alpha(theme.palette.primary.main, 0.08) 
                    : 'transparent',
                  '&:hover': { 
                    bgcolor: isSelected
                      ? alpha(theme.palette.primary.main, 0.12)
                      : theme.palette.mode === 'dark'
                        ? alpha(theme.palette.common.white, 0.05)
                        : alpha(theme.palette.common.black, 0.02),
                  },
                  cursor: 'pointer',
                  transition: 'background-color 0.2s',
                }}
                onClick={selectionMode ? () => handleToggleSelect(entry.id) : () => handleEntryClick(entry)}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', width: '100%', gap: 1.5 }}>
                  {selectionMode && (
                    <Checkbox
                      checked={isSelected}
                      onChange={() => handleToggleSelect(entry.id)}
                      onClick={(e) => e.stopPropagation()}
                      size="small"
                      sx={{ 
                        p: 0,
                        '&.Mui-checked': {
                          color: 'primary.main',
                        },
                      }}
                    />
                  )}
                  <Chip
                    label={entry.method}
                    size="small"
                    sx={{
                      bgcolor: networkService.getMethodColor(entry.method),
                      color: 'white',
                      fontWeight: 600,
                      minWidth: '64px',
                      height: '24px',
                      fontSize: '0.75rem',
                    }}
                  />
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 0.5,
                    }}
                  >
                    {getStatusIcon(entry.status)}
                    <Chip
                      label={entry.statusCode || entry.status}
                      size="small"
                      color={
                        entry.status === 'success' 
                          ? 'success' 
                          : entry.status === 'error' 
                          ? 'error' 
                          : 'default'
                      }
                      sx={{
                        height: '24px',
                        fontSize: '0.75rem',
                      }}
                    />
                  </Box>
                  <Box sx={{ flexGrow: 1, minWidth: 0, mx: 1 }}>
                    <Tooltip title={entry.url} arrow>
                      <Typography
                        variant="body2"
                        sx={{
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          fontFamily: 'monospace',
                          fontSize: '0.8125rem',
                        }}
                      >
                        {entry.url}
                      </Typography>
                    </Tooltip>
                  </Box>
                  <Box 
                    sx={{ 
                      display: 'flex', 
                      gap: 2, 
                      minWidth: 'fit-content',
                      alignItems: 'center',
                    }}
                  >
                    {entry.duration && (
                      <Typography 
                        variant="caption" 
                        color="text.secondary"
                        sx={{ 
                          fontFamily: 'monospace',
                          fontSize: '0.75rem',
                        }}
                      >
                        {networkService.formatDuration(entry.duration)}
                      </Typography>
                    )}
                    {entry.responseSize && (
                      <Typography 
                        variant="caption" 
                        color="text.secondary"
                        sx={{ 
                          fontFamily: 'monospace',
                          fontSize: '0.75rem',
                        }}
                      >
                        {networkService.formatSize(entry.responseSize)}
                      </Typography>
                    )}
                    {!entry.duration && !entry.responseSize && (
                      <Typography variant="caption" color="text.secondary">
                        -
                      </Typography>
                    )}
                  </Box>
                </Box>
              </ListItem>
              );
            })
          )}
        </List>
      </Box>

      {renderDetailsDialog()}
    </Box>
  );
});

NetworkPanel.displayName = 'NetworkPanel';

export default NetworkPanel;
