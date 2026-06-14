import { memo, useState, useCallback, useMemo } from 'react';
import {
  Box,
  Typography,
  Button,
  IconButton,
  DialogTitle,
  DialogContent,
  Tooltip,
  useTheme,
  CircularProgress,
  ToggleButtonGroup,
  ToggleButton,
  useMediaQuery,
  BottomNavigation,
  BottomNavigationAction
} from '@mui/material';
import BackButtonDialog from '../common/BackButtonDialog';
import {
  Globe,
  Sparkles,
  Code,
  Eye,
  ExternalLink,
  Download,
  X,
  Maximize2,
  Minimize2,
  Columns2,
  ChevronLeft,
  ZoomIn,
  ZoomOut
} from 'lucide-react';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { Capacitor } from '@capacitor/core';
import { createLogger } from '../../shared/services/infra/logger';

const logger = createLogger('HtmlArtifactsCard');

interface HtmlArtifactsCardProps {
  html: string;
  onSave?: (html: string) => void;
  isStreaming?: boolean;
}

/**
 * 从 HTML 中提取 title 标签内容
 */
function extractHtmlTitle(html: string): string | null {
  const match = /<title[^>]*>([^<]*)<\/title>/i.exec(html);
  return match ? match[1].trim() : null;
}

/**
 * HTML Artifacts 卡片组件
 * 参考 Cherry Studio 的设计实现
 */
const HtmlArtifactsCard: React.FC<HtmlArtifactsCardProps> = memo(({
  html,
  onSave,
  isStreaming = false
}) => {
  const theme = useTheme();
  const isDarkMode = theme.palette.mode === 'dark';
  
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  
  const title = useMemo(() => extractHtmlTitle(html) || 'HTML Artifacts', [html]);
  const hasContent = html?.trim().length > 0;

  // 在外部浏览器/应用打开
  const handleOpenExternal = useCallback(async () => {
    try {
      if (Capacitor.isNativePlatform()) {
        // 移动端：保存文件后使用 Share 分享
        
        // 生成文件名
        const safeTitle = title.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '-') || 'html-preview';
        const fileName = `${safeTitle}.html`;
        
        // 写入临时文件
        const result = await Filesystem.writeFile({
          path: fileName,
          data: html,
          directory: Directory.Cache,
          encoding: 'utf8' as any,
        });
        
        // 使用 Share 分享文件，用户可以选择用 Safari/Chrome 等打开
        await Share.share({
          title: title,
          url: result.uri,
          dialogTitle: '选择打开方式',
        });
      } else {
        // Web 端：使用 blob URL 在新标签页打开
        const blob = new Blob([html], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
    } catch (error) {
      logger.error('打开外部浏览器失败:', error);
      // 降级方案：使用 window.open
      const blob = new Blob([html], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
  }, [html, title]);

  // 下载 HTML 文件
  const handleDownload = useCallback(async () => {
    const safeTitle = title.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '-') || 'html-artifact';
    const fileName = `${safeTitle}.html`;
    
    try {
      if (Capacitor.isNativePlatform()) {
        // 移动端：保存到 Documents 目录并提示用户
        const { Toast } = await import('@capacitor/toast');
        
        // 保存到 Documents 目录
        await Filesystem.writeFile({
          path: fileName,
          data: html,
          directory: Directory.Documents,
          encoding: 'utf8' as any,
        });
        
        // 提示用户
        await Toast.show({
          text: `已保存到 ${fileName}`,
          duration: 'long',
          position: 'bottom',
        });
      } else {
        // Web 端：使用传统下载方式
        const blob = new Blob([html], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      logger.error('下载失败:', error);
      // 降级方案
      const blob = new Blob([html], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  }, [html, title]);

  return (
    <>
      {/* 卡片容器 */}
      <Box
        sx={{
          backgroundColor: theme.palette.background.paper,
          border: `1px solid ${theme.palette.divider}`,
          borderRadius: '8px',
          overflow: 'hidden',
          my: 1.25,
          mt: 0,
        }}
      >
        {/* 头部 */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            px: 3,
            py: 2,
            pb: 2,
            backgroundColor: theme.palette.background.default,
            borderBottom: `1px solid ${theme.palette.divider}`,
            borderRadius: '8px 8px 0 0',
          }}
        >
          {/* 图标 */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 44,
              height: 44,
              borderRadius: '12px',
              background: isStreaming
                ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)'
                : 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
              boxShadow: isStreaming
                ? '0 4px 6px -1px rgba(245, 158, 11, 0.3)'
                : '0 4px 6px -1px rgba(59, 130, 246, 0.3)',
              flexShrink: 0,
              transition: 'background 0.3s ease',
            }}
          >
            {isStreaming ? (
              <Sparkles size={20} color="white" />
            ) : (
              <Globe size={20} color="white" />
            )}
          </Box>

          {/* 标题区域 */}
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography
              variant="subtitle1"
              sx={{
                fontWeight: 600,
                fontSize: '14px',
                color: isDarkMode ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.85)',
                lineHeight: 1.4,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {title}
            </Typography>
            
            {/* HTML 徽章 */}
            <Box
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 0.5,
                mt: 0.5,
                px: 0.75,
                py: 0.25,
                backgroundColor: isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
                border: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}`,
                borderRadius: '6px',
              }}
            >
              <Code size={10} />
              <Typography
                variant="caption"
                sx={{
                  fontSize: '10px',
                  fontWeight: 500,
                  color: isDarkMode ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.5)',
                }}
              >
                HTML
              </Typography>
            </Box>
          </Box>
        </Box>

        {/* 内容区域 */}
        <Box sx={{ p: 0 }}>
          {isStreaming && !hasContent ? (
            // 生成中状态
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                gap: 1,
                py: 3,
                minHeight: '78px',
              }}
            >
              <CircularProgress size={20} />
              <Typography
                variant="body2"
                sx={{ color: isDarkMode ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.5)' }}
              >
                正在生成内容...
              </Typography>
            </Box>
          ) : isStreaming && hasContent ? (
            // 流式生成中，显示终端预览
            <>
              {/* 终端预览区域 */}
              <Box
                sx={{
                  m: 2,
                  borderRadius: '8px',
                  overflow: 'hidden',
                  backgroundColor: theme.palette.background.default,
                }}
              >
                <Box
                  sx={{
                    p: 1.5,
                    minHeight: '80px',
                    fontFamily: '"Fira Code", "JetBrains Mono", Consolas, monospace',
                    fontSize: '13px',
                    lineHeight: 1.4,
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                    {/* 终端提示符 */}
                    <Typography
                      component="span"
                      sx={{
                        color: isDarkMode ? '#4ade80' : '#16a34a',
                        fontWeight: 'bold',
                        fontFamily: 'inherit',
                        flexShrink: 0,
                      }}
                    >
                      $
                    </Typography>
                    {/* 代码内容 */}
                    <Box
                      component="span"
                      sx={{
                        flex: 1,
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                        fontFamily: 'inherit',
                        color: theme.palette.text.primary,
                      }}
                    >
                      {html.trim().split('\n').slice(-5).join('\n')}
                      {/* 闪烁光标 */}
                      <Box
                        component="span"
                        sx={{
                          display: 'inline-block',
                          width: '2px',
                          height: '1em',
                          backgroundColor: isDarkMode ? '#4ade80' : '#16a34a',
                          ml: 0.25,
                          verticalAlign: 'text-bottom',
                          animation: 'cursorBlink 1s step-end infinite',
                          '@keyframes cursorBlink': {
                            '0%, 100%': { opacity: 1 },
                            '50%': { opacity: 0 },
                          },
                        }}
                      />
                    </Box>
                  </Box>
                </Box>
              </Box>
              {/* 预览按钮 */}
              <Box sx={{ px: 2, pb: 1.5 }}>
                <Button
                  variant="contained"
                  size="small"
                  startIcon={<Eye size={14} />}
                  onClick={() => setIsPopupOpen(true)}
                  sx={{ textTransform: 'none' }}
                >
                  预览
                </Button>
              </Box>
            </>
          ) : (
            // 完成状态，显示按钮组
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'row',
                gap: 0,
                mx: 2,
                my: 1.25,
              }}
            >
              <Button
                size="small"
                startIcon={<Eye size={14} />}
                onClick={() => setIsPopupOpen(true)}
                disabled={!hasContent}
                sx={{
                  textTransform: 'none',
                  color: theme.palette.text.secondary,
                  fontSize: '13px',
                  fontWeight: 400,
                  '&:hover': {
                    backgroundColor: 'transparent',
                    color: theme.palette.text.primary,
                  }
                }}
              >
                预览
              </Button>
              <Button
                size="small"
                startIcon={<ExternalLink size={14} />}
                onClick={handleOpenExternal}
                disabled={!hasContent}
                sx={{
                  textTransform: 'none',
                  color: theme.palette.text.secondary,
                  fontSize: '13px',
                  fontWeight: 400,
                  '&:hover': {
                    backgroundColor: 'transparent',
                    color: theme.palette.text.primary,
                  }
                }}
              >
                外部浏览器打开
              </Button>
              <Button
                size="small"
                startIcon={<Download size={14} />}
                onClick={handleDownload}
                disabled={!hasContent}
                sx={{
                  textTransform: 'none',
                  color: theme.palette.text.secondary,
                  fontSize: '13px',
                  fontWeight: 400,
                  '&:hover': {
                    backgroundColor: 'transparent',
                    color: theme.palette.text.primary,
                  }
                }}
              >
                下载
              </Button>
            </Box>
          )}
        </Box>
      </Box>

      {/* 预览弹窗 */}
      <HtmlArtifactsPopup
        open={isPopupOpen}
        title={title}
        html={html}
        onSave={onSave}
        onClose={() => setIsPopupOpen(false)}
      />
    </>
  );
});

HtmlArtifactsCard.displayName = 'HtmlArtifactsCard';

/**
 * HTML 预览弹窗组件
 */
interface HtmlArtifactsPopupProps {
  open: boolean;
  title: string;
  html: string;
  onSave?: (html: string) => void;
  onClose: () => void;
}

type ViewMode = 'split' | 'code' | 'preview';

const HtmlArtifactsPopup: React.FC<HtmlArtifactsPopupProps> = memo(({
  open,
  title,
  html,
  onSave: _onSave,
  onClose
}) => {
  const theme = useTheme();
  const isDarkMode = theme.palette.mode === 'dark';
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  
  // 移动端默认预览模式，桌面端默认分屏
  const [viewMode, setViewMode] = useState<ViewMode>(isMobile ? 'preview' : 'split');
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  // 缩放控制
  const [zoom, setZoom] = useState(100);
  const ZOOM_STEP = 25;
  const ZOOM_MIN = 25;
  const ZOOM_MAX = 200;
  
  const handleZoomIn = useCallback(() => {
    setZoom(prev => Math.min(prev + ZOOM_STEP, ZOOM_MAX));
  }, []);
  
  const handleZoomOut = useCallback(() => {
    setZoom(prev => Math.max(prev - ZOOM_STEP, ZOOM_MIN));
  }, []);
  
  const handleZoomReset = useCallback(() => {
    setZoom(100);
  }, []);

  // 移动端始终全屏
  const effectiveFullscreen = isMobile || isFullscreen;

  const handleViewModeChange = (_: React.MouseEvent<HTMLElement>, newMode: ViewMode | null) => {
    if (newMode !== null) {
      setViewMode(newMode);
    }
  };

  // 移动端底部导航切换视图
  const handleMobileViewChange = (_: React.SyntheticEvent, newValue: ViewMode) => {
    setViewMode(newValue);
  };

  return (
    <BackButtonDialog
      open={open}
      onClose={onClose}
      maxWidth={false}
      fullScreen={effectiveFullscreen}
      PaperProps={{
        sx: {
          width: effectiveFullscreen ? '100vw' : '90vw',
          maxWidth: effectiveFullscreen ? '100vw' : '1400px',
          height: effectiveFullscreen ? '100vh' : '85vh',
          borderRadius: '12px',
          overflow: 'hidden',
        }
      }}
    >
      {/* 头部 */}
      <DialogTitle
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          py: isMobile ? 1.5 : 1,
          px: isMobile ? 1 : 2,
          minHeight: isMobile ? 56 : 'auto',
          borderBottom: `1px solid ${theme.palette.divider}`,
          backgroundColor: theme.palette.background.default,
        }}
      >
        {/* 移动端返回按钮 */}
        {isMobile && (
          <IconButton size="small" onClick={onClose} sx={{ mr: 1 }}>
            <ChevronLeft size={24} />
          </IconButton>
        )}

        {/* 标题 */}
        <Typography
          variant="subtitle1"
          sx={{
            fontWeight: 600,
            flex: 1,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            fontSize: isMobile ? '16px' : '14px',
          }}
        >
          {title}
        </Typography>

        {/* 桌面端：中间视图切换 */}
        {!isMobile && (
          <ToggleButtonGroup
            value={viewMode}
            exclusive
            onChange={handleViewModeChange}
            size="small"
            sx={{
              position: 'absolute',
              left: '50%',
              transform: 'translateX(-50%)',
              backgroundColor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
              borderRadius: '8px',
              '& .MuiToggleButton-root': {
                border: 'none',
                px: 1.5,
                py: 0.5,
                textTransform: 'none',
                fontSize: '13px',
                '&.Mui-selected': {
                  backgroundColor: 'primary.main',
                  color: 'white',
                  '&:hover': {
                    backgroundColor: 'primary.dark',
                  }
                }
              }
            }}
          >
            <ToggleButton value="split">
              <Columns2 size={14} style={{ marginRight: 4 }} />
              分屏
            </ToggleButton>
            <ToggleButton value="code">
              <Code size={14} style={{ marginRight: 4 }} />
              代码
            </ToggleButton>
            <ToggleButton value="preview">
              <Eye size={14} style={{ marginRight: 4 }} />
              预览
            </ToggleButton>
          </ToggleButtonGroup>
        )}

        {/* 右侧按钮 */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          {/* 缩放控制 - 仅在预览模式显示 */}
          {(viewMode === 'preview' || viewMode === 'split') && (
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 0.25,
                mr: 1,
                px: 0.5,
                py: 0.25,
                borderRadius: '6px',
                backgroundColor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
              }}
            >
              <Tooltip title="缩小">
                <IconButton 
                  size="small" 
                  onClick={handleZoomOut}
                  disabled={zoom <= ZOOM_MIN}
                  sx={{ p: 0.5 }}
                >
                  <ZoomOut size={16} />
                </IconButton>
              </Tooltip>
              <Tooltip title="重置缩放">
                <Button 
                  size="small" 
                  onClick={handleZoomReset}
                  sx={{ 
                    minWidth: 'auto', 
                    px: 0.75, 
                    py: 0.25,
                    fontSize: '12px',
                    fontWeight: 500,
                    color: zoom !== 100 ? 'primary.main' : 'text.secondary',
                  }}
                >
                  {zoom}%
                </Button>
              </Tooltip>
              <Tooltip title="放大">
                <IconButton 
                  size="small" 
                  onClick={handleZoomIn}
                  disabled={zoom >= ZOOM_MAX}
                  sx={{ p: 0.5 }}
                >
                  <ZoomIn size={16} />
                </IconButton>
              </Tooltip>
            </Box>
          )}
          
          {/* 桌面端全屏按钮 */}
          {!isMobile && (
            <Tooltip title={isFullscreen ? '退出全屏' : '全屏'}>
              <IconButton size="small" onClick={() => setIsFullscreen(!isFullscreen)}>
                {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
              </IconButton>
            </Tooltip>
          )}
          {/* 桌面端关闭按钮 */}
          {!isMobile && (
            <Tooltip title="关闭">
              <IconButton size="small" onClick={onClose}>
                <X size={18} />
              </IconButton>
            </Tooltip>
          )}
        </Box>
      </DialogTitle>

      {/* 内容区域 */}
      <DialogContent
        sx={{
          p: 0,
          display: 'flex',
          flexDirection: isMobile ? 'column' : 'row',
          height: '100%',
          overflow: 'hidden',
          // 移动端底部留出导航栏空间
          pb: isMobile ? 7 : 0,
        }}
      >
        {/* 代码面板 */}
        {(viewMode === 'split' || viewMode === 'code') && (
          <Box
            sx={{
              flex: isMobile ? 1 : (viewMode === 'split' ? '0 0 50%' : 1),
              height: '100%',
              overflow: 'auto',
              backgroundColor: theme.palette.background.default,
              borderRight: !isMobile && viewMode === 'split' 
                ? `1px solid ${theme.palette.divider}` 
                : 'none',
            }}
          >
            <pre
              style={{
                margin: 0,
                padding: isMobile ? '12px' : '16px',
                fontFamily: '"Fira Code", "JetBrains Mono", Consolas, monospace',
                fontSize: isMobile ? '12px' : '13px',
                lineHeight: 1.5,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                color: theme.palette.text.primary,
              }}
            >
              {html}
            </pre>
          </Box>
        )}

        {/* 预览面板 */}
        {(viewMode === 'split' || viewMode === 'preview') && (
          <Box
            sx={{
              flex: isMobile ? 1 : (viewMode === 'split' ? '0 0 50%' : 1),
              height: '100%',
              backgroundColor: '#fff',
              overflow: 'auto',
              position: 'relative',
            }}
          >
            {/* 缩放容器 */}
            <Box
              sx={{
                width: `${10000 / zoom}%`,
                height: `${10000 / zoom}%`,
                transform: `scale(${zoom / 100})`,
                transformOrigin: 'top left',
              }}
            >
              <iframe
                srcDoc={html}
                title="HTML Preview"
                sandbox="allow-scripts allow-same-origin allow-forms"
                style={{
                  width: '100%',
                  height: '100%',
                  border: 'none',
                  backgroundColor: '#fff',
                }}
              />
            </Box>
          </Box>
        )}
      </DialogContent>

      {/* 移动端底部导航 */}
      {isMobile && (
        <BottomNavigation
          value={viewMode}
          onChange={handleMobileViewChange}
          showLabels
          sx={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            borderTop: `1px solid ${theme.palette.divider}`,
            backgroundColor: theme.palette.background.paper,
            // 底部安全区域
            paddingBottom: 'env(safe-area-inset-bottom, 0px)',
            height: 'auto',
            minHeight: 56,
          }}
        >
          <BottomNavigationAction
            label="代码"
            value="code"
            icon={<Code size={20} />}
          />
          <BottomNavigationAction
            label="预览"
            value="preview"
            icon={<Eye size={20} />}
          />
          <BottomNavigationAction
            label="分屏"
            value="split"
            icon={<Columns2 size={20} />}
          />
        </BottomNavigation>
      )}
    </BackButtonDialog>
  );
});

HtmlArtifactsPopup.displayName = 'HtmlArtifactsPopup';

export default HtmlArtifactsCard;
