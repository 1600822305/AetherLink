import { alpha } from '@mui/material/styles';
import type { Theme } from '@mui/material/styles';
import type { ThemeStyle } from '../config/themes';

/**
 * 主题工具函数，帮助组件获取主题相关的颜色和样式
 */

// 获取主题适配的颜色
export const getThemeColors = (theme: Theme, themeStyle?: ThemeStyle) => {
  const isDark = theme.palette.mode === 'dark';
  
  // 基础颜色
  const baseColors = {
    primary: theme.palette.primary.main,
    secondary: theme.palette.secondary.main,
    background: theme.palette.background.default,
    paper: theme.palette.background.paper,
    textPrimary: theme.palette.text.primary,
    textSecondary: theme.palette.text.secondary,
    divider: theme.palette.divider,
  };

  // 根据主题风格调整特定颜色
  const styleSpecificColors = {
    // AI消息气泡颜色 - 根据不同主题风格配置
    aiBubbleColor: (() => {
      switch (themeStyle) {
        case 'claude':
          // 修复：使用不透明的背景色，避免"双层"效果
          return isDark ? '#2A1F1A' : '#FEF3E2'; // 深色：深棕色，浅色：浅米色
        case 'minimal':
          return isDark ? 'rgba(30, 30, 30, 0.9)' : 'rgba(255, 255, 255, 0.9)';
        case 'vibrant':
          return isDark ? 'rgba(139, 92, 246, 0.3)' : 'rgba(139, 92, 246, 0.25)';
        default:
          return isDark ? 'rgba(26, 59, 97, 0.9)' : 'rgba(230, 244, 255, 0.9)';
      }
    })(),

    aiBubbleActiveColor: (() => {
      switch (themeStyle) {
        case 'claude':
          // 修复：使用不透明的悬停背景色
          return isDark ? '#3A2B20' : '#FDE8C7'; // 深色：稍亮的深棕色，浅色：稍深的米色
        case 'minimal':
          return isDark ? 'rgba(255, 255, 255, 0.16)' : 'rgba(0, 0, 0, 0.12)';
        case 'vibrant':
          return isDark ? 'rgba(139, 92, 246, 0.25)' : 'rgba(139, 92, 246, 0.2)';
        default:
          return isDark ? '#234b79' : '#d3e9ff';
      }
    })(),

    // 用户消息气泡颜色 - 根据不同主题风格配置
    userBubbleColor: (() => {
      switch (themeStyle) {
        case 'claude':
          // 修复：使用不透明的背景色，避免"双层"效果
          return isDark ? '#1A2E26' : '#E6F7F1'; // 深色：深绿色，浅色：浅绿色
        case 'minimal':
          return isDark ? 'rgba(40, 40, 40, 0.95)' : 'rgba(255, 255, 255, 0.95)';
        case 'vibrant':
          return isDark ? 'rgba(6, 182, 212, 0.4)' : 'rgba(6, 182, 212, 0.35)';
        default:
          return isDark ? 'rgba(51, 51, 51, 0.95)' : 'rgba(227, 242, 253, 0.95)';
      }
    })(),

    // 按钮和交互元素颜色 - 根据主题风格配置
    buttonPrimary: (() => {
      switch (themeStyle) {
        case 'claude': return '#D97706';
        case 'minimal': return '#000000';
        case 'vibrant': return '#8B5CF6';
        default: return theme.palette.primary.main;
      }
    })(),

    buttonSecondary: (() => {
      switch (themeStyle) {
        case 'claude': return '#059669';
        case 'minimal': return '#6B7280';
        case 'vibrant': return '#06B6D4';
        default: return theme.palette.secondary.main;
      }
    })(),

    // 图标颜色
    iconColor: isDark ? '#64B5F6' : '#1976D2',
    iconColorSuccess: '#4CAF50',
    iconColorWarning: '#FF9800',
    iconColorError: '#f44336',
    iconColorInfo: '#2196F3',

    // 悬停和选中状态 - 根据主题风格配置
    hoverColor: (() => {
      switch (themeStyle) {
        case 'claude':
          return isDark ? alpha('#D97706', 0.12) : alpha('#D97706', 0.08);
        case 'minimal':
          return isDark ? alpha('#FFFFFF', 0.08) : alpha('#000000', 0.04);
        case 'vibrant':
          return isDark ? alpha('#8B5CF6', 0.12) : alpha('#8B5CF6', 0.08);
        default:
          return isDark ? alpha(theme.palette.primary.main, 0.12) : alpha(theme.palette.primary.main, 0.08);
      }
    })(),

    selectedColor: (() => {
      switch (themeStyle) {
        case 'claude':
          return isDark ? alpha('#D97706', 0.16) : alpha('#D97706', 0.12);
        case 'minimal':
          return isDark ? alpha('#FFFFFF', 0.12) : alpha('#000000', 0.06);
        case 'vibrant':
          return isDark ? alpha('#8B5CF6', 0.16) : alpha('#8B5CF6', 0.12);
        default:
          return isDark ? alpha(theme.palette.primary.main, 0.16) : alpha(theme.palette.primary.main, 0.12);
      }
    })(),

    // 边框颜色 - 根据主题风格配置
    borderColor: (() => {
      switch (themeStyle) {
        case 'claude':
          return isDark ? alpha('#D97706', 0.2) : alpha('#D97706', 0.1);
        case 'minimal':
          return isDark ? alpha('#FFFFFF', 0.15) : alpha('#000000', 0.1);
        case 'vibrant':
          return isDark ? alpha('#8B5CF6', 0.2) : alpha('#8B5CF6', 0.1);
        default:
          return theme.palette.divider;
      }
    })(),

    // 工具栏样式
    toolbarBg: isDark ? 'rgba(30, 30, 30, 0.85)' : 'rgba(255, 255, 255, 0.85)',
    toolbarBorder: isDark ? 'rgba(60, 60, 60, 0.8)' : 'rgba(230, 230, 230, 0.8)',
    toolbarShadow: isDark ? 'rgba(0,0,0,0.15)' : 'rgba(0,0,0,0.07)',
  };

  return {
    ...baseColors,
    ...styleSpecificColors,
    isDark,
  };
};

// 获取消息样式
export const getMessageStyles = (theme: Theme, themeStyle?: ThemeStyle, isUserMessage: boolean = false) => {
  const colors = getThemeColors(theme, themeStyle);
  
  return {
    backgroundColor: isUserMessage ? colors.userBubbleColor : colors.aiBubbleColor,
    color: colors.textPrimary,
    borderColor: colors.borderColor,
    '&:hover': {
      backgroundColor: isUserMessage 
        ? alpha(colors.userBubbleColor, 0.8)
        : colors.aiBubbleActiveColor,
    },
  };
};

// 获取按钮样式
export const getButtonStyles = (theme: Theme, themeStyle?: ThemeStyle, variant: 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'info' = 'primary') => {
  const colors = getThemeColors(theme, themeStyle);
  
  const colorMap = {
    primary: colors.buttonPrimary,
    secondary: colors.buttonSecondary,
    success: colors.iconColorSuccess,
    warning: colors.iconColorWarning,
    error: colors.iconColorError,
    info: colors.iconColorInfo,
  };

  const baseColor = colorMap[variant];

  return {
    color: baseColor,
    borderColor: alpha(baseColor, 0.5),
    backgroundColor: alpha(baseColor, 0.08),
    '&:hover': {
      backgroundColor: alpha(baseColor, 0.12),
      borderColor: alpha(baseColor, 0.7),
    },
    '&:active': {
      backgroundColor: alpha(baseColor, 0.16),
    },
  };
};

// 获取列表项样式
export const getListItemStyles = (theme: Theme, themeStyle?: ThemeStyle, isSelected: boolean = false) => {
  const colors = getThemeColors(theme, themeStyle);
  
  return {
    backgroundColor: isSelected ? colors.selectedColor : 'transparent',
    '&:hover': {
      backgroundColor: isSelected ? alpha(colors.selectedColor, 1.2) : colors.hoverColor,
    },
    borderRadius: theme.shape.borderRadius,
    marginBottom: 0.5,
  };
};

// 获取输入框样式
export const getInputStyles = (theme: Theme, themeStyle?: ThemeStyle) => {
  const colors = getThemeColors(theme, themeStyle);
  
  return {
    '& .MuiOutlinedInput-root': {
      backgroundColor: colors.paper,
      '& fieldset': {
        borderColor: colors.borderColor,
      },
      '&:hover fieldset': {
        borderColor: alpha(colors.primary, 0.5),
      },
      '&.Mui-focused fieldset': {
        borderColor: colors.primary,
      },
    },
  };
};

// 获取工具栏样式
export const getToolbarStyles = (theme: Theme, themeStyle?: ThemeStyle) => {
  const colors = getThemeColors(theme, themeStyle);
  
  return {
    buttonBg: colors.toolbarBg,
    buttonBorder: colors.toolbarBorder,
    buttonShadow: colors.toolbarShadow,
    hoverBg: colors.isDark ? 'rgba(40, 40, 40, 0.95)' : 'rgba(255, 255, 255, 0.95)',
    hoverShadow: colors.isDark ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.1)',
    borderRadius: '50px',
    backdropFilter: 'blur(5px)',
  };
};

// 获取侧边栏样式
export const getSidebarStyles = (theme: Theme, themeStyle?: ThemeStyle) => {
  const colors = getThemeColors(theme, themeStyle);
  
  return {
    backgroundColor: colors.background,
    borderColor: colors.borderColor,
    itemHoverColor: colors.hoverColor,
    itemSelectedColor: colors.selectedColor,
  };
};

// 检查是否为Claude主题
export const isClaudeTheme = (themeStyle?: ThemeStyle): boolean => {
  return themeStyle === 'claude';
};

// 获取Claude主题特定的样式
export const getClaudeThemeStyles = (theme: Theme) => {
  if (theme.palette.mode === 'dark') {
    return {
      background: '#1C1917',
      paper: '#292524',
      primary: '#D97706',
      secondary: '#059669',
      accent: '#DC2626',
    };
  } else {
    return {
      background: '#FEF7ED',
      paper: '#FFFFFF',
      primary: '#D97706',
      secondary: '#059669',
      accent: '#DC2626',
    };
  }
};
