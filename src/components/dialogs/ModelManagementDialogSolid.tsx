/**
 * ModelManagementDialog - SolidJS 版本的 React 包装器
 * 使用 SolidBridge 桥接 SolidJS 组件
 */
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useTheme, alpha } from '@mui/material';
import { SolidBridge } from '../../shared/bridges/SolidBridge';
import { ModelManagementDrawer } from '../../solid/components/ModelSelector/ModelManagementDrawer.solid';
import { fetchModels } from '../../shared/services/network/APIService';
import { useDialogBackHandler } from '../../hooks/useDialogBackHandler';
import type { Model } from '../../shared/types';

interface ModelManagementDialogSolidProps {
  open: boolean;
  onClose: () => void;
  provider: any;
  onAddModel: (model: Model) => void;
  onAddModels?: (models: Model[]) => void;
  onRemoveModel: (modelId: string) => void;
  onRemoveModels?: (modelIds: string[]) => void;
  existingModels: Model[];
}

/**
 * ModelManagementDialog - SolidJS 增强版
 * 
 * 特点：
 * - ✅ 使用 SolidJS 细粒度响应式系统
 * - ✅ 性能优于 React 版本
 * - ✅ 原生 HTML + CSS，无 Material-UI 依赖
 * - ✅ 完全向后兼容的 API
 */
const ModelManagementDialogSolid: React.FC<ModelManagementDialogSolidProps> = ({
  open,
  onClose,
  provider,
  onAddModel,
  onAddModels,
  onRemoveModel,
  onRemoveModels,
  existingModels
}) => {
  const theme = useTheme();
  const [loading, setLoading] = useState<boolean>(false);
  const [models, setModels] = useState<Model[]>([]);
  // 单调递增的请求序号，用来丢弃乱序回来的旧请求结果，避免快速重开/切换 provider
  // 时旧响应覆盖新响应
  const latestRequestRef = useRef(0);

  // 注册返回键处理，使手机系统返回键关闭此抽屉而非导航回上一页
  useDialogBackHandler('model-management-drawer', open, onClose);

  // 加载模型列表
  const loadModels = async () => {
    if (!provider) return;
    const requestId = ++latestRequestRef.current;
    setLoading(true);
    try {
      const fetchedModels = await fetchModels(provider);
      if (requestId !== latestRequestRef.current) return;
      setModels(fetchedModels);
    } catch (error) {
      if (requestId !== latestRequestRef.current) return;
      console.error('加载模型失败:', error);
      setModels([]);
    } finally {
      if (requestId === latestRequestRef.current) {
        setLoading(false);
      }
    }
  };

  // 每次对话框打开时都重新加载模型，保证用户能拿到最新结果
  // 之前用 ref 缓存了首次打开时的 provider，导致同一 provider 重复打开时不会刷新
  useEffect(() => {
    if (open && provider) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      loadModels();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, provider?.id, provider?.apiKey, provider?.baseUrl]);

  // 主题模式
  const themeMode = useMemo(() => theme.palette.mode as 'light' | 'dark', [theme.palette.mode]);

  // 动态注入 MUI 主题颜色到 CSS 变量
  useEffect(() => {
    if (open) {
      const root = document.documentElement;
      root.style.setProperty('--theme-bg-paper', theme.palette.background.paper);
      root.style.setProperty('--theme-bg-default', theme.palette.background.default);
      root.style.setProperty('--theme-text-primary', theme.palette.text.primary);
      root.style.setProperty('--theme-text-secondary', theme.palette.text.secondary);
      root.style.setProperty('--theme-primary', theme.palette.primary.main);
      root.style.setProperty('--theme-success', theme.palette.success.main);
      root.style.setProperty('--theme-error', theme.palette.error.main);
      root.style.setProperty('--theme-border-default', alpha(theme.palette.text.primary, 0.12));
      root.style.setProperty('--theme-hover-bg', alpha(theme.palette.text.primary, 0.04));
      root.style.setProperty('--theme-active-bg', alpha(theme.palette.text.primary, 0.08));
      root.style.setProperty('--theme-success-bg', alpha(theme.palette.success.main, 0.12));
      root.style.setProperty('--theme-error-bg', alpha(theme.palette.error.main, 0.12));
      root.style.setProperty('--theme-success-hover', alpha(theme.palette.success.main, 0.2));
      root.style.setProperty('--theme-error-hover', alpha(theme.palette.error.main, 0.2));
    }
  }, [open, theme]);

  return (
    <SolidBridge
      component={ModelManagementDrawer as any}
      props={{
        open,
        onClose,
        provider,
        models,
        loading,
        existingModels,
        onAddModel,
        onAddModels,
        onRemoveModel,
        onRemoveModels,
        themeMode
      }}
      debugName="ModelManagementDrawer"
      debug={process.env.NODE_ENV === 'development'}
      onError={(error) => {
        console.error('[ModelManagementDialog] SolidJS 组件错误:', error);
      }}
    />
  );
};

export default ModelManagementDialogSolid;
