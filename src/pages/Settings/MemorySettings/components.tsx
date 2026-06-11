/**
 * 记忆设置页的通用 UI 组件：区块卡片、行式设置项、记忆列表项
 */
import React from 'react';
import { Box, Chip, IconButton, Paper, Typography } from '@mui/material';
import type { SxProps, Theme } from '@mui/material/styles';
import { Edit3, Trash2 } from 'lucide-react';
import type { MemoryItem } from '../../../shared/types/memory';

interface SectionCardProps {
  icon?: React.ReactNode;
  title?: string;
  description?: string;
  action?: React.ReactNode;
  children?: React.ReactNode;
  sx?: SxProps<Theme>;
}

/** 设置区块卡片：1px 边框、无阴影、统一圆角与留白 */
export const SectionCard: React.FC<SectionCardProps> = ({ icon, title, description, action, children, sx }) => (
  <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, ...sx }}>
    {(title || action) && (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
        <Box sx={{ minWidth: 0 }}>
          {title && (
            <Typography
              variant="subtitle2"
              sx={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}
            >
              {icon}
              {title}
            </Typography>
          )}
          {description && (
            <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 0.25 }}>
              {description}
            </Typography>
          )}
        </Box>
        {action && <Box sx={{ flexShrink: 0 }}>{action}</Box>}
      </Box>
    )}
    {children && <Box sx={{ mt: title ? 1.5 : 0 }}>{children}</Box>}
  </Paper>
);

interface SettingRowProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  control: React.ReactNode;
  divider?: boolean;
}

/** 行式设置项：图标 + 标题 + 描述 + 右侧控件 */
export const SettingRow: React.FC<SettingRowProps> = ({ icon, title, description, control, divider }) => (
  <Box
    sx={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 2,
      py: 1.25,
      ...(divider && { borderBottom: theme => `1px solid ${theme.palette.divider}` }),
    }}
  >
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0 }}>
      {icon && <Box sx={{ display: 'flex', color: 'text.secondary', flexShrink: 0 }}>{icon}</Box>}
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="body2" sx={{ fontWeight: 500 }}>
          {title}
        </Typography>
        {description && (
          <Typography variant="caption" color="text.secondary" component="p">
            {description}
          </Typography>
        )}
      </Box>
    </Box>
    <Box sx={{ flexShrink: 0 }}>{control}</Box>
  </Box>
);

interface MemoryListItemProps {
  memory: MemoryItem;
  onEdit: (memory: MemoryItem) => void;
  onDelete: (id: string) => void;
}

export const MemoryListItem: React.FC<MemoryListItemProps> = ({ memory, onEdit, onDelete }) => (
  <Box
    sx={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      gap: 1,
      px: 2,
      py: 1.5,
      '&:not(:last-of-type)': { borderBottom: theme => `1px solid ${theme.palette.divider}` },
      '&:hover': { backgroundColor: 'action.hover' },
    }}
  >
    <Box sx={{ flex: 1, minWidth: 0 }}>
      <Typography variant="body2">{memory.memory}</Typography>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 0.75, flexWrap: 'wrap' }}>
        {memory.metadata?.source && (
          <Chip
            label={memory.metadata.source === 'auto' ? '自动' : '手动'}
            size="small"
            variant="outlined"
            sx={{ height: 20, fontSize: '0.7rem' }}
          />
        )}
        {memory.score && (
          <Chip
            label={`相似度 ${(memory.score * 100).toFixed(0)}%`}
            size="small"
            color="primary"
            variant="outlined"
            sx={{ height: 20, fontSize: '0.7rem' }}
          />
        )}
        <Typography variant="caption" color="text.secondary">
          {new Date(memory.createdAt).toLocaleDateString()}
        </Typography>
      </Box>
    </Box>
    <Box sx={{ display: 'flex', gap: 0.5, flexShrink: 0 }}>
      <IconButton size="small" onClick={() => onEdit(memory)}>
        <Edit3 size={16} />
      </IconButton>
      <IconButton size="small" color="error" onClick={() => onDelete(memory.id)}>
        <Trash2 size={16} />
      </IconButton>
    </Box>
  </Box>
);
