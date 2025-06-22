import React, { useState } from 'react';
import {
  Box,
  AppBar,
  Toolbar,
  IconButton,
  Typography,
  Tabs,
  Tab,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  DialogContentText,
  Button,
  FormControlLabel,
  Tooltip,
} from '@mui/material';
import {
  ArrowLeft as ArrowBackIcon,
  Trash2 as DeleteIcon,
  Settings as SettingsIcon,
  Terminal as TerminalIcon,
  Wifi as NetworkCheckIcon,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '@mui/material/styles';
import { useMediaQuery } from '@mui/material';
import CustomSwitch from '../components/CustomSwitch';
import ConsolePanel from '../components/DevTools/ConsolePanel';
import NetworkPanel from '../components/DevTools/NetworkPanel';
import EnhancedConsoleService from '../shared/services/EnhancedConsoleService';
import EnhancedNetworkService from '../shared/services/network/EnhancedNetworkService';

const DevToolsPage: React.FC = () => {
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const [tabValue, setTabValue] = useState(0);
  const [clearDialogOpen, setClearDialogOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const [preserveLog, setPreserveLog] = useState(false);

  const consoleService = EnhancedConsoleService.getInstance();
  const networkService = EnhancedNetworkService.getInstance();

  const handleTabChange = (_: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const handleBack = () => {
    navigate(-1);
  };

  const handleClear = () => {
    if (tabValue === 0) {
      consoleService.clear();
    } else if (tabValue === 1) {
      networkService.clear();
    }
    setClearDialogOpen(false);
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      {/* 顶部工具栏 */}
      <AppBar position="static" elevation={1}>
        <Toolbar variant={isMobile ? 'dense' : 'regular'}>
          <IconButton
            edge="start"
            color="inherit"
            onClick={handleBack}
            aria-label="返回"
          >
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            开发者工具
          </Typography>

          <Tooltip title="设置">
            <IconButton color="inherit" onClick={() => setSettingsOpen(true)}>
              <SettingsIcon />
            </IconButton>
          </Tooltip>

          <Tooltip title="清除">
            <IconButton color="inherit" onClick={() => setClearDialogOpen(true)}>
              <DeleteIcon />
            </IconButton>
          </Tooltip>
        </Toolbar>
      </AppBar>

      {/* 标签页 */}
      <Tabs
        value={tabValue}
        onChange={handleTabChange}
        variant={isMobile ? "fullWidth" : "standard"}
        sx={{ borderBottom: 1, borderColor: 'divider' }}
      >
        <Tab
          icon={<TerminalIcon />}
          label="控制台"
          iconPosition="start"
          sx={{ minHeight: isMobile ? 48 : 64 }}
        />
        <Tab
          icon={<NetworkCheckIcon />}
          label="网络"
          iconPosition="start"
          sx={{ minHeight: isMobile ? 48 : 64 }}
        />
      </Tabs>

      {/* 主内容区域 */}
      <Box sx={{ flexGrow: 1, overflow: 'hidden' }}>
        {tabValue === 0 && <ConsolePanel autoScroll={autoScroll} />}
        {tabValue === 1 && <NetworkPanel />}
      </Box>

      {/* 设置对话框 */}
      <Dialog open={settingsOpen} onClose={() => setSettingsOpen(false)}>
        <DialogTitle>开发者工具设置</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1, display: 'flex', flexDirection: 'column', gap: 1 }}>
            <FormControlLabel
              control={
                <CustomSwitch
                  checked={autoScroll}
                  onChange={(e) => setAutoScroll(e.target.checked)}
                />
              }
              label="自动滚动到底部"
            />
            <FormControlLabel
              control={
                <CustomSwitch
                  checked={preserveLog}
                  onChange={(e) => setPreserveLog(e.target.checked)}
                />
              }
              label="保留日志"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSettingsOpen(false)}>关闭</Button>
        </DialogActions>
      </Dialog>

      {/* 清除确认对话框 */}
      <Dialog open={clearDialogOpen} onClose={() => setClearDialogOpen(false)}>
        <DialogTitle>确认清除</DialogTitle>
        <DialogContent>
          <DialogContentText>
            确定要清除所有{tabValue === 0 ? '控制台日志' : '网络记录'}吗？此操作无法撤销。
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setClearDialogOpen(false)}>取消</Button>
          <Button onClick={handleClear} color="error">清除</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default DevToolsPage;
