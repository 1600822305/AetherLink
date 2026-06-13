/**
 * Signals 优化的模型列表项
 * 使用 @preact/signals-react 实现细粒度响应式更新
 */

import { memo } from 'react';
import { Box, Typography, IconButton, CircularProgress } from '@mui/material';
import { Edit, Trash2, CheckCircle } from 'lucide-react';
import { alpha } from '@mui/material/styles';
import { useTranslation } from 'react-i18next';
import { useSignals } from '@preact/signals-react/runtime';
import type { Model } from '../../../../shared/types';
import { testingModelId, testModeEnabled } from './providerSignals';

interface ModelItemSignalsProps {
  model: Model;
  alwaysShowTestButton: boolean;
  onEdit: (model: Model) => void;
  onDelete: (modelId: string) => void;
  onTest: (model: Model) => void;
}

function ModelItemSignals({
  model,
  alwaysShowTestButton,
  onEdit,
  onDelete,
  onTest,
}: ModelItemSignalsProps) {
  useSignals();
  const { t } = useTranslation();

  return (
    <Box
      sx={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        py: { xs: 1.5, sm: 1 },
        pl: { xs: 5.5, sm: 5 },
        pr: { xs: (testModeEnabled.value || alwaysShowTestButton) ? 12.5 : 9, sm: (testModeEnabled.value || alwaysShowTestButton) ? 11 : 8 },
        bgcolor: 'background.paper',
        borderBottom: '1px solid',
        borderColor: 'divider',
        transition: 'background-color 0.2s ease',
        // 左侧引导竖线（缩进处），表明归属于上方分组
        '&::before': {
          content: '""',
          position: 'absolute',
          left: { xs: 24, sm: 20 },
          top: 0,
          bottom: 0,
          width: '2px',
          bgcolor: (theme) => alpha(theme.palette.text.primary, 0.22),
        },
        '&:hover': {
          bgcolor: 'action.hover',
        },
      }}
    >
      <Typography
        variant="subtitle2"
        sx={{
          fontWeight: 600,
          fontSize: { xs: '0.95rem', sm: '0.875rem' },
          flex: 1,
          mr: 1,
        }}
      >
        {model.name}
      </Typography>

      {model.isDefault && (
        <Box
          sx={{
            px: { xs: 1.25, sm: 1 },
            py: { xs: 0.5, sm: 0.25 },
            borderRadius: 1,
            fontSize: { xs: '0.75rem', sm: '0.7rem' },
            fontWeight: 600,
            bgcolor: (theme) => alpha(theme.palette.success.main, 0.12),
            color: 'success.main',
            mr: 1,
          }}
        >
          {t('modelSettings.provider.defaultBadge')}
        </Box>
      )}

      {/* 按钮组 - 绝对定位 */}
      <Box
        sx={{
          position: 'absolute',
          right: { xs: 2.5, sm: 2 },
          top: '50%',
          transform: 'translateY(-50%)',
          display: 'flex',
          alignItems: 'center',
          gap: { xs: 0.5, sm: 0.5 },
        }}
      >
          {(testModeEnabled.value || alwaysShowTestButton) && (
          <IconButton
            aria-label="test"
            onClick={() => onTest(model)}
            disabled={testingModelId.value !== null}
            sx={{
              width: { xs: 34, sm: 30 },
              height: { xs: 34, sm: 30 },
              minWidth: { xs: 34, sm: 30 },
              borderRadius: 1.25,
              p: 0,
              color: 'text.secondary',
              bgcolor: 'transparent',
              '&:hover': {
                color: 'success.main',
                bgcolor: (theme) => alpha(theme.palette.success.main, 0.1),
              },
              transition: 'color 0.2s ease, background-color 0.2s ease',
            }}
          >
            {testingModelId.value === model.id ? (
              <CircularProgress size={14} color="success" />
            ) : (
              <CheckCircle size={16} />
            )}
          </IconButton>
        )}

        <IconButton
          aria-label="edit"
          onClick={() => onEdit(model)}
          sx={{
            width: { xs: 34, sm: 30 },
            height: { xs: 34, sm: 30 },
            minWidth: { xs: 34, sm: 30 },
            borderRadius: 1.25,
            p: 0,
            color: 'text.secondary',
            bgcolor: 'transparent',
            '&:hover': {
              color: 'info.main',
              bgcolor: (theme) => alpha(theme.palette.info.main, 0.1),
            },
            transition: 'color 0.2s ease, background-color 0.2s ease',
          }}
        >
          <Edit size={16} />
        </IconButton>

        <IconButton
          aria-label="delete"
          onClick={() => onDelete(model.id)}
          sx={{
            width: { xs: 34, sm: 30 },
            height: { xs: 34, sm: 30 },
            minWidth: { xs: 34, sm: 30 },
            borderRadius: 1.25,
            p: 0,
            color: 'text.secondary',
            bgcolor: 'transparent',
            '&:hover': {
              color: 'error.main',
              bgcolor: (theme) => alpha(theme.palette.error.main, 0.1),
            },
            transition: 'color 0.2s ease, background-color 0.2s ease',
          }}
        >
          <Trash2 size={16} />
        </IconButton>
      </Box>
    </Box>
  );
}

export default memo(ModelItemSignals);
