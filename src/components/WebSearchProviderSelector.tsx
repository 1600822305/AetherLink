/**
 * WebSearchProviderSelector - React 桥接组件
 * 包装 SolidJS 版本的网络搜索提供商选择器，在 React 中使用
 */
import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useTheme, useMediaQuery } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { SolidBridge } from '../shared/bridges/SolidBridge';
import type { RootState } from '../shared/store';
import { setWebSearchProvider, refreshProviders, setActiveProviderId } from '../shared/store/slices/webSearchSlice';
import type { WebSearchProviderConfig } from '../shared/types';
import { isCustomProviderConfigured, getCustomProviderProtocol } from '../shared/services/webSearch/customProtocols';
import type { ProviderItem } from '../solid/components/WebSearchProviderSelector/WebSearchProviderSelector.solid';

interface WebSearchProviderSelectorProps {
  open: boolean;
  onClose: () => void;
  onProviderSelect?: (providerId: string) => void;
}

// 免费提供商，无需任何配置
const FREE_PROVIDERS = ['bing-free', 'bing', 'local-google', 'local-bing', 'exa-mcp'];

const getProviderIcon = (providerId: string): string => {
  switch (providerId) {
    case 'bing-free':
      return '🆓';
    case 'tavily':
      return '🔍';
    case 'bing':
      return '🔎';
    case 'searxng':
      return '🌐';
    case 'exa':
      return '🎯';
    case 'bocha':
      return '🤖';
    case 'firecrawl':
      return '🔥';
    case 'cloudflare-ai-search':
      return '☁️';
    case 'zhipu':
      return '🧠';
    case 'jina':
      return '🔎';
    case 'querit':
      return '🔍';
    case 'exa-mcp':
      return '🆓';
    default:
      return '🔍';
  }
};

const getProviderStatus = (
  provider: WebSearchProviderConfig,
  apiKeys: Record<string, string> | undefined
): { available: boolean; label: string } => {
  // 免费搜索引擎无需配置，直接可用
  if (FREE_PROVIDERS.includes(provider.id)) {
    return { available: true, label: '免费可用' };
  }

  const apiKey = provider.apiKey?.trim() || apiKeys?.[provider.id]?.trim();

  // Cloudflare AI Search 需要 API 密钥、Account ID 和 AutoRAG 名称
  if (provider.id === 'cloudflare-ai-search') {
    if (apiKey && provider.accountId?.trim() && provider.autoragName?.trim()) {
      return { available: true, label: 'API密钥' };
    }
    return { available: false, label: '需要配置' };
  }

  if (apiKey) {
    return { available: true, label: 'API密钥' };
  }

  // 基础认证（用于 Searxng 等自托管服务）
  if (provider.basicAuthUsername?.trim() && provider.basicAuthPassword?.trim()) {
    return { available: true, label: '基础认证' };
  }

  return { available: false, label: '需要配置' };
};

/**
 * 网络搜索提供商选择器（React 桥接版）
 * 内部使用 SolidJS 实现，通过桥接层在 React 中使用
 */
const WebSearchProviderSelector: React.FC<WebSearchProviderSelectorProps> = ({
  open,
  onClose,
  onProviderSelect
}) => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));
  const themeMode = theme.palette.mode;

  const webSearchSettings = useSelector((state: RootState) => state.webSearch);

  // 动态加载 SolidJS 组件
  const [SolidComponent, setSolidComponent] = useState<any>(null);

  useEffect(() => {
    import('../solid/components/WebSearchProviderSelector/WebSearchProviderSelector.solid').then((mod) => {
      setSolidComponent(() => mod.WebSearchProviderSelectorSolid);
    });
  }, []);

  const providerItems = useMemo<ProviderItem[]>(() => {
    const providers = webSearchSettings?.providers || [];
    const items = providers.map((provider) => {
      const status = getProviderStatus(provider, webSearchSettings?.apiKeys);
      return {
        id: provider.id,
        name: provider.name,
        icon: getProviderIcon(provider.id),
        available: status.available,
        statusLabel: status.label
      };
    });

    // 自定义提供商：可用性由对应协议适配器判断
    const customProviders = (webSearchSettings?.customProviders || []).filter((p) => p.enabled);
    const customItems = customProviders.map((provider) => {
      const configured = isCustomProviderConfigured(provider);
      const protocol = getCustomProviderProtocol(provider);
      return {
        id: provider.id,
        name: provider.name,
        icon: protocol === 'searxng' ? '🌐' : '🧩',
        available: configured,
        statusLabel: configured ? '自定义' : '需要配置'
      };
    });

    return [...items, ...customItems];
  }, [webSearchSettings?.providers, webSearchSettings?.customProviders, webSearchSettings?.apiKeys]);

  const handleSelectProvider = useCallback((providerId: string) => {
    // 未配置的提供商：跳转到设置页配置，而不是直接选中
    const item = providerItems.find((p) => p.id === providerId);
    if (item && !item.available) {
      onClose();
      navigate('/settings/web-search');
      return;
    }
    dispatch(setWebSearchProvider(providerId as any));
    // 设置 activeProviderId，标记用户已经选择了搜索引擎
    dispatch(setActiveProviderId(providerId));
    onProviderSelect?.(providerId);
    onClose();
  }, [providerItems, navigate, dispatch, onProviderSelect, onClose]);

  const handleDisable = useCallback(() => {
    // 清除 activeProviderId 即可禁用搜索，不修改持久化的 provider 设置
    dispatch(setActiveProviderId(undefined));
    onProviderSelect?.('');
    onClose();
  }, [dispatch, onProviderSelect, onClose]);

  const handleOpenSettings = useCallback(() => {
    onClose();
    navigate('/settings/web-search');
  }, [onClose, navigate]);

  const handleRefresh = useCallback(() => {
    dispatch(refreshProviders());
  }, [dispatch]);

  const solidProps = useMemo(() => ({
    open,
    onClose,
    providers: providerItems,
    activeProviderId: webSearchSettings?.activeProviderId,
    onSelectProvider: handleSelectProvider,
    onDisable: handleDisable,
    onOpenSettings: handleOpenSettings,
    onRefresh: handleRefresh,
    themeMode: themeMode as 'light' | 'dark',
    fullScreen
  }), [
    open,
    onClose,
    providerItems,
    webSearchSettings?.activeProviderId,
    handleSelectProvider,
    handleDisable,
    handleOpenSettings,
    handleRefresh,
    themeMode,
    fullScreen
  ]);

  if (!open || !SolidComponent) {
    return null;
  }

  return (
    <SolidBridge
      component={SolidComponent}
      props={solidProps}
      debugName="WebSearchProviderSelector"
    />
  );
};

export default WebSearchProviderSelector;
