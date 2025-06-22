import React from 'react';
import {
  Box,
  Dialog,
  DialogTitle,
  DialogContent,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Typography,
  Divider,
  alpha
} from '@mui/material';
import {
  Globe as LanguageIcon,
  Settings as SettingsIcon,
  Check as CheckIcon,
  X as CloseIcon,
  RefreshCw as RefreshIcon
} from 'lucide-react';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import type { RootState } from '../shared/store';
import { setWebSearchProvider, refreshProviders } from '../shared/store/slices/webSearchSlice';
import type { WebSearchProviderConfig } from '../shared/types';

interface WebSearchProviderSelectorProps {
  open: boolean;
  onClose: () => void;
  onProviderSelect?: (providerId: string) => void;
}

// 创建稳定的空数组引用
const EMPTY_PROVIDERS_ARRAY: any[] = [];

/**
 * 网络搜索提供商选择器
 * 类似最佳实例的快捷面板，适配移动端UI
 */
const WebSearchProviderSelector: React.FC<WebSearchProviderSelectorProps> = ({
  open,
  onClose,
  onProviderSelect
}) => {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const webSearchSettings = useSelector((state: RootState) => state.webSearch);

  // 安全地解构，使用稳定的空数组引用
  const providers = webSearchSettings?.providers || EMPTY_PROVIDERS_ARRAY;
  const currentProvider = webSearchSettings?.provider || 'bing-free';
  const enabled = webSearchSettings?.enabled || false;

  // 如果providers为空，显示加载状态
  if (!providers || providers.length === 0) {
    return (
      <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
        <DialogTitle>加载中...</DialogTitle>
        <DialogContent>
          <Typography>正在加载搜索提供商...</Typography>
        </DialogContent>
      </Dialog>
    );
  }

  const handleProviderSelect = (providerId: string) => {
    dispatch(setWebSearchProvider(providerId as any));
    onProviderSelect?.(providerId);
    onClose();
  };

  const handleDisableWebSearch = () => {
    dispatch(setWebSearchProvider('custom' as any)); // 设置为无效提供商来禁用
    onProviderSelect?.('');
    onClose();
  };

  const handleOpenSettings = () => {
    onClose();
    navigate('/settings/web-search');
  };

  const handleRefreshProviders = () => {
    dispatch(refreshProviders());
  };

  const getProviderIcon = (providerId: string) => {
    switch (providerId) {
      case 'bing-free':
        return '🆓'; // 免费Bing搜索图标
      case 'tavily':
        return '🔍';
      case 'bing':
        return '🔎'; // 🚀 免费网络搜索引擎图标
      case 'searxng':
        return '🌐';
      case 'exa':
        return '🎯';
      case 'bocha':
        return '🤖';
      case 'firecrawl':
        return '';
      default:
        return '🔍';
    }
  };

  const getProviderStatus = (provider: WebSearchProviderConfig) => {
    // 🚀 免费搜索引擎（WebSearch）无需配置，直接可用
    if (provider.id === 'bing-free' || provider.id === 'bing') {
      return { available: true, label: '免费可用' };
    }

    // 检查API密钥
    if (provider.apiKey && provider.apiKey.trim()) {
      return { available: true, label: 'API密钥' };
    }

    // 检查自托管服务（如Searxng）
    if (provider.apiHost && provider.apiHost.trim()) {
      return { available: true, label: '自托管' };
    }

    // 检查基础认证（用于Searxng）
    if ('basicAuthUsername' in provider && 'basicAuthPassword' in provider) {
      if (provider.basicAuthUsername && provider.basicAuthPassword) {
        return { available: true, label: '基础认证' };
      }
    }

    return { available: false, label: '需要配置' };
  };

  // 🚀 显示所有提供商，不再区分可用和不可用
  const allProviders = providers;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 3,
          maxHeight: '80vh'
        }
      }}
    >
      <DialogTitle
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          pb: 1
        }}
      >
        <LanguageIcon color="#1976d2" />
        <Typography variant="h6" component="span">
          选择搜索提供商
        </Typography>
        <Box sx={{ flexGrow: 1 }} />
        <IconButton onClick={handleRefreshProviders} size="small" title="刷新提供商列表">
          <RefreshIcon />
        </IconButton>
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ px: 0, pb: 2 }}>
        {/* 禁用网络搜索选项 */}
        <List dense>
          <ListItem disablePadding>
            <ListItemButton
              onClick={handleDisableWebSearch}
              selected={!enabled || !currentProvider}
              sx={{
                mx: 2,
                borderRadius: 2,
                mb: 1
              }}
            >
              <ListItemIcon>
                <Box
                  sx={{
                    width: 32,
                    height: 32,
                    borderRadius: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    bgcolor: alpha('#666', 0.1),
                    fontSize: '16px'
                  }}
                >
                  🚫
                </Box>
              </ListItemIcon>
              <ListItemText
                primary="不使用网络搜索"
                secondary="禁用网络搜索功能"
              />
              {(!enabled || !currentProvider) && (
                <ListItemSecondaryAction>
                  <CheckIcon color="#1976d2" />
                </ListItemSecondaryAction>
              )}
            </ListItemButton>
          </ListItem>
        </List>

        <Divider sx={{ my: 1 }} />

        {/* 🚀 所有搜索提供商 */}
        {allProviders.length > 0 && (
          <>
            <Typography
              variant="subtitle2"
              color="text.secondary"
              sx={{ px: 2, py: 1 }}
            >
              搜索提供商
            </Typography>
            <List dense>
              {allProviders.map((provider) => {
                const status = getProviderStatus(provider);
                const isSelected = enabled && currentProvider === provider.id;

                return (
                  <ListItem key={provider.id} disablePadding>
                    <ListItemButton
                      onClick={() => handleProviderSelect(provider.id)}
                      selected={isSelected}
                      sx={{
                        mx: 2,
                        borderRadius: 2,
                        mb: 0.5
                      }}
                    >
                      <ListItemIcon>
                        <Box
                          sx={{
                            width: 32,
                            height: 32,
                            borderRadius: 1,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            bgcolor: status.available ? alpha('#3b82f6', 0.1) : alpha('#666', 0.1),
                            fontSize: '16px',
                            opacity: status.available ? 1 : 0.6
                          }}
                        >
                          {getProviderIcon(provider.id)}
                        </Box>
                      </ListItemIcon>
                      <ListItemText
                        primary={provider.name}
                        secondary={status.available ? `✓ ${status.label}` : `⚠️ ${status.label}`}
                      />
                      {isSelected && (
                        <ListItemSecondaryAction>
                          <CheckIcon color="#1976d2" />
                        </ListItemSecondaryAction>
                      )}
                    </ListItemButton>
                  </ListItem>
                );
              })}
            </List>
          </>
        )}

        <Divider sx={{ my: 1 }} />

        {/* 设置按钮 */}
        <List dense>
          <ListItem disablePadding>
            <ListItemButton
              onClick={handleOpenSettings}
              sx={{
                mx: 2,
                borderRadius: 2
              }}
            >
              <ListItemIcon>
                <SettingsIcon color="#757575" />
              </ListItemIcon>
              <ListItemText
                primary="搜索设置"
                secondary="配置搜索提供商和选项"
              />
            </ListItemButton>
          </ListItem>
        </List>
      </DialogContent>
    </Dialog>
  );
};

export default WebSearchProviderSelector;
