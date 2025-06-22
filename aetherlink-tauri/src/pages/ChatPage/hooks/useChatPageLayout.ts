import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMediaQuery, useTheme } from '@mui/material';

/**
 * 处理聊天页面布局相关逻辑的钩子
 * 负责响应式布局、导航跳转等功能
 */
export const useChatPageLayout = () => {
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [drawerOpen, setDrawerOpen] = useState(!isMobile);

  // 当屏幕尺寸变化时更新抽屉状态
  useEffect(() => {
    setDrawerOpen(!isMobile);
  }, [isMobile]);

  return {
    isMobile,
    drawerOpen, 
    setDrawerOpen,
    navigate
  };
}; 