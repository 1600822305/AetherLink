import { useMemo, useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { createCustomTheme, getValidThemeStyle } from '../shared/config/themes';
import { statusBarService } from '../shared/services/platform/StatusBarService';
import { applyCSSVariables } from '../shared/utils/cssVariables';
import { loadSavedCustomFonts } from '../shared/services/ui/GoogleFontsService';
import { createLogger } from '../shared/services/infra/logger';

const logger = createLogger('useTheme');

export const useTheme = () => {
  const [mode, setMode] = useState<'light' | 'dark'>('light');
  const [fontsReady, setFontsReady] = useState(false);

  const themePreference = useSelector((state: any) => state.settings.theme);
  const themeStyleRaw = useSelector((state: any) => state.settings.themeStyle);
  
  // 验证并修正主题风格，避免缓存中的无效值
  const themeStyle = getValidThemeStyle(themeStyleRaw);
  const fontSize = useSelector((state: any) => state.settings.fontSize);
  const fontFamily = useSelector((state: any) => state.settings.fontFamily || 'system');

  // 🎨 加载自定义字体（确保在创建 theme 前完成）
  useEffect(() => {
    loadSavedCustomFonts().then(() => {
      setFontsReady(true);
    });
  }, []);

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

  // 注入 CSS Variables（在主题或模式改变时）
  useEffect(() => {
    try {
      applyCSSVariables(themeStyle, mode);
    } catch (error) {
      logger.error('CSS Variables 注入失败:', error);
      // 如果注入失败，尝试使用默认主题
      try {
        applyCSSVariables('default', mode);
      } catch (fallbackError) {
        logger.error('默认主题注入也失败:', fallbackError);
      }
    }
  }, [mode, themeStyle]);

  // 更新状态栏主题
  useEffect(() => {
    const updateStatusBar = async () => {
      try {
        if (statusBarService.isReady()) {
          await statusBarService.updateTheme(mode, themeStyle);
        }
      } catch (error) {
        logger.error('状态栏主题更新失败:', error);
      }
    };

    updateStatusBar();
  }, [mode, themeStyle]);

  // 创建主题对象 - 使用稳定的依赖
  // fontsReady 作为依赖确保字体加载完成后重新创建 theme
  const theme = useMemo(() => {
    return createCustomTheme(mode, themeStyle, fontSize, fontFamily);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, themeStyle, fontSize, fontFamily, fontsReady]);

  return { theme, mode, fontSize, fontFamily };
};
