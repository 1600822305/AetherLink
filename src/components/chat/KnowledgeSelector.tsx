import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Box,
  Alert,
  CircularProgress,
  Chip
} from '@mui/material';
import BackButtonDrawer from '../common/BackButtonDrawer';
import { alpha } from '@mui/material/styles';
import styled from '@emotion/styled';
import { useTheme } from '@mui/material/styles';
import { BookOpen as MenuBookIcon, Plus, Trash2, Check } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import type { RootState } from '../../shared/store';
import { clearSelectedKnowledgeBase, toggleKnowledgeBase } from '../../shared/store/slices/knowledgeSelectionSlice';
import { dexieStorage } from '../../shared/services/storage/DexieStorageService';
import type { KnowledgeBase as FullKnowledgeBase, KnowledgeSearchResult } from '../../shared/types/KnowledgeBase';
import { createLogger } from '../../shared/services/infra/logger';

const logger = createLogger('KnowledgeSelector');

/** UI展示用的知识库简化类型 */
interface KnowledgeBaseDisplay {
  id: string;
  name: string;
  description?: string;
  documentCount: number;
  createdAt: string | Date;
}

/** 搜索结果类型（兼容旧接口） */
type SearchResult = Pick<KnowledgeSearchResult, 'content' | 'similarity' | 'documentId'> & {
  title?: string;
};

interface KnowledgeSelectorProps {
  open: boolean;
  onClose: () => void;
  onSelect: (knowledgeBase: KnowledgeBaseDisplay | FullKnowledgeBase, searchResults: SearchResult[]) => void;
  searchQuery?: string;
}

const KnowledgePanelBody = styled.div<{ theme?: any }>`
  padding: 5px 0;
  background-color: ${props => props.theme?.palette?.background?.paper};
`;

const KnowledgePanelList = styled.div<{ theme?: any }>`
  max-height: 300px;
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
`;

const KnowledgePanelItem = styled.div<{ theme?: any; selected?: boolean }>`
  min-height: 44px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 0 5px 1px 5px;
  padding: 8px 12px;
  border-radius: 6px;
  cursor: pointer;
  transition: background-color 0.1s ease;
  background-color: ${props => props.selected 
    ? (props.theme?.palette?.mode === 'dark' ? 'rgba(5, 150, 105, 0.25)' : 'rgba(5, 150, 105, 0.15)')
    : 'transparent'};

  &:hover {
    background-color: ${props => props.selected
      ? (props.theme?.palette?.mode === 'dark' ? 'rgba(5, 150, 105, 0.35)' : 'rgba(5, 150, 105, 0.25)')
      : (props.theme?.palette?.mode === 'dark' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.04)')};
  }
`;

const KnowledgePanelItemLeft = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
  min-width: 0;
`;

const KnowledgePanelItemIcon = styled.span<{ theme?: any; selected?: boolean }>`
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${props => props.selected 
    ? (props.theme?.palette?.mode === 'dark' ? 'rgba(5, 150, 105, 0.95)' : 'rgba(5, 150, 105, 0.85)')
    : (props.theme?.palette?.text?.secondary || '#666')};
  flex-shrink: 0;
`;

const KnowledgePanelItemContent = styled.div`
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
  gap: 2px;
`;

const KnowledgePanelItemLabel = styled.span<{ selected?: boolean }>`
  font-size: 14px;
  line-height: 20px;
  font-weight: ${props => props.selected ? 600 : 400};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const KnowledgePanelItemDescription = styled.span<{ theme?: any }>`
  font-size: 12px;
  color: ${props => props.theme?.palette?.text?.secondary || '#666'};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const KnowledgePanelFooter = styled.div<{ theme?: any }>`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px 6px;
  border-top: 1px solid ${props => props.theme?.palette?.mode === 'dark' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)'};
`;

const KnowledgePanelFooterTitle = styled.div<{ theme?: any }>`
  font-size: 12px;
  color: ${props => props.theme?.palette?.text?.secondary || '#666'};
`;

const KnowledgePanelFooterTips = styled.div<{ theme?: any }>`
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 11px;
  color: ${props => props.theme?.palette?.text?.secondary || '#666'};
`;

const KnowledgePanelDivider = styled.div<{ theme?: any }>`
  height: 1px;
  background-color: ${props => props.theme?.palette?.mode === 'dark' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)'};
  margin: 4px 8px;
`;

const KnowledgeSelector: React.FC<KnowledgeSelectorProps> = ({ open, onClose, onSelect }) => {
  const theme = useTheme();
  const navigate = useNavigate();
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBaseDisplay[]>([]);
  const [loading, setLoading] = useState(false);
  // 从 Redux 读取已选中的知识库 ID
  const reduxSelectedKBs = useSelector((state: RootState) => state.knowledgeSelection.selectedKnowledgeBases);
  const selectedKBIds = useMemo(() => new Set(reduxSelectedKBs.map(kb => kb.id)), [reduxSelectedKBs]);
  const [error, setError] = useState<string>('');
  const isMountedRef = useRef(true);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const loadKnowledgeBases = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const kbs = await dexieStorage.knowledge_bases.toArray();

      const kbsWithCount = await Promise.all(
        kbs.map(async (kb) => {
          const docs = await dexieStorage.knowledge_documents
            .where('knowledgeBaseId')
            .equals(kb.id)
            .toArray();

          return {
            id: kb.id,
            name: kb.name,
            description: kb.description,
            documentCount: docs.length,
            createdAt: kb.created_at
          };
        })
      );

      if (isMountedRef.current) {
        setKnowledgeBases(kbsWithCount);
      }
    } catch (error) {
      logger.error('加载知识库失败:', error);
      if (isMountedRef.current) {
        setError('加载知识库失败，请重试');
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, []);

  const handleClose = useCallback(() => {
    setError('');
    onClose();
  }, [onClose]);

  const dispatch = useDispatch();

  // 清除已选中的知识库
  const handleClear = useCallback(() => {
    dispatch(clearSelectedKnowledgeBase());
    handleClose();
  }, [dispatch, handleClose]);

  // 添加知识库
  const handleAddKnowledgeBase = useCallback(() => {
    handleClose();
    // 跳转到知识库页面
    navigate('/knowledge');
  }, [handleClose, navigate]);

  const handleSelectKB = useCallback((kb: KnowledgeBaseDisplay) => {
    // 立即 dispatch 到 Redux，关闭面板不会丢失选择
    dispatch(toggleKnowledgeBase({ id: kb.id, name: kb.name }));
  }, [dispatch]);

  const handleConfirm = useCallback(() => {
    // 选择已实时同步到 Redux，直接关闭并回调
    const firstSelected = knowledgeBases.find(kb => selectedKBIds.has(kb.id));
    if (firstSelected) {
      onSelect(firstSelected, []);
    }
    handleClose();
  }, [knowledgeBases, selectedKBIds, onSelect, handleClose]);

  useEffect(() => {
    if (open) {
      isMountedRef.current = true;
      loadKnowledgeBases();
    }
  }, [open, loadKnowledgeBases]);

  const knowledgeBaseListStatus = useMemo(() => {
    if (loading) return 'loading';
    if (error) return 'error';
    if (knowledgeBases.length === 0) return 'empty';
    return 'loaded';
  }, [loading, error, knowledgeBases.length]);

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleClose();
      } else if (e.key === 'Enter' && selectedKBIds.size > 0) {
        e.preventDefault();
        handleConfirm();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, selectedKBIds, handleClose, handleConfirm]);

  return (
    <BackButtonDrawer
      anchor="bottom"
      open={open}
      onClose={handleClose}
      PaperProps={{
        sx: {
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
          maxHeight: '60vh',
          bgcolor: 'background.paper',
          pb: 'var(--safe-area-bottom-computed, 0px)'
        }
      }}
    >
      <Box sx={{ maxHeight: '60vh', display: 'flex', flexDirection: 'column' }}>
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

        <KnowledgePanelBody theme={theme}>
          {error && (
            <Alert severity="error" sx={{ mx: 1, mb: 1 }}>
              {error}
            </Alert>
          )}

          <KnowledgePanelList theme={theme}>
            {/* 清除按钮 */}
            <KnowledgePanelItem
              theme={theme}
              onClick={handleClear}
            >
              <KnowledgePanelItemLeft>
                <KnowledgePanelItemIcon theme={theme}>
                  <Trash2 size={18} />
                </KnowledgePanelItemIcon>
                <KnowledgePanelItemLabel>清除</KnowledgePanelItemLabel>
              </KnowledgePanelItemLeft>
              <KnowledgePanelItemDescription theme={theme}>
                清除当前已选中的知识库
              </KnowledgePanelItemDescription>
            </KnowledgePanelItem>

            <KnowledgePanelDivider theme={theme} />

            {knowledgeBaseListStatus === 'loading' ? (
              <Box display="flex" justifyContent="center" py={3}>
                <CircularProgress size={24} />
              </Box>
            ) : knowledgeBaseListStatus === 'empty' ? (
              <Alert severity="info" sx={{ mx: 1 }}>
                暂无知识库，请先创建知识库
              </Alert>
            ) : (
              <>
                {knowledgeBases.length > 0 && knowledgeBases.map((kb) => (
                  <KnowledgePanelItem
                    key={kb.id}
                    theme={theme}
                    selected={selectedKBIds.has(kb.id)}
                    onClick={() => handleSelectKB(kb)}
                  >
                    <KnowledgePanelItemLeft>
                      <KnowledgePanelItemIcon theme={theme} selected={selectedKBIds.has(kb.id)}>
                        {selectedKBIds.has(kb.id) ? <Check size={20} /> : <MenuBookIcon size={20} />}
                      </KnowledgePanelItemIcon>
                      <KnowledgePanelItemContent>
                        <KnowledgePanelItemLabel selected={selectedKBIds.has(kb.id)}>
                          {kb.name}
                        </KnowledgePanelItemLabel>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          {kb.description && (
                            <KnowledgePanelItemDescription theme={theme}>
                              {kb.description.length > 30 
                                ? `${kb.description.substring(0, 30)}...` 
                                : kb.description}
                            </KnowledgePanelItemDescription>
                          )}
                          <Chip
                            size="small"
                            label={`${kb.documentCount}个文档`}
                            sx={{
                              height: 18,
                              fontSize: '11px',
                              '& .MuiChip-label': { px: 0.5 }
                            }}
                          />
                        </Box>
                      </KnowledgePanelItemContent>
                    </KnowledgePanelItemLeft>
                  </KnowledgePanelItem>
                ))}

                <KnowledgePanelDivider theme={theme} />

                {/* 添加知识库按钮 */}
                <KnowledgePanelItem
                  theme={theme}
                  onClick={handleAddKnowledgeBase}
                >
                  <KnowledgePanelItemLeft>
                    <KnowledgePanelItemIcon theme={theme}>
                      <Plus size={18} />
                    </KnowledgePanelItemIcon>
                    <KnowledgePanelItemLabel>添加知识库...</KnowledgePanelItemLabel>
                  </KnowledgePanelItemLeft>
                </KnowledgePanelItem>
              </>
            )}
          </KnowledgePanelList>

          <KnowledgePanelFooter theme={theme}>
            <KnowledgePanelFooterTitle theme={theme}>
              知识库 ({knowledgeBases.length})
            </KnowledgePanelFooterTitle>
            <KnowledgePanelFooterTips theme={theme}>
              <span>ESC 关闭</span>
              <span>多选</span>
              <span>↩︎ 确认</span>
            </KnowledgePanelFooterTips>
          </KnowledgePanelFooter>
        </KnowledgePanelBody>
      </Box>
    </BackButtonDrawer>
  );
};

export default KnowledgeSelector;
