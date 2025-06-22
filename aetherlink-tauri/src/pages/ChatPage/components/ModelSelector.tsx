import React from 'react';
import { useSelector } from 'react-redux';
import type { RootState } from '../../../shared/store';
import DialogModelSelector from './DialogModelSelector';
import DropdownModelSelector from './DropdownModelSelector';

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

  // 默认使用弹窗式选择器
  return (
    <DialogModelSelector
      selectedModel={props.selectedModel}
      availableModels={props.availableModels}
      handleModelSelect={props.handleModelSelect}
      handleMenuClick={props.handleMenuClick}
      handleMenuClose={props.handleMenuClose}
      menuOpen={props.menuOpen}
    />
  );
};