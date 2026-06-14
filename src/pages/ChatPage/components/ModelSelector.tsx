import React from 'react';
import { useSelector } from 'react-redux';
import { useTheme, useMediaQuery } from '@mui/material';
import type { RootState } from '../../../shared/store';
import { selectProviders } from '../../../shared/store/selectors/settingsSelectors';
import { SolidBridge } from '../../../shared/bridges/SolidBridge';
import { DialogModelSelector as SolidDialogModelSelector } from '../../../solid/components/ModelSelector/DialogModelSelector.solid';
import DropdownModelSelector from './DropdownModelSelector';
import { createLogger } from '../../../shared/services/infra/logger';

const logger = createLogger('ModelSelector');

// 定义组件props类型
interface ModelSelectorProps {
  selectedModel: any;
  availableModels: any[];
  handleModelSelect: (model: any) => void;
  handleMenuClick: () => void;
  handleMenuClose: () => void;
  menuOpen: boolean;
}

// 导出ModelSelector组件 - 根据设置选择不同的选择器样式
export const ModelSelector: React.FC<ModelSelectorProps> = (props) => {
  const modelSelectorStyle = useSelector((state: RootState) => state.settings.modelSelectorStyle);
  const providers = useSelector(selectProviders);
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));
  const themeMode = theme.palette.mode;

  // 根据模型选择器样式设置选择组件
  if (modelSelectorStyle === 'dropdown') {
    return (
      <DropdownModelSelector
        selectedModel={props.selectedModel}
        availableModels={props.availableModels}
        handleModelSelect={props.handleModelSelect}
      />
    );
  }

  // 使用增强版 SolidJS 弹窗式选择器（支持响应式 Props 和状态保持）
  return (
    <SolidBridge
      component={SolidDialogModelSelector as any}  // TypeScript 类型系统限制：SolidJS JSX vs React JSX
      props={{
        selectedModel: props.selectedModel,
        availableModels: props.availableModels,
        handleModelSelect: props.handleModelSelect,
        handleMenuClose: props.handleMenuClose,
        menuOpen: props.menuOpen,
        providers: providers,
        themeMode: themeMode as 'light' | 'dark',
        fullScreen: fullScreen,
      }}
      debugName="DialogModelSelector"
      debug={process.env.NODE_ENV === 'development'}
      onError={(error) => {
        logger.error('SolidJS 组件错误:', error);
      }}
    />
  );
};