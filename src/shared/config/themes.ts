import { createTheme } from '@mui/material/styles';
import type { Theme } from '@mui/material/styles';
import { getFontFamilyString } from './fonts';
import { cssVar } from '../utils/cssVariables';
import { createLogger } from '../services/infra/logger';

const logger = createLogger('Themes');

// 主题风格类型
export type ThemeStyle = 'default' | 'claude' | 'nature' | 'tech' | 'soft' | 'ocean' | 'sunset' | 'cinnamonSlate' | 'horizonGreen' | 'cherryCoded';

// 主题配置接口
export interface ThemeConfig {
  name: string;
  description: string;
  colors: {
    primary: string;
    secondary: string;
    accent?: string;
    background: {
      light: string;
      dark: string;
    };
    paper: {
      light: string;
      dark: string;
    };
    text: {
      primary: {
        light: string;
        dark: string;
      };
      secondary: {
        light: string;
        dark: string;
      };
    };
  };
  gradients?: {
    primary: string;
    secondary?: string;
  };
  shadows?: {
    light: string[];
    dark: string[];
  };
}

// 预定义主题配置
export const themeConfigs: Record<ThemeStyle, ThemeConfig> = {
  default: {
    name: '默认主题',
    description: '简洁现代的默认设计风格',
    colors: {
      primary: '#64748B',
      secondary: '#10B981',
      background: {
        light: '#FFFFFF',
        dark: '#1A1A1A', // 统一使用稍微柔和的深灰色
      },
      paper: {
        light: '#FFFFFF',
        dark: '#2A2A2A', // 改为更柔和的深灰色，提高可读性
      },
      text: {
        primary: {
          light: '#1E293B',
          dark: '#F0F0F0', // 改为稍微柔和的白色，提高舒适度
        },
        secondary: {
          light: '#64748B',
          dark: '#B0B0B0', // 提高次要文字的对比度
        },
      },
    },
    gradients: {
      primary: 'linear-gradient(90deg, #9333EA, #754AB4)',
    },
  },

  claude: {
    name: 'Claude 风格',
    description: '温暖优雅的 Claude AI 设计风格',
    colors: {
      primary: '#D97706',
      secondary: '#059669',
      accent: '#DC2626',
      background: {
        light: '#FEF7ED',
        dark: '#1C1917',
      },
      paper: {
        light: '#FEF7ED', // 改为与背景色一致的米色
        dark: '#292524',
      },
      text: {
        primary: {
          light: '#1C1917',
          dark: '#F5F5F4',
        },
        secondary: {
          light: '#78716C',
          dark: '#A8A29E',
        },
      },
    },
    gradients: {
      primary: 'linear-gradient(135deg, #D97706, #EA580C)',
      secondary: 'linear-gradient(135deg, #059669, #047857)',
    },
  },

  nature: {
    name: '自然风格',
    description: '2025年流行的自然系大地色调设计',
    colors: {
      primary: '#2D5016', // 深森林绿
      secondary: '#8B7355', // 大地棕色
      accent: '#C7B299', // 温暖米色
      background: {
        light: '#F7F5F3', // 温暖的米白色背景
        dark: '#1A1F16', // 深绿黑色
      },
      paper: {
        light: '#F7F5F3', // 与背景一致的米白色
        dark: '#252B20', // 深绿灰色
      },
      text: {
        primary: {
          light: '#1A1F16', // 深绿黑色文字
          dark: '#E8E6E3', // 温暖的浅色文字
        },
        secondary: {
          light: '#5D6B47', // 橄榄绿色次要文字
          dark: '#B8B5B0', // 温暖的灰色次要文字
        },
      },
    },
    gradients: {
      primary: 'linear-gradient(135deg, #2D5016, #5D6B47)', // 森林绿渐变
      secondary: 'linear-gradient(135deg, #8B7355, #C7B299)', // 大地色渐变
    },
  },

  tech: {
    name: '未来科技',
    description: '2025年流行的科技感设计，冷色调与玻璃态效果',
    colors: {
      primary: '#3B82F6', // 科技蓝
      secondary: '#8B5CF6', // 紫色
      accent: '#06B6D4', // 青色
      background: {
        light: '#F8FAFC', // 淡蓝白色
        dark: '#0F172A', // 深蓝黑色
      },
      paper: {
        light: '#F8FAFC', // 与背景色一致的淡蓝白色
        dark: '#1E293B', // 深灰蓝色
      },
      text: {
        primary: {
          light: '#0F172A', // 深蓝黑色
          dark: '#F1F5F9', // 淡蓝白色
        },
        secondary: {
          light: '#64748B', // 灰蓝色
          dark: '#94A3B8', // 浅灰蓝色
        },
      },
    },
    gradients: {
      primary: 'linear-gradient(135deg, #3B82F6, #8B5CF6)', // 蓝紫渐变
      secondary: 'linear-gradient(135deg, #06B6D4, #3B82F6)', // 青蓝渐变
    },
  },

  soft: {
    name: '柔和渐变',
    description: '2025年流行的柔和渐变设计，温暖舒适的视觉体验',
    colors: {
      primary: '#EC4899', // 粉红色
      secondary: '#14B8A6', // 青绿色
      accent: '#F59E0B', // 暖橙色
      background: {
        light: '#FDF2F8', // 淡粉色背景
        dark: '#1F1626', // 深紫黑色
      },
      paper: {
        light: '#FDF2F8', // 与背景色一致的淡粉色
        dark: '#2D1B3D', // 深紫色
      },
      text: {
        primary: {
          light: '#1F1626', // 深紫黑色
          dark: '#FCE7F3', // 淡粉色
        },
        secondary: {
          light: '#9F1239', // 深粉红色
          dark: '#F9A8D4', // 浅粉红色
        },
      },
    },
    gradients: {
      primary: 'linear-gradient(135deg, #EC4899, #F472B6)', // 粉红渐变
      secondary: 'linear-gradient(135deg, #14B8A6, #06B6D4)', // 青绿渐变
    },
  },

  ocean: {
    name: '海洋风格',
    description: '2025年流行的海洋蓝绿色系，清新舒适的视觉体验',
    colors: {
      primary: '#0EA5E9', // 天空蓝
      secondary: '#06B6D4', // 青色
      accent: '#14B8A6', // 青绿色
      background: {
        light: '#F0F9FF', // 淡蓝白色
        dark: '#0C1A2E', // 深蓝黑色
      },
      paper: {
        light: '#F0F9FF', // 与背景色一致的淡蓝白色
        dark: '#1E3A5F', // 深蓝色
      },
      text: {
        primary: {
          light: '#0C4A6E', // 深蓝色
          dark: '#E0F2FE', // 淡蓝色
        },
        secondary: {
          light: '#0369A1', // 蓝色
          dark: '#7DD3FC', // 浅蓝色
        },
      },
    },
    gradients: {
      primary: 'linear-gradient(135deg, #0EA5E9, #06B6D4)', // 蓝青渐变
      secondary: 'linear-gradient(135deg, #06B6D4, #14B8A6)', // 青绿渐变
    },
  },

  sunset: {
    name: '日落风格',
    description: '2025年流行的日落色系，温暖浪漫的视觉氛围',
    colors: {
      primary: '#F97316', // 橙色
      secondary: '#FB923C', // 亮橙色
      accent: '#FDE047', // 黄色
      background: {
        light: '#FFF7ED', // 淡橙白色
        dark: '#1C1917', // 深棕黑色
      },
      paper: {
        light: '#FFF7ED', // 与背景色一致的淡橙白色
        dark: '#292524', // 深棕色
      },
      text: {
        primary: {
          light: '#7C2D12', // 深橙棕色
          dark: '#FED7AA', // 淡橙色
        },
        secondary: {
          light: '#C2410C', // 橙棕色
          dark: '#FDBA74', // 浅橙色
        },
      },
    },
    gradients: {
      primary: 'linear-gradient(135deg, #F97316, #FB923C)', // 橙色渐变
      secondary: 'linear-gradient(135deg, #FB923C, #FDE047)', // 橙黄渐变
    },
  },

  cinnamonSlate: {
    name: '肉桂板岩',
    description: '2025年流行趋势：深邃温暖的色调，带来内心的平静',
    colors: {
      primary: '#8B6F5C', // 肉桂棕
      secondary: '#5D4E4A', // 板岩灰
      accent: '#B08968', // 温暖金棕
      background: {
        light: '#F5F1ED', // 淡米白色
        dark: '#1A1614', // 深棕黑色
      },
      paper: {
        light: '#F5F1ED', // 与背景色一致的淡米白色
        dark: '#2B2420', // 深棕灰色
      },
      text: {
        primary: {
          light: '#2B2420', // 深棕色
          dark: '#F0EBE3', // 温暖的浅米色
        },
        secondary: {
          light: '#5D4E4A', // 板岩灰
          dark: '#C4B5A8', // 浅棕灰色
        },
      },
    },
    gradients: {
      primary: 'linear-gradient(135deg, #8B6F5C, #B08968)', // 肉桂渐变
      secondary: 'linear-gradient(135deg, #5D4E4A, #8B7B75)', // 板岩渐变
    },
  },

  horizonGreen: {
    name: '地平线绿',
    description: '2025年日本代表色：带蓝调的绿色，象征希望与自然',
    colors: {
      primary: '#4A9B8E', // 地平线绿
      secondary: '#70B8A8', // 浅绿松石
      accent: '#95D5C8', // 淡薄荷绿
      background: {
        light: '#F5FAF8', // 淡绿白色
        dark: '#0F1B18', // 深绿黑色
      },
      paper: {
        light: '#F5FAF8', // 与背景色一致的淡绿白色
        dark: '#1A2B26', // 深绿灰色
      },
      text: {
        primary: {
          light: '#0F3D34', // 深绿色
          dark: '#E8F5F1', // 淡绿白色
        },
        secondary: {
          light: '#2D6B5E', // 青绿色
          dark: '#A8D5C8', // 浅薄荷绿
        },
      },
    },
    gradients: {
      primary: 'linear-gradient(135deg, #4A9B8E, #70B8A8)', // 绿松石渐变
      secondary: 'linear-gradient(135deg, #70B8A8, #95D5C8)', // 薄荷渐变
    },
  },

  cherryCoded: {
    name: '樱桃编码',
    description: '2025年流行趋势：深樱桃红色，传达热情与活力',
    colors: {
      primary: '#C41E3A', // 樱桃红
      secondary: '#E63E6D', // 玫瑰红
      accent: '#FF6B9D', // 粉红色
      background: {
        light: '#FFF5F7', // 淡粉白色
        dark: '#1A0C0F', // 深红黑色
      },
      paper: {
        light: '#FFF5F7', // 与背景色一致的淡粉白色
        dark: '#2B1418', // 深红棕色
      },
      text: {
        primary: {
          light: '#450A0F', // 深红棕色
          dark: '#FFE8ED', // 淡粉色
        },
        secondary: {
          light: '#78121C', // 深樱桃红
          dark: '#FFB3C6', // 浅粉红色
        },
      },
    },
    gradients: {
      primary: 'linear-gradient(135deg, #C41E3A, #E63E6D)', // 樱桃渐变
      secondary: 'linear-gradient(135deg, #E63E6D, #FF6B9D)', // 玫瑰渐变
    },
  },
};

// 创建主题函数
export const createCustomTheme = (
  mode: 'light' | 'dark',
  themeStyle: ThemeStyle,
  fontSize: number = 16,
  fontFamily: string = 'system'
): Theme => {
  // 容错处理：如果主题配置不存在，使用默认主题
  const config = themeConfigs[themeStyle] || themeConfigs['default'];
  
  // 如果传入的 themeStyle 不存在，输出警告
  if (!themeConfigs[themeStyle]) {
    logger.warn(`主题配置不存在: ${themeStyle}，使用默认主题`);
  }
  
  const fontScale = fontSize / 16;
  const fontFamilyString = getFontFamilyString(fontFamily);

  // 注意：Material-UI 的 palette 不支持 CSS Variables
  // 因为 MUI 需要在 JS 中解析颜色来生成变体
  // 所以这里使用实际的颜色值，而在 components styleOverrides 中使用 CSS Variables
  return createTheme({
    palette: {
      mode,
      primary: {
        main: config.colors.primary,
      },
      secondary: {
        main: config.colors.secondary,
      },
      background: {
        default: config.colors.background[mode],
        paper: config.colors.paper[mode],
      },
      text: {
        primary: config.colors.text.primary[mode],
        secondary: config.colors.text.secondary[mode],
      },
      divider: mode === 'light' ? 'rgba(0, 0, 0, 0.12)' : 'rgba(255, 255, 255, 0.12)',
      error: {
        main: '#EF4444',
      },
      warning: {
        main: '#F59E0B',
      },
      info: {
        main: '#38BDF8',
      },
      success: {
        main: '#10B981',
      },
    },
    typography: {
      fontSize: fontSize,
      fontFamily: fontFamilyString,
      h1: { fontSize: `${2.5 * fontScale}rem` },
      h2: { fontSize: `${2 * fontScale}rem` },
      h3: { fontSize: `${1.75 * fontScale}rem` },
      h4: { fontSize: `${1.5 * fontScale}rem` },
      h5: { fontSize: `${1.25 * fontScale}rem` },
      h6: { fontSize: `${1.125 * fontScale}rem` },
      body1: { fontSize: `${1 * fontScale}rem` },
      body2: { fontSize: `${0.875 * fontScale}rem` },
      caption: { fontSize: `${0.75 * fontScale}rem` },
    },
    shape: {
      borderRadius: 8,
    },
    components: {
      // 全局关闭涟漪效果（所有基于 ButtonBase 的组件：Button/IconButton/Tab/MenuItem 等）
      MuiButtonBase: {
        defaultProps: {
          disableRipple: true,
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
            backgroundColor: cssVar('bg-paper'),
            // 保留主题特定的阴影样式
            ...(themeStyle === 'claude' && {
              boxShadow: mode === 'light'
                ? '0 1px 3px rgba(0, 0, 0, 0.1), 0 1px 2px rgba(0, 0, 0, 0.06)'
                : '0 4px 6px rgba(0, 0, 0, 0.3)',
            }),
            ...(themeStyle === 'nature' && {
              boxShadow: mode === 'light'
                ? '0 2px 4px rgba(45, 80, 22, 0.08), 0 1px 2px rgba(45, 80, 22, 0.04)'
                : '0 4px 8px rgba(0, 0, 0, 0.4)',
            }),
            ...(themeStyle === 'tech' && {
              boxShadow: mode === 'light'
                ? '0 4px 6px rgba(59, 130, 246, 0.1), 0 2px 4px rgba(59, 130, 246, 0.06)'
                : '0 8px 16px rgba(59, 130, 246, 0.2), 0 4px 8px rgba(0, 0, 0, 0.3)',
            }),
            ...(themeStyle === 'soft' && {
              boxShadow: mode === 'light'
                ? '0 2px 8px rgba(236, 72, 153, 0.12), 0 1px 4px rgba(236, 72, 153, 0.08)'
                : '0 4px 12px rgba(236, 72, 153, 0.15), 0 2px 6px rgba(0, 0, 0, 0.3)',
            }),
          },
        },
      },
      MuiButton: {
        styleOverrides: {
          root: {
            textTransform: 'none',
            fontWeight: 600,
            '&.MuiButton-contained': {
              background: cssVar('gradient-primary'),
              '&:hover': {
                background: cssVar('gradient-primary'),
                filter: 'brightness(0.9)',
              },
            },
          },
        },
      },
      MuiAppBar: {
        styleOverrides: {
          root: {
            // 使用 CSS Variables 定义的背景色，添加透明度和模糊效果
            backgroundColor: cssVar('bg-default'),
            backdropFilter: 'blur(12px)',
            // 为特定主题添加半透明效果
            ...(themeStyle !== 'default' && {
              opacity: 0.95,
            }),
            // 🚀 全局适配状态栏安全区域：使用 CSS 变量，由 SafeAreaService 根据平台动态设置
            '&.MuiAppBar-positionFixed, &.MuiAppBar-positionStatic, &.MuiAppBar-positionAbsolute': {
              paddingTop: 'var(--safe-area-top, 0px)',
            },
          },
        },
      },
      MuiToolbar: {
        styleOverrides: {
          root: {
            // 🚀 全局统一 Toolbar 高度为 56px，确保所有页面工具栏高度一致
            minHeight: '56px !important',
            '@media (min-width: 600px)': {
              minHeight: '56px !important', // 覆盖 MUI 在 sm 断点的默认 64px
            },
          },
        },
      },
      MuiDrawer: {
        styleOverrides: {
          paper: {
            backgroundColor: cssVar('sidebar-bg'),
            borderRight: `1px solid ${cssVar('sidebar-border')}`,
          },
        },
      },
      MuiListItemButton: {
        styleOverrides: {
          root: {
            '&:hover': {
              backgroundColor: cssVar('sidebar-item-hover'),
            },
            '&.Mui-selected': {
              backgroundColor: cssVar('sidebar-item-selected'),
              '&:hover': {
                backgroundColor: cssVar('sidebar-item-selected-hover'),
              },
            },
          },
        },
      },
      MuiTextField: {
        styleOverrides: {
          root: {
            '& .MuiOutlinedInput-root': {
              backgroundColor: cssVar('input-bg'),
              '& .MuiOutlinedInput-notchedOutline': {
                borderColor: cssVar('input-border'),
              },
              '&:hover .MuiOutlinedInput-notchedOutline': {
                borderColor: cssVar('input-border-hover'),
              },
              '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                borderColor: cssVar('input-border-focus'),
              },
            },
            '& .MuiInputBase-input': {
              color: cssVar('input-text'),
              '&::placeholder': {
                color: cssVar('input-placeholder'),
                opacity: 0.7,
              },
            },
          },
        },
      },
      // 移除全局Box样式覆盖，避免影响消息内容
      // 添加全局CssBaseline样式覆盖
      MuiCssBaseline: {
        styleOverrides: {
          body: {
            backgroundColor: cssVar('bg-default'),
            color: cssVar('text-primary'),
          },
          '#root': {
            backgroundColor: cssVar('bg-default'),
          },
        },
      },
    },
  });
};

// 获取主题预览颜色
export const getThemePreviewColors = (themeStyle: ThemeStyle) => {
  const config = themeConfigs[themeStyle];
  return {
    primary: config.colors.primary,
    secondary: config.colors.secondary,
    background: config.colors.background.light,
    paper: config.colors.paper.light,
  };
};

// 验证主题风格是否有效
export const isValidThemeStyle = (themeStyle: string): themeStyle is ThemeStyle => {
  return themeStyle in themeConfigs;
};

// 获取有效的主题风格（如果无效则返回默认值）
export const getValidThemeStyle = (themeStyle: string | undefined | null): ThemeStyle => {
  if (!themeStyle || !isValidThemeStyle(themeStyle)) {
    return 'default';
  }
  return themeStyle;
};
