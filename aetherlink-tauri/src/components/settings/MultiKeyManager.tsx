/**
 * 多 Key 管理组件
 * 提供可视化的多 API Key 管理界面
 */

import React, { useState } from 'react';
import {
  Box,
  Typography,
  Button,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Switch,
  FormControlLabel,
  Chip,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Alert,
  LinearProgress,
  Tooltip,
  Card,
  CardContent,
} from '@mui/material';
import {
  Plus,
  Delete,
  Edit,
  Eye,
  EyeOff,
  CheckCircle,
  AlertCircle,
  AlertTriangle
} from 'lucide-react';

import type { ApiKeyConfig, LoadBalanceStrategy } from '../../shared/config/defaultModels';
import ApiKeyManager from '../../shared/services/ApiKeyManager';

interface MultiKeyManagerProps {
  providerName: string;
  providerType: string;
  apiKeys: ApiKeyConfig[];
  strategy: LoadBalanceStrategy;
  onKeysChange: (keys: ApiKeyConfig[]) => void;
  onStrategyChange: (strategy: LoadBalanceStrategy) => void;
}

const MultiKeyManager: React.FC<MultiKeyManagerProps> = ({
  providerName,
  providerType,
  apiKeys,
  strategy,
  onKeysChange,
  onStrategyChange,
}) => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingKey, setEditingKey] = useState<ApiKeyConfig | null>(null);
  const [newKeyValue, setNewKeyValue] = useState('');
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyPriority, setNewKeyPriority] = useState(5);
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const [validationError, setValidationError] = useState('');

  const keyManager = ApiKeyManager.getInstance();

  // 获取状态图标和颜色
  const getStatusInfo = (status: ApiKeyConfig['status']) => {
    switch (status) {
      case 'active':
        return { icon: <CheckCircle size={16} />, color: 'success' as const, text: '正常' };
      case 'error':
        return { icon: <AlertCircle size={16} />, color: 'error' as const, text: '错误' };
      case 'disabled':
        return { icon: <AlertTriangle size={16} />, color: 'warning' as const, text: '禁用' };
      case 'rate_limited':
        return { icon: <AlertTriangle size={16} />, color: 'warning' as const, text: '限流' };
      default:
        return { icon: <AlertTriangle size={16} />, color: 'default' as const, text: '未知' };
    }
  };

  // 处理添加新 Key
  const handleAddKey = () => {
    setEditingKey(null);
    setNewKeyValue('');
    setNewKeyName('');
    setNewKeyPriority(5);
    setValidationError('');
    setDialogOpen(true);
  };

  // 处理编辑 Key
  const handleEditKey = (key: ApiKeyConfig) => {
    setEditingKey(key);
    setNewKeyValue(key.key);
    setNewKeyName(key.name || '');
    setNewKeyPriority(key.priority);
    setValidationError('');
    setDialogOpen(true);
  };

  // 保存 Key
  const handleSaveKey = () => {
    // 验证 Key 格式
    if (!keyManager.validateApiKey(newKeyValue, providerType)) {
      setValidationError(`无效的 ${providerName} API Key 格式`);
      return;
    }

    // 检查重复
    const isDuplicate = apiKeys.some(key => 
      key.key === newKeyValue && key.id !== editingKey?.id
    );
    if (isDuplicate) {
      setValidationError('该 API Key 已存在');
      return;
    }

    let updatedKeys: ApiKeyConfig[];

    if (editingKey) {
      // 编辑现有 Key
      updatedKeys = apiKeys.map(key =>
        key.id === editingKey.id
          ? {
              ...key,
              key: newKeyValue,
              name: newKeyName || `API Key ${Date.now()}`,
              priority: newKeyPriority,
              updatedAt: Date.now(),
            }
          : key
      );
    } else {
      // 添加新 Key
      const newKey = keyManager.createApiKeyConfig(
        newKeyValue,
        newKeyName || `API Key ${Date.now()}`,
        newKeyPriority
      );
      updatedKeys = [...apiKeys, newKey];
    }

    onKeysChange(updatedKeys);
    setDialogOpen(false);
  };

  // 删除 Key
  const handleDeleteKey = (keyId: string) => {
    const updatedKeys = apiKeys.filter(key => key.id !== keyId);
    onKeysChange(updatedKeys);

    // 重置轮询状态，因为 Key 配置发生了变化
    keyManager.resetRoundRobinState();
  };

  // 切换 Key 启用状态
  const handleToggleKey = (keyId: string, enabled: boolean) => {
    const updatedKeys = apiKeys.map(key =>
      key.id === keyId
        ? { ...key, isEnabled: enabled, updatedAt: Date.now() }
        : key
    );
    onKeysChange(updatedKeys);
  };

  // 切换 Key 显示/隐藏
  const toggleKeyVisibility = (keyId: string) => {
    setShowKeys(prev => ({
      ...prev,
      [keyId]: !prev[keyId]
    }));
  };

  // 格式化 Key 显示
  const formatKeyDisplay = (key: string, show: boolean) => {
    if (show) return key;
    if (key.length <= 8) return '••••••••';
    return `${key.substring(0, 4)}••••${key.substring(key.length - 4)}`;
  };

  // 获取统计信息
  const stats = keyManager.getKeyStats(apiKeys);

  return (
    <Box>
      {/* 统计卡片 */}
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 2, mb: 3 }}>
        <Card>
          <CardContent sx={{ textAlign: 'center', py: 2 }}>
            <Typography variant="h6" color="primary">
              {stats.total}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              总数
            </Typography>
          </CardContent>
        </Card>
        <Card>
          <CardContent sx={{ textAlign: 'center', py: 2 }}>
            <Typography variant="h6" color="success.main">
              {stats.active}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              正常
            </Typography>
          </CardContent>
        </Card>
        <Card>
          <CardContent sx={{ textAlign: 'center', py: 2 }}>
            <Typography variant="h6" color="error.main">
              {stats.error}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              错误
            </Typography>
          </CardContent>
        </Card>
        <Card>
          <CardContent sx={{ textAlign: 'center', py: 2 }}>
            <Typography variant="h6" color="text.primary">
              {stats.successRate}%
            </Typography>
            <Typography variant="body2" color="text.secondary">
              成功率
            </Typography>
          </CardContent>
        </Card>
      </Box>

      {/* 负载均衡策略选择 */}
      <Box sx={{ mb: 3 }}>
        <FormControl fullWidth>
          <InputLabel>负载均衡策略</InputLabel>
          <Select
            value={strategy}
            label="负载均衡策略"
            onChange={(e) => onStrategyChange(e.target.value as LoadBalanceStrategy)}
          >
            <MenuItem value="round_robin">轮询 (Round Robin)</MenuItem>
            <MenuItem value="priority">优先级 (Priority)</MenuItem>
            <MenuItem value="least_used">最少使用 (Least Used)</MenuItem>
            <MenuItem value="random">随机 (Random)</MenuItem>
          </Select>
        </FormControl>
      </Box>

      {/* Key 列表 */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6">API Keys ({apiKeys.length})</Typography>
        <Button
          variant="contained"
          startIcon={<Plus size={16} />}
          onClick={handleAddKey}
          size="small"
        >
          添加 Key
        </Button>
      </Box>

      {apiKeys.length === 0 ? (
        <Alert severity="info">
          还没有配置 API Key。点击"添加 Key"开始配置。
        </Alert>
      ) : (
        <List>
          {apiKeys.map((key, index) => {
            const statusInfo = getStatusInfo(key.status);
            const isVisible = showKeys[key.id] || false;

            return (
              <ListItem key={key.id} divider>
                <ListItemText
                  primary={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="subtitle2">
                        {key.name || `Key ${index + 1}`}
                      </Typography>
                      <Chip
                        icon={statusInfo.icon}
                        label={statusInfo.text}
                        size="small"
                        color={statusInfo.color}
                      />
                      <Chip
                        label={`优先级: ${key.priority}`}
                        size="small"
                        variant="outlined"
                      />
                    </Box>
                  }
                  secondary={
                    <Box>
                      <Typography
                        variant="body2"
                        sx={{
                          fontFamily: 'monospace',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          maxWidth: '100%', // 确保在父容器内
                        }}
                      >
                        {formatKeyDisplay(key.key, isVisible)}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        请求: {key.usage.totalRequests} | 成功: {key.usage.successfulRequests} | 
                        失败: {key.usage.failedRequests}
                      </Typography>
                      {key.usage.totalRequests > 0 && (
                        <LinearProgress
                          variant="determinate"
                          value={(key.usage.successfulRequests / key.usage.totalRequests) * 100}
                          sx={{ mt: 1, height: 4, borderRadius: 2 }}
                        />
                      )}
                    </Box>
                  }
                />
                <ListItemSecondaryAction>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={key.isEnabled}
                          onChange={(e) => handleToggleKey(key.id, e.target.checked)}
                          size="small"
                        />
                      }
                      label=""
                    />
                    <Tooltip title={isVisible ? "隐藏 Key" : "显示 Key"}>
                      <IconButton
                        size="small"
                        onClick={() => toggleKeyVisibility(key.id)}
                      >
                        {isVisible ? <EyeOff size={16} /> : <Eye size={16} />}
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="编辑">
                      <IconButton
                        size="small"
                        onClick={() => handleEditKey(key)}
                      >
                        <Edit size={16} />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="删除">
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => handleDeleteKey(key.id)}
                      >
                        <Delete size={16} />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </ListItemSecondaryAction>
              </ListItem>
            );
          })}
        </List>
      )}

      {/* 添加/编辑 Key 对话框 */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingKey ? '编辑 API Key' : '添加 API Key'}
        </DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="API Key"
            type="password"
            fullWidth
            variant="outlined"
            value={newKeyValue}
            onChange={(e) => {
              setNewKeyValue(e.target.value);
              setValidationError('');
            }}
            error={!!validationError}
            helperText={validationError || `请输入有效的 ${providerName} API Key`}
            sx={{ mb: 2 }}
          />
          <TextField
            margin="dense"
            label="名称 (可选)"
            fullWidth
            variant="outlined"
            value={newKeyName}
            onChange={(e) => setNewKeyName(e.target.value)}
            placeholder="例如：主要账户、备用账户"
            sx={{ mb: 2 }}
          />
          <TextField
            margin="dense"
            label="优先级"
            type="number"
            fullWidth
            variant="outlined"
            value={newKeyPriority}
            onChange={(e) => setNewKeyPriority(Number(e.target.value))}
            inputProps={{ min: 1, max: 10 }}
            helperText="1-10，数字越小优先级越高"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>取消</Button>
          <Button onClick={handleSaveKey} variant="contained">
            {editingKey ? '保存' : '添加'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default MultiKeyManager;
