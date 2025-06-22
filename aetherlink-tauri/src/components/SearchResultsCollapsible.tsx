import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  IconButton,
  Collapse,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Avatar,
  alpha,
  Chip,
  useTheme
} from '@mui/material';
import { ChevronDown as ExpandMoreIcon, ExternalLink as LaunchIcon, Search as SearchIcon } from 'lucide-react';
import type { WebSearchResult } from '../shared/types';

interface SearchResultsCollapsibleProps {
  results: WebSearchResult[];
  query?: string;
}

/**
 * 可折叠的搜索结果组件
 * 默认折叠状态，点击展开显示搜索结果列表
 */
const SearchResultsCollapsible: React.FC<SearchResultsCollapsibleProps> = ({
  results,
  query
}) => {
  const [expanded, setExpanded] = useState(false);
  const theme = useTheme();

  if (!results || results.length === 0) {
    return null;
  }

  const handleToggle = () => {
    setExpanded(!expanded);
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

  const truncateTitle = (title: string, maxLength = 60) => {
    if (!title) return '';
    return title.length > maxLength ? title.slice(0, maxLength) + '...' : title;
  };

  return (
    <Card
      variant="outlined"
      sx={{
        mt: 2,
        mb: 1,
        overflow: 'hidden',
        borderRadius: 3,
        border: '1px solid',
        borderColor: 'divider',
        boxShadow: 'none',
        userSelect: 'none', // 禁止文本选择
        '&:hover': {
          borderColor: 'primary.main',
          boxShadow: 1
        }
      }}
    >
      {/* 折叠头部 */}
      <CardContent
        sx={{
          py: 1.5,
          px: 2,
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: 'white',
          cursor: 'pointer',
          '&:last-child': { pb: 1.5 },
          '&:hover': {
            background: 'linear-gradient(135deg, #5a6fd8 0%, #6a4190 100%)'
          }
        }}
        onClick={handleToggle}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <SearchIcon size={18} />
          <Box sx={{ display: 'flex', alignItems: 'center', flexGrow: 1, gap: 1 }}>
            <Typography variant="body2" fontWeight={500} component="span">
              找到 {results.length} 篇参考资料
            </Typography>
            {query && (
              <Chip
                label={query}
                size="small"
                sx={{
                  bgcolor: 'rgba(255, 255, 255, 0.2)',
                  color: 'white',
                  fontSize: '11px',
                  height: 20
                }}
              />
            )}
          </Box>
          <IconButton
            size="small"
            sx={{
              color: 'white',
              transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.2s ease'
            }}
          >
            <ExpandMoreIcon size={18} />
          </IconButton>
        </Box>
      </CardContent>

      {/* 折叠内容 */}
      <Collapse in={expanded}>
        <Box
          sx={{
            bgcolor: theme.palette.mode === 'dark'
              ? alpha(theme.palette.background.paper, 0.5)
              : alpha(theme.palette.background.paper, 0.8),
            borderTop: '1px solid',
            borderTopColor: 'divider'
          }}
        >
          <List sx={{ py: 1 }}>
            {results.map((result, index) => (
              <ListItem
                key={result.id || index}
                sx={{
                  px: 2,
                  py: 1,
                  '&:hover': {
                    bgcolor: 'rgba(0, 0, 0, 0.04)'
                  }
                }}
              >
                <Avatar
                  sx={{
                    mr: 2,
                    bgcolor: alpha('#3b82f6', 0.1),
                    color: 'primary.main',
                    width: 28,
                    height: 28,
                    fontSize: '12px',
                    fontWeight: 600
                  }}
                >
                  {index + 1}
                </Avatar>

                <ListItemText
                  primary={
                    <Typography
                      variant="body2"
                      fontWeight={500}
                      sx={{
                        color: 'text.primary',
                        lineHeight: 1.4,
                        mb: 0.5
                      }}
                    >
                      {truncateTitle(result.title)}
                    </Typography>
                  }
                  secondary={
                    <Box>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        display="block"
                        sx={{ mb: 0.5 }}
                      >
                        {getHostname(result.url)}
                      </Typography>
                      {result.snippet && (
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                            lineHeight: 1.3
                          }}
                        >
                          {result.snippet}
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
                      handleOpenUrl(result.url);
                    }}
                    sx={{
                      color: 'text.secondary',
                      '&:hover': {
                        color: 'primary.main',
                        bgcolor: alpha('#3b82f6', 0.1)
                      }
                    }}
                  >
                    <LaunchIcon size={16} />
                  </IconButton>
                </ListItemSecondaryAction>
              </ListItem>
            ))}
          </List>
        </Box>
      </Collapse>
    </Card>
  );
};

export default SearchResultsCollapsible;
