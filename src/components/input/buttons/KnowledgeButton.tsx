import React, { useState, useCallback } from 'react';
import { Box, Typography, IconButton, Tooltip, useTheme } from '@mui/material';
import { BookOpen } from 'lucide-react';
import { useSelector } from 'react-redux';
import type { RootState } from '../../../shared/store';
// KnowledgeSelector 内部已处理 Redux dispatch（多选模式）
import KnowledgeSelector from '../../chat/KnowledgeSelector';
import { getGlassmorphismToolbarStyles, getTransparentToolbarStyles } from '../../../shared/styles/toolbarStyles';
import { createLogger } from '../../../shared/services/infra/logger';

const logger = createLogger('KnowledgeButton');

/** 知识库选择回调的最小接口，兼容 KnowledgeSelector 的输出类型 */
interface KnowledgeBaseSelection {
  id: string;
  name: string;
}

interface KnowledgeButtonProps {
  variant?: 'toolbar' | 'icon-button-compact' | 'icon-button-integrated';
  searchQuery?: string; // 用于知识库搜索的查询文本
}

const KnowledgeButton: React.FC<KnowledgeButtonProps> = ({
  variant = 'toolbar',
  searchQuery
}) => {
  const theme = useTheme();
  const isDarkMode = theme.palette.mode === 'dark';
  const [showKnowledgeSelector, setShowKnowledgeSelector] = useState(false);

  // 获取工具栏样式设置
  const toolbarDisplayStyle = useSelector((state: RootState) =>
    state.settings?.toolbarDisplayStyle || 'both'
  ) as 'icon' | 'text' | 'both';

  const toolbarStyle = useSelector((state: RootState) =>
    state.settings?.toolbarStyle || 'glassmorphism'
  ) as 'glassmorphism' | 'transparent';

  // 根据设置选择样式
  const currentStyles = toolbarStyle === 'glassmorphism'
    ? getGlassmorphismToolbarStyles(isDarkMode)
    : getTransparentToolbarStyles(isDarkMode);

  // 处理知识库按钮点击
  const handleKnowledgeClick = useCallback(() => {
    setShowKnowledgeSelector(true);
  }, []);

  // 处理知识库选择
  const handleKnowledgeSelect = useCallback((knowledgeBase: KnowledgeBaseSelection, searchResults?: unknown[]) => {
    logger.debug('选择了知识库:', knowledgeBase, '搜索结果:', searchResults);
    // Redux dispatch 已由 KnowledgeSelector 内部处理（支持多选）
    logger.debug(`已选择知识库: ${knowledgeBase.name}，将在发送消息时自动搜索相关内容`);
    // 关闭知识库选择器
    setShowKnowledgeSelector(false);
  }, []);

  // 根据 variant 渲染不同的按钮样式
  const renderButton = () => {
    const iconColor = isDarkMode ? 'rgba(5, 150, 105, 0.8)' : 'rgba(5, 150, 105, 0.7)';

    if (variant === 'icon-button-compact') {
      // CompactChatInput 样式：IconButton，small size，34x34px
      return (
        <Tooltip title="知识库">
          <IconButton
            size="small"
            onClick={handleKnowledgeClick}
            sx={{
              color: isDarkMode ? '#B0B0B0' : '#555',
              backgroundColor: 'transparent',
              border: '1px solid transparent',
              width: 34,
              height: 34,
              borderRadius: '8px',
              transition: 'all 0.2s ease',
              '&:hover': {
                backgroundColor: `${iconColor}20`,
                borderColor: `${iconColor}50`,
                color: iconColor,
                transform: 'translateY(-1px)',
                boxShadow: `0 2px 8px ${iconColor}20`
              }
            }}
          >
            <BookOpen size={20} />
          </IconButton>
        </Tooltip>
      );
    }

    if (variant === 'icon-button-integrated') {
      // IntegratedChatInput 样式：IconButton，medium size
      return (
        <Tooltip title="知识库">
          <span>
            <IconButton
              size="medium"
              onClick={handleKnowledgeClick}
              disabled={false}
              style={{
                color: isDarkMode ? '#ffffff' : '#000000',
                padding: '6px',
                backgroundColor: 'transparent',
                transition: 'all 0.2s ease-in-out'
              }}
            >
              <BookOpen size={20} />
            </IconButton>
          </span>
        </Tooltip>
      );
    }

    // toolbar 样式：使用原有的 Box 样式（glassmorphism/transparent）
    return (
      <Box
        role="button"
        tabIndex={0}
        aria-label="知识库"
        onClick={handleKnowledgeClick}
        sx={{
          ...currentStyles.button,
          margin: toolbarStyle === 'glassmorphism' ? '0 4px' : '0 2px',
          '&:hover': {
            ...currentStyles.buttonHover
          },
          '&:active': {
            ...currentStyles.buttonActive
          },
          '&:focus': {
            outline: `2px solid ${isDarkMode ? 'rgba(5, 150, 105, 0.8)' : 'rgba(5, 150, 105, 0.6)'}`,
            outlineOffset: '2px',
          }
        }}
        title="知识库"
      >
        {toolbarDisplayStyle !== 'text' && (
          <BookOpen
            size={16}
            color={iconColor}
          />
        )}
        {toolbarDisplayStyle !== 'icon' && (
          <Typography
            variant="body2"
            sx={{
              fontWeight: 600,
              fontSize: '13px',
              color: isDarkMode ? 'rgba(255, 255, 255, 0.9)' : 'rgba(0, 0, 0, 0.8)',
              textShadow: isDarkMode
                ? '0 1px 2px rgba(0, 0, 0, 0.3)'
                : '0 1px 2px rgba(255, 255, 255, 0.8)',
              letterSpacing: '0.01em',
              ml: toolbarDisplayStyle === 'both' ? 0.5 : 0
            }}
          >
            知识库
          </Typography>
        )}
      </Box>
    );
  };

  return (
    <>
      {renderButton()}
      <KnowledgeSelector
        open={showKnowledgeSelector}
        onClose={() => setShowKnowledgeSelector(false)}
        onSelect={handleKnowledgeSelect}
        searchQuery={searchQuery}
      />
    </>
  );
};

export default KnowledgeButton;

