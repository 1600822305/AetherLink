import React from 'react';
import {
  Box,
  Typography,
  IconButton,
  Chip,
  Paper,
  useTheme
} from '@mui/material';
import CustomSwitch from '../../../../components/CustomSwitch';
import { Trash2, GripVertical } from 'lucide-react';
import type { AssistantRegex } from '../../../../shared/types/Assistant';

export interface RegexRuleCardProps {
  rule: AssistantRegex;
  onEdit: () => void;
  onDelete: () => void;
  onToggle: (enabled: boolean) => void;
  dragHandleProps?: React.HTMLAttributes<HTMLDivElement>;
}

/**
 * 正则规则卡片组件
 */
const RegexRuleCard: React.FC<RegexRuleCardProps> = ({
  rule,
  onEdit,
  onDelete,
  onToggle,
  dragHandleProps
}) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const getScopeLabel = (scope: string) => {
    switch (scope) {
      case 'user':
        return '用户消息';
      case 'assistant':
        return '助手消息';
      default:
        return scope;
    }
  };

  return (
    <Paper
      onClick={onEdit}
      sx={{
        p: 2,
        borderRadius: '12px',
        cursor: 'pointer',
        backgroundColor: isDark
          ? 'rgba(255, 255, 255, 0.05)'
          : 'rgba(255, 255, 255, 0.9)',
        border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)'}`,
        transition: 'all 0.2s ease',
        '&:hover': {
          backgroundColor: isDark
            ? 'rgba(255, 255, 255, 0.08)'
            : 'rgba(0, 0, 0, 0.02)',
          borderColor: theme.palette.primary.main,
          transform: 'translateY(-1px)',
          boxShadow: isDark
            ? '0 4px 12px rgba(0, 0, 0, 0.3)'
            : '0 4px 12px rgba(0, 0, 0, 0.1)'
        }
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
        {/* 拖拽手柄 */}
        {dragHandleProps && (
          <Box
            {...dragHandleProps}
            onClick={(e) => e.stopPropagation()}
            sx={{
              cursor: 'grab',
              color: theme.palette.text.secondary,
              opacity: 0.5,
              '&:hover': { opacity: 1 },
              '&:active': { cursor: 'grabbing' }
            }}
          >
            <GripVertical size={18} />
          </Box>
        )}

        {/* 内容区域 */}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          {/* 标题行 */}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
            <Typography
              variant="subtitle2"
              sx={{
                fontWeight: 600,
                color: theme.palette.text.primary,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}
            >
              {rule.name || '未命名规则'}
            </Typography>
            <Box onClick={(e) => e.stopPropagation()}>
              <CustomSwitch
                checked={rule.enabled}
                onChange={(e) => onToggle(e.target.checked)}
              />
            </Box>
          </Box>

          {/* 正则模式预览 */}
          <Typography
            variant="caption"
            sx={{
              display: 'block',
              color: theme.palette.text.secondary,
              fontFamily: 'monospace',
              backgroundColor: isDark ? 'rgba(0, 0, 0, 0.2)' : 'rgba(0, 0, 0, 0.05)',
              px: 1,
              py: 0.5,
              borderRadius: '4px',
              mb: 1.5,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}
          >
            {rule.pattern}
          </Typography>

          {/* 标签行 */}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
              {rule.scopes.map((scope) => (
                <Chip
                  key={scope}
                  label={getScopeLabel(scope)}
                  size="small"
                  sx={{
                    height: 22,
                    fontSize: '0.7rem',
                    backgroundColor: isDark
                      ? 'rgba(255, 255, 255, 0.08)'
                      : theme.palette.primary.main + '15',
                    color: theme.palette.primary.main,
                    border: `1px solid ${theme.palette.primary.main}40`
                  }}
                />
              ))}
              {rule.visualOnly && (
                <Chip
                  label="仅视觉"
                  size="small"
                  sx={{
                    height: 22,
                    fontSize: '0.7rem',
                    backgroundColor: isDark
                      ? 'rgba(255, 255, 255, 0.08)'
                      : theme.palette.warning.main + '15',
                    color: theme.palette.warning.main,
                    border: `1px solid ${theme.palette.warning.main}40`
                  }}
                />
              )}
            </Box>

            {/* 删除按钮 */}
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              sx={{
                color: theme.palette.error.main,
                opacity: 0.7,
                '&:hover': {
                  opacity: 1,
                  backgroundColor: theme.palette.error.main + '15'
                }
              }}
            >
              <Trash2 size={16} />
            </IconButton>
          </Box>
        </Box>
      </Box>
    </Paper>
  );
};

export default RegexRuleCard;
