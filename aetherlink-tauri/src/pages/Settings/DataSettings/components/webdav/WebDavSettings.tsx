import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  FormControlLabel,
  Alert,
  CircularProgress,
  Chip,
  Divider
} from '@mui/material';
import {
  Cloud as CloudIcon,
  CloudUpload as CloudSyncIcon,
  Settings as SettingsIcon,
  CheckCircle as CheckCircleIcon,
  AlertCircle as ErrorIcon,
  RefreshCw as SyncIcon
} from 'lucide-react';
import type { WebDavConfig, WebDavSyncState } from '../../../../../shared/types';
import { WebDavBackupService } from '../../../../../shared/services/storage/WebDavBackupService';
import {
  saveWebDavConfig,
  getWebDavConfig,
  validateWebDavConfig,
  getSyncIntervalOptions,
  getMaxBackupsOptions,
  formatDateTime
} from '../../../../../shared/utils/webdavUtils';

interface WebDavSettingsProps {
  onConfigChange?: (config: WebDavConfig | null) => void;
}

const WebDavSettings: React.FC<WebDavSettingsProps> = ({ onConfigChange }) => {
  const [config, setConfig] = useState<WebDavConfig>({
    webdavHost: '',
    webdavUser: '',
    webdavPass: '',
    webdavPath: '/AetherLink'
  });

  const [syncState, setSyncState] = useState<WebDavSyncState>({
    syncing: false,
    lastSyncTime: null,
    lastSyncError: null,
    autoSync: false,
    syncInterval: 0,
    maxBackups: 5
  });

  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  const webdavService = WebDavBackupService.getInstance();

  // 加载配置
  useEffect(() => {
    loadConfig();
    loadSyncState();
  }, []);

  const loadConfig = async () => {
    try {
      const savedConfig = await getWebDavConfig();
      if (savedConfig) {
        setConfig(savedConfig);
        onConfigChange?.(savedConfig);
      }
    } catch (error) {
      console.error('加载 WebDAV 配置失败:', error);
    }
  };

  const loadSyncState = async () => {
    try {
      const state = await webdavService.getSyncState();
      setSyncState(state);
    } catch (error) {
      console.error('加载同步状态失败:', error);
    }
  };

  const handleConfigChange = (field: keyof WebDavConfig, value: string) => {
    const newConfig = { ...config, [field]: value };
    setConfig(newConfig);
    setTestResult(null);
    setErrors([]);
  };

  const handleSyncSettingChange = async (field: keyof WebDavSyncState, value: any) => {
    const newSyncState = { ...syncState, [field]: value };
    setSyncState(newSyncState);

    try {
      await webdavService.updateSyncState({ [field]: value });

      // 如果是自动同步设置变更
      if (field === 'autoSync' || field === 'syncInterval') {
        if (newSyncState.autoSync && newSyncState.syncInterval > 0) {
          await webdavService.startAutoSync(config, newSyncState.syncInterval);
        } else {
          await webdavService.stopAutoSync();
        }
      }
    } catch (error) {
      console.error('更新同步设置失败:', error);
    }
  };

  const testConnection = async () => {
    const validationErrors = validateWebDavConfig(config);
    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }

    setTesting(true);
    setTestResult(null);
    setErrors([]);

    try {
      const success = await webdavService.checkConnection(config);
      setTestResult({
        success,
        message: success ? '连接成功！' : '连接失败，请检查配置'
      });
    } catch (error) {
      setTestResult({
        success: false,
        message: `连接错误: ${error instanceof Error ? error.message : String(error)}`
      });
    } finally {
      setTesting(false);
    }
  };

  const saveConfig = async () => {
    const validationErrors = validateWebDavConfig(config);
    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }

    setSaving(true);
    setErrors([]);

    try {
      await saveWebDavConfig(config);
      onConfigChange?.(config);
      setTestResult({
        success: true,
        message: '配置保存成功！'
      });
    } catch (error) {
      setErrors([`保存失败: ${error instanceof Error ? error.message : String(error)}`]);
    } finally {
      setSaving(false);
    }
  };

  const renderSyncStatus = () => {
    if (!config.webdavHost) return null;

    return (
      <Box sx={{ mt: 2 }}>
        <Typography variant="subtitle2" gutterBottom>
          同步状态
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          {syncState.syncing && (
            <Chip
              icon={<SyncIcon />}
              label="同步中..."
              color="primary"
              size="small"
            />
          )}

          {syncState.lastSyncError && (
            <Chip
              icon={<ErrorIcon />}
              label={`错误: ${syncState.lastSyncError}`}
              color="error"
              size="small"
            />
          )}

          {syncState.lastSyncTime && !syncState.syncing && !syncState.lastSyncError && (
            <Chip
              icon={<CheckCircleIcon />}
              label={`上次同步: ${formatDateTime(new Date(syncState.lastSyncTime).toISOString())}`}
              color="success"
              size="small"
            />
          )}

          {!syncState.lastSyncTime && !syncState.syncing && !syncState.lastSyncError && (
            <Chip
              label="未同步"
              color="default"
              size="small"
            />
          )}
        </Box>
      </Box>
    );
  };

  return (
    <Paper sx={{ p: 3, mb: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <CloudIcon size={24} color="var(--mui-palette-primary-main)" style={{ marginRight: 8 }} />
        <Typography variant="h6">
          WebDAV 云备份设置
        </Typography>
      </Box>

      <Typography variant="body2" color="textSecondary" sx={{ mb: 3 }}>
        配置 WebDAV 服务器，实现数据的云端备份和同步
      </Typography>

      {errors.length > 0 && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {errors.map((error, index) => (
            <div key={index}>{error}</div>
          ))}
        </Alert>
      )}

      {testResult && (
        <Alert severity={testResult.success ? 'success' : 'error'} sx={{ mb: 2 }}>
          {testResult.message}
        </Alert>
      )}

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <TextField
          label="WebDAV 服务器地址"
          placeholder="https://your-server.com/webdav"
          value={config.webdavHost}
          onChange={(e) => handleConfigChange('webdavHost', e.target.value)}
          fullWidth
          helperText="例如: https://cloud.example.com/remote.php/webdav"
        />

        <TextField
          label="用户名"
          value={config.webdavUser}
          onChange={(e) => handleConfigChange('webdavUser', e.target.value)}
          fullWidth
        />

        <TextField
          label="密码"
          type="password"
          value={config.webdavPass}
          onChange={(e) => handleConfigChange('webdavPass', e.target.value)}
          fullWidth
        />

        <TextField
          label="备份路径"
          value={config.webdavPath}
          onChange={(e) => handleConfigChange('webdavPath', e.target.value)}
          fullWidth
          helperText="在服务器上存储备份文件的目录路径"
        />

        <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
          <Button
            variant="outlined"
            onClick={testConnection}
            disabled={testing || saving}
            startIcon={testing ? <CircularProgress size={20} /> : <SettingsIcon size={20} />}
          >
            {testing ? '测试中...' : '测试连接'}
          </Button>

          <Button
            variant="contained"
            onClick={saveConfig}
            disabled={testing || saving}
            startIcon={saving ? <CircularProgress size={20} /> : <CloudSyncIcon size={20} />}
          >
            {saving ? '保存中...' : '保存配置'}
          </Button>
        </Box>

        {config.webdavHost && (
          <>
            <Divider sx={{ my: 2 }} />

            <Typography variant="subtitle1" gutterBottom>
              自动同步设置
            </Typography>

            <FormControl fullWidth>
              <InputLabel>同步间隔</InputLabel>
              <Select
                value={syncState.syncInterval}
                label="同步间隔"
                onChange={(e) => handleSyncSettingChange('syncInterval', e.target.value)}
              >
                {getSyncIntervalOptions().map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth>
              <InputLabel>最大备份数量</InputLabel>
              <Select
                value={syncState.maxBackups}
                label="最大备份数量"
                onChange={(e) => handleSyncSettingChange('maxBackups', e.target.value)}
              >
                {getMaxBackupsOptions().map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControlLabel
              control={
                <Switch
                  checked={syncState.autoSync}
                  onChange={(e) => handleSyncSettingChange('autoSync', e.target.checked)}
                />
              }
              label="启用自动同步"
            />

            {renderSyncStatus()}
          </>
        )}
      </Box>
    </Paper>
  );
};

export default WebDavSettings;
