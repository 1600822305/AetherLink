import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import {
  Drawer,
  Box,
  Typography,
  CircularProgress,
  useMediaQuery,
  IconButton,
  Tooltip,
  InputBase
} from '@mui/material';
import { FileText, Folder, ChevronRight, ArrowLeft, X, Search } from 'lucide-react';
import { alpha } from '@mui/material/styles';
import { useTheme } from '@mui/material/styles';
import { simpleNoteService } from '../shared/services/notes/SimpleNoteService';
import { useNotesSearch } from '../shared/hooks/useNotesSearch';
import type { NoteFile } from '../shared/types/note';
import type { SearchResult } from '../shared/services/notes/NotesSearchService';
import styled from '@emotion/styled';
import { createLogger } from '../shared/services/infra/logger';

const logger = createLogger('NoteSelector');

interface NoteSelectorProps {
  open: boolean;
  onClose: () => void;
  onSelectNote: (path: string, content: string, fileName: string) => void;
}

// 样式组件定义
const NotePanelBody = styled.div<{ theme?: any }>`
  padding: 5px 0;
  background-color: ${props => props.theme?.palette?.background?.paper};
`;

const NotePanelList = styled.div<{ theme?: any }>`
  max-height: 400px;
  overflow-y: auto;
  
  &::-webkit-scrollbar {
    width: 6px;
  }
  
  &::-webkit-scrollbar-track {
    background: transparent;
  }
  
  &::-webkit-scrollbar-thumb {
    background: ${props => props.theme?.palette?.mode === 'dark' ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)'};
    border-radius: 3px;
  }
  
  // 移动端优化
  @media (max-width: 768px) {
    max-height: calc(100vh - 240px);
    -webkit-overflow-scrolling: touch;
  }
  
  @media (max-width: 480px) {
    max-height: calc(100vh - 220px);
  }
`;

const NotePanelItem = styled.div<{ theme?: any }>`
  min-height: 44px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 0 5px 1px 5px;
  padding: 10px 12px;
  border-radius: 6px;
  cursor: pointer;
  transition: background-color 0.1s ease;

  &:hover {
    background-color: ${props => props.theme?.palette?.mode === 'dark' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.04)'};
  }

  &.focused {
    background-color: ${props => props.theme?.palette?.mode === 'dark' ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)'};
  }
  
  // 移动端优化
  @media (max-width: 768px) {
    min-height: 48px;
    padding: 12px 16px;
    margin: 0 8px 2px 8px;
  }
  
  @media (max-width: 480px) {
    min-height: 52px;
    padding: 14px 16px;
    margin: 0 12px 3px 12px;
  }
  
  // 移动端触摸反馈
  @media (hover: none) {
  &:active {
    background-color: ${props => props.theme?.palette?.mode === 'dark' ? 'rgba(255, 255, 255, 0.16)' : 'rgba(0, 0, 0, 0.12)'};
  }
}
`;

const NotePanelItemLeft = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
  min-width: 0;
`;

const NotePanelItemIcon = styled.span<{ theme?: any }>`
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${props => props.theme?.palette?.text?.secondary || '#666'};
  flex-shrink: 0;
`;

const NotePanelItemLabel = styled.span`
  font-size: 14px;
  line-height: 20px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
`;

const NotePanelItemRight = styled.div<{ theme?: any }>`
  display: flex;
  align-items: center;
  color: ${props => props.theme?.palette?.text?.secondary || '#666'};
  flex-shrink: 0;
`;

const NotePanelFooter = styled.div<{ theme?: any }>`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px 6px;
  border-top: 1px solid ${props => props.theme?.palette?.mode === 'dark' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)'};
`;

const NotePanelFooterTitle = styled.div<{ theme?: any }>`
  font-size: 12px;
  color: ${props => props.theme?.palette?.text?.secondary || '#666'};
`;

const NotePanelFooterTips = styled.div<{ theme?: any }>`
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 11px;
  color: ${props => props.theme?.palette?.text?.secondary || '#666'};
`;

const Breadcrumb = styled.div<{ theme?: any }>`
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 8px 12px;
  font-size: 13px;
  color: ${props => props.theme?.palette?.text?.secondary || '#666'};
  border-bottom: 1px solid ${props => props.theme?.palette?.mode === 'dark' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)'};
  
  // 移动端优化
  @media (max-width: 768px) {
    padding: 10px 16px;
    font-size: 14px;
    flex-wrap: nowrap;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;
    -ms-overflow-style: none;
    
    &::-webkit-scrollbar {
      display: none;
    }
  }
  
  @media (max-width: 480px) {
    padding: 12px 16px;
    font-size: 15px;
  }
`;

const BreadcrumbItem = styled.span<{ clickable?: boolean; theme?: any }>`
  cursor: ${props => props.clickable ? 'pointer' : 'default'};
  color: ${props => props.clickable ? props.theme?.palette?.primary?.main : 'inherit'};
  white-space: nowrap;
  
  &:hover {
    text-decoration: ${props => props.clickable ? 'underline' : 'none'};
  }
  
  // 移动端优化
  @media (max-width: 768px) {
    font-size: 14px;
    padding: 2px 0;
  }
  
  @media (max-width: 480px) {
    font-size: 15px;
    padding: 3px 0;
  }
`;

const SearchInputWrapper = styled.div<{ theme?: any }>`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  margin: 0 8px 8px 8px;
  border-radius: 8px;
  background-color: ${props => props.theme?.palette?.mode === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)'};
  
  @media (max-width: 768px) {
    margin: 0 12px 8px 12px;
    padding: 10px 14px;
  }
`;

const MatchContext = styled.div<{ theme?: any }>`
  font-size: 12px;
  color: ${props => props.theme?.palette?.text?.secondary || '#666'};
  margin-top: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  
  mark {
    background-color: ${props => props.theme?.palette?.mode === 'dark' ? 'rgba(255, 213, 79, 0.3)' : 'rgba(255, 213, 79, 0.5)'};
    color: inherit;
    padding: 0 2px;
    border-radius: 2px;
  }
`;

const MatchBadge = styled.span<{ theme?: any }>`
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 4px;
  background-color: ${props => props.theme?.palette?.mode === 'dark' ? 'rgba(66, 165, 245, 0.2)' : 'rgba(66, 165, 245, 0.15)'};
  color: ${props => props.theme?.palette?.primary?.main || '#42A5F5'};
  margin-left: 8px;
  flex-shrink: 0;
`;

const NoteSelector: React.FC<NoteSelectorProps> = ({
  open,
  onClose,
  onSelectNote
}) => {
  const theme = useTheme();
  const [notes, setNotes] = useState<NoteFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentPath, setCurrentPath] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [isSearchMode, setIsSearchMode] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  
  // 搜索功能
  const { 
    search, 
    reset: resetSearch, 
    keyword, 
    isSearching, 
    results: searchResults,
    stats 
  } = useNotesSearch({ debounceMs: 300 });
  
  // 移动端适配
  const isMobile = useMediaQuery('(max-width:768px)');
  const isSmallMobile = useMediaQuery('(max-width:480px)');
  
  // 移动端触摸滑动支持
  const touchStartY = useRef<number>(0);
  const drawerRef = useRef<HTMLDivElement>(null);
  const lastClickTime = useRef<number>(0);
  
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
  };
  
  const handleTouchMove = (e: React.TouchEvent) => {
    if (!drawerRef.current) return;
    
    const currentY = e.touches[0].clientY;
    const diff = currentY - touchStartY.current;
    
    // 向下滑动超过阈值时关闭抽屉
    if (diff > 100 && currentPath === '') {
      onClose();
    }
  };

  // 加载笔记列表
  const loadNotes = useCallback(async (path: string = '') => {
    setLoading(true);
    try {
      const items = await simpleNoteService.listNotes(path);
      setNotes(items);
    } catch (error) {
      logger.error('加载笔记列表失败:', error);
      setNotes([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      loadNotes(currentPath);
      setSelectedIndex(-1);
    } else {
      // 关闭时重置搜索状态
      setIsSearchMode(false);
      resetSearch();
    }
  }, [open, currentPath, loadNotes, resetSearch]);
  
  // 进入搜索模式时聚焦输入框
  useEffect(() => {
    if (isSearchMode && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isSearchMode]);
  
  // 当前显示的列表项
  const displayItems = useMemo(() => {
    if (isSearchMode && keyword) {
      return searchResults;
    }
    return notes;
  }, [isSearchMode, keyword, searchResults, notes]);

  // 处理文件/文件夹点击 - 移动端优化
  const handleItemClick = async (item: NoteFile | SearchResult) => {
    // 移动端防抖处理
    if (isMobile) {
      // 简单的防抖，防止快速双击
      const now = Date.now();
      if (lastClickTime.current && now - lastClickTime.current < 300) {
        return;
      }
      lastClickTime.current = now;
    }
    
    if (item.isDirectory) {
      // 进入文件夹（搜索模式下也支持）
      setCurrentPath(item.path);
      setSelectedIndex(-1);
      // 退出搜索模式
      if (isSearchMode) {
        setIsSearchMode(false);
        resetSearch();
      }
    } else {
      // 选择文件
      try {
        const content = await simpleNoteService.readNote(item.path);
        onSelectNote(item.path, content, item.name);
        onClose();
      } catch (error) {
        logger.error('读取笔记失败:', error);
      }
    }
  };
  
  // 切换搜索模式
  const toggleSearchMode = useCallback(() => {
    setIsSearchMode(prev => {
      if (prev) {
        resetSearch();
      }
      return !prev;
    });
    setSelectedIndex(-1);
  }, [resetSearch]);

  // 返回上级目录
  const handleGoBack = useCallback(() => {
    // 如果在搜索模式，先退出搜索
    if (isSearchMode) {
      setIsSearchMode(false);
      resetSearch();
      return;
    }
    
    if (!currentPath) {
      // 已经在根目录，无法返回
      return;
    }
    
    const pathParts = currentPath.split('/');
    if (pathParts.length === 1) {
      // 只有一级目录，返回根目录
      setCurrentPath('');
    } else {
      // 多级目录，返回上一级
      pathParts.pop();
      setCurrentPath(pathParts.join('/'));
    }
  }, [currentPath, isSearchMode, resetSearch]);

  // 面包屑导航
  const breadcrumbs = useMemo(() => {
    if (!currentPath) return ['根目录'];
    return ['根目录', ...currentPath.split('/')];
  }, [currentPath]);

  // 键盘导航
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        if (isSearchMode) {
          setIsSearchMode(false);
          resetSearch();
        } else if (currentPath) {
          handleGoBack();
        } else {
          onClose();
        }
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev < displayItems.length - 1 ? prev + 1 : 0));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : displayItems.length - 1));
      } else if (e.key === 'Enter' && selectedIndex >= 0) {
        e.preventDefault();
        handleItemClick(displayItems[selectedIndex]);
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, selectedIndex, displayItems, currentPath, isSearchMode, handleGoBack, resetSearch]);
  
  // 渲染匹配上下文（高亮关键词）
  const renderMatchContext = (item: SearchResult) => {
    if (!item.matches || item.matches.length === 0) return null;
    const firstMatch = item.matches[0];
    const { context, matchStart, matchEnd } = firstMatch;
    
    return (
      <MatchContext theme={theme}>
        {context.substring(0, matchStart)}
        <mark>{context.substring(matchStart, matchEnd)}</mark>
        {context.substring(matchEnd)}
      </MatchContext>
    );
  };

  return (
    <Drawer
      anchor="bottom"
      open={open}
      onClose={onClose}
      ref={drawerRef}
      PaperProps={{
        sx: {
          borderTopLeftRadius: isSmallMobile ? 0 : 16,
          borderTopRightRadius: isSmallMobile ? 0 : 16,
          maxHeight: isSmallMobile ? '100vh' : isMobile ? '85vh' : '70vh',
          height: isSmallMobile ? '100vh' : 'auto',
          bgcolor: 'background.paper',
          pb: 'var(--safe-area-bottom-computed, 0px)'
        }
      }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
    >
      <Box sx={{ maxHeight: isSmallMobile ? '100vh' : isMobile ? '85vh' : '70vh', display: 'flex', flexDirection: 'column' }}>
        {/* 移动端头部 */}
        {isMobile && (
          <Box sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between',
            p: 2,
            borderBottom: 1,
            borderColor: 'divider'
          }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              {(currentPath || isSearchMode) && (
                <Tooltip title="返回">
                    <IconButton 
                      onClick={handleGoBack}
                      size={isSmallMobile ? "medium" : "small"}
                      sx={{ 
                        color: theme.palette.text.secondary,
                        padding: isSmallMobile ? 2 : 1,
                        '&:hover': {
                          backgroundColor: 'action.hover'
                        }
                      }}
                    >
                      <ArrowLeft size={isSmallMobile ? 24 : 20} />
                    </IconButton>
                  </Tooltip>
              )}
              <Typography variant="h6" sx={{ fontSize: isSmallMobile ? '1.1rem' : '1.25rem' }}>
                {isSearchMode ? '搜索笔记' : '选择笔记'}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {!isSearchMode && (
                <Tooltip title="搜索">
                  <IconButton 
                    onClick={toggleSearchMode}
                    size={isSmallMobile ? "medium" : "small"}
                    sx={{ 
                      color: theme.palette.text.secondary,
                      padding: isSmallMobile ? 2 : 1,
                      '&:hover': {
                        backgroundColor: 'action.hover'
                      }
                    }}
                  >
                    <Search size={isSmallMobile ? 22 : 18} />
                  </IconButton>
                </Tooltip>
              )}
              <IconButton 
                onClick={onClose}
                size={isSmallMobile ? "medium" : "small"}
                sx={{ 
                  color: theme.palette.text.secondary,
                  padding: isSmallMobile ? 2 : 1,
                  '&:hover': {
                    backgroundColor: 'action.hover'
                  }
                }}
              >
                <X size={isSmallMobile ? 24 : 20} />
              </IconButton>
            </Box>
          </Box>
        )}
        
        {/* 桌面端拖拽指示器 */}
        {!isMobile && (
          <Box sx={{ pt: 1, pb: 1.5, display: 'flex', justifyContent: 'center' }}>
            <Box
              sx={{
                width: 40,
                height: 4,
                bgcolor: (theme) => alpha(theme.palette.text.primary, 0.2),
                borderRadius: 999
              }}
            />
          </Box>
        )}

        {/* 面包屑导航 - 移动端隐藏，使用头部返回按钮；搜索模式下也隐藏 */}
        {!isMobile && !isSearchMode && (
          <Breadcrumb theme={theme}>
            {breadcrumbs.map((crumb, index) => (
              <React.Fragment key={index}>
                {index > 0 && <ChevronRight size={14} />}
                <BreadcrumbItem
                  clickable={index > 0 && index < breadcrumbs.length - 1}
                  theme={theme}
                  onClick={() => {
                    if (index === 0) {
                      setCurrentPath('');
                    } else if (index < breadcrumbs.length - 1) {
                      // 计算要跳转到的路径：从根目录到当前点击的层级
                      const pathParts = breadcrumbs.slice(1, index + 1);
                      setCurrentPath(pathParts.join('/'));
                    }
                    // 如果是当前目录（最后一个面包屑），不执行任何操作
                  }}
                >
                  {crumb}
                </BreadcrumbItem>
              </React.Fragment>
            ))}
          </Breadcrumb>
        )}
        
        {/* 搜索输入框 */}
        {isSearchMode && (
          <SearchInputWrapper theme={theme}>
            <Search size={18} color={theme.palette.text.secondary} />
            <InputBase
              inputRef={searchInputRef}
              placeholder="搜索笔记名称或内容..."
              value={keyword}
              onChange={(e) => search(e.target.value)}
              fullWidth
              sx={{ fontSize: isMobile ? 16 : 14 }}
            />
            {isSearching && <CircularProgress size={16} />}
          </SearchInputWrapper>
        )}

        <NotePanelBody ref={panelRef} theme={theme}>
          {loading || (isSearchMode && isSearching && !keyword) ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: isMobile ? 6 : 4 }}>
              <CircularProgress size={isMobile ? 32 : 24} />
            </Box>
          ) : displayItems.length === 0 ? (
            <Box sx={{ p: isMobile ? 6 : 4, textAlign: 'center' }}>
              <Typography 
                color="text.secondary" 
                variant={isMobile ? 'h6' : 'body2'}
                sx={{ fontSize: isMobile ? '1.1rem' : 'inherit' }}
              >
                {isSearchMode ? (keyword ? '未找到匹配的笔记' : '输入关键词搜索笔记') : '此文件夹为空'}
              </Typography>
              {isSearchMode && keyword && stats.total === 0 && (
                <Typography 
                  color="text.secondary" 
                  variant="body2"
                  sx={{ mt: 1, fontSize: '0.85rem' }}
                >
                  尝试使用其他关键词
                </Typography>
              )}
            </Box>
          ) : (
            <>
              {/* 搜索统计 */}
              {isSearchMode && keyword && stats.total > 0 && (
                <Box sx={{ px: 2, py: 1, fontSize: 12, color: 'text.secondary' }}>
                  找到 {stats.total} 个结果
                  {stats.bothMatches > 0 && ` (${stats.bothMatches} 个同时匹配名称和内容)`}
                </Box>
              )}
              <NotePanelList theme={theme}>
                {displayItems.map((item, index) => {
                  const isSearchResult = 'matchType' in item;
                  const searchItem = isSearchResult ? item as SearchResult : null;
                  
                  return (
                    <NotePanelItem
                      key={item.id}
                      theme={theme}
                      className={selectedIndex === index ? 'focused' : ''}
                      onClick={() => handleItemClick(item)}
                      onMouseEnter={() => !isMobile && setSelectedIndex(index)}
                      onTouchStart={() => isMobile && setSelectedIndex(index)}
                    >
                      <NotePanelItemLeft>
                        <NotePanelItemIcon theme={theme}>
                          {item.isDirectory ? (
                            <Folder size={isMobile ? 22 : 18} color="#FBC02D" />
                          ) : (
                            <FileText size={isMobile ? 22 : 18} color="#42A5F5" />
                          )}
                        </NotePanelItemIcon>
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            <NotePanelItemLabel>{item.name}</NotePanelItemLabel>
                            {searchItem && searchItem.matchType === 'both' && (
                              <MatchBadge theme={theme}>全匹配</MatchBadge>
                            )}
                          </Box>
                          {/* 搜索模式下显示路径 */}
                          {isSearchMode && item.path && item.path.includes('/') && (
                            <Typography 
                              variant="caption" 
                              color="text.secondary"
                              sx={{ display: 'block', fontSize: 11, opacity: 0.7 }}
                            >
                              {item.path}
                            </Typography>
                          )}
                          {/* 显示匹配上下文 */}
                          {searchItem && renderMatchContext(searchItem)}
                        </Box>
                      </NotePanelItemLeft>
                      {item.isDirectory && (
                        <NotePanelItemRight theme={theme}>
                          <ChevronRight size={isMobile ? 20 : 16} />
                        </NotePanelItemRight>
                      )}
                    </NotePanelItem>
                  );
                })}
              </NotePanelList>
            </>
          )}

          {/* 桌面端底部提示 */}
          {!isMobile && (
            <NotePanelFooter theme={theme}>
              <NotePanelFooterTitle theme={theme}>
                {isSearchMode ? `搜索笔记${stats.total > 0 ? ` (${stats.total})` : ''}` : '选择笔记'}
              </NotePanelFooterTitle>
              <NotePanelFooterTips theme={theme}>
                <span>ESC {isSearchMode ? '退出搜索' : (currentPath ? '返回' : '关闭')}</span>
                <span>▲▼ 选择</span>
                <span>↩︎ 确认</span>
              </NotePanelFooterTips>
            </NotePanelFooter>
          )}
        </NotePanelBody>
      </Box>
    </Drawer>
  );
};

export default NoteSelector;
