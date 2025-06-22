import React from 'react';
import {
  Box,
  Typography,
  Paper,
  Divider,
  IconButton,
  Chip,
  Stack,
  Tooltip,
} from '@mui/material';
import { X as CloseIcon, FileText as DescriptionIcon, Calendar as DateRangeIcon, Quote as FormatQuoteIcon } from 'lucide-react';
import type { KnowledgeDocument } from '../../shared/types/KnowledgeBase';

interface DocumentPreviewProps {
  document: KnowledgeDocument;
  onClose?: () => void;
}

export const DocumentPreview: React.FC<DocumentPreviewProps> = ({
  document,
  onClose,
}) => {
  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  return (
    <Paper
      elevation={2}
      sx={{
        p: 2,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
        <Typography variant="h6" component="h2">
          文档预览
        </Typography>
        {onClose && (
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        )}
      </Box>

      <Divider sx={{ mb: 2 }} />

      <Stack spacing={2} sx={{ mb: 2 }}>
        {document.metadata.fileName && (
          <Box display="flex" alignItems="center">
            <DescriptionIcon size={16} color="var(--mui-palette-primary-main)" style={{ marginRight: 8 }} />
            <Typography variant="body2">
              文件名: {document.metadata.fileName}
            </Typography>
          </Box>
        )}

        {document.metadata.source && (
          <Box display="flex" alignItems="center">
            <FormatQuoteIcon size={16} color="var(--mui-palette-primary-main)" style={{ marginRight: 8 }} />
            <Typography variant="body2">
              来源: {document.metadata.source}
            </Typography>
          </Box>
        )}

        {document.metadata.timestamp && (
          <Box display="flex" alignItems="center">
            <DateRangeIcon size={16} color="var(--mui-palette-primary-main)" style={{ marginRight: 8 }} />
            <Typography variant="body2">
              创建时间: {formatTimestamp(document.metadata.timestamp)}
            </Typography>
          </Box>
        )}

        {document.metadata.chunkIndex !== undefined && (
          <Chip
            label={`片段 #${document.metadata.chunkIndex + 1}`}
            size="small"
            color="primary"
            variant="outlined"
            sx={{ alignSelf: 'flex-start' }}
          />
        )}
      </Stack>

      <Typography variant="subtitle2" sx={{ mb: 1 }}>
        文档内容:
      </Typography>

      <Paper
        variant="outlined"
        sx={{
          p: 2,
          flexGrow: 1,
          overflow: 'auto',
          bgcolor: 'background.default',
          fontFamily: 'monospace',
          fontSize: '0.875rem',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}
      >
        {document.content}
      </Paper>

      <Tooltip title={`文档ID: ${document.id}`}>
        <Typography variant="caption" color="text.secondary" sx={{ mt: 2, fontSize: '0.7rem' }}>
          文档ID: {document.id.substring(0, 8)}...
        </Typography>
      </Tooltip>
    </Paper>
  );
};

export default DocumentPreview;