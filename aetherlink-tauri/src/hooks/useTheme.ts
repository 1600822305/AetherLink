import { useMemo, useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { createCustomTheme } from '../shared/config/themes';
import { statusBarService } from '../shared/services/StatusBarService';

export const useTheme = () => {
  const [mode, setMode] = useState<'light' | 'dark'>('light');

  const themePreference = useSelector((state: any) => state.settings.theme);
  const themeStyle = useSelector((state: any) => state.settings.themeStyle);
  const fontSize = useSelector((state: any) => state.settings.fontSize);
  const fontFamily = useSelector((state: any) => state.settings.fontFamily || 'system');

  // 监听系统主题变化
  useEffect(() => {
    if (themePreference === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const updateMode = (e: MediaQueryListEvent) => setMode(e.matches ? 'dark' : 'light');

      setMode(mediaQuery.matches ? 'dark' : 'light');
      mediaQuery.addEventListener('change', updateMode);

      return () => mediaQuery.removeEventListener('change', updateMode);
    } else {
      setMode(themePreference as 'light' | 'dark');
    }
  }, [themePreference]);

  // 更新状态栏主题
  useEffect(() => {
    const updateStatusBar = async () => {
      try {
        if (statusBarService.isReady()) {
          await statusBarService.updateTheme(mode, themeStyle);
        }
      } catch (error) {
        console.error('状态栏主题更新失败:', error);
      }
    };

    updateStatusBar();
  }, [mode, themeStyle]);

  // 创建主题对象 - 使用稳定的依赖
  const theme = useMemo(() => {
    return createCustomTheme(mode, themeStyle || 'default', fontSize, fontFamily);
  }, [mode, themeStyle, fontSize, fontFamily]);

  return { theme, mode, fontSize, fontFamily };
};
