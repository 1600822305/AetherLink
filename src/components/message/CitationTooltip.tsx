/**
 * 引用弹窗组件
 * 
 * 点击显示引用详情，支持移动端
 * - 桌面端：使用 Popover
 * - 移动端：使用底部 Drawer
 */

import React, { useMemo, useCallback, useState } from 'react';
import { 
  Box, 
  Typography, 
  useTheme, 
  alpha, 
  Popover,
  Drawer,
  useMediaQuery,
  IconButton,
  Button,
  Collapse
} from '@mui/material';
import { X, ExternalLink, Globe, BookOpen, ChevronDown, ChevronUp } from 'lucide-react';
import type { CitationSupData } from '../../shared/types/citation';
import { parseCitationData, extractHostname } from '../../shared/utils/citation';

// favicon URL 缓存
const faviconCache = new Map<string, string>();

/**
 * 获取 favicon URL（带缓存）
 */
function getFaviconUrl(hostname: string): string {
  if (!hostname) return '';
  
  if (faviconCache.has(hostname)) {
    return faviconCache.get(hostname)!;
  }
  
  // 使用多个源，优先使用 icon.horse
  const faviconUrl = `https://icon.horse/icon/${hostname}`;
  faviconCache.set(hostname, faviconUrl);
  return faviconUrl;
}

interface CitationTooltipProps {
  /** 引用数据（JSON 字符串或解析后的对象） */
  citation: string | CitationSupData;
  /** 子元素（引用链接） */
  children: React.ReactElement;
}

/**
 * 引用弹窗内容组件
 */
const CitationContent: React.FC<{
  citationData: CitationSupData;
  hostname: string;
  displayTitle: string;
  onOpenLink: () => void;
  onClose: () => void;
  isMobile: boolean;
  isKnowledgeUrl?: boolean;
}> = ({ citationData, hostname, displayTitle, onOpenLink, onClose, isMobile, isKnowledgeUrl }) => {
  const theme = useTheme();
  const [expanded, setExpanded] = useState(false);
  
  // 知识库引用内容超过 100 字符才显示展开按钮
  const canExpand = isKnowledgeUrl && citationData.content && citationData.content.length > 100;
  
  return (
    <Box sx={{ 
      p: 2,
      maxWidth: isMobile ? '100%' : (expanded ? 480 : 360),
      minWidth: isMobile ? '100%' : 280,
      transition: 'max-width 0.2s ease'
    }}>
      {/* 头部：标题 + 关闭按钮 */}
      <Box sx={{ 
        display: 'flex', 
        alignItems: 'flex-start', 
        justifyContent: 'space-between',
        gap: 1,
        mb: 1.5
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1, minWidth: 0 }}>
          {/* Favicon */}
          <Box
            sx={{
              width: 24,
              height: 24,
              borderRadius: '6px',
              bgcolor: alpha(theme.palette.primary.main, 0.1),
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              overflow: 'hidden'
            }}
          >
            {isKnowledgeUrl ? (
              <BookOpen size={14} />
            ) : hostname ? (
              <img
                src={getFaviconUrl(hostname)}
                alt=""
                style={{ width: 18, height: 18 }}
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                  // 显示备用图标
                  const parent = (e.target as HTMLImageElement).parentElement;
                  if (parent) {
                    parent.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><path d="M2 12h20"></path><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>';
                  }
                }}
              />
            ) : (
              <Globe size={14} />
            )}
          </Box>
          
          {/* 标题 */}
          <Typography
            variant="subtitle1"
            sx={{
              fontWeight: 600,
              color: 'text.primary',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              lineHeight: 1.3
            }}
          >
            {displayTitle}
          </Typography>
        </Box>
        
        {/* 关闭按钮 */}
        <IconButton 
          size="small" 
          onClick={onClose}
          sx={{ 
            ml: 0.5,
            color: 'text.secondary',
            '&:hover': { bgcolor: alpha(theme.palette.text.primary, 0.08) }
          }}
        >
          <X size={18} />
        </IconButton>
      </Box>
      
      {/* 内容摘要 / 全文 */}
      {citationData.content && (
        <Box sx={{ mb: 1.5 }}>
          {!expanded ? (
            <Typography
              variant="body2"
              sx={{
                color: 'text.secondary',
                display: '-webkit-box',
                WebkitLineClamp: isKnowledgeUrl ? 3 : 4,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
                lineHeight: 1.6,
              }}
            >
              {citationData.content}
            </Typography>
          ) : (
            <Collapse in={expanded}>
              <Box
                sx={{
                  maxHeight: isMobile ? '40vh' : 320,
                  overflowY: 'auto',
                  pr: 0.5,
                  '&::-webkit-scrollbar': { width: 4 },
                  '&::-webkit-scrollbar-thumb': {
                    backgroundColor: alpha(theme.palette.text.primary, 0.2),
                    borderRadius: 2
                  }
                }}
              >
                <Typography
                  variant="body2"
                  sx={{
                    color: 'text.secondary',
                    lineHeight: 1.7,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word'
                  }}
                >
                  {citationData.content}
                </Typography>
              </Box>
            </Collapse>
          )}
          
          {/* 展开/收起按钮 */}
          {canExpand && (
            <Box
              onClick={() => setExpanded(!expanded)}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 0.5,
                mt: 0.5,
                cursor: 'pointer',
                color: 'primary.main',
                fontSize: '0.8rem',
                '&:hover': { opacity: 0.8 }
              }}
            >
              {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              <Typography variant="caption" sx={{ color: 'inherit', fontWeight: 500 }}>
                {expanded ? '收起' : '查看全文'}
              </Typography>
            </Box>
          )}
        </Box>
      )}
      
      {/* 底部：URL + 打开按钮 */}
      <Box sx={{ 
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 1,
        pt: 1.5,
        borderTop: `1px solid ${theme.palette.divider}`
      }}>
        <Typography
          variant="caption"
          sx={{
            color: 'text.disabled',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            flex: 1
          }}
        >
          {isKnowledgeUrl ? citationData.title || '知识库' : hostname}
        </Typography>
        
        {!isKnowledgeUrl && (
          <Button
            size="small"
            variant="contained"
            startIcon={<ExternalLink size={14} />}
            onClick={onOpenLink}
            sx={{
              textTransform: 'none',
              borderRadius: 2,
              px: 2,
              py: 0.5,
              fontSize: '0.8rem'
            }}
          >
            打开链接
          </Button>
        )}
      </Box>
    </Box>
  );
};

/**
 * 引用弹窗组件
 * 
 * 点击显示引用详情：
 * - 桌面端：Popover
 * - 移动端：底部 Drawer
 */
export const CitationTooltip: React.FC<CitationTooltipProps> = ({ citation, children }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  
  // 弹窗状态
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  
  // 解析引用数据
  const citationData = useMemo((): CitationSupData | null => {
    if (!citation) return null;
    if (typeof citation === 'object') return citation;
    return parseCitationData(citation);
  }, [citation]);
  
  // 提取主机名
  const hostname = useMemo(() => {
    if (!citationData?.url) return '';
    return extractHostname(citationData.url);
  }, [citationData?.url]);
  
  // 获取标题（优先使用 title，否则使用 hostname）
  const displayTitle = useMemo(() => {
    return citationData?.title?.trim() || hostname || '未知来源';
  }, [citationData?.title, hostname]);
  
  // 检测是否为知识库引用
  const isKnowledgeUrl = citationData?.url?.startsWith('knowledge://') ?? false;
  
  // 点击打开弹窗
  const handleClick = useCallback((e: React.MouseEvent<HTMLElement>) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (isMobile) {
      setDrawerOpen(true);
    } else {
      setAnchorEl(e.currentTarget);
    }
  }, [isMobile]);
  
  // 关闭弹窗
  const handleClose = useCallback(() => {
    setAnchorEl(null);
    setDrawerOpen(false);
  }, []);
  
  // 打开链接
  const handleOpenLink = useCallback(() => {
    if (citationData?.url) {
      window.open(citationData.url, '_blank', 'noopener,noreferrer');
    }
    handleClose();
  }, [citationData?.url, handleClose]);
  
  // 如果没有引用数据，直接返回子元素
  if (!citationData) {
    return children;
  }
  
  // 克隆子元素，添加点击事件
  const childProps = children.props as Record<string, any>;
  const triggerElement = React.cloneElement(children, {
    onClick: handleClick,
    style: { 
      ...(childProps?.style || {}), 
      cursor: 'pointer',
      textDecoration: 'none'
    }
  } as React.HTMLAttributes<HTMLElement>);
  
  return (
    <>
      {triggerElement}
      
      {/* 桌面端：Popover */}
      {!isMobile && (
        <Popover
          open={Boolean(anchorEl)}
          anchorEl={anchorEl}
          onClose={handleClose}
          anchorOrigin={{
            vertical: 'top',
            horizontal: 'center',
          }}
          transformOrigin={{
            vertical: 'bottom',
            horizontal: 'center',
          }}
          slotProps={{
            paper: {
              sx: {
                borderRadius: 2,
                boxShadow: theme.shadows[8],
                border: `1px solid ${theme.palette.divider}`,
                mt: -1
              }
            }
          }}
        >
          <CitationContent
            citationData={citationData}
            hostname={hostname}
            displayTitle={displayTitle}
            onOpenLink={handleOpenLink}
            onClose={handleClose}
            isMobile={false}
            isKnowledgeUrl={isKnowledgeUrl}
          />
        </Popover>
      )}
      
      {/* 移动端：底部 Drawer */}
      {isMobile && (
        <Drawer
          anchor="bottom"
          open={drawerOpen}
          onClose={handleClose}
          PaperProps={{
            sx: {
              borderTopLeftRadius: 16,
              borderTopRightRadius: 16,
              maxHeight: '60vh',
              // 安全区域
              pb: 'env(safe-area-inset-bottom, 16px)'
            }
          }}
        >
          {/* 拖拽指示条 */}
          <Box sx={{ 
            display: 'flex', 
            justifyContent: 'center', 
            pt: 1.5, 
            pb: 0.5 
          }}>
            <Box sx={{ 
              width: 36, 
              height: 4, 
              borderRadius: 2, 
              bgcolor: alpha(theme.palette.text.primary, 0.2) 
            }} />
          </Box>
          
          <CitationContent
            citationData={citationData}
            hostname={hostname}
            displayTitle={displayTitle}
            onOpenLink={handleOpenLink}
            onClose={handleClose}
            isMobile={true}
            isKnowledgeUrl={isKnowledgeUrl}
          />
        </Drawer>
      )}
    </>
  );
};

export default CitationTooltip;
