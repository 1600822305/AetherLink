import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  Box,
  AppBar,
  Toolbar,
  IconButton,
  Typography,
  Tabs,
  Tab,
  DialogTitle,
  DialogContent,
  DialogActions,
  DialogContentText,
  Button,
  FormControlLabel,
  Tooltip,
  Divider,
  Paper,
} from '@mui/material';
import BackButtonDialog from '../components/common/BackButtonDialog';
import {
  ArrowLeft as ArrowBackIcon,
  Trash2 as DeleteIcon,
  Settings as SettingsIcon,
  Terminal as TerminalIcon,
  Wifi as NetworkCheckIcon,
  Copy as CopyIcon,
  CheckSquare as SelectAllIcon,
  Square as DeselectIcon,
  MousePointer2 as SelectModeIcon,
  Share as ShareIcon,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTheme, alpha } from '@mui/material/styles';
import { useMediaQuery } from '@mui/material';
import { useTranslation } from '../i18n';
import CustomSwitch from '../components/CustomSwitch';
import ConsolePanel from '../components/DevTools/ConsolePanel';
import type { ConsolePanelRef } from '../components/DevTools/ConsolePanel';
import NetworkPanel from '../components/DevTools/NetworkPanel';
import type { NetworkPanelRef } from '../components/DevTools/NetworkPanel';
import EnhancedConsoleService from '../shared/services/infra/EnhancedConsoleService';
import EnhancedNetworkService from '../shared/services/network/EnhancedNetworkService';
import { SafeAreaContainer } from '../components/settings/SettingComponents';
import { toastManager } from '../components/EnhancedToast';
import { shareTextAsFile } from '../utils/exportUtils';
import dayjs from 'dayjs';
import { createLogger } from '../shared/services/infra/logger';

const logger = createLogger('DevToolsPage');

const DevToolsPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const [tabValue, setTabValue] = useState(0);
  const [clearDialogOpen, setClearDialogOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  
  // 从 localStorage 读取设置，默认值为 true（自动滚动开启）
  const [autoScroll, setAutoScroll] = useState(() => {
    try {
      const saved = localStorage.getItem('devtools-auto-scroll');
      return saved !== null ? JSON.parse(saved) : true;
    } catch {
      return true;
    }
  });
  
  // 从 localStorage 读取保持日志设置，默认值为 false
  const [preserveLog, setPreserveLog] = useState(() => {
    try {
      const saved = localStorage.getItem('devtools-preserve-log');
      return saved !== null ? JSON.parse(saved) : false;
    } catch {
      return false;
    }
  });
  
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedConsoleIds, setSelectedConsoleIds] = useState<Set<string>>(new Set());
  const [selectedNetworkIds, setSelectedNetworkIds] = useState<Set<string>>(new Set());
  
  // 用于获取面板数据的引用
  const consolePanelRef = useRef<ConsolePanelRef>(null);
  const networkPanelRef = useRef<NetworkPanelRef>(null);

  const consoleService = EnhancedConsoleService.getInstance();
  const networkService = EnhancedNetworkService.getInstance();

  // 监听 autoScroll 变化并保存到 localStorage
  useEffect(() => {
    try {
      localStorage.setItem('devtools-auto-scroll', JSON.stringify(autoScroll));
    } catch (error) {
      logger.warn('保存自动滚动设置失败:', error);
    }
  }, [autoScroll]);

  // 监听 preserveLog 变化并保存到 localStorage
  useEffect(() => {
    try {
      localStorage.setItem('devtools-preserve-log', JSON.stringify(preserveLog));
    } catch (error) {
      logger.warn('保存保持日志设置失败:', error);
    }
  }, [preserveLog]);

  const handleTabChange = (_: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const handleBack = () => {
    navigate('/settings/about');
  };

  const handleClear = () => {
    if (tabValue === 0) {
      consoleService.clear();
      setSelectedConsoleIds(new Set());
    } else if (tabValue === 1) {
      networkService.clear();
      setSelectedNetworkIds(new Set());
    }
    setClearDialogOpen(false);
  };

  // 切换选择模式
  const handleToggleSelectionMode = () => {
    if (selectionMode) {
      // 退出选择模式时清空选中
      setSelectedConsoleIds(new Set());
      setSelectedNetworkIds(new Set());
    }
    setSelectionMode(!selectionMode);
  };

  // 全选/取消全选
  const handleSelectAll = useCallback(() => {
    if (tabValue === 0) {
      const entries = consolePanelRef.current?.getFilteredEntries() || [];
      if (selectedConsoleIds.size === entries.length && entries.length > 0) {
        setSelectedConsoleIds(new Set());
      } else {
        setSelectedConsoleIds(new Set(entries.map((e: any) => e.id)));
      }
    } else if (tabValue === 1) {
      const entries = networkPanelRef.current?.getFilteredEntries() || [];
      if (selectedNetworkIds.size === entries.length && entries.length > 0) {
        setSelectedNetworkIds(new Set());
      } else {
        setSelectedNetworkIds(new Set(entries.map((e: any) => e.id)));
      }
    }
  }, [tabValue, selectedConsoleIds.size, selectedNetworkIds.size]);

  // 复制选中内容
  const handleCopySelected = useCallback(async () => {
    let textToCopy = '';
    
    if (tabValue === 0) {
      const entries = consolePanelRef.current?.getFilteredEntries() || [];
      const selectedEntries = entries.filter((e: any) => selectedConsoleIds.has(e.id));
      textToCopy = selectedEntries.map((entry: any) => {
        const time = new Date(entry.timestamp).toLocaleTimeString();
        const level = entry.level.toUpperCase();
        const message = entry.args.map((arg: any) => consoleService.formatArg(arg)).join(' ');
        const stack = entry.stack ? `\n${entry.stack}` : '';
        return `[${time}] [${level}] ${message}${stack}`;
      }).join('\n\n');
    } else if (tabValue === 1) {
      const entries = networkPanelRef.current?.getFilteredEntries() || [];
      const selectedEntries = entries.filter((e: any) => selectedNetworkIds.has(e.id));
      textToCopy = selectedEntries.map((entry: any) => {
        const time = new Date(entry.startTime).toLocaleTimeString();
        const duration = entry.duration ? networkService.formatDuration(entry.duration) : 'pending';
        return `[${time}] ${entry.method} ${entry.url}\nStatus: ${entry.statusCode || entry.status} | Duration: ${duration}`;
      }).join('\n\n');
    }
    
    if (textToCopy) {
      try {
        await navigator.clipboard.writeText(textToCopy);
        // 可选：显示复制成功提示
      } catch (err) {
        logger.error('Failed to copy:', err);
      }
    }
  }, [tabValue, selectedConsoleIds, selectedNetworkIds]);

  // 分享日志功能
  const handleShareLogs = useCallback(async () => {
    try {
      let logContent = '';
      const timestamp = dayjs().format('YYYY-MM-DD-HH-mm-ss');
      let fileName = '';

      if (tabValue === 0) {
        // 控制台日志
        const entries = consolePanelRef.current?.getFilteredEntries() || [];
        fileName = `console_logs_${timestamp}.txt`;
        
        if (entries.length === 0) {
          toastManager.warning('没有控制台日志可以分享', '分享提醒');
          return;
        }

        logContent = [
          `# 控制台日志导出`,
          `导出时间: ${dayjs().format('YYYY-MM-DD HH:mm:ss')}`,
          `日志条数: ${entries.length}`,
          ``,
          `---`,
          ``,
          ...entries.map((entry: any) => {
            const time = new Date(entry.timestamp).toLocaleString();
            const level = entry.level.toUpperCase();
            const message = entry.args.map((arg: any) => consoleService.formatArg(arg)).join(' ');
            const stack = entry.stack ? `\n堆栈信息: ${entry.stack}` : '';
            return `[${time}] [${level}] ${message}${stack}`;
          })
        ].join('\n');

      } else if (tabValue === 1) {
        // 网络日志
        const entries = networkPanelRef.current?.getFilteredEntries() || [];
        fileName = `network_logs_${timestamp}.txt`;
        
        if (entries.length === 0) {
          toastManager.warning('没有网络日志可以分享', '分享提醒');
          return;
        }

        logContent = [
          `# 网络请求日志导出`,
          `导出时间: ${dayjs().format('YYYY-MM-DD HH:mm:ss')}`,
          `请求数量: ${entries.length}`,
          ``,
          `---`,
          ``,
          ...entries.map((entry: any) => {
            const startTime = new Date(entry.startTime).toLocaleString();
            const duration = entry.duration ? networkService.formatDuration(entry.duration) : 'pending';
            const size = entry.responseSize ? networkService.formatSize(entry.responseSize) : '-';
            
            let requestInfo = `[${startTime}] ${entry.method} ${entry.url}`;
            requestInfo += `\n状态: ${entry.statusCode || entry.status}`;
            requestInfo += `\n耗时: ${duration}`;
            requestInfo += `\n大小: ${size}`;
            
            if (entry.requestHeaders && Object.keys(entry.requestHeaders).length > 0) {
              requestInfo += `\n请求头: ${JSON.stringify(entry.requestHeaders, null, 2)}`;
            }
            
            if (entry.responseHeaders && Object.keys(entry.responseHeaders).length > 0) {
              requestInfo += `\n响应头: ${JSON.stringify(entry.responseHeaders, null, 2)}`;
            }
            
            if (entry.error) {
              requestInfo += `\n错误: ${entry.error.message}`;
            }
            
            return requestInfo;
          })
        ].join('\n\n');
      }

      await shareTextAsFile(logContent, fileName);

    } catch (error) {
      logger.error('分享日志失败:', error);
      toastManager.error('分享日志失败: ' + (error as Error).message, '分享错误');
    }
  }, [tabValue, consoleService, networkService]);

  // 当前选中的数量
  const selectedCount = tabValue === 0 ? selectedConsoleIds.size : selectedNetworkIds.size;

  return (
    <SafeAreaContainer>
      {/* 顶部工具栏 - 优化设计 */}
      <AppBar 
        position="static" 
        elevation={0}
        className="status-bar-safe-area"
        sx={{
          bgcolor: theme.palette.mode === 'dark' 
            ? alpha(theme.palette.background.paper, 0.8)
            : theme.palette.background.paper,
          borderBottom: `1px solid ${theme.palette.divider}`,
          backdropFilter: 'blur(8px)',
        }}
      >
        <Toolbar variant={isMobile ? 'dense' : 'regular'} sx={{ gap: 1 }}>
          <IconButton
            edge="start"
            onClick={handleBack}
            aria-label={t('devtools.back')}
            sx={{
              color: 'text.primary',
              '&:hover': {
                bgcolor: alpha(theme.palette.primary.main, 0.08),
              },
            }}
          >
            <ArrowBackIcon size={20} />
          </IconButton>
          
          <Box sx={{ flexGrow: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 32,
                height: 32,
                borderRadius: 1,
                bgcolor: theme.palette.mode === 'dark'
                  ? alpha(theme.palette.primary.main, 0.2)
                  : alpha(theme.palette.primary.main, 0.1),
                color: 'primary.main',
              }}
            >
              <TerminalIcon size={18} />
            </Box>
            <Typography 
              variant="h6" 
              component="div"
              sx={{ 
                fontWeight: 600,
                color: 'text.primary',
              }}
            >
              {t('devtools.title')}
            </Typography>
          </Box>

          <Box sx={{ display: 'flex', gap: 0.5 }}>
            {/* 选择模式切换 */}
            <Tooltip title={selectionMode ? t('devtools.exitSelectMode') : t('devtools.selectMode')} arrow>
              <IconButton 
                onClick={handleToggleSelectionMode}
                sx={{
                  color: selectionMode ? 'primary.main' : 'text.secondary',
                  bgcolor: selectionMode ? alpha(theme.palette.primary.main, 0.12) : 'transparent',
                  '&:hover': {
                    bgcolor: alpha(theme.palette.primary.main, 0.08),
                    color: 'primary.main',
                  },
                }}
              >
                <SelectModeIcon size={18} />
              </IconButton>
            </Tooltip>

            {/* 选择模式下的操作按钮 */}
            {selectionMode && (
              <>
                <Tooltip title={t('devtools.selectAll')} arrow>
                  <IconButton 
                    onClick={handleSelectAll}
                    sx={{
                      color: 'text.secondary',
                      '&:hover': {
                        bgcolor: alpha(theme.palette.primary.main, 0.08),
                        color: 'primary.main',
                      },
                    }}
                  >
                    {selectedCount > 0 ? <DeselectIcon size={18} /> : <SelectAllIcon size={18} />}
                  </IconButton>
                </Tooltip>
                <Tooltip title={`${t('devtools.copy')} (${selectedCount})`} arrow>
                  <span>
                    <IconButton 
                      onClick={handleCopySelected}
                      disabled={selectedCount === 0}
                      sx={{
                        color: selectedCount > 0 ? 'text.secondary' : 'action.disabled',
                        '&:hover': {
                          bgcolor: alpha(theme.palette.success.main, 0.08),
                          color: 'success.main',
                        },
                      }}
                    >
                      <CopyIcon size={18} />
                    </IconButton>
                  </span>
                </Tooltip>
              </>
            )}

            <Tooltip title="分享日志" arrow>
              <IconButton 
                onClick={handleShareLogs}
                sx={{
                  color: 'text.secondary',
                  '&:hover': {
                    bgcolor: alpha(theme.palette.success.main, 0.08),
                    color: 'success.main',
                  },
                }}
              >
                <ShareIcon size={18} />
              </IconButton>
            </Tooltip>

            <Tooltip title={t('devtools.settings')} arrow>
              <IconButton 
                onClick={() => setSettingsOpen(true)}
                sx={{
                  color: 'text.secondary',
                  '&:hover': {
                    bgcolor: alpha(theme.palette.primary.main, 0.08),
                    color: 'primary.main',
                  },
                }}
              >
                <SettingsIcon size={18} />
              </IconButton>
            </Tooltip>

            <Tooltip title={t('devtools.clear')} arrow>
              <IconButton 
                onClick={() => setClearDialogOpen(true)}
                sx={{
                  color: 'text.secondary',
                  '&:hover': {
                    bgcolor: alpha(theme.palette.error.main, 0.08),
                    color: 'error.main',
                  },
                }}
              >
                <DeleteIcon size={18} />
              </IconButton>
            </Tooltip>
          </Box>
        </Toolbar>
      </AppBar>

      {/* 标签页 - 优化样式 */}
      <Paper 
        elevation={0}
        square
        sx={{
          borderBottom: `1px solid ${theme.palette.divider}`,
          bgcolor: theme.palette.mode === 'dark' 
            ? alpha(theme.palette.background.paper, 0.6)
            : theme.palette.background.paper,
        }}
      >
        <Tabs
          value={tabValue}
          onChange={handleTabChange}
          variant={isMobile ? "fullWidth" : "standard"}
          sx={{
            minHeight: isMobile ? 48 : 56,
            '& .MuiTab-root': {
              minHeight: isMobile ? 48 : 56,
              textTransform: 'none',
              fontWeight: 500,
              fontSize: '0.875rem',
              gap: 1,
              color: 'text.secondary',
              '&.Mui-selected': {
                color: 'primary.main',
                fontWeight: 600,
              },
            },
            '& .MuiTabs-indicator': {
              height: 2,
              borderRadius: '1px 1px 0 0',
            },
          }}
        >
          <Tab
            icon={<TerminalIcon size={18} />}
            label={t('devtools.tabs.console')}
            iconPosition="start"
          />
          <Tab
            icon={<NetworkCheckIcon size={18} />}
            label={t('devtools.tabs.network')}
            iconPosition="start"
          />
        </Tabs>
      </Paper>

      {/* 主内容区域 */}
      <Box sx={{ 
        flexGrow: 1, 
        overflow: 'hidden', 
        position: 'relative',
        pb: 'var(--content-bottom-padding)',
      }}>
        {tabValue === 0 && (
          <ConsolePanel 
            ref={consolePanelRef}
            autoScroll={autoScroll} 
            selectionMode={selectionMode}
            selectedIds={selectedConsoleIds}
            onSelectionChange={setSelectedConsoleIds}
          />
        )}
        {tabValue === 1 && (
          <NetworkPanel 
            ref={networkPanelRef}
            selectionMode={selectionMode}
            selectedIds={selectedNetworkIds}
            onSelectionChange={setSelectedNetworkIds}
          />
        )}
      </Box>

      {/* 设置对话框 - 优化设计 */}
      <BackButtonDialog 
        open={settingsOpen} 
        onClose={() => setSettingsOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 2,
          },
        }}
      >
        <DialogTitle sx={{ pb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <SettingsIcon size={20} />
            <Typography variant="h6" component="span" sx={{ fontWeight: 600 }}>
              {t('devtools.settingsDialog.title')}
            </Typography>
          </Box>
        </DialogTitle>
        <Divider />
        <DialogContent sx={{ pt: 2 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <FormControlLabel
              control={
                <CustomSwitch
                  checked={autoScroll}
                  onChange={(e) => setAutoScroll(e.target.checked)}
                />
              }
              label={
                <Box>
                  <Typography variant="body1" sx={{ fontWeight: 500 }}>
                    {t('devtools.settingsDialog.autoScroll.label')}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {t('devtools.settingsDialog.autoScroll.description')}
                  </Typography>
                </Box>
              }
              sx={{ alignItems: 'flex-start', m: 0 }}
            />
            <Divider />
            <FormControlLabel
              control={
                <CustomSwitch
                  checked={preserveLog}
                  onChange={(e) => setPreserveLog(e.target.checked)}
                />
              }
              label={
                <Box>
                  <Typography variant="body1" sx={{ fontWeight: 500 }}>
                    {t('devtools.settingsDialog.preserveLog.label')}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {t('devtools.settingsDialog.preserveLog.description')}
                  </Typography>
                </Box>
              }
              sx={{ alignItems: 'flex-start', m: 0 }}
            />
          </Box>
        </DialogContent>
        <Divider />
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button 
            onClick={() => setSettingsOpen(false)}
            variant="contained"
            sx={{ textTransform: 'none', px: 3 }}
          >
            {t('devtools.settingsDialog.close')}
          </Button>
        </DialogActions>
      </BackButtonDialog>

      {/* 清除确认对话框 - 优化设计 */}
      <BackButtonDialog 
        open={clearDialogOpen} 
        onClose={() => setClearDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 2,
          },
        }}
      >
        <DialogTitle sx={{ pb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 40,
                height: 40,
                borderRadius: 1,
                bgcolor: alpha(theme.palette.error.main, 0.1),
                color: 'error.main',
              }}
            >
              <DeleteIcon size={20} />
            </Box>
            <Typography variant="h6" component="span" sx={{ fontWeight: 600 }}>
              {t('devtools.clearDialog.title')}
            </Typography>
          </Box>
        </DialogTitle>
        <Divider />
        <DialogContent sx={{ pt: 2 }}>
          <DialogContentText sx={{ fontSize: '0.9375rem' }}>
            <strong>
              {tabValue === 0 
                ? t('devtools.clearDialog.consoleMessage')
                : t('devtools.clearDialog.networkMessage')}
            </strong>
            <br />
            <Typography component="span" variant="caption" color="text.secondary">
              {t('devtools.clearDialog.warning')}
            </Typography>
          </DialogContentText>
        </DialogContent>
        <Divider />
        <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
          <Button 
            onClick={() => setClearDialogOpen(false)}
            variant="outlined"
            sx={{ textTransform: 'none', px: 3 }}
          >
            {t('devtools.clearDialog.cancel')}
          </Button>
          <Button 
            onClick={handleClear} 
            color="error"
            variant="contained"
            sx={{ textTransform: 'none', px: 3 }}
          >
            {t('devtools.clearDialog.clear')}
          </Button>
        </DialogActions>
      </BackButtonDialog>
    </SafeAreaContainer>
  );
};

export default DevToolsPage;
