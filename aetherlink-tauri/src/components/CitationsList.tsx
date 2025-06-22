import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Avatar,
  alpha
} from '@mui/material';
import {
  ExternalLink as LaunchIcon,
  Copy as CopyIcon,
  X as CloseIcon,
  Globe as LanguageIcon,
  FileText as ArticleIcon
} from 'lucide-react';
import type { Citation } from '../shared/types';

interface CitationsListProps {
  citations: Citation[];
}

/**
 * 引用列表组件
 * 显示搜索结果的引用信息，适配移动端UI
 */
const CitationsList: React.FC<CitationsListProps> = ({ citations }) => {
  const [open, setOpen] = useState(false);
  const [selectedCitation, setSelectedCitation] = useState<Citation | null>(null);

  if (!citations || citations.length === 0) {
    return null;
  }

  const handleOpenDialog = () => {
    setOpen(true);
  };

  const handleCloseDialog = () => {
    setOpen(false);
    setSelectedCitation(null);
  };

  const handleCitationClick = (citation: Citation) => {
    setSelectedCitation(citation);
  };

  const handleCopyContent = (content: string) => {
    navigator.clipboard.writeText(content);
    // 可以添加toast提示
  };

  const handleOpenUrl = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const getHostname = (url: string) => {
    try {
      return new URL(url).hostname;
    } catch {
      return url;
    }
  };

  const truncateText = (text: string, maxLength = 100) => {
    if (!text) return '';
    return text.length > maxLength ? text.slice(0, maxLength) + '...' : text;
  };

  const previewCitations = citations.slice(0, 3);

  return (
    <>
      {/* 引用预览按钮 */}
      <Card
        variant="outlined"
        sx={{
          mt: 2,
          mb: 1,
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          '&:hover': {
            boxShadow: 2,
            borderColor: 'primary.main'
          }
        }}
        onClick={handleOpenDialog}
      >
        <CardContent sx={{ py: 1.5, px: 2, '&:last-child': { pb: 1.5 } }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {/* 预览图标 */}
            <Box sx={{ display: 'flex', alignItems: 'center', mr: 1 }}>
              {previewCitations.map((citation, index) => (
                <Avatar
                  key={index}
                  sx={{
                    width: 20,
                    height: 20,
                    fontSize: '10px',
                    bgcolor: alpha('#3b82f6', 0.1),
                    color: 'primary.main',
                    ml: index > 0 ? -0.5 : 0,
                    zIndex: previewCitations.length - index,
                    border: '1px solid',
                    borderColor: 'background.paper'
                  }}
                >
                  {citation.type === 'websearch' ? (
                    <LanguageIcon size={12} />
                  ) : (
                    <ArticleIcon size={12} />
                  )}
                </Avatar>
              ))}
            </Box>

            {/* 引用信息 */}
            <Box sx={{ flexGrow: 1 }}>
              <Typography variant="body2" color="primary">
                {citations.length} 个引用
              </Typography>
              <Typography variant="caption" color="text.secondary">
                点击查看详细信息
              </Typography>
            </Box>

            {/* 展开图标 */}
            <LaunchIcon size={16} style={{ color: '#666' }} />
          </Box>
        </CardContent>
      </Card>

      {/* 引用详情对话框 */}
      <Dialog
        open={open}
        onClose={handleCloseDialog}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 3,
            maxHeight: '80vh'
          }
        }}
      >
        <DialogTitle
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            pb: 1
          }}
        >
          <LanguageIcon color="primary" />
          <Typography variant="h6" component="span">
            搜索引用 ({citations.length})
          </Typography>
          <Box sx={{ flexGrow: 1 }} />
          <IconButton onClick={handleCloseDialog} size="small">
            <CloseIcon />
          </IconButton>
        </DialogTitle>

        <DialogContent sx={{ px: 0 }}>
          {selectedCitation ? (
            // 显示选中的引用详情
            <Box sx={{ px: 3 }}>
              <Button
                startIcon={<CloseIcon />}
                onClick={() => setSelectedCitation(null)}
                sx={{ mb: 2 }}
              >
                返回列表
              </Button>

              <Card variant="outlined">
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2, mb: 2 }}>
                    <Avatar
                      sx={{
                        bgcolor: alpha('#3b82f6', 0.1),
                        color: 'primary.main'
                      }}
                    >
                      {selectedCitation.type === 'websearch' ? (
                        <LanguageIcon />
                      ) : (
                        <ArticleIcon />
                      )}
                    </Avatar>
                    <Box sx={{ flexGrow: 1 }}>
                      <Typography variant="h6" gutterBottom>
                        {selectedCitation.title || getHostname(selectedCitation.url)}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" gutterBottom>
                        {getHostname(selectedCitation.url)}
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                        <Button
                          size="small"
                          startIcon={<LaunchIcon />}
                          onClick={() => handleOpenUrl(selectedCitation.url)}
                        >
                          打开链接
                        </Button>
                        {selectedCitation.content && (
                          <Button
                            size="small"
                            startIcon={<CopyIcon />}
                            onClick={() => handleCopyContent(selectedCitation.content!)}
                          >
                            复制内容
                          </Button>
                        )}
                      </Box>
                    </Box>
                  </Box>

                  {selectedCitation.content && (
                    <Box
                      sx={{
                        bgcolor: alpha('#f5f5f5', 0.5),
                        borderRadius: 1,
                        p: 2,
                        maxHeight: 300,
                        overflow: 'auto'
                      }}
                    >
                      <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                        {selectedCitation.content}
                      </Typography>
                    </Box>
                  )}
                </CardContent>
              </Card>
            </Box>
          ) : (
            // 显示引用列表
            <List>
              {citations.map((citation, index) => (
                <ListItem
                  key={index}
                  component="div"
                  onClick={() => handleCitationClick(citation)}
                  sx={{
                    borderRadius: 2,
                    mx: 2,
                    mb: 1,
                    cursor: 'pointer',
                    '&:hover': {
                      bgcolor: 'action.hover'
                    }
                  }}
                >
                  <Avatar
                    sx={{
                      mr: 2,
                      bgcolor: alpha('#3b82f6', 0.1),
                      color: 'primary.main',
                      width: 32,
                      height: 32
                    }}
                  >
                    {citation.type === 'websearch' ? (
                      <LanguageIcon size={16} />
                    ) : (
                      <ArticleIcon size={16} />
                    )}
                  </Avatar>

                  <ListItemText
                    primary={
                      <Typography variant="body2" fontWeight={500}>
                        {citation.title || getHostname(citation.url)}
                      </Typography>
                    }
                    secondary={
                      <Box component="span" sx={{ display: 'block' }}>
                        <Typography variant="caption" color="text.secondary" component="span" sx={{ display: 'block' }}>
                          {getHostname(citation.url)}
                        </Typography>
                        {citation.content && (
                          <Typography variant="caption" color="text.secondary" component="span" sx={{ display: 'block', mt: 0.5 }}>
                            {truncateText(citation.content, 80)}
                          </Typography>
                        )}
                      </Box>
                    }
                  />

                  <ListItemSecondaryAction>
                    <IconButton
                      edge="end"
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenUrl(citation.url);
                      }}
                    >
                      <LaunchIcon size={16} />
                    </IconButton>
                  </ListItemSecondaryAction>
                </ListItem>
              ))}
            </List>
          )}
        </DialogContent>

        {!selectedCitation && (
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={handleCloseDialog}>
              关闭
            </Button>
          </DialogActions>
        )}
      </Dialog>
    </>
  );
};

export default CitationsList;
