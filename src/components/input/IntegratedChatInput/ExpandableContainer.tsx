import React, { useState, useEffect, useCallback } from 'react';
import { IconButton, Tooltip } from '@mui/material';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface ExpandableContainerProps {
  // 基础状态
  message: string;
  isMobile: boolean;
  isTablet: boolean;
  isIOS: boolean;
  isKeyboardVisible: boolean;
  
  // 样式相关
  isDarkMode: boolean;
  iconColor: string;
  themeColors: any;
  inputBoxStyle: string;
  border: string;
  borderRadius: string;
  boxShadow: string;
  
  // 事件处理
  handleChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  
  // 子组件
  children: React.ReactNode;
}

const useExpandableContainer = ({
  message,
  isMobile,
  isTablet,
  isIOS,
  isKeyboardVisible,
  isDarkMode,
  iconColor,
  themeColors,
  inputBoxStyle,
  border,
  borderRadius,
  boxShadow,
  handleChange
}: Omit<ExpandableContainerProps, 'children'>) => {
  // 展开状态管理
  const [expanded, setExpanded] = useState(false);
  const [expandedHeight, setExpandedHeight] = useState(Math.floor(window.innerHeight * 0.7));
  const [showExpandButton, setShowExpandButton] = useState(false);

  // 监听窗口大小变化，更新展开高度
  useEffect(() => {
    const updateExpandedHeight = () => {
      setExpandedHeight(Math.floor(window.innerHeight * 0.7));
    };

    window.addEventListener('resize', updateExpandedHeight);
    return () => window.removeEventListener('resize', updateExpandedHeight);
  }, []);

  // 检测是否需要显示展开按钮和隐藏语音按钮 - 改为基于字数判断
  const checkButtonVisibility = useCallback(() => {
    // 计算文本行数：根据字符数估算行数
    const textLength = message.length;
    const containerWidth = isMobile ? 280 : isTablet ? 400 : 500; // 估算容器宽度
    const charsPerLine = Math.floor(containerWidth / (isTablet ? 17 : 16)); // 根据字体大小估算每行字符数

    // 计算换行符数量
    const newlineCount = (message.match(/\n/g) || []).length;

    // 估算总行数：字符行数 + 换行符行数
    const estimatedLines = Math.ceil(textLength / charsPerLine) + newlineCount;

    if (!expanded) {
      // 当文本超过4行时显示展开按钮
      setShowExpandButton(estimatedLines > 4);
    } else {
      // 展开状态下始终显示展开按钮（用于收起）
      setShowExpandButton(true);
    }
  }, [message, isMobile, isTablet, expanded]);

  // 监听消息内容变化，检测按钮显示状态
  useEffect(() => {
    checkButtonVisibility();
  }, [message, checkButtonVisibility]);

  // 监听展开状态变化
  useEffect(() => {
    // 延迟检测，确保DOM更新完成
    setTimeout(checkButtonVisibility, 100);
  }, [expanded, checkButtonVisibility]);

  // 优化的 handleChange - 移除URL检测，添加防抖机制
  const enhancedHandleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    // 调用 hook 提供的 handleChange
    handleChange(e);
    // 使用防抖延迟检测按钮显示状态，避免频繁计算
    setTimeout(checkButtonVisibility, 100);
  }, [handleChange, checkButtonVisibility]);

  // 展开切换函数
  const handleExpandToggle = useCallback(() => {
    setExpanded(!expanded);
  }, [expanded]);

  // 根据屏幕尺寸调整样式
  const getResponsiveStyles = () => {
    if (isMobile) {
      return {
        paddingTop: '0px',
        paddingBottom: isIOS ? '34px' : '4px', // 为iOS设备增加底部padding
        maxWidth: '100%', // 移动端占满屏幕宽度
        marginTop: '0',
        marginLeft: '0', // 移动端不需要居中边距
        marginRight: '0', // 移动端不需要居中边距
        paddingLeft: '8px', // 使用padding代替margin
        paddingRight: '8px' // 使用padding代替margin
      };
    } else if (isTablet) {
      return {
        paddingTop: '0px',
        paddingBottom: isIOS ? '34px' : '4px', // 为iOS设备增加底部padding
        maxWidth: 'calc(100% - 40px)', // 确保有足够的左右边距
        marginTop: '0',
        marginLeft: 'auto', // 水平居中
        marginRight: 'auto' // 水平居中
      };
    } else {
      return {
        paddingTop: '0px',
        paddingBottom: isIOS ? '34px' : '6px', // 为iOS设备增加底部padding
        maxWidth: 'calc(100% - 32px)', // 确保有足够的左右边距
        marginTop: '0',
        marginLeft: 'auto', // 水平居中
        marginRight: 'auto' // 水平居中
      };
    }
  };

  // 渲染展开按钮
  const renderExpandButton = useCallback(() => {
    if (!showExpandButton) return null;

    return (
      <div style={{
        position: 'absolute',
        top: '4px',
        right: '4px',
        zIndex: 10
      }}>
        <Tooltip title={expanded ? "收起输入框" : "展开输入框"}>
          <IconButton
            onClick={handleExpandToggle}
            size="small"
            style={{
              color: expanded ? '#2196F3' : iconColor,
              padding: '2px',
              width: '20px',
              height: '20px',
              minWidth: '20px',
              backgroundColor: isDarkMode
                ? 'rgba(42, 42, 42, 0.9)'
                : 'rgba(255, 255, 255, 0.9)',
              backdropFilter: 'blur(4px)',
              borderRadius: '6px',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
              transition: 'all 0.2s ease'
            }}
          >
            {expanded ? (
              <ChevronDown size={14} />
            ) : (
              <ChevronUp size={14} />
            )}
          </IconButton>
        </Tooltip>
      </div>
    );
  }, [showExpandButton, expanded, handleExpandToggle, iconColor, isDarkMode]);

  // 渲染容器
  const renderContainer = useCallback((children: React.ReactNode) => {
    const responsiveStyles = getResponsiveStyles();

    return (
      <div
        style={{
          backgroundColor: 'transparent',
          ...responsiveStyles,
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: 'none',
          transition: 'all 0.3s ease',
          marginBottom: isKeyboardVisible ? '0' : (isMobile ? '0' : isTablet ? '0' : '0'),
          paddingBottom: isKeyboardVisible && isMobile ? 'env(safe-area-inset-bottom)' : (isIOS ? '34px' : '0'),
          border: 'none'
        }}
      >
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          padding: isTablet ? '8px 12px' : isMobile ? '6px 8px' : '7px 10px',
          borderRadius: borderRadius,
          background: themeColors.paper,
          border: border,
          minHeight: isTablet ? '72px' : isMobile ? '64px' : '68px',
          boxShadow: boxShadow,
          width: '100%',
          maxWidth: '100%',
          backdropFilter: inputBoxStyle === 'modern' ? 'blur(10px)' : 'none',
          WebkitBackdropFilter: inputBoxStyle === 'modern' ? 'blur(10px)' : 'none',
          transition: 'all 0.3s ease',
          position: 'relative',
          userSelect: 'none',
          WebkitUserSelect: 'none',
          MozUserSelect: 'none',
          msUserSelect: 'none',
          WebkitTouchCallout: 'none',
          WebkitTapHighlightColor: 'transparent'
        }}>
          {renderExpandButton()}
          {children}
        </div>
      </div>
    );
  }, [
    getResponsiveStyles, isKeyboardVisible, isMobile, isTablet, isIOS, themeColors.paper,
    border, boxShadow, inputBoxStyle, renderExpandButton
  ]);

  return {
    expanded,
    expandedHeight,
    showExpandButton,
    enhancedHandleChange,
    handleExpandToggle,
    renderContainer
  };
};

export default useExpandableContainer;
