import React, { useState } from 'react';
import { Box, Typography, Button } from '@mui/material';
import { Row } from '../../../components/settings/SettingComponents';
import { ModelSelector } from '../../ChatPage/components/ModelSelector';
import type { ModelWithProvider } from './useAllModels';

interface ModelPickerRowProps {
  label: string;
  selectedModel: ModelWithProvider | null;
  availableModels: ModelWithProvider[];
  onSelect: (model: ModelWithProvider) => void;
  buttonText?: string;
  notSelectedText?: string;
}

/** 统一的模型选择行：标签 + 当前模型 + 选择按钮 */
const ModelPickerRow: React.FC<ModelPickerRowProps> = ({
  label,
  selectedModel,
  availableModels,
  onSelect,
  buttonText = '选择模型',
  notSelectedText = '未选择',
}) => {
  const [open, setOpen] = useState(false);

  const handleSelect = (model: ModelWithProvider) => {
    onSelect(model);
    setOpen(false);
  };

  return (
    <Row>
      <Typography sx={{ minWidth: 80 }}>{label}</Typography>
      <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 1.5, flexWrap: 'wrap' }}>
        <Typography variant="body2" color="text.secondary" sx={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {selectedModel
            ? `${selectedModel.providerName} / ${selectedModel.name || selectedModel.id}`
            : notSelectedText}
        </Typography>
        <Button variant="outlined" size="small" onClick={() => setOpen(true)} sx={{ textTransform: 'none' }}>
          {buttonText}
        </Button>
        <ModelSelector
          selectedModel={selectedModel}
          availableModels={availableModels}
          handleModelSelect={handleSelect}
          handleMenuClick={() => setOpen(true)}
          handleMenuClose={() => setOpen(false)}
          menuOpen={open}
        />
      </Box>
    </Row>
  );
};

export default ModelPickerRow;
