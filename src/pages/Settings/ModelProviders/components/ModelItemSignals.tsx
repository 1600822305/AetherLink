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
        pl: { xs: 2.5, sm: 2 },
        pr: { xs: (testModeEnabled.value || alwaysShowTestButton) ? 15 : 11, sm: (testModeEnabled.value || alwaysShowTestButton) ? 13 : 9.5 },
        transition: 'all 0.2s ease',
        '&:hover': {
          bgcolor: (theme) => alpha(theme.palette.primary.main, 0.05),
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
          gap: { xs: 1, sm: 0.75 },
        }}
      >
          {(testModeEnabled.value || alwaysShowTestButton) && (
          <IconButton
            aria-label="test"
            onClick={() => onTest(model)}
            disabled={testingModelId.value !== null}
            sx={{
              width: { xs: 40, sm: 36 },
              height: { xs: 40, sm: 36 },
              minWidth: { xs: 40, sm: 36 },
              borderRadius: 1.5,
              p: 0,
              bgcolor: (theme) => alpha(theme.palette.success.main, 0.12),
              color: 'success.main',
              '&:hover': {
                bgcolor: (theme) => alpha(theme.palette.success.main, 0.2),
              },
              transition: 'all 0.2s ease',
            }}
          >
            {testingModelId.value === model.id ? (
              <CircularProgress size={16} color="success" />
            ) : (
              <CheckCircle size={18} />
            )}
          </IconButton>
        )}

        <IconButton
          aria-label="edit"
          onClick={() => onEdit(model)}
          sx={{
            width: { xs: 40, sm: 36 },
            height: { xs: 40, sm: 36 },
            minWidth: { xs: 40, sm: 36 },
            borderRadius: 1.5,
            p: 0,
            bgcolor: (theme) => alpha(theme.palette.info.main, 0.12),
            color: 'info.main',
            '&:hover': {
              bgcolor: (theme) => alpha(theme.palette.info.main, 0.2),
            },
            transition: 'all 0.2s ease',
          }}
        >
          <Edit size={18} />
        </IconButton>

        <IconButton
          aria-label="delete"
          onClick={() => onDelete(model.id)}
          sx={{
            width: { xs: 40, sm: 36 },
            height: { xs: 40, sm: 36 },
            minWidth: { xs: 40, sm: 36 },
            borderRadius: 1.5,
            p: 0,
            bgcolor: (theme) => alpha(theme.palette.error.main, 0.12),
            color: 'error.main',
            '&:hover': {
              bgcolor: (theme) => alpha(theme.palette.error.main, 0.2),
            },
            transition: 'all 0.2s ease',
          }}
        >
          <Trash2 size={18} />
        </IconButton>
      </Box>
    </Box>
  );
}

export default memo(ModelItemSignals);
